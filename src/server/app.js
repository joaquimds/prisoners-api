const createError = require('http-errors')
const express = require('express')
const path = require('path')
const logger = require('morgan')

const app = express()

app.use(logger('dev'))
app.use(express.static(path.join(__dirname, '..', '..', 'public')))

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404))
})

// error handler
app.use((err, req, res, next) => {
  res.sendStatus(err.status || 500)
})

module.exports = app
