"use strict";

// Initial imports
var nconf			= require("nconf");
var Promise			= require("promise");

// Constants
nconf.argv().env();

var DEBUG			= nconf.get("debug");							// Whether or not the server is in debug mode
var PORT			= nconf.get("port") || 8080;						// The socket on which to run the server

// Express imports and server setup
var express			= require("express");
var app				= express();
var cookieParser                = require('cookie-parser')
app.use(cookieParser())

// Node imports
var crypto			= require("crypto");
var geolib			= require("geolib");

// API imports
var Yelp			= require("yelp");
var instagram		= require("instagram-node").instagram();
var Locu			= require("./locu");
var yummly			= require("./yummly");

// Local imports
var logger			= require("./logger");
var db				= require("./db");

var nn 				= require("./nn")(db.raw);

db.raw.restaurants.createIndex({location: "2dsphere"})
db.raw.queries.createIndex({location: "2dsphere"})
db.raw.queries.createIndex({timestamp: 1}, {expireAfterSeconds: 300000})
db.raw.items.createIndex({name: "text"})

if(DEBUG){
	logger.warn("Using debug mode.");
	app.use(require("morgan")("dev"));
}

if(nconf.get("YELP_CONSUMER_KEY") && nconf.get("YELP_CONSUMER_SECRET") && nconf.get("YELP_TOKEN") && nconf.get("YELP_TOKEN_SECRET")){
	var yelp = new Yelp({
		consumer_key: nconf.get("YELP_CONSUMER_KEY"),
		consumer_secret: nconf.get("YELP_CONSUMER_SECRET"),
		token: nconf.get("YELP_TOKEN"),
		token_secret: nconf.get("YELP_TOKEN_SECRET")
	});
} else {
	logger.error("FATAL: Yelp credentials missing or incomplete.");
	process.exit(1);
}

if(nconf.get("INSTAGRAM_ACCESS_TOKEN")){
	instagram.use({access_token: nconf.get("INSTAGRAM_ACCESS_TOKEN")});
	var igSearch = Promise.denodeify(instagram.media_search);
} else {
	logger.error("FATAL: Instagram credentials missing or incomplete.");
	process.exit(1);
}

if(nconf.get("LOCU_API_KEY")){
	var locu = new Locu.VenueClient(nconf.get("LOCU_API_KEY"));
	var locuSearch = Promise.denodeify(locu.search).bind(locu);
} else {
	logger.error("FATAL: Locu credentials missing or incomplete.");
	process.exit(1);
}

if(nconf.get("YUMMLY_APP_ID") && nconf.get("YUMMLY_API_KEY")){
	var yummlySearch = Promise.denodeify(function(query, cb){
		yummly.search(query, function(err, response, data){
			cb(err, data)
		})
	});
	var yummlyAuth = {
		id: nconf.get("YUMMLY_APP_ID"),
		key: nconf.get("YUMMLY_API_KEY")
	};
} else {
	logger.error("FATAL: Yummly credentials missing or incomplete.");
	process.exit(1);
}

app.use(require("body-parser").json());
var http = require("http").Server(app);

// API methods

app.post("/register", function(req, res) {
	var username = req.body.user;
	var pass     = req.body.password;
	var email    = req.body.email;

	if(username === undefined || pass === undefined || email === undefined){
		res.status(400).send({error: "Need username, password, and email"});
		return;
	}

	db.find("users", {"$or": [{username: username}, {email: email}] }).then(function(doc) {
		if (doc && doc[0]) {
			res.status(403)
			if (doc[0].username == username) {
				res.send({error: "User Already Exists"})
			} else {
				res.send({error: "Email Already Exists"})
			}
			return Promise.resolve(false)
		} else {
			return db.insert("users", {
				username: username,
				password: hash(pass),
				email: email,
			})
		}
	}).then(function(skip) {
		if (skip === false) {
			return Promise.resolve(false)
		}
		return random().then(function(bytes) {
			return db.find("users", {username: username}).then(function(doc) {
				return db.insert("sessions", {
					user: doc[0]._id,
					session: bytes,
				}).then(function() {
					res.status(201)
					res.cookie("session", bytes)
					res.cookie("user", username)
					res.send({
						session: bytes
					})
					return Promise.resolve()
				})
			})
		})
	}).catch(function(err) {
		res.status(500)
		res.send({error: "Shit"})
		logger.error(err.stack || err)
	})
})

