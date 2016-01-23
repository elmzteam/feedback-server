"use strict";

// Initial imports
var nconf			= require("nconf");
var Promise			= require("promise");

// Constants
nconf.argv().env();

var DEBUG			= nconf.get("debug");							// Whether or not the server is in debug mode
var PORT			= nconf.get("port") || 8080;					// The socket on which to run the server

// Express imports and server setup
var express			= require("express");
var app				= express();

app.use(require("body-parser").json());
var http = require("http").Server(app);

// Node imports
var crypto			= require("crypto");

// API imports
var Yelp			= require("yelp");

// Local imports
var logger			= require("./logger");
var db				= require("./db");

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

// API methods

app.get("/user", function(req, res){
	// todo
	res.status(200).send();
});

app.post("/user", function(req, res){
	// todo
	res.status(200).send();
});

app.get("/restaurants", function(req, res){
	var lat = req.query.lat;
	var lon = req.query.lon;

	if(lat === undefined || lon === undefined){
		res.status(400).send();
		return;
	}
	
	if(!yelp){
		rest.status(500).send();
		return;
	}

	// todo: check if you *actually* need to query yelp, query more than 20 locations from yelp, cache results
	
	yelp.search({
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
			}
		});
	}).then(function(data){
		// you'll want to cache all of the grabbed restaurants here; searching by 'location' (lat/lon) would be the most applicable
		res.status(200).send(data);	
	}).catch(function(err){
		console.log(err);
		res.status(500).send();
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

// Start the server

http.listen(PORT, function(){
	logger.info("Listening on *:" + PORT);
});