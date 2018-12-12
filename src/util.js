const crypto = require('crypto')

module.exports = {
  anonymizeIp: (ip) => crypto.createHash('md5').update(ip).digest('hex')
}
