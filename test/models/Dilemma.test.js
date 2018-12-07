const _ = require('lodash')

const { describe, it } = require('mocha')
const { assert } = require('chai')

const Dilemma = require('../../src/models/Dilemma')
const Player = require('../../src/models/Player')
const { sleep } = require('../util')

const DILEMMA_IDLE_TIME = parseFloat(process.env.DILEMMA_IDLE_TIME)

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
        readyTimestamp: null
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
        readyTimestamp: null
      })
    })

    it('adds second player and sets readyTimestamp', () => {
      const minReadyTimestamp = Date.now() + 1000 * DILEMMA_IDLE_TIME
      dilemma.addPlayer(bob)
      const maxReadyTimestamp = Date.now() + 1000 * DILEMMA_IDLE_TIME
      assert.deepEqual(_.omit(dilemma, ['readyTimestamp']), {
        id: 0,
        choices: {},
        players: [{ id: 0, remoteAddress: '::1' }, { id: 1, remoteAddress: '::2' }]
      })
      assert.ok(dilemma.readyTimestamp >= minReadyTimestamp && dilemma.readyTimestamp <= maxReadyTimestamp)
    })

    it('will not add third player', () => {
      try {
        dilemma.addPlayer(new Player())
        assert.fail()
      } catch (e) {
        assert.equal(e.message, 'Could not add new player')
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
        assert.equal(e.message, 'Invalid choice')
      }
    })

    it('does not allow invalid player', () => {
      try {
        const dilemma = new Dilemma(0)
        dilemma.addPlayer(alice)
        dilemma.setChoice(1, 'Split')
        assert.fail()
      } catch (e) {
        assert.equal(e.message, 'Invalid player id')
      }
    })

    it('does not allow early choice', async () => {
      const dilemma = new Dilemma(0)
      dilemma.addPlayer(alice)
      try {
        dilemma.setChoice(0, 'Split')
        assert.fail()
      } catch (e) {
        assert.equal(e.message, 'Can\'t choose yet')
      }
      dilemma.addPlayer(bob)
      try {
        dilemma.setChoice(0, 'Split')
        assert.fail()
      } catch (e) {
        assert.equal(e.message, 'Can\'t choose yet')
      }
      await sleep(DILEMMA_IDLE_TIME * 1000)
      dilemma.setChoice(0, 'Split')
      assert.deepEqual(_.omit(dilemma, ['readyTimestamp']), {
        id: 0,
        choices: { '0': 'Split' },
        players: [{ id: 0, remoteAddress: '::1' }, { id: 1, remoteAddress: '::2' }]
      })
    })

    it('does not allow player to change their choice if all players have chosen', async () => {
      const dilemma = new Dilemma(0)
      dilemma.addPlayer(alice)
      dilemma.addPlayer(bob)
      await sleep(DILEMMA_IDLE_TIME * 1000)
      dilemma.setChoice(0, 'Split')
      assert.deepEqual(dilemma.choices, { '0': 'Split' })
      dilemma.setChoice(0, 'Steal')
      assert.deepEqual(dilemma.choices, { '0': 'Steal' })
      dilemma.setChoice(1, 'Split')
      assert.deepEqual(dilemma.choices, { '0': 'Steal', '1': 'Split' })
      try {
        dilemma.setChoice(0, 'Split')
      } catch (e) {
        assert.equal(e.message, 'Can\'t change choice as all players have chosen')
      }
    })
  })

  describe('remove player', () => {
    it('removes player', async () => {
      const dilemma = new Dilemma(0)
      dilemma.addPlayer(alice)
      dilemma.addPlayer(bob)
      assert.ok(dilemma.readyTimestamp)
      await sleep(DILEMMA_IDLE_TIME * 1000)
      dilemma.setChoice(0, 'Split')
      assert.deepEqual(_.omit(dilemma, ['readyTimestamp']), {
        id: 0,
        choices: { '0': 'Split' },
        players: [{ id: 0, remoteAddress: '::1' }, { id: 1, remoteAddress: '::2' }]
      })
      dilemma.removePlayer(0)
      assert.deepEqual(dilemma, {
        id: 0,
        choices: {},
        players: [{ id: 1, remoteAddress: '::2' }],
        readyTimestamp: null
      })
    })

    it('doesn\'t remove choice if all players have chosen', async () => {
      const dilemma = new Dilemma(0)
      dilemma.addPlayer(alice)
      dilemma.addPlayer(bob)
      assert.ok(dilemma.readyTimestamp)
      await sleep(DILEMMA_IDLE_TIME * 1000)
      dilemma.setChoice(0, 'Split')
      dilemma.setChoice(1, 'Split')
      dilemma.removePlayer(0)
      assert.deepEqual(_.omit(dilemma, ['readyTimestamp']), {
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
        readyTimestamp: null
      })
    })

    it('shows correct summary after one player joins', () => {
      dilemma.addPlayer(alice)
      assert.deepEqual(dilemma.summary(0), {
        players: 1,
        outcome: 'Pending',
        hasChosen: false,
        hasWon: false,
        readyTimestamp: null
      })
    })

    it('shows correct summary after two players join', () => {
      dilemma.addPlayer(bob)
      assert.deepEqual(_.omit(dilemma.summary(0), 'readyTimestamp'), {
        players: 2,
        outcome: 'Pending',
        hasChosen: false,
        hasWon: false
      })
    })

    it('shows correct summary after first choice', async () => {
      await sleep(DILEMMA_IDLE_TIME * 1000)
      dilemma.setChoice(0, 'Split')
      assert.deepEqual(_.omit(dilemma.summary(0), 'readyTimestamp'), {
        players: 2,
        outcome: 'Pending',
        hasChosen: true,
        hasWon: false
      })
      assert.deepEqual(_.omit(dilemma.summary(1), 'readyTimestamp'), {
        players: 2,
        outcome: 'Pending',
        hasChosen: false,
        hasWon: false
      })
    })

    it('shows correct summary after second choice', async () => {
      dilemma.setChoice(1, 'Split')
      assert.deepEqual(_.omit(dilemma.summary(0), 'readyTimestamp'), {
        players: 2,
        outcome: 'Split',
        hasChosen: true,
        hasWon: true
      })
      assert.deepEqual(_.omit(dilemma.summary(1), 'readyTimestamp'), {
        players: 2,
        outcome: 'Split',
        hasChosen: true,
        hasWon: true
      })
    })

    it('shows correct summary for steal', async () => {
      dilemma.choices['1'] = 'Steal'
      assert.deepEqual(_.omit(dilemma.summary(0), 'readyTimestamp'), {
        players: 2,
        outcome: 'Steal',
        hasChosen: true,
        hasWon: false
      })
      assert.deepEqual(_.omit(dilemma.summary(1), 'readyTimestamp'), {
        players: 2,
        outcome: 'Steal',
        hasChosen: true,
        hasWon: true
      })
    })

    it('shows correct summary for lose', async () => {
      dilemma.choices['0'] = 'Steal'
      assert.deepEqual(_.omit(dilemma.summary(0), 'readyTimestamp'), {
        players: 2,
        outcome: 'Lose',
        hasChosen: true,
        hasWon: false
      })
      assert.deepEqual(_.omit(dilemma.summary(1), 'readyTimestamp'), {
        players: 2,
        outcome: 'Lose',
        hasChosen: true,
        hasWon: false
      })
    })
  })
})
