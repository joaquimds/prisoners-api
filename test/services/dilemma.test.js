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

describe('dilemma service', () => {
  before(async () => {
    try {
      savedStats = await storageService.getData('stats')
    } catch (e) {}
    await storageService.removeData('stats')
    await storageService.removeData('lastWinTimestamp')
  })

  after(async () => {
    if (savedStats) {
      await storageService.saveData('stats', savedStats)
      return
    }
    await storageService.removeData('stats')
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
    })
  })

  describe('activate player', () => {
    it('fails if player does not exist', () => {
      try {
        dilemmaService.activatePlayer(1)
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
      dilemmaService.createPlayer(players[1].remoteAddress)
      const dilemmas = dilemmaService.activatePlayer(1)
      assert.deepEqual(dilemmas, [])
    })

    it('adds players to a dilemma', () => {
      dilemmaService.createPlayer(players[2].remoteAddress)
      dilemmaService.createPlayer(players[3].remoteAddress)
      dilemmaService.createPlayer(players[4].remoteAddress)
      dilemmaService.createPlayer(players[5].remoteAddress)
      dilemmaService.createPlayer(players[6].remoteAddress)

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

    it('restricts by unique IP threshold while high win rate', async () => {
      await sleep(DILEMMA_IDLE_TIME)
      await dilemmaService.setChoice(0, 'Split')
      await dilemmaService.setChoice(2, 'Split')

      try {
        dilemmaService.activatePlayer(3)
        assert.fail()
      } catch (e) {
        assert.equal(e.message, ApplicationWarning.too_few_unique_ips)
      }

      const dilemmas = dilemmaService.activatePlayer(4)

      const expectedDilemmas = [
        {
          id: 1,
          players: [ players[1], players[3] ],
          choices: {}
        }
      ]

      assert.deepEqual(simplifyDilemmas(dilemmas), expectedDilemmas)
    })

    it('adds reactivated players to new dilemma', async () => {
      dilemmaService.deactivatePlayer(0)

      try {
        dilemmaService.activatePlayer(0)
        assert.fail()
      } catch (e) {
        assert.equal(e.message, ApplicationWarning.too_few_unique_ips)
      }

      const oldDilemmas = dilemmaService.deactivatePlayer(2)
      assert.deepEqual(simplifyDilemmas(oldDilemmas), [
        {
          id: 0,
          players: [],
          choices: { '0': 'Split', '2': 'Split' }
        }
      ])

      const expectedDilemmas = [
        {
          id: 2,
          players: [ players[4], players[0] ],
          choices: {}
        }
      ]

      const dilemmas = dilemmaService.activatePlayer(2)
      assert.deepEqual(simplifyDilemmas(dilemmas), expectedDilemmas)
    })

    it('disables unique IP checking when win rate drops', async () => {
      try {
        dilemmaService.activatePlayer(2)
        assert.fail()
      } catch (e) {
        assert.equal(e.message, ApplicationWarning.too_few_unique_ips)
      }
      await sleep(600)
      dilemmaService.activatePlayer(2)
    })
  })

  describe('get final stats', () => {
    it('returns stats', async () => {
      const stats = await dilemmaService.getStats()
      assert.deepEqual(stats, { Split: 1, Steal: 0, Lose: 0 })
    })
  })
})

const simplifyDilemmas = (dilemmas) => {
  return dilemmas.map(d => _.pick(d, ['id', 'players', 'choices']))
}
