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


// Node imports
var crypto			= require("crypto");

// API imports
var Yelp			= require("yelp");
var instagram		= require("instagram-node").instagram();

// Local imports
var logger			= require("./logger");
var db				= require("./db");
db.raw.restaurants.createIndex({location: "2dsphere"})

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
	logger.warn("Yelp credentials missing or incomplete.  Will not be able to pull Yelp data.");
}


if(nconf.get("INSTAGRAM_ACCESS_TOKEN")){
	instagram.use({access_token: nconf.get("INSTAGRAM_ACCESS_TOKEN")});
	var igSearch = Promise.denodeify(instagram.media_search);
} else {
	logger.warn("Instagram credentials missing or incomplete.  Will not be able to pull Instagram data.");
}

app.use(require("body-parser").json());
var http = require("http").Server(app);

// API methods

app.post("/register", function(req, res) {
	var username = req.body.user;
	var pass     = req.body.password;
	var email    = req.body.email;
	db.find("users", {"$or": [{username: username}, {email: email}] }).then(function(doc) {
		if (doc && doc[0]) {
			res.status(403)
			if (doc[0].username == username) {
				res.send({error: "User Already Exists"})
			} else {
				res.send({error: "Email Already Exists"})
			}
		} else {
			return db.insert("users", {
				username: username,
				password: hash(pass),
				email: email,
			})
		}
	}).then(function() {
		res.status(201)
		res.send({message: "Created"})
	}).catch(function(err) {
		res.status(500)
		res.send({error: "Shit"})
		logger.error(err)
	})
})

app.post("/login", function(req, res) {
	var username = req.body.user;
	var pass     = req.body.password;
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
	verify(session, user).then(function() {
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

	// todo: check if you *actually* need to query yelp, query more than 20 locations from yelp, cache results
	
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
	
	var igData = yelpData.then(function(data){
		return Promise.all(data.map(function(el){
			return igSearch(el.location.latitude, el.location.longitude, {min_timestamp: 0, distance: 20});
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
					acc.push(el.link);
				}
				return acc;
			}, []);
		});
	});
	
	Promise.all([yelpData, igData]).then(function(data){
		var images = data[1];
		data = data[0];
		// you'll want to cache all of the grabbed restaurants here; searching by 'location' (lat/lon) would be the most applicable
		for(var i = 0; i < data.length; i++){
			data[i].images = (images[i] ? images[i].slice(0, 6) : []);
			cache(data[i])
		}
		res.status(200).send(data);	
	}).catch(function(err){
		logger.error(err)
		console.log(err)
		res.status(500).send({error: "Hehe, my b"});
	})
});

app.get("/items", function(req, res){
	var rstId = req.query.restaurant;

	if(rstId === undefined){
		res.status(400).send();
		return;
	}

	// todo
	res.status(200).send();
})

app.put("/rating", function(req, res){
	var rstId = req.body.restaurant;
	var itmId = req.body.item;
	var rating = req.body.rating;

	if(rstId === undefined || itmId === undefined || rating === undefined){
		res.status(400).send();
		return;
	}

	// todo
	res.status(200).send();
})

// Helper Functions

var cache = function(rest) {
	var temp = rest
	temp.location = {
		type: "point",
		coordinate: [
			rest.location.latitude,
			rest.location.longitude
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

// Start the server

http.listen(PORT, function(){
	logger.info("Listening on *:" + PORT);
});
