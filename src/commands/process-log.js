const storageService = require('../services/storage')

module.exports = {
  definition: 'process-log',
  options: [],
  run: async () => {
    const log = await storageService.getRaw('log')
    const lines = log.split(/\r?\n/)

    for (const line of lines) {
      const [dateStr, info] = line.split('prisoners:dilemma')
      const endDate = new Date(dateStr)
      const start = endDate - 150 * 1000
      const [ dilemma, outcome ] = info.split(' is ')
      const id = dilemma.split('Dilemma ')[1]
      const item = { id, outcome, timestamps: { end: endDate.getTime(), start } }
      console.log(JSON.stringify(item))
    }

  }
}
