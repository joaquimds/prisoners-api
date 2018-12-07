const io = require('socket.io')
const debug = require('debug')('prisoners:socket')

const clients = require('./clients')
const events = require('./events')

const socketService = {
  init: (server) => {
    const socket = io(server)
    socket.on('connection', client => {
      try {
        const id = clients.addClient(client)
        socketService.initClient(id, client)
      } catch (e) {
        debug(e.message)
        client.disconnect()
      }
    })
  },

  initClient: (id, client) => {
    for (const event of Object.keys(events)) {
      client.on(event, (params) => {
        try {
          events[event](id, params, client)
        } catch (e) {
          debug(e.message)
        }
      })
    }
  }
}

module.exports = socketService
