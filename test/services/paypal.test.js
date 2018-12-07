const { describe, it } = require('mocha')
const { assert } = require('chai')
const paypal = require('paypal-rest-sdk')

const paypalService = require('../../src/services/paypal')

describe('paypal service', () => {
  describe('payout', () => {
    it('pays out', async () => {
      const success = await paypalService.payout('0:0', 0.5, 'alice@example.com')
      assert.deepEqual(paypalService._paymentStatus, { '0:0': 'paid' })
      assert.ok(success)
      assert.equal(paypal.payout.create.callCount, 1)
    })
    it('does not pay out twice', async () => {
      const success = await paypalService.payout('0:0', 0.5, 'alice@example.com')
      assert.deepEqual(paypalService._paymentStatus, { '0:0': 'paid' })
      assert.ok(!success)
      assert.equal(paypal.payout.create.callCount, 1)
    })
    it('handles concurrency', async () => {
      const successes = await Promise.all([
        paypalService.payout('0:1', 0.5, 'slow@example.com'),
        paypalService.payout('0:1', 0.5, 'fast@example.com')
      ])
      assert.equal(paypal.payout.create.callCount, 2)
      assert.ok(successes[0])
      assert.ok(!successes[1])
    })
  })
})
