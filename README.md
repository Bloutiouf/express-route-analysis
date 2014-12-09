# Express Route Analysis

Acts as a wrapper over [Express](http://expressjs.com/) to analyze application routes.

It handles routes that are defined with `.VERB` or `.all` (i.e. not these defined with `.use`).

All the time variables are in **milliseconds**.

## Example

See [example.js](https://github.com/Bloutiouf/express-route-analysis/blob/master/example.js) for a complete example. It is an Express server with a REST service that can do amazing things, but for now it only delivers random numbers. Well, it's just an example.

The routes are defined with a description, which is impossible to do with a regular router.

The service has [an introspective route](http://localhost:3000/api/math/) that can display the defined routes (in the service only).

Route statistics are taken by intervals of five minutes and stored in a [Couchbase database](http://www.couchbase.com/). Statistics are computed with [statsjs](https://github.com/angusgibbs/statsjs).

## Route descriptor

In this package, a `Route` is an object with following fields:

* **mountpath** (`String`) is the mount path, in case the route is inside a router and has been `use`d with a mount path, or is an empty string
* **path** (`String`) is the defined path
* **method** (`String`) is the HTTP verb in lowercase or `all`
* **data** (`Object`) is an opaque user object where you can store any information you want

When watched through a `Stats` object, a `Route` has also a field **metrics** with the following fields:

* **errors** (`Array<Error>`) contains all the errors thrown from the route
* **statusCode** (`Object<Number>`) contains the number of responses for each status code
* **times** (`Array<Number>`) contains the times taken to complete the requests that have ended or failed in the route

## .Router(expressRouter [, callback])

Returns a drop-in wrapper over `expressRouter` that can define routes to watch. It transmits actually every function call to `expressRouter`, moreover the `.VERB` and `.all` functions define the routes to watch. 

If defined, `callback` is called every time a route is added to the router through `.VERB` or `.all`, with the following arguments:

1. **route** (`Route`) being added
2. **middlewares** (`Array`) declared

and must return an `Array` of middlewares. Therefore, `callback` can be used to filter the route middlewares.

It is impossible to wrap the application router, so if you want to analyze routes defined at the application level (`app.VERB` and `app.all`), define them on a proxy router and `app.use(proxyRouteur)` instead. 

### .routes

`Array<Route>`

Routes defined in this router.

## .Stats(expressApp [, callback])

Returns an object that watches routes. Call `stats.use` instead of `app.use` to define `Router`s to watch.

### .start(interval, callback)

Start to watch routes. `callback` is called every `interval` ms with the following arguments:

1. **elapsedTime**(`Number`) is the elapsed time since last call to `callback` (may somewhat differ from `interval`)

Ensure that the execution time of `callback` is lower than `interval`.

### .stop()

Stop to watch routes.

### .use([mountpath,] router...)

Replacement for `app.use`. It is mandatory to call this method to watch `Router`s. Other middlewares can be `use`d through this method or `app.use` interchangeably.

### .routes

`Array<Route>`

Routes defined in the routers used by this Stats.

## Helper middlewares

Debug middlewares provided for convenience.

### .delay(time)

Wait `time` ms, and pass the control to the next handler.

```js
router.get('/processing', routeAnalysis.delay(1000), function(req, res) {
	return res.send("Hard work is done.");
});
```

### .mayFail(ratio [, statusCode = 503])

Send `statusCode` with a probability `ratio` between _0_ (never) and _1_ (always), otherwise pass the control to the next handler. Despite the name, `statusCode` doesn't have to be an error status code.

```js
router.get('/index.coffee', routeAnalysis.mayFail(0.1, 418), function(req, res) {
	return res.sendFile('index.coffee');
});
```

## License

Copyright (c) 2014 Bloutiouf aka Jonathan Giroux

[MIT licence](http://opensource.org/licenses/MIT)
