const _ = require('lodash')
const { before, after, describe, it } = require('mocha')
const { assert } = require('chai')
const { sleep } = require('../util')

const DILEMMA_IDLE_TIME = parseFloat(process.env.DILEMMA_IDLE_SECONDS) * 1000

const players = [
  { id: 0, remoteAddress: '::1' },
  { id: 1, remoteAddress: '::1' },
  { id: 2, remoteAddress: '::2' },
  { id: 3, remoteAddress: '::3' },
  { id: 4, remoteAddress: '::4' },
  { id: 5, remoteAddress: '::5' },
  { id: 6, remoteAddress: '::6' }
]

const ApplicationWarning = require('../../src/errors/ApplicationWarning')
const FatalApplicationError = require('../../src/errors/FatalApplicationError')

const storageService = require('../../src/services/storage')
const dilemmaService = require('../../src/services/dilemma')

let savedStats
let savedMetadata

describe('dilemma service', () => {
  before(async () => {
    savedStats = await storageService.getData('stats')
    savedMetadata = await storageService.getData('winMetadata')
    await storageService.removeData('stats')
    await storageService.removeData('winMetadata')
  })

  after(async () => {
    await storageService.removeData('stats')
    await storageService.removeData('winMetadata')
    if (savedStats) {
      await storageService.saveData('stats', savedStats)
    }
    if (savedMetadata) {
      await storageService.saveData('winMetadata', savedMetadata)
    }
  })

  describe('init', () => {
    it('initialises service', async () => {
      await dilemmaService.init()
      assert.deepEqual(dilemmaService.getStats(), { Split: 0, Steal: 0, Lose: 0 })
    })
  })

  describe('create player', () => {
    it('creates player', () => {
      const player = dilemmaService.createPlayer(players[0].remoteAddress)
      assert.deepEqual(player, players[0])

      dilemmaService.createPlayer(players[1].remoteAddress)
      dilemmaService.createPlayer(players[2].remoteAddress)
      dilemmaService.createPlayer(players[3].remoteAddress)
      dilemmaService.createPlayer(players[4].remoteAddress)
      dilemmaService.createPlayer(players[5].remoteAddress)
    })
  })

  describe('activate player', () => {
    it('fails if player does not exist', () => {
      try {
        dilemmaService.activatePlayer(6)
        assert.fail()
      } catch (e) {
        assert.equal(e.message, FatalApplicationError.invalid_player_id)
      }
    })

    it('activates player', () => {
      const dilemmas = dilemmaService.activatePlayer(0)
      assert.deepEqual(dilemmas, [])
    })

    it('does not pair players with the same IP address', () => {
      const dilemmas = dilemmaService.activatePlayer(1)
      assert.deepEqual(dilemmas, [])
    })

    it('adds players to a dilemma', () => {
      const dilemmas = dilemmaService.activatePlayer(2)

      const expectedDilemmas = [
        {
          id: 0,
          players: [ players[0], players[2] ],
          choices: {}
        }
      ]

      assert.deepEqual(simplifyDilemmas(dilemmas), expectedDilemmas)
    })

    it('restricts by unique IP threshold if there are in-game players', () => {
      try {
        dilemmaService.activatePlayer(3)
        assert.fail()
      } catch (e) {
        assert.equal(e.message, ApplicationWarning.too_few_unique_ips + ' (minimum 2)')
        assert.equal(e.detail, 'Active players')
      }
    })

    it('restricts by unique IP threshold while high win rate', async () => {
      await sleep(DILEMMA_IDLE_TIME)
      await dilemmaService.setChoice(0, 'Split')
      await dilemmaService.setChoice(2, 'Split')

      const oldDilemmas = deactivatePlayers(players)
      assert.deepEqual(simplifyDilemmas(oldDilemmas), [
        {
          id: 0,
          players: [],
          choices: { '0': 'Split', '2': 'Split' }
        }
      ])

      try {
        dilemmaService.activatePlayer(1)
        assert.fail()
      } catch (e) {
        assert.equal(e.message, ApplicationWarning.too_few_unique_ips + ' (minimum 2)')
        assert.equal(e.detail, 'Recent win')
      }

      const dilemmas = dilemmaService.activatePlayer(3)

      const expectedDilemmas = [
        {
          id: 1,
          players: [ players[1], players[3] ],
          choices: {}
        }
      ]

      assert.deepEqual(simplifyDilemmas(dilemmas), expectedDilemmas)
      deactivatePlayers(players)
    })

    it('adds reactivated players to new dilemma', async () => {
      try {
        dilemmaService.activatePlayer(0)
        assert.fail()
      } catch (e) {
        assert.equal(e.message, ApplicationWarning.too_few_unique_ips + ' (minimum 2)')
        assert.equal(e.detail, 'Recent win')
      }

      const dilemmas = dilemmaService.activatePlayer(2)

      const expectedDilemmas = [
        {
          id: 2,
          players: [ players[0], players[2] ],
          choices: {}
        }
      ]

      assert.deepEqual(simplifyDilemmas(dilemmas), expectedDilemmas)
      deactivatePlayers(players)
    })

    it('disables unique IP checking when win rate drops', async () => {
      try {
        dilemmaService.activatePlayer(3)
        assert.fail()
      } catch (e) {
        assert.equal(e.message, ApplicationWarning.too_few_unique_ips + ' (minimum 2)')
        assert.equal(e.detail, 'Recent win')
      }
      await sleep(300)

      const expectedDilemmas = [
        {
          id: 3,
          players: [ players[3], players[4] ],
          choices: {}
        }
      ]

      const dilemmas = dilemmaService.activatePlayer(4)
      assert.deepEqual(simplifyDilemmas(dilemmas), expectedDilemmas)
      deactivatePlayers(players)
    })

    it('restricts by IP if IP has won in the past', async () => {
      try {
        dilemmaService.activatePlayer(0)
        assert.fail()
      } catch (e) {
        assert.equal(e.message, ApplicationWarning.too_few_unique_ips + ' (minimum 2)')
        assert.equal(e.detail, 'Previous winner')
      }

      deactivatePlayers(players)
    })

    it('increases limits on quick wins', async () => {
      try {
        dilemmaService.activatePlayer(0)
      } catch (e) {}
      dilemmaService.activatePlayer(2)
      try {
        dilemmaService.activatePlayer(3)
      } catch (e) {
        assert.equal(e.detail, 'Active players')
      }
      dilemmaService.activatePlayer(4)
      await sleep(DILEMMA_IDLE_TIME)

      await dilemmaService.setChoice(0, 'Split')
      await dilemmaService.setChoice(2, 'Split')
      await dilemmaService.setChoice(3, 'Split')
      await dilemmaService.setChoice(4, 'Split')

      deactivatePlayers(players)

      await sleep(300)

      try {
        dilemmaService.activatePlayer(3)
        assert.fail()
      } catch (e) {
        assert.equal(e.message, ApplicationWarning.too_few_unique_ips + ' (minimum 3)')
        assert.equal(e.detail, 'Previous winner')
      }

      deactivatePlayers(players)
    })

    it('increases limits more slowly if win happens in second window', async () => {
      await sleep(DILEMMA_IDLE_TIME)

      try {
        dilemmaService.activatePlayer(0)
      } catch (e) {}
      try {
        dilemmaService.activatePlayer(1)
      } catch (e) {}
      try {
        dilemmaService.activatePlayer(2)
      } catch (e) {}
      try {
        dilemmaService.activatePlayer(3)
      } catch (e) {}
      dilemmaService.activatePlayer(4)

      await sleep(DILEMMA_IDLE_TIME)

      await dilemmaService.setChoice(0, 'Split')
      await dilemmaService.setChoice(2, 'Split')

      await sleep(DILEMMA_IDLE_TIME)

      await dilemmaService.setChoice(1, 'Split')
      await dilemmaService.setChoice(3, 'Split')

      deactivatePlayers(players)

      try {
        dilemmaService.activatePlayer(0)
        assert.fail()
      } catch (e) {
        assert.equal(e.message, ApplicationWarning.too_few_unique_ips + ' (minimum 3)')
        assert.equal(e.detail, 'Recent win')
      }
    })
  })

  describe('get final stats', () => {
    it('returns stats', async () => {
      const stats = await dilemmaService.getStats()
      assert.deepEqual(stats, { Split: 5, Steal: 0, Lose: 0 })
    })
  })
})

const simplifyDilemmas = (dilemmas) => {
  return dilemmas.map(d => _.pick(d, ['id', 'players', 'choices']))
}

const deactivatePlayers = (players) => {
  const dilemmas = {}
  for (const player of players) {
    const oldDilemmas = dilemmaService.deactivatePlayer(player.id)
    for (const dilemma of oldDilemmas) {
      dilemmas[dilemma.id] = dilemma
    }
  }
  return Object.keys(dilemmas).map(id => dilemmas[id])
}
