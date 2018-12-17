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

const initialRecentWinWindowMinutes = parseFloat(process.env.RECENT_WIN_WINDOW_MINUTES)
const initialMinUniqueRemoteAddresses = parseInt(process.env.MINIMUM_UNIQUE_REMOTE_ADDRESSES, 10)
const maxProportionRemoteAddress = parseInt(process.env.MAXIMUM_PROPORTION_REMOTE_ADDRESS, 10)

const shufflePlayers = process.env.SHUFFLE_PLAYERS !== 'false'

const dilemmaService = {

  _players: {},
  _activePlayers: new Map(),
  _winningRemoteAddresses: [],
  _dilemmas: [],
  _stats: null,
  _statsEmitter: new EventEmitter(),
  _maxWinsInOneDay: 0,
  _winTimestamps: [],

  init: async () => {
    await dilemmaService._loadStats()
    await dilemmaService._loadWinMetadata()
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
    const dilemmas = dilemmaService._dilemmas.filter(d => d.players.map(p => p.id).includes(playerId))
    for (const dilemma of dilemmas) {
      dilemma.removePlayer(playerId)
    }
    return dilemmas
  },

  updateDilemmaPlayers: () => {
    const players = Array.from(dilemmaService._activePlayers.keys()).map(id => dilemmaService._players[id])
    const activePlayers = []
    const waitingPlayers = []
    for (const player of players) {
      const dilemma = dilemmaService.getDilemma(player.id)
      if (!dilemma || dilemma.isWaitingForMorePlayers()) {
        waitingPlayers.push(player)
        continue
      }
      activePlayers.push(player)
    }

    const restrictReason = dilemmaService._shouldRestrictByRemoteAddress(waitingPlayers, activePlayers)
    if (restrictReason) {
      const winsPerQuarter = Math.floor(dilemmaService._maxWinsInOneDay / 4)
      const minUniqueRemoteAddresses = initialMinUniqueRemoteAddresses * (winsPerQuarter + 1)
      const validRemoteAddresses = dilemmaService._checkRemoteAddresses(
        Math.min(minUniqueRemoteAddresses, 30),
        waitingPlayers.map(p => p.remoteAddress),
        activePlayers.map(p => p.remoteAddress)
      )
      if (!validRemoteAddresses) {
        throw new ApplicationWarning(ApplicationWarning.too_few_unique_ips + ` (minimum ${minUniqueRemoteAddresses})`, restrictReason)
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

  _shouldRestrictByRemoteAddress: (waitingPlayers, activePlayers) => {
    if (dilemmaService._hasRecentWin()) {
      return 'Recent win'
    }
    if (activePlayers.length) {
      return 'Active players'
    }
    for (const player of waitingPlayers) {
      if (dilemmaService._winningRemoteAddresses.includes(player.remoteAddress)) {
        return 'Previous winner'
      }
    }
    return false
  },

  getDilemma: (playerId) => {
    return dilemmaService._dilemmas.find(d => d.players.map(p => p.id).includes(playerId))
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
          const winners = dilemma.players.filter(p => dilemma.hasWon(p.id, outcome))
          await dilemmaService._recordWin(winners, Date.now())
        }
        await dilemmaService._updateStats(outcome)
      }
      return dilemma
    }
  },

  getStats: () => {
    return dilemmaService._stats
  },

  _updateStats: async (outcome) => {
    dilemmaService._stats[outcome]++
    dilemmaService._statsEmitter.emit('update', dilemmaService._stats)
    await storageService.saveData('stats', dilemmaService._stats)
  },

  _recordWin: async (winners, timestamp) => {
    dilemmaService._winTimestamps.push(timestamp)
    const pastDayStart = timestamp - 24 * 60 * 60 * 1000
    dilemmaService._winTimestamps = dilemmaService._winTimestamps.filter(t => t > pastDayStart)
    if (dilemmaService._winTimestamps.length > dilemmaService._maxWinsInOneDay) {
      dilemmaService._maxWinsInOneDay = dilemmaService._winTimestamps.length
    }
    for (const winner of winners) {
      const remoteAddress = winner.remoteAddress
      if (!dilemmaService._winningRemoteAddresses.includes(remoteAddress)) {
        dilemmaService._winningRemoteAddresses.push(remoteAddress)
      }
    }
    await storageService.saveData('winMetadata', {
      timestamps: dilemmaService._winTimestamps,
      maxInOneDay: dilemmaService._maxWinsInOneDay,
      remoteAddresses: dilemmaService._winningRemoteAddresses
    })
  },

  _checkRemoteAddresses: (minUniqueRemoteAddresses, remoteAddresses, ignoredAddresses) => {
    const validRemoteAddresses = remoteAddresses.filter(address => !ignoredAddresses.includes(address))
    let maxRemoteAddressCount = 0
    const remoteAddressCount = {}
    for (const remoteAddress of validRemoteAddresses) {
      let count = remoteAddressCount[remoteAddress] || 0
      count++
      if (count > maxRemoteAddressCount) {
        maxRemoteAddressCount = count
      }
      remoteAddressCount[remoteAddress] = count
    }

    const maxProportion = Math.max(
      maxProportionRemoteAddress,
      100 / minUniqueRemoteAddresses
    )
    const proportion = maxRemoteAddressCount / remoteAddresses.length * 100
    if (proportion > maxProportion) {
      return false
    }
    const uniqueCount = Object.keys(remoteAddressCount).length
    return uniqueCount >= minUniqueRemoteAddresses
  },

  _hasRecentWin: () => {
    const lastWinTimestamp = dilemmaService._winTimestamps[dilemmaService._winTimestamps.length - 1]
    if (!lastWinTimestamp) {
      return false
    }
    const now = Date.now()
    const maxWinsSquared = dilemmaService._maxWinsInOneDay * dilemmaService._maxWinsInOneDay
    const windowMillis = Math.min(
      maxWinsSquared * initialRecentWinWindowMinutes * 60 * 1000,
      180 * 60 * 1000
    )
    const millisSinceLastWin = now - lastWinTimestamp
    return millisSinceLastWin <= windowMillis
  },

  _loadStats: async () => {
    const stats = await storageService.getData('stats')
    dilemmaService._stats = stats || { [outcomes.split]: 0, [outcomes.lose]: 0, [outcomes.steal]: 0 }
  },

  _loadWinMetadata: async () => {
    const metadata = await storageService.getData('winMetadata')
    let maxWinsInOneDay = 0
    let winTimestamps = []
    let winningRemoteAddresses = []
    if (metadata) {
      maxWinsInOneDay = metadata.maxInOneDay || maxWinsInOneDay
      winTimestamps = metadata.timestamps || winTimestamps
      winningRemoteAddresses = metadata.remoteAddress || winningRemoteAddresses
    }
    dilemmaService._maxWinsInOneDay = maxWinsInOneDay
    dilemmaService._winTimestamps = winTimestamps
    dilemmaService._winningRemoteAddresses = winningRemoteAddresses
  }
}

const removeValidOpponent = (player, opponents) => {
  if (initialMinUniqueRemoteAddresses < 2) {
    return opponents.shift()
  }
  const index = opponents.findIndex(opponent => opponent.remoteAddress !== player.remoteAddress)
  if (index === -1) {
    return null
  }
  return opponents.splice(index, 1)[0]
}

module.exports = dilemmaService
