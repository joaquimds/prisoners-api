const Dilemma = require('../models/Dilemma')
const Player = require('../models/Player')

const dilemmaService = {

  _dilemmas: [],

  newPlayer: (id) => {
    const player = new Player(id)
    let dilemma = dilemmaService._dilemmas.find(d => d.players.length < 2)
    if (!dilemma) {
      dilemma = new Dilemma()
      dilemmaService._dilemmas.push(dilemma)
    }
    dilemma.addPlayer(player)
    return dilemma
  },

  removePlayer: (id) => {
    const dilemma = dilemmaService.getDilemma(id)
    dilemma.removePlayer(id)
    return dilemma
  },

  getDilemma: (playerId) => {
    return dilemmaService._dilemmas.find(d => d.players.map(p => p.id).indexOf(playerId) > -1)
  },

  applyChoice: (playerId, choice) => {
    const dilemma = dilemmaService.getDilemma(playerId)
    dilemma.applyChoice(playerId, choice)
    return dilemma
  }

}

module.exports = dilemmaService
