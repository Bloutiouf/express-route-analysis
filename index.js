var methods = require('methods').concat('all');

exports.delay = delay;
exports.mayFail = mayFail;
exports.Router = Router;
exports.Stats = Stats;

function delay(time) {
	return function(req, res, next) {
		return setTimeout(next, time);
	};
}

function mayFail(ratio, statusCode) {
	return function(req, res, next) {
		if (Math.random() < ratio)
			return res.sendStatus(statusCode || 503);
		return next();
	};
}

function generateUse(_router, routes) {
	return function(fn) {
		var offset = 0;
		var mountpath = '';
		
		if (typeof fn !== 'function') {
			offset = 1;
			mountpath = fn;
		}
		
		Array.prototype.slice.call(arguments, offset).forEach(function(router) {
			if (router.name === 'routeAnalyzer') {
				router.log();
				return router.routes.forEach(function(route) {
					route.mountpath = mountpath + route.mountpath;
					routes.push(route);
				});
			}
		});
		
		return _router.use.apply(_router, arguments);
	}
}

function Router(_router, callback) {
	var logging = false;
	
	function routeAnalyzer(req, res, next) {
		function log(err, time) {
			var reqPath = req.route.path;
			var reqMethod = req.method.toLowerCase();
			return routes.some(function(route) {
				if (route.path === reqPath && (route.method === reqMethod || route.method === 'all')) {
					var metrics = route._metrics;
					metrics.times.push(time);
					
					if (err)
						metrics.errors.push(err);
					
					var statusCode = res.statusCode;
					if (metrics.statusCodes.hasOwnProperty(statusCode))
						++metrics.statusCodes[statusCode];
					else
						metrics.statusCodes[statusCode] = 1;
					
					return true;
				}
			});
		}
		
		var start = Date.now();
		
		var end = res.end;
		res.end = function() {
			var time = Date.now() - start;
			end.apply(res, arguments);
			if (logging)
				return log(null, time);
		};
		
		return _router.handle(req, res, function(err) {
			var time = Date.now() - start;
			res.end = end;
			next(err);
			if (err && logging)
				return log(err, time);
		});
	}
	
	routeAnalyzer.log = function() {
		logging = true;
	};
	
	var routes = [];
	routeAnalyzer.routes = routes;
	
	function defineProperty(prop) {
		return Object.defineProperty(routeAnalyzer, prop, {
			get: function() { return _router[prop]; },
			set: function(newValue) { _router[prop] = newValue; },
			enumerable: true,
			configurable: true
		});
	}
	
	for (var prop in _router) {
		var type = typeof _router[prop];
		if (type === 'function')
			routeAnalyzer[prop] = _router[prop].bind(_router);
		else if (type === 'object' && type)
			routeAnalyzer[prop] = _router[prop];
		else
			defineProperty(prop);
	}
	
	function filterMiddleware(path, method, middlewares) {
		var route = {
			mountpath: '',
			path: path,
			method: method,
			data: {}
		};
		routes.push(route);
		
		if (callback)
			return callback(route, middlewares);
		return middlewares;
	}
	
	methods.forEach(function(method) {
		routeAnalyzer[method] = function(path) {
			var args = filterMiddleware(path, method, Array.prototype.slice.call(arguments, 1));
			args.unshift(path);
			return _router[method].apply(_router, args);
		};
	});
	
	routeAnalyzer.use = generateUse(_router, routes);
	
	return routeAnalyzer;
}

function Stats(app) {
	var lastTime = Date.now();
	
	var routes = [];
	
	var intervalId;
	
	function newMetrics() {
		return {
			errors: [],
			statusCodes: {},
			times: []
		};
	}
	
	return {
		routes: routes,
		
		start: function(interval, callback) {
			routes.forEach(function(route) {
				route.metrics = newMetrics();
				route._metrics = newMetrics();
			});
					
			function shift() {
				var time = Date.now();
				var dt = time - lastTime;
				lastTime = time;
				
				routes.forEach(function(route) {
					route.metrics = route._metrics;
					route._metrics = newMetrics();
				});
				
				return callback(dt);
			}
			
			intervalId = setInterval(shift, interval);
		},
		
		stop: function() {
			clearInterval(intervalId);
			intervalId = null;
		},
		
		use: generateUse(app, routes)
	};
}
