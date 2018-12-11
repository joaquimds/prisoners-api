const paypal = require('paypal-rest-sdk')
const debug = require('debug')('prisoners:paypal')

paypal.configure({
  mode: process.env.PAYPAL_MODE,
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET
})

const statuses = {
  paying: 'paying',
  paid: 'paid',
  error: 'error'
}

const uniqueId = Math.floor(Date.now() / 1000)

const paypalService = {

  _paymentStatus: {},

  payout: async (id, value, email) => {
    if (paypalService._paymentStatus[id] && paypalService._paymentStatus[id] !== statuses.error) {
      return false
    }
    paypalService._paymentStatus[id] = statuses.paying

    debug('Paying ' + value + ' to ' + email)
    const json = {
      sender_batch_header: {
        sender_batch_id: `${uniqueId}:${id}`,
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

    try {
      await payout(json, email)
      paypalService._paymentStatus[id] = statuses.paid
      return true
    } catch (e) {
      paypalService._paymentStatus[id] = statuses.error
    }

    return false
  }

}

const payout = (json, email) => new Promise((resolve, reject) => {
  paypal.payout.create(json, 'false', (error) => {
    if (error) {
      debug(error.message)
      return reject(error)
    }
    debug('Successfully paid', email)
    resolve()
  })
})

module.exports = paypalService
