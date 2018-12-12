const createError = require('http-errors')
const express = require('express')
const logger = require('morgan')

const app = express()

app.use(logger('dev'))

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404))
})

// error handler
app.use((err, req, res, next) => {
  res.sendStatus(err.status || 500)
})

module.exports = app
