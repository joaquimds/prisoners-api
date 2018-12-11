class ApplicationError extends Error {
  constructor (message, fatal = false) {
    super(message)
    this.fatal = fatal
  }
}

ApplicationError.failed_captcha = 'Failed captcha'
ApplicationError.too_many_connections = 'Too many connections from your IP'
ApplicationError.could_not_add_player = 'Could not add player'
ApplicationError.invalid_choice = 'Invalid choice'
ApplicationError.invalid_player_id = 'Invalid player id'
ApplicationError.too_late_to_change_choice = 'Too late to change choice'
ApplicationError.too_early_to_choose = 'Too early to choose'
ApplicationError.too_few_unique_ips = 'Waiting for more players with unique IPs...'
ApplicationError.dilemma_not_found = 'Dilemma not found'

module.exports = ApplicationError
