const paypal = require('paypal-rest-sdk')
const EventEmitter = require('events')
const debug = require('debug')('prisoners:paypal')

const FatalApplicationError = require('../errors/FatalApplicationError')

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

  _hasFunds: true,
  _fundsEmitter: new EventEmitter(),
  _paymentStatus: {},

  hasFunds: () => paypalService._hasFunds,

  addFundsListener: (callback) => {
    paypalService._fundsEmitter.on('update', (hasFunds) => callback(hasFunds))
  },

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
    } catch (error) {
      paypalService._paymentStatus[id] = statuses.error
      if (error.response && error.response.name === 'INSUFFICIENT_FUNDS') {
        paypalService._hasFunds = false
        paypalService._fundsEmitter.emit('update', false)
        throw new FatalApplicationError(FatalApplicationError.insufficient_funds)
      }
    }

    return false
  }

}

const payout = (json, email) => new Promise((resolve, reject) => {
  paypal.payout.create(json, 'false', (error) => {
    if (error) {
      debug(error.response.message)
      return reject(error)
    }
    debug('Successfully paid', email)
    resolve()
  })
})

module.exports = paypalService
