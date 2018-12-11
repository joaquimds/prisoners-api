class FatalApplicationError extends Error {
}

FatalApplicationError.too_many_connections = 'Too many connections from your IP'
FatalApplicationError.invalid_player_id = 'Invalid player id'
FatalApplicationError.dilemma_not_found = 'Dilemma not found'
FatalApplicationError.insufficient_funds = 'Out of prize money. Try again tomorrow!'

module.exports = FatalApplicationError
