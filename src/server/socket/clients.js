const crypto = require('crypto')

const FatalApplicationError = require('../../errors/FatalApplicationError')
const dilemmaService = require('../../services/dilemma')

const ANONYMIZE_IPS = process.env.ANONYMIZE_IPS !== 'false'

const getRemoteAddress = (client) => {
  const address = client.handshake.address
  if (!ANONYMIZE_IPS) {
    return address
  }
  return crypto.createHash('md5').update(address).digest('hex')
}

const socketClients = {
  _clients: {},
  _connections: {},

  addClient: (client) => {
    socketClients.recordConnection(client)
    const { id } = dilemmaService.createPlayer(getRemoteAddress(client))
    socketClients._clients[id] = client
    return id
  },

  removeClient: (id) => {
    const client = socketClients._clients[id]
    if (client) {
      const address = getRemoteAddress(client)
      socketClients._connections[address]--
    }
    delete socketClients._clients[id]
  },

  recordConnection: (client) => {
    const address = getRemoteAddress(client)
    socketClients._connections[address] = socketClients._connections[address] || 0
    if (socketClients._connections[address] >= 10) {
      throw new FatalApplicationError(FatalApplicationError.too_many_connections)
    }
    socketClients._connections[address]++
  },

  emit: (clientId, event, data) => {
    const client = socketClients._clients[clientId]
    if (client) {
      client.emit(event, data)
    }
  },

  emitDilemmas: (dilemmas) => {
    for (const dilemma of dilemmas) {
      for (const player of dilemma.players) {
        socketClients.emit(player.id, 'dilemma', dilemma.summary(player.id))
      }
    }
  },

  sendMessage: (to, message) => {
    socketClients.emit(to, 'message', message)
  },

  emitPayment: (id, success) => {
    socketClients.emit(id, 'payment', success)
  }
}

module.exports = socketClients
