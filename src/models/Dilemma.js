const ApplicationError = require('../errors/ApplicationError')
const { choices, outcomes } = require('../constants')

const validChoices = Object.keys(choices).map(c => choices[c])
const idleTime = parseFloat(process.env.DILEMMA_IDLE_SECONDS)

class Dilemma {
  constructor (id) {
    this.id = id
    this.players = []
    this.choices = {}
    this.readyTimestamp = null
  }

  addPlayer (player) {
    if (this.players.length > 1) {
      throw new ApplicationError(ApplicationError.could_not_add_player)
    }
    this.players.push(player)
    if (this.players.length === 2) {
      this.readyTimestamp = Date.now() + idleTime * 1000
    }
  }

  removePlayer (id) {
    this.players = this.players.filter(p => p.id !== id)
    if (!this.isComplete()) {
      this.readyTimestamp = null
      delete this.choices[id]
    }
  }

  setChoice (playerId, choice) {
    if (validChoices.indexOf(choice) === -1) {
      throw new ApplicationError(ApplicationError.invalid_choice)
    }

    const player = this.players.find(({ id }) => id === playerId)
    if (!player) {
      throw new ApplicationError(ApplicationError.invalid_player_id, true)
    }

    if (this.isComplete()) {
      throw new ApplicationError(ApplicationError.too_late_to_change_choice)
    }

    if (!this.readyTimestamp || Date.now() < this.readyTimestamp) {
      throw new ApplicationError(ApplicationError.too_early_to_choose)
    }

    this.choices[playerId] = choice
  }

  isComplete () {
    const choiceCount = Object.keys(this.choices).length
    return choiceCount === 2
  }

  getOutcome () {
    const playerChoices = Object.keys(this.choices).map(playerId => this.choices[playerId])
    if (playerChoices.length < 2) {
      return outcomes.pending
    }
    const stealCount = playerChoices.filter(choice => choice === choices.steal).length
    if (stealCount === 0) {
      return outcomes.split
    }
    if (stealCount === 1) {
      return outcomes.steal
    }
    return outcomes.lose
  }

  hasWon (playerId, outcome = this.getOutcome()) {
    if (outcome === outcomes.split) {
      return true
    }
    if (outcome === outcomes.steal) {
      return this.choices[playerId] === outcomes.steal
    }
    return false
  }

  summary (playerId) {
    const players = this.players.length
    const outcome = this.getOutcome()
    const hasChosen = Boolean(this.choices[playerId])
    const hasWon = this.hasWon(playerId, outcome)
    const readyTimestamp = this.readyTimestamp

    return {
      players,
      outcome,
      hasChosen,
      hasWon,
      readyTimestamp
    }
  }
}

module.exports = Dilemma
