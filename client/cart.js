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

  // Cross domain request.
  var server = {}
  server.send = function(method, url, data, callback){
    if(!window.FormData || !window.XMLHttpRequest)
      return callback(new Error("Your browser doesn't support that feature, please update it."))
    var formData = new FormData()
    formData.append('data', JSON.stringify(data))
    var responded = false
    var xhr = new XMLHttpRequest()
    xhr.open(method.toUpperCase(), url, true)
    xhr.onreadystatechange = function(){
      if(responded) return
      if(xhr.readyState == 4){
        responded = true
        if(xhr.status == 200) callback(null, JSON.parse(xhr.responseText))
        else callback(new Error(xhr.responseText))
      }
    }
    setTimeout(function(){
      if(responded) return
      responded = true
      callback(new Error("no response from " + url + "!"))
    }, timeout)
    debug(method, url, data)
    xhr.send(formData)
  }
  server.post = function(url, data, callback){this.send('post', url, data, callback)}

  // Async helper to simplify error handling in callbacks.
  var fork = function(onError, onSuccess){
    return function(){
      var args = Array.prototype.slice.call(arguments, 1)
      if(arguments[0]) onError(arguments[0])
      else onSuccess.apply(null, args)
    }
  }
  var once = function(fn){
    var called = false
    return function(){
      if(!called){
        called = true
        return fn.apply(this, arguments)
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

  // Template helpers.
  app.templates = {}
  app.template = function(name, fn){
    this.templates[name] = function(){
      var buff = []
      var args = Array.prototype.slice.call(arguments)
      args.unshift(function(str){buff.push(str)})
      fn.apply(null, args)
      return buff.join("\n")
    }
  }
  // Render template - `render(name, args...)`.
  app.render = function(){
    var args = Array.prototype.slice.call(arguments, 1)
    return this.templates[arguments[0]].apply(null, args)
  }

  // Helper to escape HTML.
  var escapeHtml = function(str){return $('<div/>').text(str).html()}
  // var escapeId = function(str){return str.replace()}

  // Storage, for now just using `localStorage` and ignoring old browser that doesn't
  // support it, later will be updated to support older browsers also.
  var db = {
    get    : function(key){return window.localStorage.getItem(key)},
    set    : function(key, value){window.localStorage.setItem(key, value)},
    remove : function(key){window.localStorage.removeItem(key)}
  }

  // # Translation.
  app.translation = {}
  // Performs both key lookup and substring replacement with values from options.
  // Replaces all occurences of `#{key}` in string with corresponding values from
  // `options[key]`
  //
  //   app.translation.welcomeLetter = 'Welcome #{user}'
  //
  //   t('welcomeLetter', {user: 'Jim Raynor'}) => 'Welcome Jim Raynor'
  //
  // It also does pluralization if option `count` provided.
  //
  //   app.translation.cartLabelOne = '#{count} item'
  //   app.translation.cartLabelMany = '#{count} items'
  //
  //   t('cartLabel', {count: 1}) => '1 item'
  //   t('cartLabel', {count: 2}) => '2 items'
  //
  var t = function(key, options){
    options = options || {}
    if('count' in options) key = key + app.translation.pluralize(options.count)
    str = app.translation[key] || ('no translation for ' + key)
    eachInObject(options, function(k){
      str = str.replace(new RegExp('\#\{' + k + '\}', 'g'), options[k])
    })
    return str
  }

  // # Minimalistic version of heart of Backbone.js - Events / Observer Pattern.
  var Events = function(obj){
    obj.on = function(){
      var fn = arguments[arguments.length - 1]
      for(var i = 0; i < (arguments.length - 1); i++){
        var name = arguments[i]
        this.subscribers = this.subscribers || {};
        (this.subscribers[name] = this.subscribers[name] || []).push(fn)
      }
    }
    obj.trigger = function(){
      var event = arguments[0]
      var args  = Array.prototype.slice.call(arguments, 1)
      debug(event, args)
      if(!this.subscribers) return
      var list = this.subscribers[event] || []
      for(var i = 0; i < list.length; i++) list[i].apply(null, args)
    }
    obj.off = function(){delete this.subscribers}
  }

  // # Assembling and starting application.
  //
  // Adding events to `app`.
  Events(app)

  // Loading CSS & JS resources.
  app.loadResources = function(callback){
    var baseUrl = this.baseUrl
    var language = this.language
    requireJQuery(baseUrl + '/vendor/jquery-1.10.2.js', fork(callback, function(jQuery){
      $ = jQuery

      // Loading CSS and JS.
      callback = once(callback)
      var count = 0
      var done = function(err){
        count = count + 1
        if(err) callback(err)
        if(count == 3) callback()
      }

      loadCss(baseUrl + '/vendor/bootstrap-3.0.2/css/bootstrap-widget.css'
      , 'bootstrap-widget-loaded', fork(callback, function(){
        loadCss(baseUrl + '/cart.css', 'cart-loaded', done)
      }))

      loadJs(baseUrl + '/vendor/bootstrap-3.0.2/js/bootstrap.js', done)
      loadJs(baseUrl + '/languages/' + language + '.js', done)
    }))
  }

  // Initialization.
  app.languageShortcuts = {en: 'english', ru: 'russian', ua: 'ukrainian'}
  app.initialize = function(options, callback){
    // Parsing arguments.
    options = options || {}
    callback = callback || function(err){if(err) console.error(err.message || err)}

    // Options.
    this.baseUrl  = options.baseUrl  || 'http://salejs.com/v1'
    this.language = options.language || 'english'
    this.language = app.languageShortcuts[this.language] || this.language
    this.currency = options.currency || '$'
    this.requireName    = ('requireName' in options)    ? options.requireName    : true
    this.requirePhone   = ('requirePhone' in options)   ? options.requirePhone   : true
    this.requireEmail   = ('requireEmail' in options)   ? options.requireEmail   : false
    this.requireAddress = ('requireAddress' in options) ? options.requireAddress : false
    this.emailOrdersTo  = options.emailOrdersTo
    if(!this.emailOrdersTo)
      return callback(new Error("cartjs - `emailOrdersTo` not set, set it please!"))

    // // Waiting for document ready, `jQuery` can't be used because it may not be yet loaded.
    // var ensureDOMReady = function(callback){
    //   var interval = setInterval(function() {
    //     if (document.readyState === 'complete') {
    //       callback()
    //       clearInterval(interval)
    //     }
    //   }, 10)
    // }

    // Checking if it has been already initialized. It may happen if Shop uses
    // dynamic page updates, for example PJAX or Turbolinks.
    if(!this.initialized){
      debug('initializing')
      // Loading resources.
      this.loadResources(fork(callback, bind(function(){
        // Initializing models and views.
        this.initializeModels()
        this.initializeViews()
        this.initialized = true
        callback()
      }, this)))
    }else{
      debug('re-initializing')
      // Unsubscribing all handlers.
      app.off()
      $(document).off('click', '.cart-buy-button')
      $(document).off('click', '.cart-button')

      // Re-initializing views.
      this.initializeViews()
    }
  }

  app.initializeModels = function(){
    this.cart = new app.Cart()
    this.cart.load()

    this.contacts = new app.Contacts()
  }

  app.initializeViews = function(){
    this.cartButtonView = new app.CartButtonView(this.cart)
    this.cartButtonView.render()

    this.cartPopupView = new app.CartPopupView()
    this.cartPopupView.render()

    this.cartView = new app.CartView(this.cart)
    this.cartView.render()

    this.contactsView = new app.ContactsView(this.contacts, this.cart)
    this.contactsView.render()

    // Showing and hiding popup.
    app.on('toggle popup', bind(function(){
      if(this.cartPopupView.isActive()) this.cartPopupView.hide()
      else this.cartPopupView.show(this.cartView)
    }, this))

    // Showing contact form.
    app.on('purchase', bind(function(){
      this.cartPopupView.show(this.contactsView)
    }, this))

    // Sending order.
    app.on('send order', bind(function(){
      if(app.contacts.isValid()){
        // Preparing order.
        var order = {
          price             : this.cart.totalPrice(),
          emailOrdersTo     : this.emailOrdersTo,
          site              : window.location.host,
          currency          : this.currency,
          language          : this.language
        }
        extend(order, this.contacts.toJSON())
        extend(order, this.cart.toJSON())

        // Clearing the cart and showing success message.
        this.cart.removeAll()
        var message = '<div class="cart"><div class="cart-message">'
        + escapeHtml(t('orderSent')) + '</div></div>'
        this.cartPopupView.show(message)

        // Sending order to server.
        server.post(this.baseUrl + '/orders', order, bind(function(err){
          if(err){
            var message = '<div class="cart"><div class="cart-message cart-message-error">'
            + escapeHtml(t('orderFailed')) + '</div></div>'
            this.cartPopupView.show(message)
          }
        }, this))
      }
    }, this))

    // Showing popup with cart whenever user makes any change to cart.
    app.cart.on('add item', 'remove item', 'update item', bind(function(){
      this.cartPopupView.show(this.cartView)
    }, this))

    // Processing click on the buy button.
    $(document).on('click', '.cart-buy-button', bind(function(e){
      e.preventDefault()
      var $button = $(e.currentTarget)
      this.cart.add({
        name     : $button.attr('data-name'),
        price    : parseInt($button.attr('data-price')),
        quantity : parseInt($button.attr('data-quantity') || 1)
      })
    }, this))
  }

  app.priceWithCurrency = function(price){
    prefixed = ['$', '£', '€']
    if(prefixed.indexOf(this.currency.toLowerCase()) >= 0) return app.currency + price
    else return price + ' ' + app.currency
  }

  // # Models.
  //
  // Cart.
  app.Cart = function(items){this.items = items || []}
  var proto = app.Cart.prototype
  Events(proto)

  proto.load = function(){
    var jsonString = db.get('cart-items')
    debug('loading cart', jsonString)
    if(jsonString){
      var json = JSON.parse(jsonString)
      this.items = json.items || []
    }
  }

  proto.save = function(){db.set('cart-items', JSON.stringify(this))}

  proto.toJSON = function(){return {items: JSON.parse(JSON.stringify(this.items))}}

  proto.removeAll = function(){
    var length = this.items.length
    for(var i = 0; i < length; i++)
      this.remove(this.items[this.items.length - 1])
  }

  proto.totalPrice = function(){
    var sum = 0
    each(this.items, function(item){sum = sum + item.price * item.quantity})
    return sum
  }

  proto.totalQuantity = function(){
    var sum = 0
    each(this.items, function(item){sum = sum + item.quantity})
    return sum
  }

  proto.isEmpty = function(){return this.items.length == 0}

  proto.add = function(item){
    var i = find(this.items, function(i){return i.name == item.name})
    if(i >= 0){
      var existingItem = this.items[i]
      this.update(item.name, {quantity: (existingItem.quantity + item.quantity)})
    }else{
      this.validateItem(item)
      this.items.push(item)
      this.save()
      this.trigger('add item', item)
    }
  }

  proto.remove = function(nameOrItem){
    var name = nameOrItem.name || nameOrItem
    var i = find(this.items, function(i){return i.name = name})
    if(i >= 0){
      var item = this.items[i]
      this.items.splice(i, 1)
      this.save()
      this.trigger('remove item', item)
    }
  }

  proto.update = function(name, attrs){
    var i = find(this.items, function(i){return i.name == name})
    if(i >= 0){
      var item = this.items[i]
      this.validateItem(extend({}, item, attrs))
      extend(item, attrs)
      this.save()
      this.trigger('update item', item)
    }
  }

  proto.validateItem = function(item){
    if(!item.name) throw new Error('no name!')
    if(!item.price) throw new Error('no price!')
    if(!((item.quantity > 0) || (item.quantity === 0))) throw new Error('no quantity!')
  }

  // Contacts.
  app.Contacts = function(){
    extend(this, {name: '', phone: '', email: '', address: '', errors: {}})
  }
  var proto = app.Contacts.prototype
  Events(proto)

  proto.set = function(attrs){
    extend(this, attrs)
    this.validate()
    this.trigger('update', this)
    // this.save()
  }

  proto.validate = function(){
    this.errors = {}
    if(app.requireName && !this.name) this.errors.name = ["can't be empty"]
    if(app.requirePhone){
      var errors = []
      if(!this.phone) errors.push("can't be empty")
      if(!/^[0-9\- +]+$/.test(this.phone)) errors.push("invalid phone number")
      if(errors.length > 0) this.errors.phone = errors
    }
    if(app.requireEmail && !this.email) this.errors.email = ["can't be empty"]
    if(app.requireAddress && !this.address) this.errors.address = ["can't be empty"]
    return this.errors
  }

  proto.toJSON = function(){
    var data = {}
    if(app.requireName)    data.name = this.name
    if(app.requirePhone)   data.phone = this.phone
    if(app.requireEmail)   data.email = this.email
    if(app.requireAddress) data.address = this.address
    return data
  }

  proto.isValid = function(){return isObjectEmpty(this.errors)}

  // # Views.
  //
  // Cart button.
  app.CartButtonView = function(cart){
    this.cart = cart
    bindAll('render', this)
    this.cart.on('add item', 'remove item', 'update item', this.render)

    $(document).on('click', '.cart-button', function(e){
      e.preventDefault()
      app.trigger('toggle popup')
    })
  }
  var proto = app.CartButtonView.prototype

  proto.render = function(){
    var $button = $('.cart-button')
    $button.find('.cart-button-quantity').text(this.cart.items.length)
    $button.find('.cart-button-label').text(t('cartButtonLabel', {count: this.cart.items.length}))
    $button.removeClass('cart-button-empty').removeClass('cart-button-not-empty')
    $button.addClass(this.cart.isEmpty() ? 'cart-button-empty' : 'cart-button-not-empty')
    $button.show()
  }

  // Popup.
  app.CartPopupView = function(){
    this._isActive = false
    bindAll('render', 'show', 'hide', 'isActive', this)
  }
  var proto = app.CartPopupView.prototype

  proto.render = function(){}

  // Bootstrap Popup doesn't fit well into dynamic approach we using, so logic in
  // the `render` method is a little tricky.
  proto.show = function(content){
    var contentEl = content.$el || content
    if(this.isActive()){
      if(this.content === content) return
      else{
        // We already have an opened Popup and need only to change its content.
        var $popoverContent = $('body > .bootstrap-widget .popover-content')
        $popoverContent.find('> *').detach()
        $popoverContent.append(contentEl)
        this.content = content
      }
    }else{
      this._isActive = true
      this.content = content

      // Bootstrap styles will be applied only to elements inside of `.bootstrap` namespace,
      // creating such namespace if it's not yet created.
      if(!($('.bootstrap-widget').size() > 0))
        $('<div class="bootstrap-widget"></div>').appendTo('body')

      $('.cart-button').popover({
        // title     : '',
        content   : contentEl,
        html      : true,
        placement : 'bottom',
        container : 'body > .bootstrap-widget',
        trigger   : 'manual'
      })
      $('.cart-button').popover('show')
    }
  }

  proto.hide = function(){
    $('.cart-button').popover('destroy')
    this._isActive = false
    this.content = null
  }

  proto.isActive = function(){
    // We need to check also if element exists because site may use dynamic page update and
    // tools like PJAX or Ruby on Rails Turbolinks.
    return this._isActive && ($('.bootstrap-widget .popover').size() > 0)
  }

  // Cart.
  app.CartView = function(cart){
    this.cart = cart
    bindAll('render', 'renderPurchaseButton', 'renderAddItem', 'renderRemoveItem'
    , 'renderUpdateItem', 'scrollQuantity', 'updateQuantity', 'removeItem', this)

    this.cart.on('add item', 'remove item', 'update item', this.renderPurchaseButton)
    this.cart.on('add item', this.renderAddItem)
    this.cart.on('remove item', this.renderRemoveItem)
    this.cart.on('update item', this.renderUpdateItem)

    this.$el = $('<div class="cart"></div>')
    this.$el.on('keyup', '.cart-item-quantity', this.scrollQuantity)
    this.$el.on('change', '.cart-item-quantity', this.updateQuantity)
    this.$el.on('click', '.cart-item-remove', this.removeItem)
    this.$el.on('click', '.cart-purchase-button', function(e){
      e.preventDefault()
      app.trigger('purchase')
    })
  }
  var proto = app.CartView.prototype

  proto.render = function(){
    this.$el.html(app.render('cart', this.cart))
    this.renderPurchaseButton()
  }

  proto.renderPurchaseButton = function(){
    var $purchaseButton = this.$el.find('.cart-purchase-button')
    if(this.cart.totalQuantity() > 0) $purchaseButton.removeAttr('disabled')
    else $purchaseButton.attr({disabled: 'disabled'})
    $purchaseButton.html(app.render('cart-purchase-button', this.cart.totalPrice()))
  }

  proto.renderAddItem = function(item){
    var $cartItems = this.$el.find('.cart-items')
    if($cartItems.size() > 0) $cartItems.append(app.render('cart-item', item))
    else this.render()
  }

  proto.renderRemoveItem = function(item){
    if(this.cart.items.length == 0) this.render()
    this.$el.find('.cart-item[data-name="' + escapeHtml(item.name) + '"]').remove()
  }

  proto.renderUpdateItem = function(item){
    // We can't update the full item element because if user has focus on input - after
    // update that focus will be lost.
    // We using the fact that name and price of row never will be changed, only quantity
    // will, so we will update only quantity here.
    var $input = this.$el.find('.cart-item-quantity[data-name="' + escapeHtml(item.name) + '"]')
    if(parseInt($input.val()) != item.quantity){
      var input = $input[0]
      var selectionStart = input.selectionStart
      var selectionEnd   = input.selectionEnd
      $input.val(item.quantity)
      input.setSelectionRange(selectionStart, selectionEnd)
    }
  }

  // Update quantity with Up or Down buttons.
  proto.scrollQuantity = function(e){
    e.preventDefault()
    var delta = 0
    if(e.keyCode == 38) delta = 1  // Up
    if(e.keyCode == 40) delta = -1 // Down
    if(delta === 0) return

    var $input = $(e.currentTarget)
    var name = $input.attr('data-name')
    var quantity = parseInt($input.val()) + delta
    if(quantity >= 0) this.cart.update(name, {quantity: quantity})
  }

  proto.updateQuantity = function(e){
    e.preventDefault()
    var $input = $(e.currentTarget)
    var name = $input.attr('data-name')
    var quantity = parseInt($input.val())
    if(quantity >= 0) this.cart.update(name, {quantity: quantity})
  }

  proto.removeItem = function(e){
    e.preventDefault()
    var $removeButton = $(e.currentTarget)
    this.cart.remove($removeButton.attr('data-name'))
  }

  app.template('cart', function(add, cart){
    add('<div class="cart">')
      if(cart.items.length > 0){
        // Items.
        add('<div class="cart-items">')
          each(cart.items, function(item){add(app.render('cart-item', item))})
        add('</div>')

        // Purchase button.
        add('<button class="btn btn-primary cart-purchase-button" type="button"></button>')

      }else add('<div class="cart-message">' + escapeHtml(t('emptyCart')) + '</div>')
    add('</div>')
  })

  app.template('cart-purchase-button', function(add, totalPrice){
    add('<span class="cart-purchase-button-label">' + escapeHtml(t('purchaseButtonTitle'))
    + '</span>')
    add('<span class="cart-purchase-button-price">'
    + app.priceWithCurrency(totalPrice) + '</span>')
  })

  app.template('cart-item', function(add, item){
    add('<div class="cart-item" data-name="' + escapeHtml(item.name) + '">')
      add('<div class="cart-item-name">' + escapeHtml(item.name) + '</div>')
      add('<a href="#" class="cart-item-remove" data-name="' + escapeHtml(item.name)
      + '">&times;</a>')
      add('<input class="cart-item-quantity form-control" type="text" value="'
      + item.quantity + '" data-name="' + escapeHtml(item.name) + '">')
      add('<div class="cart-item-multiply-sign">&times;</div>')
      // If price with currency is too big showing price only.
      var priceWithCurrency = app.priceWithCurrency(item.price)
      if(priceWithCurrency.length > 5) priceWithCurrency = item.price
      add('<div class="cart-item-price">' + priceWithCurrency + '</div>')
      add('<div class="cart-clearfix"></div>')
    add('</div>')
  })

  // Contact form.
  app.ContactsView = function(contacts, cart){
    this.contacts = contacts
    this.cart = cart
    bindAll('render', 'renderUpdate', 'updateInput', this)

    this.contacts.on('update', this.renderUpdate)
    this.cart.on('add item', 'remove item', 'update item', this.render)

    this.$el = $('<div class="cart"></div>')
    this.$el.on('change', 'input, textarea', this.updateInput)
    // this.$el.on('change', 'textarea', this.updateTextarea)
    var sendOrder = bind(function(e){
      e.preventDefault()
      this.contacts.set(this.getValues())
      this.showAllErrors = true
      this.renderUpdate()
      app.trigger('send order')
    }, this)
    this.$el.on('click', '.cart-send-order-button', sendOrder)
    this.$el.on('submit', 'form', sendOrder)

    // When user enter values in form for the first time not all errors
    // should be shown, but only on those fields he already touched.
    // But, if he tries to submit form - errors on all fields should be
    // shown.
    this.showAllErrors = false
  }
  var proto = app.ContactsView.prototype

  proto.render = function(){
    this.$el.html(app.render('contact-form'
    , this.contacts, this.cart.totalPrice(), this.showAllErrors))
  }

  // We can't rerender the whole form because the focus and selection will be lost,
  // making only small changes and only if they are neccessarry.
  proto.renderUpdate = function(){
    this.$el.find('.form-group').each(bind(function(i, e){
      var $group = $(e)
      var $input = $group.find('input, textarea')
      var input = $input[0]
      var name = $input.attr('name')

      // Setting error or success.
      $group.removeClass('has-error').removeClass('has-success')
      // Showing errors only if field has been changed.
      if(this.showAllErrors || ($input.attr('data-changed') == 'changed'))
        $group.addClass(this.contacts.errors[name] ? 'has-error' : 'has-success')

      // Updating value.
      if($input.val() !== this.contacts[name]){
        var selectionStart = input.selectionStart
        var selectionEnd   = input.selectionEnd
        $input.val(this.contacts[name])
        input.setSelectionRange(selectionStart, selectionEnd)
      }
    }, this))
  }

  proto.updateInput = function(e){
    e.preventDefault()
    var $input = $(e.currentTarget)
    // We need this marking to show errors only on fields that has been changed.
    $input.attr('data-changed', 'changed')
    var attrs = {}
    attrs[$input.attr('name')] = $input.val()
    this.contacts.set(attrs)
  }

  proto.getValues = function(){
    var attrs = {}
    this.$el.find('input, textarea').each(bind(function(i, e){
      var $input = $(e)
      attrs[$input.attr('name')] = $input.val()
    }, this))
    return attrs
  }

  app.template('contact-form', function(add, contacts, totalPrice, showAllErrors){
    add('<form role="form">')
      var errorClass = function(attribute){
        if(contacts.errors[attribute]) return ' has-error'
        else return showAllErrors ? ' has-success' : ''
      }

      // Name field.
      if(app.requireName){
        add('<div class="form-group' + errorClass('name') + '">')
          add('<label class="control-label" for="cart-name">'
          + escapeHtml(t('nameFieldLabel')) + '</label>')
          add('<input type="text" name="name" class="form-control" id="cart-name"'
          + ' placeholder="' + escapeHtml(t('nameFieldPlaceholder')) + '"'
          + ' required value="' + contacts.name + '">')
        add('</div>')
      }

      // Phone field.
      if(app.requirePhone){
        add('<div class="form-group' + errorClass('phone') + '">')
          add('<label class="control-label" for="cart-phone">'
          + escapeHtml(t('phoneFieldLabel')) + '</label>')
          add('<input type="text" name="phone" class="form-control" id="cart-phone"'
          + ' placeholder="' + escapeHtml(t('phoneFieldPlaceholder')) + '"'
          + ' required value="' + contacts.phone + '">')
        add('</div>')
      }

      // Email field.
      if(app.requireEmail){
        add('<div class="form-group' + errorClass('email') + '">')
          add('<label class="control-label" for="cart-email">'
          + escapeHtml(t('emailFieldLabel')) + '</label>')
          add('<input type="text" name="email" class="form-control" id="cart-email"'
          + ' placeholder="' + escapeHtml(t('emailFieldPlaceholder')) + '"'
          + ' required value="' + contacts.email + '">')
        add('</div>')
      }

      // Address field.
      if(app.requireAddress){
        add('<div class="form-group' + errorClass('address') + '">')
          add('<label class="control-label" for="cart-address">'
          + escapeHtml(t('addressFieldLabel')) + '</label>')
          add('<textarea type="text" name="address" class="form-control" id="cart-address"'
          + ' placeholder="' + escapeHtml(t('addressFieldPlaceholder')) + '"'
          + ' required rows="3">' + contacts.address + '</textarea>')
        add('</div>')
      }

      // Buy button.
      add('<button type="button" class="btn btn-primary cart-send-order-button">')
        add('<span class="cart-send-order-button-label">' + escapeHtml(t('buyButtonTitle'))
        + '</span>')
        add('<span class="cart-send-order-button-price">' + app.priceWithCurrency(totalPrice)
        + '</span>')
      add('</button>')
    add('</form>')
  })
})()
