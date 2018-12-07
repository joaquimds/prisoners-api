const _ = require('lodash')
const { describe, it } = require('mocha')
const { assert } = require('chai')

const dilemmaService = require('../../src/services/dilemma')

describe('dilemma service', () => {
  describe('create player', () => {
    it('creates player', () => {
      const player = dilemmaService.createPlayer('::1')
      assert.deepEqual(player, {
        id: 0,
        remoteAddress: '::1'
      })
    })
  })

  describe('activate player', () => {
    it('fails if player does not exist', () => {
      try {
        dilemmaService.activatePlayer(1)
        assert.fail()
      } catch (e) {
        assert.equal(e.message, 'Player does not exist, please refresh')
      }
    })

    it('fails if too few unique IP addresses', () => {
      try {
        dilemmaService.activatePlayer(0)
        assert.fail()
      } catch (e) {
        assert.equal(e.message, 'Waiting for more players with unique IP addresses...')
      }
    })

    it('adds players to a dilemma', () => {
      dilemmaService.createPlayer('::1')
      dilemmaService.createPlayer('::2')
      dilemmaService.createPlayer('::3')
      dilemmaService.createPlayer('::4')
      dilemmaService.createPlayer('::5')
      dilemmaService.createPlayer('::6')

      try {
        dilemmaService.activatePlayer(1)
        assert.fail()
      } catch (e) {
        assert.equal(e.message, 'Waiting for more players with unique IP addresses...')
      }
      try {
        dilemmaService.activatePlayer(2)
        assert.fail()
      } catch (e) {
        assert.equal(e.message, 'Waiting for more players with unique IP addresses...')
      }
      try {
        dilemmaService.activatePlayer(3)
        assert.fail()
      } catch (e) {
        assert.equal(e.message, 'Waiting for more players with unique IP addresses...')
      }
      let dilemmas = dilemmaService.activatePlayer(4)

      let expectedDilemmas = [
        {
          id: 0,
          players: [{ id: 0, remoteAddress: '::1' }, { id: 4, remoteAddress: '::4' }]
        },
        {
          id: 1,
          players: [{ id: 1, remoteAddress: '::1' }, { id: 3, remoteAddress: '::3' }]
        }
      ]

      assert.deepEqual(simplifyDilemmas(dilemmas), expectedDilemmas)

      try {
        dilemmaService.activatePlayer(5)
        assert.fail()
      } catch (e) {
        assert.equal(e.message, 'Waiting for more players with unique IP addresses...')
      }

      dilemmas = dilemmaService.activatePlayer(6)

      expectedDilemmas = [
        {
          id: 2,
          players: [{ id: 2, remoteAddress: '::2' }, { id: 6, remoteAddress: '::6' }]
        }
      ]

      assert.deepEqual(simplifyDilemmas(dilemmas), expectedDilemmas)
    })
  })
})

const simplifyDilemmas = (dilemmas) => {
  return dilemmas.map(d => _.pick(d, ['id', 'players']))
}
