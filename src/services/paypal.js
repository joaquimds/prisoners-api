const paypal = require('paypal-rest-sdk')
const debug = require('debug')('prisoners:paypal')

paypal.configure({
  mode: process.env.PAYPAL_MODE,
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET
})

const paypalService = {

  payout: (id, value, email) => {
    debug('Paying ' + value + ' to ' + email)
    const json = {
      sender_batch_header: {
        sender_batch_id: id,
        email_subject: 'You won Prisoner\'s Dilemma!'
      },
      items: [
        {
          recipient_type: 'EMAIL',
          amount: {
            value,
            currency: 'GBP'
          },
          receiver: email,
          note: 'Congratulations!'
        }
      ]
    }

    paypal.payout.create(json, 'false', (error) => {
      if (error) {
        debug(error.message)
        return
      }
      debug('Successfully paid', email)
    })
  }

}

module.exports = paypalService
