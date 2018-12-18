const https = require('https')
const querystring = require('querystring')
const debug = require('debug')('prisoners:captcha')

const { anonymizeIp } = require('../util')

const ANONYMIZE_IPS = process.env.ANONYMIZE_IPS !== 'false'
const enabled = process.env.RECAPTCHA_ENABLED !== 'false'

module.exports = {
  verify: async (ip, token) => {
    if (!enabled) {
      return true
    }
    debug('Verify', ANONYMIZE_IPS ? anonymizeIp(ip) : ip)
    try {
      const data = await post('https://www.google.com/recaptcha/api/siteverify', {
        secret: process.env.RECAPTCHA_SECRET_KEY,
        response: token,
        remoteip: ip
      })
      const json = JSON.parse(data)
      return json.success && json.score > 0.5
    } catch (e) {
      debug(e.message)
      return false
    }
  }
}

const post = (url, data) => {
  const queryString = querystring.stringify(data)
  return new Promise((resolve, reject) => {
    const req = https.request(`${url}?${queryString}`, { method: 'POST' }, (res) => {
      let data = ''

      res.on('data', (d) => {
        data = data + d
      })

      res.on('end', () => {
        resolve(data)
      })
    })

    req.on('error', (e) => {
      reject(e)
    })

    req.end()
  })
}
