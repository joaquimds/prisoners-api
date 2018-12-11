const debug = require('debug')('prisoners:command:test')

module.exports = {
  definition: 'test',
  options: [],
  run: () => debug('Test Command')
}
