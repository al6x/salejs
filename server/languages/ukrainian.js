module.exports = function(app){
  app.template('ukrainian', 'owner-email-subject', function(add, order){
    add('Замовлення з ' + order.site + ' на ' + app.priceWithCurrency(order.price, order.currency))
  })

  app.template('ukrainian', 'owner-email-text', function(add, order){
    add('Замовник')
    add('')
    if(order.name)    add("  Ім'я:     " + order.name)
    if(order.phone)   add("  Телефон: " + order.phone)
    if(order.email)   add("  Пошта:   " + order.email)
    if(order.address) add("  Адреса:   " + order.address)
    add('')

    add('Замовив')
    add('')
    for(var i = 0; i < order.items.length; i++){
      var item = order.items[i]
      add('  ' + item.name + '\t' + item.quantity + '\t'
      + app.priceWithCurrency(item.price, order.currency))
    }
    add('')
    add('На суму ' + app.priceWithCurrency(order.price, order.currency))
  })
}
