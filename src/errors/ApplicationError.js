class ApplicationError extends Error {
}

ApplicationError.failed_captcha = 'Failed captcha'
ApplicationError.could_not_add_player = 'Could not add player'

module.exports = ApplicationError
