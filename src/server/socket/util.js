const crypto = require('crypto')

const ANONYMIZE_IPS = process.env.ANONYMIZE_IPS !== 'false'

module.exports = {
  getRemoteAddress: (client, anonymize = ANONYMIZE_IPS) => {
    const address = client.handshake.headers['x-real-ip'] || client.handshake.address
    if (!anonymize) {
      return address
    }
    return crypto.createHash('md5').update(address).digest('hex')
  }
}
