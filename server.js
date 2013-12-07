var initialize = function(express, options){
  // Parsing environment variables.
  options = options || {}
  options.port         = options.port || 3000
  options.requestLimit = parseInt(options.requestLimit || 5 * 1024)
  options.email        = parseInt(options.email || 'robot@salejs.com')

  var app = express()
  var nodemailer = require("nodemailer")

  // Helpers.
  var p = console.log.bind(console)

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

  // Preparing email.
  var mailer = nodemailer.createTransport("sendmail")

  // Serving static files from `client` folder and telling browser
  // to cache it.
  //
  // Using version in path in order to provide backward compatibile API
  // in future.
  app.use('/v1', express.static(__dirname + '/client', {maxAge: 31557600000}))

  // Middleware for request parsing.
  app.use(express.json({limit: options.requestLimit}))
  app.use(express.urlencoded())
  app.use(express.multipart({limit: options.requestLimit}))

  // Processing orders.
  app.post('/v1/orders', function(req, res){
    var order = JSON.parse(req.body.data)

    // Need this for logging.
    console.log('salejs order from ' + order.site + ' for '
    + app.priceWithCurrency(order.price, order.currency) + ' (' + req.body.data + ')')

    // Setting special headers to allow cross domain requsts.
    res.header('Access-Control-Allow-Origin',  '*')
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
    res.header('Access-Control-Allow-Headers', 'Content-Type')

    // Sending mail to shop owner.
    mailer.sendMail({
      from    : options.email,
      to      : order.emailOrdersTo,
      subject : app.render(order.language, 'owner-email-subject', order),
      text    : app.render(order.language, 'owner-email-text', order)
    }, function(err){
      if(err){
        console.log("salejs can't send email to " + order.emailOrdersTo + ' because of '
        + (err.message || err))
        res.end(500, '{}')
      }
      else res.end('{}')
    })
  })
  return app
}

// Exporting as middleware.
module.exports = initialize

// Starting server.
if(process.argv[1] == __filename){
  // Parsing environment variables.
  var options = {}
  options.port         = process.env.port || 3000
  options.requestLimit = process.env.requestLimit
  options.email        = process.env.email

  // Initializing
  var app = initialize(require('express'), options)

  // Starting server.
  app.listen(options.port)
  console.info("salejs server started on " + options.port + " port")
}