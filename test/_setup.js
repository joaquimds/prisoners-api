const path = require('path')
const { sleep } = require('./util')

require('dotenv').load({ path: path.join(__dirname, '..', '.env.test') })

const paypal = require('paypal-rest-sdk')
paypal.payout.create = (json, isAsync, callback) => {
  paypal.payout.create.callCount++
  const receiver = json.items[0].receiver
  if (receiver === 'invalid@example.com') {
    return callback(new Error('Invalid receiver'))
  }
  const timeout = receiver === 'slow@example.com' ? 150 : 100
  sleep(timeout).then(() => callback())
}
paypal.payout.create.callCount = 0
