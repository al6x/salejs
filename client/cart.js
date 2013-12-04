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
    var language = this.language
    requireJQuery(baseUrl + '/vendor/jquery-1.10.2.js', fork(callback, function(jQuery){
      $ = jQuery
      // Loading CSS and JS resources.
      var done = parallel(callback)
      loadCss(baseUrl + '/vendor/bootstrap-3.0.2/css/bootstrap-widget.css', 'cart-loaded', done())
      loadCss(baseUrl + '/cart.css', 'cart-loaded', done())
      loadJs(baseUrl + '/vendor/bootstrap-3.0.2/js/bootstrap.js', done())
      // loadJs(baseUrl + '/vendor/underscore-1.5.2.js', done())
      loadJs(baseUrl + '/languages/' + language + '.js', done())
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
  }

  // Initialization.
  app.initialize = function(options, callback){
    // Parsing arguments.
    options = options || {}
    callback = callback || function(err){if(err) console.error(err.message || err)}

    // Options.
    this.baseUrl  = options.baseUrl  || 'http://salejs.com/v1'
    this.language = options.language || 'en'
    this.currency = options.currency || '$'


    // Loading resources.
    this.loadResources(fork(callback, bind(function(){

      options = options || {}
      var $cart = $('.cart-button')

      var cart = new app.Cart()
      cart.add({name: 'Boots', price: '10', quantity: '2'})
      cart.add({name: 'Hat', price: '5', quantity: '5'})

      var cartView = new app.CartView(cart)
      cartView.render()

      // Showing mockup
      $cart.popover({
        // title     : '',
        content   : cartView.$el,
        html      : true,
        placement : 'bottom',
        container : 'body > .bootstrap-widget'
      })
      $cart.popover('show')

      callback()
    }, this)))
  }

  app.priceWithCurrency = function(price){
    if(['$', '£'].indexOf(this.currency) >= 0) return app.currency + price
    else return price + app.currency
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
        add('<button class="btn btn-primary cart-purchase-button" type="button">'
        + escapeHtml(t('purchaseButtonTitle')) + '</button>')

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
      add('<div class="cart-item-price">' + app.priceWithCurrency(item.price) + '</div>')
      add('<div class="cart-clearfix"></div>')
    add('</div>')
  })

  // Contact form.
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