app.post("/login", function(req, res) {
	var username = req.body.user;
	var pass     = req.body.password;

	if(username === undefined || pass === undefined){
		res.status(400).send({error: "Need username and password"});
		return;
	}

	db.find("users", {username: username, password: hash(pass)}).then(function(doc) {
		if (!doc || !doc[0]) {
			res.status(401)
			res.send({error: "Login Failed"})
		} else {
			return random().then(function(bytes) {
				return db.insert("sessions", {
					user: doc[0]._id,
					session: bytes,
				}).then(function() {
					res.status(201)
					res.cookie("session", bytes)
					res.cookie("user", username)
					res.send({
						session: bytes
					})
					return Promise.resolve()
				})
			})
		}
	}).catch(function(err) {
		res.status(500)
		res.send({error: "Oops"})
		logger.error(err)
	})
})

app.use(function(req, res, next) {
	var user = req.headers.user
	var session = req.headers.session
	var csession = req.cookies.session
	var cuser = req.cookies.user
	verify(session || csession, user || cuser).then(function() {
		next()
	}).catch(function(err) {
		if (err) {
			res.status(500)
			res.send({error: "Well shoot"})
			logger.error(err)
		} else {
			res.status(401)
			res.send({error: "Unauthorized"})
		}
	})
})

app.get("/user", function(req, res){
	// todo
	res.status(200).send();
});

app.post("/user", function(req, res){
	// todo
	res.status(200).send();
});

