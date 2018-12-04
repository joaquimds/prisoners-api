const debug = require('debug')('prisoners:socket')

const { outcomes } = require('../constants')

const Dilemma = require('../models/Dilemma')
const Player = require('../models/Player')

const dilemmaService = {

  _dilemmas: [],

  newPlayer: (id) => {
    debug('new player', id)
    const player = new Player(id)
    let dilemma = dilemmaService._dilemmas.find(d => d.players.length < 2 && d.outcome === outcomes.pending)
    if (!dilemma) {
      dilemma = new Dilemma()
      dilemmaService._dilemmas.push(dilemma)
    }
    dilemma.addPlayer(player)
    return dilemma
  },

  removePlayer: (id) => {
    debug('remove player', id)
    const dilemma = dilemmaService.getDilemma(id)
    if (dilemma) {
      dilemma.removePlayer(id)
      return dilemma
    }
  },

  getDilemma: (playerId) => {
    return dilemmaService._dilemmas.find(d => d.players.map(p => p.id).indexOf(playerId) > -1)
  },

  applyChoice: (playerId, choice) => {
    debug('apply choice', playerId, choice)
    const dilemma = dilemmaService.getDilemma(playerId)
    if (dilemma) {
      dilemma.applyChoice(playerId, choice)
      return dilemma
    }
  }

}

module.exports = dilemmaService
