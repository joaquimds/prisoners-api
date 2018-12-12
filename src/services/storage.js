const path = require('path')
const fs = require('fs')

const storageDir = path.join(__dirname, '..', '..', 'storage')

module.exports = {

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

  getData: (key) => (
    new Promise((resolve, reject) => {
      fs.readFile(path.join(storageDir, key), 'utf8', (err, json) => {
        if (err) {
          return reject(err)
        }
        try {
          const data = JSON.parse(json)
          resolve(data)
        } catch (e) {
          reject(e)
        }
      })
    })
  ),

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
