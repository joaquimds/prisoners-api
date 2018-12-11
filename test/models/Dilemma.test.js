const _ = require('lodash')

const { describe, it } = require('mocha')
const { assert } = require('chai')

const ApplicationWarning = require('../../src/errors/ApplicationWarning')
const ApplicationError = require('../../src/errors/ApplicationError')
const FatalApplicationError = require('../../src/errors/FatalApplicationError')

const Dilemma = require('../../src/models/Dilemma')
const Player = require('../../src/models/Player')
const { sleep } = require('../util')

const DILEMMA_IDLE_TIME = parseFloat(process.env.DILEMMA_IDLE_SECONDS) * 1000
const DILEMMA_MAX_AGE = parseFloat(process.env.DILEMMA_MAX_AGE_SECONDS) * 1000

describe('Dilemma', () => {
  const alice = new Player(0, '::1')
  const bob = new Player(1, '::2')

  describe('constructor', () => {
    it('creates instance', () => {
      const dilemma = new Dilemma(0)
      assert.deepEqual(dilemma, {
        id: 0,
        choices: {},
        players: [],
        readyTimestamp: null,
        endTimestamp: null
      })
    })
  })

  describe('add player', () => {
    const dilemma = new Dilemma(0)

    it('adds first player', () => {
      dilemma.addPlayer(alice)
      assert.deepEqual(dilemma, {
        id: 0,
        choices: {},
        players: [{ id: 0, remoteAddress: '::1' }],
        readyTimestamp: null,
        endTimestamp: null
      })
    })

    it('adds second player and sets timestamps', () => {
      const minReadyTimestamp = Date.now() + DILEMMA_IDLE_TIME
      dilemma.addPlayer(bob)
      const maxReadyTimestamp = Date.now() + DILEMMA_IDLE_TIME
      const minEndTimestamp = minReadyTimestamp + DILEMMA_MAX_AGE
      const maxEndTimestamp = maxReadyTimestamp + DILEMMA_MAX_AGE
      assert.deepEqual(_.omit(dilemma, ['readyTimestamp', 'endTimestamp']), {
        id: 0,
        choices: {},
        players: [{ id: 0, remoteAddress: '::1' }, { id: 1, remoteAddress: '::2' }]
      })
      assert.ok(dilemma.readyTimestamp >= minReadyTimestamp && dilemma.readyTimestamp <= maxReadyTimestamp)
      assert.ok(dilemma.endTimestamp >= minEndTimestamp && dilemma.endTimestamp <= maxEndTimestamp)
    })

    it('will not add third player', () => {
      try {
        dilemma.addPlayer(new Player())
        assert.fail()
      } catch (e) {
        assert.equal(e.message, ApplicationError.could_not_add_player)
      }
    })
  })

  describe('add choice', () => {
    it('does not allow invalid choice', () => {
      try {
        const dilemma = new Dilemma(0)
        dilemma.setChoice(0, 'foo')
        assert.fail()
      } catch (e) {
        assert.equal(e.message, ApplicationWarning.invalid_choice)
      }
    })

    it('does not allow invalid player', () => {
      try {
        const dilemma = new Dilemma(0)
        dilemma.addPlayer(alice)
        dilemma.setChoice(1, 'Split')
        assert.fail()
      } catch (e) {
        assert.equal(e.message, FatalApplicationError.invalid_player_id)
      }
    })

    it('does not allow early choice', async () => {
      const dilemma = new Dilemma(0)
      dilemma.addPlayer(alice)
      try {
        dilemma.setChoice(0, 'Split')
        assert.fail()
      } catch (e) {
        assert.equal(e.message, ApplicationWarning.too_early_to_choose)
      }
      dilemma.addPlayer(bob)
      try {
        dilemma.setChoice(0, 'Split')
        assert.fail()
      } catch (e) {
        assert.equal(e.message, ApplicationWarning.too_early_to_choose)
      }
      await sleep(DILEMMA_IDLE_TIME)
      dilemma.setChoice(0, 'Split')
      assert.deepEqual(simplifyDilemma(dilemma), {
        id: 0,
        choices: { '0': 'Split' },
        players: [{ id: 0, remoteAddress: '::1' }, { id: 1, remoteAddress: '::2' }]
      })
    })

    it('does not allow late choice', async () => {
      const dilemma = new Dilemma(0)
      dilemma.addPlayer(alice)
      dilemma.addPlayer(bob)
      await sleep(DILEMMA_IDLE_TIME)
      await sleep(DILEMMA_MAX_AGE)
      try {
        dilemma.setChoice(0, 'Split')
        assert.fail()
      } catch (e) {
        assert.equal(e.message, ApplicationWarning.too_late_to_change_choice)
      }
    })

    it('does not allow player to change their choice if all players have chosen', async () => {
      const dilemma = new Dilemma(0)
      dilemma.addPlayer(alice)
      dilemma.addPlayer(bob)
      await sleep(DILEMMA_IDLE_TIME)
      dilemma.setChoice(0, 'Split')
      assert.deepEqual(dilemma.choices, { '0': 'Split' })
      dilemma.setChoice(0, 'Steal')
      assert.deepEqual(dilemma.choices, { '0': 'Steal' })
      dilemma.setChoice(1, 'Split')
      assert.deepEqual(dilemma.choices, { '0': 'Steal', '1': 'Split' })
      try {
        dilemma.setChoice(0, 'Split')
      } catch (e) {
        assert.equal(e.message, ApplicationWarning.too_late_to_change_choice)
      }
    })
  })

  describe('remove player', () => {
    it('removes player', async () => {
      const dilemma = new Dilemma(0)
      dilemma.addPlayer(alice)
      dilemma.addPlayer(bob)
      assert.ok(dilemma.readyTimestamp)
      await sleep(DILEMMA_IDLE_TIME)
      dilemma.setChoice(0, 'Split')
      assert.deepEqual(simplifyDilemma(dilemma), {
        id: 0,
        choices: { '0': 'Split' },
        players: [{ id: 0, remoteAddress: '::1' }, { id: 1, remoteAddress: '::2' }]
      })
      dilemma.removePlayer(0)
      assert.deepEqual(dilemma, {
        id: 0,
        choices: {},
        players: [{ id: 1, remoteAddress: '::2' }],
        readyTimestamp: null,
        endTimestamp: null
      })
    })

    it('doesn\'t remove choice if all players have chosen', async () => {
      const dilemma = new Dilemma(0)
      dilemma.addPlayer(alice)
      dilemma.addPlayer(bob)
      assert.ok(dilemma.readyTimestamp)
      await sleep(DILEMMA_IDLE_TIME)
      dilemma.setChoice(0, 'Split')
      dilemma.setChoice(1, 'Split')
      dilemma.removePlayer(0)
      assert.deepEqual(simplifyDilemma(dilemma), {
        id: 0,
        choices: { '0': 'Split', '1': 'Split' },
        players: [{ id: 1, remoteAddress: '::2' }]
      })
    })
  })

  describe('summary', () => {
    const dilemma = new Dilemma(0)

    it('shows correct initial summary', () => {
      assert.deepEqual(dilemma.summary(0), {
        players: 0,
        outcome: 'Pending',
        hasChosen: false,
        hasWon: false,
        readyTimestamp: null,
        endTimestamp: null
      })
    })

    it('shows correct summary after one player joins', () => {
      dilemma.addPlayer(alice)
      assert.deepEqual(dilemma.summary(0), {
        players: 1,
        outcome: 'Pending',
        hasChosen: false,
        hasWon: false,
        readyTimestamp: null,
        endTimestamp: null
      })
    })

    it('shows correct summary after two players join', () => {
      dilemma.addPlayer(bob)
      assert.deepEqual(simplifyDilemma(dilemma.summary(0)), {
        players: 2,
        outcome: 'Pending',
        hasChosen: false,
        hasWon: false
      })
    })

    it('shows correct summary after first choice', async () => {
      await sleep(DILEMMA_IDLE_TIME)
      dilemma.setChoice(0, 'Split')
      assert.deepEqual(simplifyDilemma(dilemma.summary(0)), {
        players: 2,
        outcome: 'Pending',
        hasChosen: true,
        hasWon: false
      })
      assert.deepEqual(simplifyDilemma(dilemma.summary(1)), {
        players: 2,
        outcome: 'Pending',
        hasChosen: false,
        hasWon: false
      })
    })

    it('shows correct summary after second choice', async () => {
      dilemma.setChoice(1, 'Split')
      assert.deepEqual(simplifyDilemma(dilemma.summary(0)), {
        players: 2,
        outcome: 'Split',
        hasChosen: true,
        hasWon: true
      })
      assert.deepEqual(simplifyDilemma(dilemma.summary(1)), {
        players: 2,
        outcome: 'Split',
        hasChosen: true,
        hasWon: true
      })
    })

    it('shows correct summary for steal', async () => {
      dilemma.choices['1'] = 'Steal'
      assert.deepEqual(simplifyDilemma(dilemma.summary(0)), {
        players: 2,
        outcome: 'Steal',
        hasChosen: true,
        hasWon: false
      })
      assert.deepEqual(simplifyDilemma(dilemma.summary(1)), {
        players: 2,
        outcome: 'Steal',
        hasChosen: true,
        hasWon: true
      })
    })

    it('shows correct summary for lose', async () => {
      dilemma.choices['0'] = 'Steal'
      assert.deepEqual(simplifyDilemma(dilemma.summary(0)), {
        players: 2,
        outcome: 'Lose',
        hasChosen: true,
        hasWon: false
      })
      assert.deepEqual(simplifyDilemma(dilemma.summary(1)), {
        players: 2,
        outcome: 'Lose',
        hasChosen: true,
        hasWon: false
      })
    })
  })
})

const simplifyDilemma = (dilemma) => _.omit(dilemma, ['readyTimestamp', 'endTimestamp'])