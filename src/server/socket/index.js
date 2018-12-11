const io = require('socket.io')
const debug = require('debug')('prisoners:socket')

const clients = require('./clients')
const events = require('./events')
const dilemmaService = require('../../services/dilemma')
const paypalService = require('../../services/paypal')

const ApplicationWarning = require('../../errors/ApplicationWarning')
const ApplicationError = require('../../errors/ApplicationError')
const FatalApplicationError = require('../../errors/FatalApplicationError')

const socketService = {
  init: (server) => {
    const socket = io(server)

    dilemmaService.addStatsListener((stats) => socketService.sendStats(socket, stats))
    paypalService.addFundsListener((hasFunds) => socketService.sendFundsError(socket, hasFunds))

    socket.on('connection', client => {
      try {
        const id = clients.addClient(client)
        socketService.addEventListeners(id, client)
        socketService.sendStats(client, dilemmaService.getStats())
        socketService.sendFundsError(client, paypalService.hasFunds())
      } catch (e) {
        socketService.handleError(e, client)
        client.disconnect()
      }
    })
  },

  addEventListeners: (id, client) => {
    for (const event of Object.keys(events)) {
      socketService.addEventListener(id, client, event)
    }
  },

  addEventListener: (id, client, event) => {
    client.on(event, async (params) => {
      try {
        await events[event](id, params, client)
      } catch (e) {
        socketService.handleError(e, client)
      }
    })
  },

  sendStats: (socket, stats) => {
    socket.emit('stats', stats)
  },

  sendFundsError: (socket, hasFunds) => {
    if (!hasFunds) {
      socket.emit('fatal_api_error', { message: FatalApplicationError.insufficient_funds })
    }
  },

  handleError: (e, client) => {
    debug(e.message)
    if (e instanceof ApplicationWarning) {
      client.emit('api_warning', { message: e.message })
      return
    }
    if (e instanceof ApplicationError) {
      client.emit('api_error', { message: e.message })
      return
    }
    if (e instanceof FatalApplicationError) {
      client.emit('fatal_api_error', { message: e.message })
      return
    }
    client.emit('fatal_api_error', { message: 'Unknown error' })
  }
}

module.exports = socketService
