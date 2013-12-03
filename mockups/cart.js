(function(){
  // Globals.
  var app = {}
  window.cartjs = app

  // Helpers.
  var p = console.log.bind(console)
  var templatesCache = {}

  app.initialize = function(options){
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
  }
})()