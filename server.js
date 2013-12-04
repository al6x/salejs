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

// Middleware for request parsing.
app.use(express.json({limit: options.requestLimit}))
app.use(express.urlencoded())
app.use(express.multipart({limit: options.requestLimit}))

// Processing orders.
app.post('/v1/orders', function(req, res){
  console.log('processing order...', req.body)

  // Setting special headers to allow cross domain requsts.
  res.header('Access-Control-Allow-Origin',  '*')
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
  res.header('Access-Control-Allow-Headers', 'Content-Type')

  res.end('{}')
})

// Starting server.
app.listen(options.port)
console.info("salejs server started on " + options.port + " port")