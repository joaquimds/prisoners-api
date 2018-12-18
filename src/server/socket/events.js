const debug = require('debug')('prisoners:socket:events')

const clients = require('./clients')
const { getRemoteAddress } = require('./util')
const dilemmaService = require('../../services/dilemma')
const captchaService = require('../../services/captcha')
const paypalService = require('../../services/paypal')
const { outcomes } = require('../../constants')
const ApplicationError = require('../../errors/ApplicationError')
const FatalApplicationError = require('../../errors/FatalApplicationError')

module.exports = {

  reset: async (id, token, client) => {
    const oldDilemmas = dilemmaService.deactivatePlayer(id)
    clients.emitDilemmas(oldDilemmas)

    const remoteAddress = getRemoteAddress(client, false)
    const verified = await captchaService.verify(remoteAddress, token)
    if (!verified) {
      debug('Failed captcha', remoteAddress)
      throw new ApplicationError(ApplicationError.failed_captcha)
    }

    const newDilemmas = dilemmaService.activatePlayer(id)
    clients.emitDilemmas(newDilemmas)
  },

  message: (id, message) => {
    const dilemma = dilemmaService.getDilemma(id)
    if (dilemma) {
      for (const player of dilemma.players) {
        if (player.id !== id) {
          clients.sendMessage(player.id, message)
        }
      }
    }
  },

  choice: async (id, choice) => {
    const dilemma = await dilemmaService.setChoice(id, choice)
    if (!dilemma) {
      throw new FatalApplicationError(FatalApplicationError.dilemma_not_found)
    }
    clients.emitDilemmas([dilemma])
  },

  email: async (id, email) => {
    const dilemma = dilemmaService.getDilemma(id)
    if (!dilemma || !dilemma.hasWon(id)) {
      throw new FatalApplicationError(FatalApplicationError.dilemma_not_found)
    }
    const paymentId = `${dilemma.id}:${id}`
    const value = dilemma.getOutcome() === outcomes.split ? 0.5 : 1
    const success = await paypalService.payout(paymentId, value, email)
    clients.emitPayment(id, success)
  },

  disconnect: (id) => {
    debug('Disconnect', id)
    const dilemmas = dilemmaService.removePlayer(id)
    clients.removeClient(id)
    clients.emitDilemmas(dilemmas)
  }
}
