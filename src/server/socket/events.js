const debug = require('debug')('prisoners:socket:events')

const clients = require('./clients')
const dilemmaService = require('../../services/dilemma')
const captchaService = require('../../services/captcha')
const paypalService = require('../../services/paypal')
const { outcomes } = require('../../constants')
const ApplicationError = require('../../errors/ApplicationError')

module.exports = {

  reset: async (id, token, client) => {
    const oldDilemmas = dilemmaService.deactivatePlayer(id)
    clients.emitDilemmas(oldDilemmas)

    const verified = await captchaService.verify(client.handshake.address, token)
    if (!verified) {
      debug('Failed captcha', client.handshake.address)
      throw new ApplicationError(ApplicationError.failed_captcha, true)
    }

    const newDilemmas = dilemmaService.activatePlayer(id)
    clients.emitDilemmas(newDilemmas)
  },

  message: (id, message) => {
    clients.sendMessage(id, message)
  },

  choice: (id, choice) => {
    const dilemma = dilemmaService.setChoice(id, choice)
    if (!dilemma) {
      throw new ApplicationError(ApplicationError.dilemma_not_found, true)
    }
    clients.emitDilemmas([dilemma])
  },

  email: async (id, email) => {
    const dilemma = dilemmaService.getDilemma(id)
    if (dilemma && dilemma.hasWon(id)) {
      const paymentId = `${dilemma.id}:${id}`
      const value = dilemma.getOutcome() === outcomes.split ? 0.5 : 1
      const success = await paypalService.payout(paymentId, value, email)
      clients.emitPayment(id, success)
    }
  },

  disconnect: (id) => {
    debug('Disconnect', id)
    const dilemmas = dilemmaService.removePlayer(id)
    clients.removeClient(id)
    clients.emitDilemmas(dilemmas)
  }
}
