const { anonymizeIp } = require('../../util')

const ANONYMIZE_IPS = process.env.ANONYMIZE_IPS !== 'false'

module.exports = {
  getRemoteAddress: (client, anonymize = ANONYMIZE_IPS) => {
    const address = client.handshake.headers['x-real-ip'] || client.handshake.address
    if (!anonymize) {
      return address
    }
    return anonymizeIp(address)
  }
}
