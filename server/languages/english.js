module.exports = function(app){
  // Owner email templates, users can override those templates to fit their needs.
  app.template('english', 'owner-email-subject', function(add, order){
    add('Order from ' + order.site + ' for ' + app.priceWithCurrency(order.price, order.currency))
  })

  app.template('english', 'owner-email-text', function(add, order){
    add('Customer')
    add('')
    if(order.name)    add("  Name    " + order.name)
    if(order.phone)   add("  Phone   " + order.phone)
    if(order.email)   add("  Email   " + order.email)
    if(order.address) add("  Address " + order.address)
    add('')

    add('Ordered')
    add('')
    for(var i = 0; i < order.items.length; i++){
      var item = order.items[i]
      add('  ' + item.name + '\t' + item.quantity + '\t'
      + app.priceWithCurrency(item.price, order.currency))
    }
    add('')
    add('Total ' + app.priceWithCurrency(order.price, order.currency))
  })
}