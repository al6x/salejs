(function(){
  var app = cartjs

  var t = app.translation
  t.addressFieldLabel = "Address"
  t.addressFieldPlaceholder = "Enter your address"
  t.buyButtonTitle = 'Buy'
  t.cartButtonLabelOne = "item"
  t.cartButtonLabelMany = "items"
  t.emailFieldLabel = "Email"
  t.emailFieldPlaceholder = "Enter your email"
  t.emptyCart = "You haven't purchased any products yet."
  t.nameFieldLabel = "Name"
  t.nameFieldPlaceholder = "Enter your name"
  t.orderFailed = 'Order failed, contact support please'
  t.orderSent = "Your order has been sent"
  t.phoneFieldLabel = "Phone"
  t.phoneFieldPlaceholder = "Enter your phone"
  t.purchaseButtonTitle = 'Purchase'
  t.emailNotificationTitle = ''
  t.emailNotificationBody = ''

  t.pluralize = function(count){return count === 1 ? 'One' : 'Many'}
})()