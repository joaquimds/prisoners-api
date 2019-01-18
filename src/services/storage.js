const path = require('path')
const fs = require('fs')

const storageDir = path.join(__dirname, '..', '..', 'storage')

const storageService = {

  saveData: (key, data) => (
    new Promise((resolve, reject) => {
      fs.writeFile(path.join(storageDir, key), JSON.stringify(data), (err) => {
        if (err) {
          return reject(err)
        }
        resolve()
      })
    })
  ),

  getRaw: (key) => (
    new Promise((resolve, reject) => {
      fs.readFile(path.join(storageDir, key), 'utf8', (err, data) => {
        if (err && err.code !== 'ENOENT') {
          return reject(err)
        }
        resolve(data)
      })
    })
  ),

  getData: async (key) => {
    const json = await storageService.getRaw(key)
    return json ? JSON.parse(json) : null
  },

  removeData: (key) => (
    new Promise((resolve, reject) => {
      fs.unlink(path.join(storageDir, key), (err) => {
        if (err && err.code !== 'ENOENT') {
          return reject(err)
        }
        resolve()
      })
    })
  )
}

module.exports = storageService
