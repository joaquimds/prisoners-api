const ApplicationWarning = require('../errors/ApplicationWarning')
const ApplicationError = require('../errors/ApplicationError')
const FatalApplicationError = require('../errors/FatalApplicationError')
const { choices, outcomes } = require('../constants')

const validChoices = Object.keys(choices).map(c => choices[c])
const idleTime = parseFloat(process.env.DILEMMA_IDLE_SECONDS)
const maxAge = parseFloat(process.env.DILEMMA_MAX_AGE_SECONDS)

class Dilemma {
  constructor (id, roundId) {
    this.id = id
    this.roundId = roundId
    this.players = []
    this.choices = {}
    this.readyTimestamp = null
    this.endTimestamp = null
  }

  addPlayer (player) {
    if (this.players.length > 1) {
      throw new ApplicationError(ApplicationError.could_not_add_player)
    }
    this.players.push(player)
    if (this.players.length === 2) {
      this.readyTimestamp = Date.now() + idleTime * 1000
      this.endTimestamp = this.readyTimestamp + maxAge * 1000
    }
  }

  removePlayer (id) {
    this.players = this.players.filter(p => p.id !== id)
    if (!this.isComplete()) {
      this.readyTimestamp = null
      this.endTimestamp = null
      delete this.choices[id]
    }
  }

  setChoice (playerId, choice) {
    if (!validChoices.includes(choice)) {
      throw new ApplicationWarning(ApplicationWarning.invalid_choice)
    }

    const player = this.players.find(({ id }) => id === playerId)
    if (!player) {
      throw new FatalApplicationError(FatalApplicationError.invalid_player_id)
    }

    if (this.isComplete()) {
      throw new ApplicationWarning(ApplicationWarning.too_late_to_change_choice)
    }

    if (!this.readyTimestamp || Date.now() < this.readyTimestamp) {
      throw new ApplicationWarning(ApplicationWarning.too_early_to_choose)
    }

    this.choices[playerId] = choice
  }

  isComplete () {
    if (this.endTimestamp && Date.now() > this.endTimestamp) {
      return true
    }
    const choiceCount = Object.keys(this.choices).length
    return choiceCount === 2
  }

  isWaitingForMorePlayers () {
    return this.players.length < 2 && !this.isComplete()
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
    const choice = this.choices[playerId] || null
    const hasWon = this.hasWon(playerId, outcome)
    const readyTimestamp = this.readyTimestamp
    const endTimestamp = this.endTimestamp

    return {
      players,
      outcome,
      choice,
      hasWon,
      readyTimestamp,
      endTimestamp
    }
  }
}

module.exports = Dilemma
