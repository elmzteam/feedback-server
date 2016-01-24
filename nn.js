var brain = require("brain")

module.exports = function(db) {
	var nn = new NN(db)
	return {
		process: function(user, values) {
			return nn.process(user, values)
		},
		train: function(user) {
			return nn.train(user)
		}
	}
}

var NN = function(db) {
	this.db = db;
}

NN.prototype = {
	getNet: function(user) {
		var that = this
		return new closedPromise(that, user, function(resolve, reject, that, user) {
			that.db.brains.find({user: user}, function(err, doc) {
				if (err) {
					reject(err)
				} else if (!doc || doc.length == 0) {
					resolve(new brain.NeuralNetwork())
				} else {
					resolve(new brain.NeuralNetwork().fromJSON(doc[0].brain))
				}
			})
		})
	},
	saveNet: function(user, net) {
		var that = this
		return new closedPromise(that, user, net, function(resolve, reject, that, user, net) {
			that.db.brains.update({user: user}, {user: user, brain: net.toJSON()}, {upsert: true}, function(err) {
				if (err) {
					reject(err)
				} else {
					resolve()
				}
			})
		})
	},
	getIOPair: function(item, pref) {
		var that = this
		return closedPromise(item, pref, that, function(resolve, reject, item, pref, that) {
			that.db.items.findOne({_id: item}, (function(pref) {
				return function(err, doc) {
					if (err) {
						reject(err)
						return
					}
					resolve({input: doc[0].tastes, output: {pref: pref}})
				}
			})(pref))
		})
	},
	process: function(user, values) {
		return this.getNet(user).then((function(user,values) { 
			return function(net) {
				for (var i = 0; i < values.length; i++) {
					if (net.weights) {
						values[i].preference = net.run(values[i].tastes).pref
					} else {
						values[i].preference = 0
					}
				}
				return Promise.resolve(values)
			}
		})(user, values))
	},
	train: function(user) {
		var that = this
		return closedPromise(user, that, function(resolve, reject, user, that) {
			that.db.prefs.find({user: user}, function(err, docs) {
				if (err) {
					reject(err)
				}
				var all = []
				for (var id = 0; id < docs.length; id++) {
					all.push(that.getIOPair(docs[id].item, docs[id].rating))
				}
				return Promise.all(all).then((function(that, user) {
					return function(data) {
						return that.getNet(user).then((function(data, that, user) {
							return function(net) {
								net.train(data)
								return that.saveNet(user, net)
							}
						})(data, that, user))
					}
				})(that, user))
			})
		})
	}
}

var closedPromise = function() {
	return (new Promise((function (objargs) {
		return function(resolve, reject) {
			var args = []
			for (var i = 0; i < objargs.length; i++) {
				args[i] = objargs[i]
			}
			var fn = args[args.length - 1]
			var argmts = args.slice(0, -1)
			argmts = ([resolve, reject]).concat(argmts)
			fn.apply(fn, argmts)
		}
	})(arguments))).catch(function(err) {
		console.log(err.stack || err)
	})
}