app.get("/restaurants", function(req, res){
	var lat = parseFloat(req.query.lat);
	var lon = parseFloat(req.query.lon);

	if(isNaN(lat) || isNaN(lon)){
		res.status(400).send({error: "No location given"});
		return;
	}

	if(!yelp || !igSearch){
		res.status(500).send({error: "Not Configured"});
		return;
	}

	var query = {
		location: {
			"$near" : {
				"$geometry" : {
					"type" : "Point",
					"coordinates" : [
						lon,
						lat
					]
				},
				"$maxDistance" : 2000,
				"$minDistance" : 0
			}
		}
	}

	db.findOne("queries", query).then(function(doc) {
		if (doc) {
			query["location"]["$near"]["$maxDistance"] = 10000;
			return db.find("restaurants", query).then(function(result) {
				if (result) {
					res.status(200)
					res.send(result)
				}
			})
		}
		if (!doc) {
			var yelpData = yelp.search({
				term: "food",
				ll: lat + "," + lon,
				limit: 20,
				sort: 1
			}).then(function(data){
				return data.businesses.map(function(el){
					return {
						name: el.name,
						distance: el.distance,
						categories: el.categories.map(function(cat){
							return cat[0];
						}).join(", "),
						address: el.location.address[0],
						location: el.location.coordinate
					};
				});
			});

			var locuData = yelpData.then(function(data){
				console.log(data)
				return locuSearch({
					fields: ["name", "menus", "location"],
					venue_queries: 
					[
						{
							location: {
								geo: {
									"$in_lat_lng_radius": [lat, lon, data[data.length-1].distance + 100]
								}
							},
							menus: {
								"$present": true
							}
						}
					]
				});
			}).then(function(data){
				return data.venues;
			});

			var igData = yelpData.then(function(data){
				return Promise.all(data.map(function(el){
					return igSearch(el.location.latitude, el.location.longitude, {min_timestamp: 0, distance: 30});
				}));
			}).then(function(data){
				return data.map(function(el){
					return el.map(function(photo){
						if(photo.type != "image"){
							return null;
						}
						var matched = false;
						for(var i = 0; i < photo.tags.length; i++){
							if(photo.tags[i].includes("food")){
								matched = true;
								break;
							}
						}
						return matched ? photo : null;
					}).reduce(function(acc, el){
						if(el != null){
							acc.push(el.images.standard_resolution.url);
						}
						return acc;
					}, []);
				})
			});

			return Promise.all([yelpData, igData, locuData]).then(function(data){
				var images = data[1];
				var menus = data[2]
				data = data[0];

				var all = []
				
				for(var i = 0; i < data.length; i++) {
					data[i].images = (images[i] ? images[i].slice(0, 6) : []);
					data[i].menu = [];
					var added = false
					for(var j = 0; j < menus.length; j++){
						var titleWords = menus[j].name.split(" ");
						var ignoreWords = ["The", "the", "a", "A", "of", "Of"];
						var cntOverlap = 0;
						for (var n = 0; n < titleWords.length; n++){
							var ignore = false;
							for (var jp = 0; jp < ignoreWords.length; jp++) {
								if (titleWords[n].indexOf(ignoreWords[jp]) >= 0) {
									ignore = true;
								}
								if (data[i].name.split(" ").indexOf(titleWords[n]) >= 0 && !ignore){
									cntOverlap++;
								}
							}
						}
						if (cntOverlap != 0) {
							console.log("Attempting to conflate "+data[i].name+" and "+menus[j].name)
							console.log("They share a geolib distance of "+geolib.getDistance(menus[j].location.geo.coordinates, data[i].location))
						}
						if(menus[j].menus.length > 0 && geolib.getDistance(menus[j].location.geo.coordinates, data[i].location) <= 100 && cntOverlap != 0){
							all.push((function(data, i) {
								return insertMenu(data[i], menus[j].menus[0]).then(function(ids) {
									data[i].menu = ids ;//menus[j].menus[0];
									return Promise.resolve(data[i]);
								}).then(function(obj) {
									return cache(obj).then(function() {
										return Promise.resolve(data[i])
									})
								}).catch(function(err) {
									logger.error(err.stack)
								})
							})(data, i))
							added = true
							break;
						}
					}
					if (!added) {
						all.push((function(data, i) {
							return cache(data[i]).then(function() {
								return Promise.resolve(data[i])
							})
						})(data,i))
					}
				}

				db.insert("queries", {
					timestamp: Date.now(), 
					location: {
						type: "Point",
						coordinates: [lon, lat]
					}
				});
				Promise.all(all).then(function(dati) {
					res.status(200).send(dati);	
				})
			})
		}
	}).catch(function(err){
		logger.error(err);
		logger.error(err.stack);
		res.status(500).send({error: "lolwut"});
	})

});

app.post("/item/", function(req, res) {
	var item = req.body.name
	var rest = req.body.restaurant
	var user = req.headers.user

	if (item == undefined || rest == undefined) {
		res.status(400)
		res.send({error: "Please send a restaurant id and search string"})
		return
	}
	db.find("items", {$text: {$search: "\""+item+"\""}}).then(function(docs) {
		if (docs.length > 0) {
			return nn.process(user, docs).then(function(docs) {
				res.status(200)
				res.send(docs[0])
				return Promise.resolve(docs[0]._id)
			})		
		} else {
			return addItem(item).then(function(doc) {
				doc.name = item
				res.status(200)
				res.send(doc)
				return db.insert("items", doc).next(function(doc) {
					console.log(doc)
					return nn.process(user, doc).then(function(docs) {
						res.status(200)
						res.send(docs[0])
						return Promise.resolve(doc[0]._id)
					})
				})
			})
		}
	}).then(function(id) {
		return db.update("restaurants", {_id: db.ObjectId(rest)}, {$addToSet: {menu: id}})
	}).catch(function(err) {
		res.status(500)
		res.send({error: "So that happened"})
		logger.error(err.stack || err)
	})
})

