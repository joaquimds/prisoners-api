class FatalApplicationError extends Error {
}

FatalApplicationError.too_many_connections = 'Too many connections from your IP'
FatalApplicationError.invalid_player_id = 'Invalid player id'
FatalApplicationError.dilemma_not_found = 'Dilemma not found'

module.exports = FatalApplicationError
