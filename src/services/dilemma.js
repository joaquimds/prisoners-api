const _ = require('lodash')
const debug = require('debug')('prisoners:dilemma')

const ApplicationWarning = require('../errors/ApplicationWarning')
const FatalApplicationError = require('../errors/FatalApplicationError')
const Dilemma = require('../models/Dilemma')
const Player = require('../models/Player')

let _playerId = 0
let _dilemmaId = 0

const minUniqueRemoteAddresses = parseInt(process.env.MINIMUM_UNIQUE_REMOTE_ADDRESSES, 10)
const maxProportionRemoteAddress = parseInt(process.env.MAXIMUM_PROPORTION_REMOTE_ADDRESS, 10)
const shufflePlayers = process.env.SHUFFLE_PLAYERS !== 'false'

const dilemmaService = {

  _players: {},
  _activePlayers: {},
  _dilemmas: [],

  createPlayer: (remoteAddress) => {
    const id = _playerId++
    debug('Create player', id)
    const player = new Player(id, remoteAddress)
    dilemmaService._players[id] = player
    return player
  },

  activatePlayer: (playerId) => {
    debug('Add player', playerId)
    const player = dilemmaService._players[playerId]
    if (!player) {
      throw new FatalApplicationError(FatalApplicationError.invalid_player_id)
    }

    dilemmaService._activePlayers[playerId] = true

    return dilemmaService.updateDilemmaPlayers()
  },

  removePlayer: (id) => {
    debug('Remove player', id)
    delete dilemmaService._players[id]
    return dilemmaService.deactivatePlayer(id)
  },

  deactivatePlayer: (playerId) => {
    delete dilemmaService._activePlayers[playerId]
    const dilemmas = dilemmaService._dilemmas.filter(d => d.players.map(p => p.id).indexOf(playerId) > -1)
    for (const dilemma of dilemmas) {
      dilemma.removePlayer(playerId)
    }
    return dilemmas
  },

  updateDilemmaPlayers: () => {
    const players = Object.keys(dilemmaService._activePlayers).map(id => dilemmaService._players[id])
    const waitingPlayers = players.filter(player => {
      const dilemma = dilemmaService.getDilemma(player.id)
      if (!dilemma) {
        return true
      }
      return dilemma.players.length < 2 && !dilemma.isComplete()
    })

    const validRemoteAddresses = checkRemoteAddresses(waitingPlayers)
    if (!validRemoteAddresses) {
      throw new ApplicationWarning(ApplicationWarning.too_few_unique_ips)
    }

    const updated = []
    const shuffledPlayers = shufflePlayers ? _.shuffle(waitingPlayers) : _.clone(waitingPlayers)

    while (shuffledPlayers.length > 1) {
      const player = shuffledPlayers.shift()
      const opponent = removeValidOpponent(player, shuffledPlayers)
      if (!opponent) {
        break
      }

      let dilemma = dilemmaService.getDilemma(player.id)
      if (!dilemma) {
        const id = _dilemmaId++
        dilemma = new Dilemma(id)
        dilemmaService._dilemmas.push(dilemma)
        dilemma.addPlayer(player)
      }

      const altDilemma = dilemmaService.getDilemma(opponent.id)
      if (altDilemma) {
        altDilemma.removePlayer(opponent.id)
      }
      dilemma.addPlayer(opponent)

      updated.push(dilemma)
    }
    return updated
  },

  getDilemma: (playerId) => {
    return dilemmaService._dilemmas.find(d => d.players.map(p => p.id).indexOf(playerId) > -1)
  },

  setChoice: (playerId, choice) => {
    const dilemma = dilemmaService.getDilemma(playerId)
    debug(`Player ${playerId} chose ${choice} in dilemma ${dilemma && dilemma.id}`)
    if (dilemma) {
      dilemma.setChoice(playerId, choice)
      debug(`Dilemma ${dilemma.id} is ${dilemma.getOutcome()}`)
      return dilemma
    }
  }
}

const checkRemoteAddresses = (players) => {
  let maxRemoteAddressCount = 0
  const remoteAddressCount = {}
  for (const player of players) {
    let count = remoteAddressCount[player.remoteAddress] || 0
    count++
    if (count > maxRemoteAddressCount) {
      maxRemoteAddressCount = count
    }
    remoteAddressCount[player.remoteAddress] = count
  }

  const proportion = maxRemoteAddressCount / players.length * 100
  if (proportion > maxProportionRemoteAddress) {
    return false
  }
  const uniqueCount = Object.keys(remoteAddressCount).length
  return uniqueCount >= minUniqueRemoteAddresses
}

const removeValidOpponent = (player, opponents) => {
  if (minUniqueRemoteAddresses < 2) {
    return opponents.shift()
  }
  const index = opponents.findIndex(opponent => opponent.remoteAddress !== player.remoteAddress)
  if (index === -1) {
    return null
  }
  return opponents.splice(index, 1)[0]
}

module.exports = dilemmaService
