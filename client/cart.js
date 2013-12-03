(function(){
  // Globals.
  var app = {}
  window.cartjs = app

  // jQuery in some cases may be unavailable and will be loaded dynamically.
  var $ = null

  // # Helpers.
  //
  // Common helpers.
  var timeout = 3000
  var bind = function(fn, _this){
    return function(){return fn.apply(_this, arguments)}
  }
  var bindAll = function(){
    var obj = arguments[arguments.length - 1]
    for(var i = 0; i < (arguments.length - 1); i++){
      var fname = arguments[i]
      var fn = obj[fname]
      if(!fn) throw new Error('no function ' + fname + ' for object ' + obj + ' !')
      obj[fname] = bind(fn, obj)
    }
  }
  var p = bind(console.log, console)
  var find = function(array, fn){
    for(var i = 0; i < array.length; i++) if(fn(array[i])) return i
    return -1
  }
  var each = function(array, fn){for(var i = 0; i < array.length; i++) fn(array[i], i)}
  var eachInObject = function(obj, fn){for(k in obj) if(obj.hasOwnProperty(k)) fn(k)}
  var isObjectEmpty = function(obj){
    for(k in obj) if(obj.hasOwnProperty(k)) return false
    return true
  }
  var extend = function(){
    var a = arguments[0]
    for(var i = 1; i < arguments.length; i++){
      var b = arguments[i]
      eachInObject(b, function(k){a[k] = b[k]})
    }
    return a
  }
  var debug = function(){
    // var args = Array.prototype.slice.call(arguments)
    // args.unshift('cartjs')
    // console.info.apply(console, args)
  }

  // Async helper to simplify error handling in callbacks.
  var fork = function(onError, onSuccess){
    return function(){
      var args = Array.prototype.slice.call(arguments, 1)
      if(arguments[0]) onError(arguments[0])
      else onSuccess.apply(null, args)
    }
  }

  // Asynchronous helper, it will call `callback` when all resources will be loaded.
  var parallel = function(callback){
    var counter = 0
    var responded = false
    return function(){
      counter = counter + 1
      return function(err){
        if(responded) return
        if(err){
          responded = true
          return callback(err)
        }
        counter = counter - 1
        if(counter === 0) return callback()
      }
    }
  }

  // Load CSS dynamically. There's no way to determine when stylesheet has been loaded
  // so we using hack - define `#my-css-loaded {position: absolute}` rule in stylesheet
  // and the `callback` will be called when it's loaded.
  var loadCss = function(url, cssFileId, callback){
    // CSS in IE can be added only with `createStyleSheet`.
    if(document.createStyleSheet) document.createStyleSheet(url)
    else $('<link rel="stylesheet" type="text/css" href="' + url + '" />').appendTo('head')

    // There's no API to notify when styles will be loaded, using hack to
    // determine if it's loaded or not.
    var loaded = false
    var $testEl = $('<div id="' + cssFileId + '" style="display: none"></div>').appendTo('body')
    var interval = 10
    var time     = 0
    var checkIfStyleHasBeenLoaded = function(){
      if($testEl.css('position') === 'absolute'){
        loaded = true
        $testEl.remove()
        return callback()
      }
      if(time >= timeout) return callback(new Error("can't load " + url + "!"))
      time = time + interval
      setTimeout(checkIfStyleHasBeenLoaded, interval)
    }
    setTimeout(checkIfStyleHasBeenLoaded, 0)
  }

  // Load JS dynamically, `$.getScript` can't be used because there may be no `jQuery`.
  var loadJs = function(url, callback){
    var script = document.createElement('script')
    script.type = 'text/javascript'
    script.async = true
    var responded = false
    script.onreadystatechange = script.onload = function () {
      var state = script.readyState
      if(responded) return
      if (!state || /loaded|complete/.test(state)) {
        responded = true
        callback()
      }
    }
    script.src = url
    document.body.appendChild(script)
    setTimeout(function(){
      if(responded) return
      responded = true
      callback(new Error("can't load " + url + "!"))
    }, timeout)
  }

  // Loading jQuery if it's not already loaded.
  var requireJQuery = function(jQueryUrl, callback){
    if(window.jQuery) callback(null, window.jQuery)
    else loadJs(jQueryUrl, fork(callback, function(){
      if(!window.jQuery) return callback(new Error("can't load jQuery!"))
      callback(null, window.jQuery)
    }))
  }

  // Loading CSS & JS resources.
  app.loadResources = function(callback){
    var baseUrl = this.baseUrl
    requireJQuery(baseUrl + '/vendor/jquery-1.10.2.js', fork(callback, function(jQuery){
      $ = jQuery
      // Loading CSS and JS resources.
      var done = parallel(callback)
      loadCss(baseUrl + '/vendor/bootstrap-3.0.2/css/bootstrap-widget.css', 'cart-loaded', done())
      loadCss(baseUrl + '/cart.css', 'cart-loaded', done())
      loadJs(baseUrl + '/vendor/bootstrap-3.0.2/js/bootstrap.js', done())
      // loadJs(baseUrl + '/vendor/underscore-1.5.2.js', done())
    }))
  }

  // Initialization.
  app.initialize = function(options, callback){
    // Parsing arguments.
    options = options || {}
    callback = callback || function(err){if(err) console.error(err.message || err)}

    // Options.
    this.baseUrl  = options.baseUrl  || 'http://salejs.com/v1'

    // Loading resources.
    this.loadResources(fork(callback, bind(function(){

      options = options || {}
      var $cart = $('.cart-button')

      // Showing mockup
      $cart.popover({
        // title     : '',
        content   : $(window.location.hash || '#cart-with-items-template').val(),
        html      : true,
        placement : 'bottom',
        container : 'body > .bootstrap-widget'
      })
      $cart.popover('show')

      callback()
    }, this)))
  }
})()