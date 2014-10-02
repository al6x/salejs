module.exports = function(app){
  // Owner email templates, users can override those templates to fit their needs.
  app.template('croatian', 'owner-email-subject', function(add, order){
    add('Narudžba sa ' + order.site + ' za ' + app.priceWithCurrency(order.price, order.currency))
  })

  app.template('croatian', 'owner-email-text', function(add, order){
    add('Kupac')
    add('')
    if(order.name)    add("  Ime     " + order.name)
    if(order.phone)   add("  Telefon " + order.phone)
    if(order.email)   add("  Email   " + order.email)
    if(order.address) add("  Adresa  " + order.address)
    add('')

    add('Naručuje')
    add('')
    for(var i = 0; i < order.items.length; i++){
      var item = order.items[i]
      add('  ' + item.name + '\t' + item.quantity + '\t'
      + app.priceWithCurrency(item.price, order.currency))
    }
    add('')
    add('Ukupno ' + app.priceWithCurrency(order.price, order.currency))
  })
}
