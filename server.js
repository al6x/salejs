var express = require('express')
var app = express()
global.app = app

// Parsing environment variables.
var options = {}
options.port         = process.env.port || 3000

// Serving static files from `client` folder and telling browser
// to cache it.
//
// Using version in path in order to provide backward compatibile API
// in future.
app.use('/v1', express.static(__dirname + '/client'))
app.use('/v1', function(req, res, next){
  res.setHeader('Cache-Control', 'public, max-age=31536000')
  next()
})

// Starting server.
app.listen(options.port)
console.info("salejs server started on " + options.port + " port")