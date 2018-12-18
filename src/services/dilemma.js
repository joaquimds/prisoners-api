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
let _roundId = 0

const recentWinWindowMinutes = parseFloat(process.env.RECENT_WIN_WINDOW_MINUTES)
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
  _lastWinTimestamp: null,
  _lastWinRoundId: null,
  _minRemoteAddressesScale: 1,
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
      const minUniqueRemoteAddresses = Math.floor(
        initialMinUniqueRemoteAddresses * dilemmaService._minRemoteAddressesScale
      )
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
        dilemma = new Dilemma(id, _roundId)
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
    if (updated.length) {
      _roundId++
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
          await dilemmaService._recordWin(dilemma, outcome, Date.now())
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

  _recordWin: async (dilemma, outcome, timestamp) => {
    const winners = dilemma.players.filter(p => dilemma.hasWon(p.id, outcome))
    dilemmaService._updateLastWinTimestamp(dilemma.roundId, timestamp)
    for (const winner of winners) {
      const remoteAddress = winner.remoteAddress
      if (!dilemmaService._winningRemoteAddresses.includes(remoteAddress)) {
        dilemmaService._winningRemoteAddresses.push(remoteAddress)
      }
    }
    await storageService.saveData('winMetadata', {
      lastWinTimestamp: dilemmaService._lastWinTimestamp,
      minRemoteAddressesScale: dilemmaService._minRemoteAddressesScale,
      winningRemoteAddresses: dilemmaService._winningRemoteAddresses
    })
  },

  _updateLastWinTimestamp: (roundId, winTimestamp) => {
    const lastWinTimestamp = dilemmaService._lastWinTimestamp
    dilemmaService._lastWinTimestamp = winTimestamp

    if (!lastWinTimestamp || dilemmaService._lastWinRoundId === roundId) {
      return
    }

    dilemmaService._lastWinRoundId = roundId

    const windowMillis = recentWinWindowMinutes * 60 * 1000
    const windowCount = Math.ceil((winTimestamp - lastWinTimestamp) / windowMillis)

    dilemmaService._minRemoteAddressesScale = dilemmaService._minRemoteAddressesScale + 1 / windowCount
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
    if (!dilemmaService._lastWinTimestamp) {
      return false
    }
    const now = Date.now()
    const windowMillis = recentWinWindowMinutes * 60 * 1000
    const millisSinceLastWin = now - dilemmaService._lastWinTimestamp
    return millisSinceLastWin <= windowMillis
  },

  _loadStats: async () => {
    const stats = await storageService.getData('stats')
    dilemmaService._stats = stats || { [outcomes.split]: 0, [outcomes.lose]: 0, [outcomes.steal]: 0 }
  },

  _loadWinMetadata: async () => {
    const metadata = await storageService.getData('winMetadata')
    let minRemoteAddressesScale = 1
    let lastWinTimestamp = 0
    let winningRemoteAddresses = []
    if (metadata) {
      minRemoteAddressesScale = metadata.minRemoteAddressesScale || minRemoteAddressesScale
      lastWinTimestamp = metadata.lastWinTimestamp || lastWinTimestamp
      winningRemoteAddresses = metadata.winningRemoteAddresses || winningRemoteAddresses
    }
    dilemmaService._minRemoteAddressesScale = minRemoteAddressesScale
    dilemmaService._lastWinTimestamp = lastWinTimestamp
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