app.get("/items/:RSTR", function(req, res){
	var items = req.params.RSTR;
	var user  = req.headers.user;

	if(items === undefined){
		res.status(400).send({error: "Please Pass 'restaurant'"});
		return;
	}
	
	db.findOne("restaurants", {_id: db.ObjectId(items)}).then(function(doc) {
		if (!doc) {
			res.status(404)
			res.send({error: "Invalid Item"})
			return Promise.resolve()
		}
		if (doc.menu.length == 0) {
			res.status(200)
			res.send([])
			return Promise.resolve()
		}
		console.log(doc.menu)
		return db.raw.items.find( {_id: {$in: doc.menu}}, { ingredients: 0}).then(function(docs) {
			return nn.process(user, docs).then(function(docs) {
				return Promise.all(docs.map(function(e) {
					return fetchLike(e, user)
				})).then(function(docs) {
					res.status(200)
					res.send(docs)
				})
			})
		})
	}).catch(function(err) {
		logger.error(err.stack || err)
		res.status(500)
		res.send({error: "00ps"})
	})
})

app.put("/rating", function(req, res){
	var rstId = req.body.restaurant;
	var itmId = req.body.item;
	var rating = req.body.rating;
	var user = req.headers.user;

	if(itmId === undefined || rating === undefined){
		res.status(400).send({error: "Please Provide rating and item"});
		return;
	}

	console.log(itmId)
	console.log(rstId)
	db.find("items",{_id: db.ObjectId(itmId)}).then(function(doc) {
		if (!doc) {
			res.status(404).send({error: "Please specify valid item"})
			return Promise.resolve()
		}
		var page = {
			user: req.headers.user,
			item: db.ObjectId(itmId),
			rating: rating,
		}
		if (rstId) {
			page.restaurant = db.ObjectId(rstId)
		}
		return db.insert("prefs", page).then(function() {
			res.status(200).send()
		})
	}).then((function (user) {
		return function() {
			return nn.train(user)
		}
	})(user)).catch(function(err) {
		res.status(500)
		res.send({error: "Khannnnnnn"})
		logger.error(err.stack || err)
	})

})


// Helper Functions

var insertMenu = function(rest, menu) {
	if (!menu) {
		return Promise.resolve([])
	}
	var out = []
	for (var s = 0; s < menu.sections.length; s++) {
		var sec = menu.sections[s]
		for (var ss = 0; ss < sec.subsections.length; ss++) {
			var subsec = sec.subsections[ss]
			for (var c = 0; c < subsec.contents.length; c++) {
				var cont = subsec.contents[c]
				if (cont.type == "ITEM") {
					out.push((function (cont) {
						return db.findOne("items", {name: cont.name}).then(function (doc) {
							if (doc) {
								return db.update("items", {name: cont.name}, {
									$addToSet: {description: {
										$each: csvSplit(cont.description)
									}}
								})
							}
							return addItem(cont.name).then(function(data) {
								return db.insert("items", {
									name: cont.name,
									ingredients: data.ingredients,
									tastes: data.tastes,
									description: csvSplit(cont.description)
								})
							})
						}).then(function() {
							return fetchID("items", {name: cont.name})
						}).catch(function(err) {
							logger.error(err)
						})
					})(cont))
				}
			}
		}
	}
	return Promise.all(out);
}

var fetchLike = function(item, user) {
	return db.find("prefs", {item: item._id, user: user}).then(function(docs) {
		if (!docs || docs.length == 0) return Promise.resolve(item) 
		item.rating = docs[0].rating
		return Promise.resolve(item)
	})
}

