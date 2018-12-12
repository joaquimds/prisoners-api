const io = require('socket.io')
const debug = require('debug')('prisoners:socket')

const clients = require('./clients')
const broadcasts = require('./broadcasts')
const events = require('./events')

const ApplicationWarning = require('../../errors/ApplicationWarning')
const ApplicationError = require('../../errors/ApplicationError')
const FatalApplicationError = require('../../errors/FatalApplicationError')

const socketService = {
  init: (server) => {
    const socket = io(server)

    broadcasts.init(socket)

    socket.on('connection', client => {
      try {
        const id = clients.addClient(client)
        socketService.addEventHandlers(id, client)
        broadcasts.sendInitialValues(client)
      } catch (e) {
        socketService.handleError(e, client)
        client.disconnect()
      }
    })
  },

  addEventHandlers: (id, client) => {
    for (const event of Object.keys(events)) {
      socketService.addEventHandler(id, client, event)
    }
  },

  addEventHandler: (id, client, event) => {
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
