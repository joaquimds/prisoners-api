const io = require('socket.io')
const debug = require('debug')('prisoners:socket')

const dilemmaService = require('./dilemma')
const captchaService = require('./captcha')

let _clientId = 0

const socketService = {
  _clients: {},
  _connections: {},

  init: (server) => {
    const socket = io(server)
    socket.on('connection', client => {
      socketService.addClient(_clientId, client)
      _clientId++
    })
  },

  addClient: (id, client) => {
    debug('add client', id)

    const address = client.handshake.address
    socketService._connections[address] = socketService._connections[address] || 0
    if (socketService._connections[address] >= 10) {
      debug('limiting', address)
      client.disconnect()
      return
    }

    socketService._connections[address]++
    socketService._clients[id] = client

    client.on('reset', async (token) => {
      dilemmaService.removePlayer(id)
      const verified = await captchaService.verify(client.handshake.address, token)
      if (verified) {
        const dilemma = dilemmaService.newPlayer(id)
        socketService.emitDilemma(dilemma)
      }
    })

    client.on('message', message => {
      socketService.sendMessage(id, message)
    })

    client.on('choice', choice => {
      const dilemma = dilemmaService.applyChoice(id, choice)
      socketService.emitDilemma(dilemma)
    })

    client.on('disconnect', () => {
      debug('disconnect', id)
      const dilemma = dilemmaService.removePlayer(id)
      delete socketService._clients[id]
      socketService._connections[address]--
      socketService.emitDilemma(dilemma)
    })
  },

  emitDilemma: (dilemma) => {
    if (dilemma) {
      dilemma.players.forEach(player => {
        const client = socketService._clients[player.id]
        client.emit('dilemma', dilemma.summary(player.id))
      })
    }
  },

  sendMessage: (senderId, message) => {
    const dilemma = dilemmaService.getDilemma(senderId)
    if (dilemma) {
      dilemma.players.forEach(player => {
        if (player.id !== senderId) {
          const client = socketService._clients[player.id]
          client.emit('message', message)
        }
      })
    }
  }
}

module.exports = socketService
