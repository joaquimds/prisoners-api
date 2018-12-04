const io = require('socket.io')
const debug = require('debug')('prisoners:socket')

const dilemmaService = require('./dilemma')

let _clientId = 0

const socketService = {
  _clients: {},

  init: (server) => {
    const socket = io(server)
    socket.on('connection', client => {
      socketService.addClient(_clientId, client)
      _clientId++
    })
  },

  addClient: (id, client) => {
    debug('new player', id)
    socketService._clients[id] = client

    client.on('message', message => {
      socketService.sendMessage(id, message)
    })

    client.on('choice', choice => {
      const dilemma = dilemmaService.applyChoice(id, choice)
      socketService.emitDilemma(dilemma)
    })

    client.on('disconnect', () => {
      debug('disconnect', id)
      dilemmaService.removePlayer(id)
      delete socketService._clients[id]
      socketService.emitDilemma(dilemma)
    })

    const dilemma = dilemmaService.newPlayer(id)
    socketService.emitDilemma(dilemma)
  },

  emitDilemma: (dilemma) => {
    dilemma.players.forEach(player => {
      const client = socketService._clients[player.id]
      client.emit('dilemma', dilemma.summary())
    })
  },

  sendMessage: (senderId, message) => {
    const dilemma = dilemmaService.getDilemma(senderId)
    dilemma.players.forEach(player => {
      if (player.id !== senderId) {
        const client = socketService._clients[player.id]
        client.emit('message', message)
      }
    })
  }
}

module.exports = socketService
