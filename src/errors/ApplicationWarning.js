class ApplicationWarning extends Error {
  constructor (message, detail = null) {
    super(message)
    this.detail = detail
  }

  toString () {
    return this.message + (this.detail ? (' ' + this.detail) : '')
  }
}

ApplicationWarning.invalid_choice = 'Invalid choice'
ApplicationWarning.too_late_to_change_choice = 'Too late to change choice'
ApplicationWarning.too_early_to_choose = 'Too early to choose'
ApplicationWarning.too_few_unique_ips = `Waiting for more players with unique IPs (minimum ${process.env.MINIMUM_UNIQUE_REMOTE_ADDRESSES})...`

module.exports = ApplicationWarning
