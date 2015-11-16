var express = require('express')
var app = express()
var nodemailer = require("nodemailer")
var compression = require('compression')()

// Helpers.
var p    = console.log.bind(console)
var info = function(msg){
  var withZero = function(number){return (number < 10) ? ('0' + number) : number}
  var timestamp = function(){
    date = new Date()
    return date.getFullYear() + '/' + withZero(date.getMonth() + 1) + '/' +
      withZero(date.getDate()) + ' ' +
      withZero(date.getHours()) + ':' + withZero(date.getMinutes()) + ':' +
      withZero(date.getSeconds())
  }
  console.info('  ', timestamp(), msg.toString().substring(0, 1000))
}

// Parsing environment variables.
var env = process.env
var options = {}
options.port         = parseInt(env.port || 3000)
options.requestLimit = parseInt(env.requestLimit || 5 * 1024)
options.smtpHost     = env.smtpHost || 'smtp.mailgun.org'
options.smtpPort     = parseInt(env.smtpPort || 25)
options.fromAddress  = env.fromAddress || 'robot@salejs.com'
options.smtpUser     = env.smtpUser
options.smtpPassword = env.smtpPassword

// Compression.
app.use(compression)

// Templates, I don't want to use express templates because I want to keep
// all the templates for each language in one file.
app.templates = {}
app.template = function(language, name, fn){
  (this.templates[language] = this.templates[language] || {})[name] = function(){
    var buff = []
    var args = Array.prototype.slice.call(arguments)
    args.unshift(function(str){buff.push(str)})
    fn.apply(null, args)
    return buff.join("\n")
  }
}
// Render template - `render(language, name, args...)`.
app.render = function(){
  var args = Array.prototype.slice.call(arguments, 2)
  var localizedTemplates = this.templates[arguments[0]]
  if(!localizedTemplates) throw new Error('no templates for ' + arguments[0] + ' language!')
  var localizedTemplate = localizedTemplates[arguments[1]]
  if(!localizedTemplates)
    throw new Error('no template ' + arguments[1] + ' for ' + arguments[0] + ' language!')
  return localizedTemplate.apply(null, args)
}

// Helper.
app.priceWithCurrency = function(price, currency){
  if(['$', '£'].indexOf(currency) >= 0) return currency + price
  else return price + currency
}

// Translations.
require('./server/languages/english')(app)
require('./server/languages/russian')(app)
require('./server/languages/ukrainian')(app)

// Preparing email.
var transporter = nodemailer.createTransport({
  host : options.smtpHost,
  port : options.smtpPort,
  auth: {
    user: options.smtpUser,
    pass: options.smtpPassword
  }
})

// Serving static files from `client` folder and telling browser
// to cache it.
//
// Using version in path in order to provide backward compatibile API
// in future.
app.use('/v1', function(req, res, next){
  var referer = req.get('Referer')
  if(referer && /\/cart.js/.test(req.path)) info("serving " + decodeURI(referer))
  next()
})
app.use('/v1', express.static(__dirname + '/client', {maxAge: 31557600000}))

// Serving site.
app.use(express.static(__dirname + '/documentation', {maxAge: 31557600000}))

// Middleware for request parsing.
app.use(express.json({limit: options.requestLimit}))
app.use(express.urlencoded())
app.use(express.multipart({limit: options.requestLimit}))

// Processing orders.
app.post('/v1/orders', function(req, res){
  var order = JSON.parse(req.body.data)

  // Need this for logging.
  info('order from ' + order.site + ' for '
  + app.priceWithCurrency(order.price, order.currency) + ' (' + req.body.data + ')')

  // Setting special headers to allow cross domain requsts.
  res.header('Access-Control-Allow-Origin',  '*')
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
  res.header('Access-Control-Allow-Headers', 'Content-Type')

  // Sending mail to shop owner.
  transporter.sendMail({
    from    : options.fromAddress,
    to      : order.emailOrdersTo,
    subject : app.render(order.language, 'owner-email-subject', order),
    text    : app.render(order.language, 'owner-email-text', order)
  }, function(err){
    if(err){
      info("can't send email to " + order.emailOrdersTo + ' because of '
      + (err.message || err))
      res.end(500, '{}')
    }
    else res.end('{}')
  })
})

// Starting server.
app.listen(options.port)
info("server started on " + options.port + " port")

// Node.js sometimes leek memory, restarting the process periodically.
setTimeout(function(){
  info('restarting by timeout')
  process.exit()
}, 4 * 60 * 60 * 1000)
