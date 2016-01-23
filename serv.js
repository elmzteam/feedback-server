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

// Local imports
var logger			= require("./logger");
var db				= require("./db");

if(DEBUG){
	logger.warn("Using debug mode.");
	app.use(require("morgan")("dev"));
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

// Helper Function

var verify = function(session, user) {
	return db.find("sessions", {session: session}).then(function(docs) {
		if (!docs || !docs[0]) {
			return Promise.reject()
		}
		return db.find("users", {_id: docs[0].user}).then(function(docs) {
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
