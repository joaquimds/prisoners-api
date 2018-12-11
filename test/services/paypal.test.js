const { describe, it } = require('mocha')
const { assert } = require('chai')
const paypal = require('paypal-rest-sdk') // methods overridden in _setup.js

const paypalService = require('../../src/services/paypal')

describe('paypal service', () => {
  describe('payout', () => {
    it('handles invalid email address', async () => {
      const success = await paypalService.payout('0:0', 0.5, 'invalid@example.com')
      assert.deepEqual(paypalService._paymentStatus, { '0:0': 'error' })
      assert.ok(!success)
      assert.equal(paypal.payout.create.callCount, 1)
    })
    it('pays out', async () => {
      const success = await paypalService.payout('0:0', 0.5, 'alice@example.com')
      assert.deepEqual(paypalService._paymentStatus, { '0:0': 'paid' })
      assert.ok(success)
      assert.equal(paypal.payout.create.callCount, 2)
    })
    it('does not pay out twice', async () => {
      const success = await paypalService.payout('0:0', 0.5, 'alice@example.com')
      assert.deepEqual(paypalService._paymentStatus, { '0:0': 'paid' })
      assert.ok(!success)
      assert.equal(paypal.payout.create.callCount, 2)
    })
    it('handles concurrency', async () => {
      const successes = await Promise.all([
        paypalService.payout('0:1', 0.5, 'slow@example.com'),
        paypalService.payout('0:1', 0.5, 'fast@example.com')
      ])
      assert.equal(paypal.payout.create.callCount, 3)
      assert.ok(successes[0])
      assert.ok(!successes[1])
    })
  })
})