var fetchID = function(coll, query) {
	return db.findOne(coll, query).then(function(doc) {
		if (!doc) {
			return Promise.resolve([])
		}
		return Promise.resolve(doc._id)
	})
}

var csvSplit = function(str) {
	return regexGroup(/[ \t\n]*([^,]*),/g, str, 1)
}

var regexGroup = function(regex, string, choice) {
	var out = []
	var match = regex.exec(string)
	while (match != null) {
		out.push(match[choice])
		match = regex.exec(string)
	}
	return out;
}

var cache = function(rest) {
	var temp = rest
	temp.location = {
		type: "Point",
		coordinates: [
			rest.location.longitude,
			rest.location.latitude,
		]
	}
	return db.findOne("restaurants", {name: temp.name, location: temp.location}).then(function(doc) {
		if (!doc) {
			return db.insert("restaurants", temp)
		}
	}).catch(function(err) {
		logger.error("Well that shouldn't happen")
		logger.error(err)
	})
}

var verify = function(session, user) {
	return db.findOne("sessions", {session: session}).then(function(docs) {
		if (!docs) {
			return Promise.reject()
		}
		return db.findOne("users", {_id: docs.user}).then(function(docs) {
			if (docs.username === user) {
				return Promise.resolve()
			} else {
				return Promise.reject()
			}
		})
	})
}

var hash = function(val) {
	var hash = crypto.createHash("sha256")
	hash.update(val)
	return hash.digest("hex");
}

var random = function() {
	return new Promise(function(resolve, reject) {
		crypto.randomBytes(32, function(err, buf) {
			if (err) reject(err)
			else resolve(buf.toString("hex"))
				})
	})
}

var addItem = function(itemName){
	return Promise.all([
		yummlySearch({credentials: yummlyAuth, query: {q: itemName, maxResult: 10, start: 0}}),
		//yummlySearch({credentials: yummlyAuth, query: {q: itemName, maxResult: 10, start: 10}}),
		//yummlySearch({credentials: yummlyAuth, query: {q: itemName, maxResult: 10, start: 20}}),
		//yummlySearch({credentials: yummlyAuth, query: {q: itemName, maxResult: 10, start: 30}})
	]).then(function(data){
		return data.reduce(function(acc, el){
			return acc.concat(el.matches);
		}, []);
	}).then(function(recipes){
		var ingredients = {};
		var tastes = {
			savory: 0,
			spicy: 0,
			sweet: 0,
			sour: 0,
			bitter: 0,
			salty: 0
		};
		var tastesCnt = 1;
		var tasteMapping = {
			savory: "savory",
			spicy: "spicy",
			sweet: "sweet",
			sour: "sour",
			bitter: "bitter",
			salty: "salty",
			piquant: "spicy",
			meaty: "savory"
		};

		for(var i = 0; i < recipes.length; i++){
			for(var j = 0; j < recipes[i].ingredients.length; j++){
				if(!(recipes[i].ingredients[j] in ingredients)){
					ingredients[recipes[i].ingredients[j]] = 0;
				}
				ingredients[recipes[i].ingredients[j]]++;
			}

			if(recipes[i].flavors != null){
				tastesCnt++;
				for(var taste in recipes[i].flavors){
					tastes[tasteMapping[taste]] += recipes[i].flavors[taste];
				}
			}
		}

		for(var ingredient in ingredients){
			ingredients[ingredient] /= recipes.length;
		}

		for(var taste in tastes){
			tastes[taste] /= tastesCnt;
		}

		return Promise.resolve({
			tastes: tastes,
			ingredients: ingredients
		})
	});
}

// testing only
app.get("/about", function(req, res){
	addItem(req.query.item)
		.then(function(item){
		res.status(200).send(item);
	})
		.catch(function(err){
		logger.error(err);
		logger.error(err.stack);
		res.status(500).send("u wot 8");
	})
});

// Start the server

http.listen(PORT, function(){
	logger.info("Listening on *:" + PORT);
});
