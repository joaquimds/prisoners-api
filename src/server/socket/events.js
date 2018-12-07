const debug = require('debug')('prisoners:socket:events')

const clients = require('./clients')
const dilemmaService = require('../../services/dilemma')
const captchaService = require('../../services/captcha')

module.exports = {

  reset: (id, token, client) => {
    const oldDilemmas = dilemmaService.deactivatePlayer(id)
    clients.emitDilemmas(oldDilemmas)

    const verified = captchaService.verify(client.handshake.address, token)
    if (verified) {
      try {
        const newDilemmas = dilemmaService.activatePlayer(id)
        clients.emitDilemmas(newDilemmas)
      } catch (e) {
        debug(e.message)
        client.emit('dilemma_error', e.message)
      }
    }
  },

  message: (id, message) => {
    clients.sendMessage(id, message)
  },

  choice: (id, choice) => {
    const dilemma = dilemmaService.setChoice(id, choice)
    if (dilemma) {
      clients.emitDilemmas([dilemma])
    }
  },

  email: (id, email) => {
    console.log('IMPLEMENT PAYOUT', email)
  },

  disconnect: (id) => {
    debug('Disconnect', id)
    const dilemmas = dilemmaService.removePlayer(id)
    clients.removeClient(id)
    clients.emitDilemmas(dilemmas)
  }
}
