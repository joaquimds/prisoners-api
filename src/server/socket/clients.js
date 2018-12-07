const dilemmaService = require('../../services/dilemma')

const socketClients = {
  _clients: {},
  _connections: {},

  addClient: (client) => {
    socketClients.recordConnection(client)
    const { id } = dilemmaService.createPlayer(client.handshake.address)
    socketClients._clients[id] = client
    return id
  },

  removeClient: (id) => {
    const client = socketClients._clients[id]
    if (client) {
      const address = client.handshake.address
      socketClients._connections[address]--
    }
    delete socketClients._clients[id]
  },

  recordConnection: (client) => {
    const address = client.handshake.address
    socketClients._connections[address] = socketClients._connections[address] || 0
    if (socketClients._connections[address] >= 10) {
      throw new Error('Too many connections from address ' + address)
    }
    socketClients._connections[address]++
  },

  emitDilemmas: (dilemmas) => {
    for (const dilemma of dilemmas) {
      for (const player of dilemma.players) {
        const client = socketClients._clients[player.id]
        if (client) {
          client.emit('dilemma', dilemma.summary(player.id))
        }
      }
    }
  },

  sendMessage: (senderId, message) => {
    const dilemma = dilemmaService.getDilemma(senderId)
    if (dilemma) {
      for (const player of dilemma.players) {
        if (player.id !== senderId) {
          const client = socketClients._clients[player.id]
          if (client) {
            client.emit('message', message)
          }
        }
      }
    }
  },

  emitPayment: (id, success) => {
    const client = socketClients._clients[id]
    if (client) {
      client.emit('payment', success)
    }
  }
}

module.exports = socketClients
