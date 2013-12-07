module.exports = function(app){
  app.template('russian', 'owner-email-subject', function(add, order){
    add('Заказ с ' + order.site + ' на ' + app.priceWithCurrency(order.price, order.currency))
  })

  app.template('russian', 'owner-email-text', function(add, order){
    add('Заказчик')
    add('')
    if(order.name)    add("  Имя     " + order.name)
    if(order.phone)   add("  Телефон " + order.phone)
    if(order.email)   add("  Почта   " + order.email)
    if(order.address) add("  Адрес   " + order.address)
    add('')

    add('Заказал')
    add('')
    for(var i = 0; i < order.items.length; i++){
      var item = order.items[i]
      add('  ' + item.name + '\t' + item.quantity + '\t'
      + app.priceWithCurrency(item.price, order.currency))
    }
    add('')
    add('На сумму ' + app.priceWithCurrency(order.price, order.currency))
  })
}