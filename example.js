var couchbase = require('couchbase'),
	express = require('express'),
	routeAnalysis = require('express-route-analysis'),
	Stats = require('statsjs'),
	util = require('util');

module.exports = function(callback) {
	var cluster = new couchbase.Cluster("couchbase://localhost");
	var bucket = cluster.openBucket('default', function(err) {
		if (err) return callback(err);
		
		var app = express();
		
		app.set('port', process.env.PORT || 3000);
		
		// ...
		
		var stats = routeAnalysis.Stats(app);
		
		var _api = express.Router();
		var api = routeAnalysis.Router(_api);
		
		var _mathService = express.Router();
		var mathService = routeAnalysis.Router(_mathService, function(route, middlewares) {
			return middlewares.filter(function(middleware) {
				if (typeof middleware === 'string') {
					route.data.description = middleware
				} else {
					return true;
				}
			});
		});
		
		mathService.get("/", "Displays routes.", function(req, res) {
			return res.send("<ul>" + mathService.routes.map(function(route) {
				var metrics = route.metrics;
				var timeStats = Stats(metrics.times);
				return util.format("<li><a href='%s'>%s<strong>%s</strong></a>: <em>%s</em> (usage stats / five minutes: %d queries, average %dms, median %dms, %d errors)</li>",
					route.mountpath + route.path,
					route.mountpath,
					route.path,
					route.data.description,
					timeStats.size(),
					timeStats.mean(),
					timeStats.median(),
					metrics.errors.length
				);
			}).join("") + "</ul>");
		});
		
		mathService.get("/random", "Responds a random number in [0, 1[.", function(req, res) {
			return res.json(Math.random());
		});
		
		api.use("/math", mathService);
		
		stats.use("/api", api);
		
		// ...
		
		stats.start(5 * 60 * 1000, function(dt) {
			var document = {};
			
			stats.routes.forEach(function(route) {
				var metrics = route.metrics;
				var timeStats = Stats(metrics.times);
				
				document[route.mountpath + route.path] = {
					requests: metrics.times.length,
					average: timeStats.mean(),
					median: timeStats.median(),
					errors: metrics.errors.length,
					statusCodes: metrics.statusCodes
				};
			});
			
			return bucket.insert("stats/" + Date.now(), document, {
				expiry: 7 * 24 * 60 * 60
			}, function(err) {
				if (err) return console.error(err);
			});
		});
		
		return callback(null, app);
	});
};

if (require.main === module) {
	module.exports(function(err, app) {
		if (err) throw err;
		
		return app.listen(app.get('port'), function() {
			console.log("Listening on port %d in %s env", app.get('port'), app.get('env'));
		});
	});
}
