const FatalApplicationError = require('../../errors/FatalApplicationError')

const dilemmaService = require('../../services/dilemma')
const paypalService = require('../../services/paypal')

const broadcasts = {
  init: (socket) => {
    dilemmaService.addStatsListener((stats) => broadcasts.sendStats(socket, stats))
    paypalService.addFundsListener((hasFunds) => broadcasts.sendFundsError(socket, hasFunds))
  },

  sendInitialValues: async (client) => {
    broadcasts.sendStats(client, await dilemmaService.getStats())
    broadcasts.sendFundsError(client, paypalService.hasFunds())
  },

  sendStats: (socket, stats) => {
    socket.emit('stats', stats)
  },

  sendFundsError: (socket, hasFunds) => {
    if (!hasFunds) {
      socket.emit('fatal_api_error', { message: FatalApplicationError.insufficient_funds })
    }
  }
}

module.exports = broadcasts
