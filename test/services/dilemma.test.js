const _ = require('lodash')
const { describe, it } = require('mocha')
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

const ApplicationError = require('../../src/errors/ApplicationError')
const dilemmaService = require('../../src/services/dilemma')

describe('dilemma service', () => {
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
        assert.equal(e.message, ApplicationError.invalid_player_id)
      }
    })

    it('fails if too few unique IP addresses', () => {
      try {
        dilemmaService.activatePlayer(0)
        assert.fail()
      } catch (e) {
        assert.equal(e.message, ApplicationError.too_few_unique_ips)
      }
    })

    it('adds players to a dilemma', () => {
      dilemmaService.createPlayer(players[1].remoteAddress)
      dilemmaService.createPlayer(players[2].remoteAddress)
      dilemmaService.createPlayer(players[3].remoteAddress)
      dilemmaService.createPlayer(players[4].remoteAddress)
      dilemmaService.createPlayer(players[5].remoteAddress)
      dilemmaService.createPlayer(players[6].remoteAddress)

      try {
        dilemmaService.activatePlayer(1)
        assert.fail()
      } catch (e) {
        assert.equal(e.message, ApplicationError.too_few_unique_ips)
      }
      try {
        dilemmaService.activatePlayer(2)
        assert.fail()
      } catch (e) {
        assert.equal(e.message, ApplicationError.too_few_unique_ips)
      }
      try {
        dilemmaService.activatePlayer(3)
        assert.fail()
      } catch (e) {
        assert.equal(e.message, ApplicationError.too_few_unique_ips)
      }
      let dilemmas = dilemmaService.activatePlayer(4)

      let expectedDilemmas = [
        {
          id: 0,
          players: [ players[0], players[2] ],
          choices: {}
        },
        {
          id: 1,
          players: [ players[1], players[3] ],
          choices: {}
        }
      ]

      assert.deepEqual(simplifyDilemmas(dilemmas), expectedDilemmas)

      try {
        dilemmaService.activatePlayer(5)
        assert.fail()
      } catch (e) {
        assert.equal(e.message, ApplicationError.too_few_unique_ips)
      }

      dilemmas = dilemmaService.activatePlayer(6)

      expectedDilemmas = [
        {
          id: 2,
          players: [ players[4], players[5] ],
          choices: {}
        }
      ]

      assert.deepEqual(simplifyDilemmas(dilemmas), expectedDilemmas)
    })

    it('adds reactivated players to new dilemma', async () => {
      await sleep(DILEMMA_IDLE_TIME)

      dilemmaService.setChoice(0, 'Split')
      dilemmaService.setChoice(2, 'Split')

      dilemmaService.deactivatePlayer(0)

      try {
        dilemmaService.activatePlayer(0)
        assert.fail()
      } catch (e) {
        assert.equal(e.message, ApplicationError.too_few_unique_ips)
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
          id: 3,
          players: [ players[0], players[2] ],
          choices: {}
        }
      ]

      const dilemmas = dilemmaService.activatePlayer(2)
      assert.deepEqual(simplifyDilemmas(dilemmas), expectedDilemmas)
    })
  })
})

const simplifyDilemmas = (dilemmas) => {
  return dilemmas.map(d => _.pick(d, ['id', 'players', 'choices']))
}
