(function(){
  var app = cartjs

  var t = app.translation
  t.addressFieldLabel = "Адреса"
  t.addressFieldPlaceholder = "Введіть вашу адресу"
  t.buyButtonTitle = 'Купити'
  t.cartButtonLabelOne = "товар"
  t.cartButtonLabelFew = "товари"
  t.cartButtonLabelMany = "товарів"
  t.emptyCart = 'Ваш кошик пустий'
  t.emailFieldLabel = "Пошта"
  t.emailFieldPlaceholder = "Введіть вашу пошту"
  t.nameFieldLabel = "Ім'я"
  t.nameFieldPlaceholder = "Введіть ваше ім'я"
  t.orderFailed = "Не вдалось відправити замовлення, зв'яжіться з тех. підтримкою"
  t.orderSent = 'Ваше замовлення відправлене'
  t.phoneFieldLabel = "Телефон"
  t.phoneFieldPlaceholder = "Введіть ваш телефон"
  t.purchaseButtonTitle = 'Замовити'

  t.pluralize = function(count){
    // Ukrainian pluralization rules.
    //
    //   one -> n mod 10 is 1 and n mod 100 is not 11;
    //   few -> n mod 10 in 2..4 and n mod 100 not in 12..14;
    //   many -> n mod 10 is 0 or n mod 10 in 5..9 or n mod 100 in 11..14;
    //   other -> everything else
    //
    //   one:   1    год
    //   few:   2    года
    //   many:  5    лет
    //   other: 1.31 года
    //
    var mod10 = count % 10
    var mod100 = count % 100
    var has = function(array, value){return array.indexOf(value) >= 0}
    if((mod10 == 1) && (mod100 != 11))
      return 'One'
    else if(has([2, 3, 4], mod10) && !has([12, 13, 14], mod100))
      return 'Few'
    else if((mod10 == 0) || has([5, 6, 7, 8, 9], mod10) || has([11, 12, 13, 14], mod100))
      return 'Many'
    else
      return 'Other'
  }
})()
