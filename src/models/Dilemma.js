const { choices, outcomes } = require('../constants')

const validChoices = Object.keys(choices).map(c => choices[c])

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
    delete this.choices[id]
    this.players = this.players.filter(p => p.id !== id)
  }

  applyChoice (playerId, choice) {
    if (Object.keys(this.choices).length === this.players.length) {
      return
    }

    if (validChoices.indexOf(choice) === -1) {
      return
    }

    this.choices[playerId] = choice
    const choicePlayerIds = Object.keys(this.choices).map(id => parseInt(id, 10))
    if (choicePlayerIds.length === 2 && choicePlayerIds.length === this.players.length) {
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

  summary (playerId) {
    return {
      players: this.players.length,
      outcome: this.outcome,
      hasChosen: Boolean(this.choices[playerId]),
      hasWon: playerId === this.winner
    }
  }
}

module.exports = Dilemma
