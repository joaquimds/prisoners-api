const _ = require('lodash')
const debug = require('debug')('prisoners:dilemma')
const EventEmitter = require('events')

const ApplicationWarning = require('../errors/ApplicationWarning')
const FatalApplicationError = require('../errors/FatalApplicationError')
const Dilemma = require('../models/Dilemma')
const Player = require('../models/Player')
const storageService = require('./storage')
const { outcomes } = require('../constants')

let _playerId = 0
let _dilemmaId = 0

const recentWinWindowMinutes = parseFloat(process.env.RECENT_WIN_WINDOW_MINUTES)
const minUniqueRemoteAddresses = parseInt(process.env.MINIMUM_UNIQUE_REMOTE_ADDRESSES, 10)
const maxProportionRemoteAddress = Math.max(
  parseInt(process.env.MAXIMUM_PROPORTION_REMOTE_ADDRESS, 10),
  Math.ceil(100 / minUniqueRemoteAddresses)
)

const shufflePlayers = process.env.SHUFFLE_PLAYERS !== 'false'

const dilemmaService = {

  _players: {},
  _activePlayers: new Map(),
  _dilemmas: [],
  _stats: null,
  _statsEmitter: new EventEmitter(),
  _lastWinTimestamp: null,

  init: async () => {
    await dilemmaService.loadStats()
    await dilemmaService.loadLastWinTimestamp()
  },

  addStatsListener: (callback) => {
    dilemmaService._statsEmitter.on('update', (stats) => callback(stats))
  },

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

    dilemmaService._activePlayers.set(playerId, true)

    return dilemmaService.updateDilemmaPlayers()
  },

  removePlayer: (id) => {
    debug('Remove player', id)
    delete dilemmaService._players[id]
    return dilemmaService.deactivatePlayer(id)
  },

  deactivatePlayer: (playerId) => {
    dilemmaService._activePlayers.delete(playerId)
    const dilemmas = dilemmaService._dilemmas.filter(d => d.players.map(p => p.id).indexOf(playerId) > -1)
    for (const dilemma of dilemmas) {
      dilemma.removePlayer(playerId)
    }
    return dilemmas
  },

  updateDilemmaPlayers: () => {
    const players = Array.from(dilemmaService._activePlayers.keys()).map(id => dilemmaService._players[id])
    const waitingPlayers = players.filter(player => {
      const dilemma = dilemmaService.getDilemma(player.id)
      if (!dilemma) {
        return true
      }
      return dilemma.players.length < 2 && !dilemma.isComplete()
    })

    if (dilemmaService.hasRecentWin()) {
      const validRemoteAddresses = checkRemoteAddresses(waitingPlayers)
      if (!validRemoteAddresses) {
        throw new ApplicationWarning(ApplicationWarning.too_few_unique_ips)
      }
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

  setChoice: async (playerId, choice) => {
    const dilemma = dilemmaService.getDilemma(playerId)
    debug(`Player ${playerId} chose ${choice} in dilemma ${dilemma && dilemma.id}`)
    if (dilemma) {
      dilemma.setChoice(playerId, choice)
      const outcome = dilemma.getOutcome()
      debug(`Dilemma ${dilemma.id} is ${outcome}`)
      if (outcome !== outcomes.pending) {
        if (outcome !== outcomes.lose) {
          await dilemmaService.recordWin(Date.now())
        }
        await dilemmaService.updateStats(outcome)
      }
      return dilemma
    }
  },

  getStats: () => {
    return dilemmaService._stats
  },

  loadStats: async () => {
    let stats = null
    try {
      stats = await storageService.getData('stats')
    } catch (e) {
      debug(e.message)
    }
    dilemmaService._stats = stats || { [outcomes.split]: 0, [outcomes.lose]: 0, [outcomes.steal]: 0 }
  },

  updateStats: async (outcome) => {
    dilemmaService._stats[outcome]++
    dilemmaService._statsEmitter.emit('update', dilemmaService._stats)
    await storageService.saveData('stats', dilemmaService._stats)
  },

  loadLastWinTimestamp: async () => {
    let timestamp = null
    try {
      timestamp = await storageService.getData('lastWinTimestamp')
    } catch (e) {
      debug(e.message)
    }
    dilemmaService._lastWinTimestamp = timestamp
  },

  recordWin: async (timestamp) => {
    dilemmaService._lastWinTimestamp = timestamp
    await storageService.saveData('lastWinTimestamp', dilemmaService._lastWinTimestamp)
  },

  hasRecentWin: () => {
    const lastWinTimestamp = dilemmaService._lastWinTimestamp
    if (!lastWinTimestamp) {
      return false
    }
    const now = Date.now()
    const windowMillis = recentWinWindowMinutes * 60 * 1000
    const millisSinceLastWin = now - lastWinTimestamp
    return millisSinceLastWin <= windowMillis
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
