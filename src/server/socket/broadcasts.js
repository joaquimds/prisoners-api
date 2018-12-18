const FatalApplicationError = require('../../errors/FatalApplicationError')

const dilemmaService = require('../../services/dilemma')
const paypalService = require('../../services/paypal')

const broadcasts = {
  init: (socket) => {
    dilemmaService.addStatsListener((stats) => broadcasts.sendStats(socket, stats))
    dilemmaService.addPlayerCountListener((playerCount) => broadcasts.sendPlayerCount(socket, playerCount))
    paypalService.addFundsListener((hasFunds) => broadcasts.sendFundsError(socket, hasFunds))
  },

  sendInitialValues: (client) => {
    broadcasts.sendStats(client, dilemmaService.getStats())
    broadcasts.sendFundsError(client, paypalService.hasFunds())
    broadcasts.sendPlayerCount(client, dilemmaService.getPlayerCount())
  },

  sendStats: (socket, stats) => {
    socket.emit('stats', stats)
  },

  sendFundsError: (socket, hasFunds) => {
    if (!hasFunds) {
      socket.emit('fatal_api_error', { message: FatalApplicationError.insufficient_funds })
    }
  },

  sendPlayerCount: (socket, playerCount) => {
    socket.emit('playerCount', playerCount)
  }
}

module.exports = broadcasts
