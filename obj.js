var mongo = require("mongod");
var dbPath = "mongodb://localhost:27017/feedback";
var db = mongo.connect(dbPath, ["brains", "users", "restaurants", "items", "sessions", "queries"])
var ObjectId = mongo.ObjectId;

var PriorityQueue = require('priorityqueuejs');

var queue = new PriorityQueue(function(a, b) {
	return a.mag - b.mag;
});


module.exports.handle = function (req, res, next) {
	if (!req.originalUrl.match(/setup\/?$/)) {
		next()
		return
	}
	db.items.find({}, {tastes: 1, _id: 1, name: 1}, function(err, data) {
		for (var i =0 ; i < data.length; i++) {
			queue.enq(variance(data[i]))	
		}
		out = []
		for (var i = 0; i < 100; i++) {
			var z = (queue.deq())
			var x = {name: z.name, _id: z._id}
			if (Math.random() < 0.5) {
				out.push(x)
			}
		}
		res.status(200)
		res.send(out)
	})
}

variance = function(inp) {
	a = ["savory", "salty", "spicy", "sweet", "bitter", "sour"]
	t = 0
	for (var i = 0; i < a.length; i++) {
		var v = inp.tastes[a[i]] 
		t += v*v
	}
	inp.mag = t
	return inp
}

