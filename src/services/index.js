const dilemmaService = require('./dilemma')

module.exports = {
  init: async () => {
    await dilemmaService.init()
  }
}
