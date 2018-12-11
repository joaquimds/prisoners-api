const io = require('socket.io')
const debug = require('debug')('prisoners:socket')

const clients = require('./clients')
const events = require('./events')
const ApplicationError = require('../../errors/ApplicationError')

const socketService = {
  init: (server) => {
    const socket = io(server)
    socket.on('connection', client => {
      try {
        const id = clients.addClient(client)
        socketService.addEventListeners(id, client)
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

  handleError: (e, client) => {
    debug(e.message)
    if (e instanceof ApplicationError) {
      client.emit('api_error', { message: e.message, fatal: e.fatal })
      return
    }
    client.emit('api_error', { message: 'Unknown error', fatal: true })
  }
}

module.exports = socketService
