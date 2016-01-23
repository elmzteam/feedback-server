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

// Local imports
var logger			= require("./logger");
var db				= require("./db");

if(DEBUG){
	logger.warn("Using debug mode.");
	app.use(require("morgan")("dev"));
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
	var lat = req.params.lat;
	var lon = req.params.lon;
	
	if(lat === undefined || lon === undefined){
		res.status(400).send();
		return;
	}
	
	// todo
	res.status(200).send();
});

app.get("/items", function(req, res){
	var rstId = req.params.restaurant;
	
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