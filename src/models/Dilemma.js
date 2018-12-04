const { choices, outcomes } = require('../constants')

class Dilemma {
  constructor () {
    this.players = []
    this.choices = {}
    this.outcome = outcomes.pending
    this.winner = null
  }

  addPlayer (player) {
    this.players.push(player)
  }

  removePlayer (id) {
    this.players = this.players.filter(p => p.id !== id)
    delete this.choices[id]
  }

  applyChoice (playerId, choice) {
    if (this.choices[playerId]) {
      return
    }

    this.choices[playerId] = choice
    this.outcome = outcomes.pending
    this.winner = null

    const choicePlayerIds = Object.keys(this.choices)
    if (choicePlayerIds.length === this.players.length) {
      let playerIdsByChoice = {
        [choices.steal]: [],
        [choices.split]: []
      }
      for (const playerId of choicePlayerIds) {
        const choice = this.choices[playerId]
        playerIdsByChoice[choice].push(playerId)
      }
      const stealCount = playerIdsByChoice[choices.steal].length
      if (stealCount > 0) {
        if (stealCount > 1) {
          this.outcome = outcomes.lose
          return
        }
        this.outcome = outcomes.steal
        this.winner = playerIdsByChoice[choices.steal][0]
        return
      }
      this.outcome = outcomes.split
    }
  }

  summary () {
    return {
      players: this.players.length,
      outcome: this.outcome,
      winner: this.winner
    }
  }
}

module.exports = Dilemma
