var mongo = require("mongod");
var dbPath = "mongodb://localhost:27017/feedback";
var db = mongo.connect(dbPath, ["brains", "users", "restaurants", "items", "sessions", "queries"])
var ObjectId = mongo.ObjectId;

var brain = require("brain")
var net = new brain.NeuralNetwork()

var prompt = require("prompt")
prompt.start()
prompt.colors = false

var p = []
var n = []
db.items.find({}, {_id: 0, ingredients: 0}).limit(30, function(err, val) {
	for (var i = 0; i < val.length; i++) {
		p.push(val[i].name)	
	}
	f(val)
})


function f(val) {
	prompt.get(p, function(err, res) {
		n = []
		for (var i = 0; i < val.length; i++) {
			n.push({input: val[i].tastes, output: {favor: res[val[i].name] == "y" ? 1 : 0}}) 
		}
		net.train(n)
		db.items.find({}, {_id: 0, ingredients: 0}).skip(30).limit(20, function(err, val) {
			for (var i = 0; i < val.length; i++) {
				var str = "Maybe."
				var r   = net.run(val[i].tastes).favor
				if (r > 0.75) {
					str = "Probably."
				}
				if (r < 0.25) {
					str = "Doubtful."
				}
				console.log("Do you like "+val[i].name+"? "+str)
			}
		})
		f(val)
	})
}

