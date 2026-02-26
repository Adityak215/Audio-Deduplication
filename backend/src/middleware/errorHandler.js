const logger = require('../modules/logging/logger');

module.exports = (err, req, res, next) => {
  const status = err.status || 500;
  const isDev = process.env.NODE_ENV !== 'production';

  // Log error with context
  if (status >= 500) {
    logger.error(
      {
        error: err.message,
        stack: err.stack,
        method: req.method,
        path: req.path,
        statusCode: status
      },
      'Unhandled server error'
    );
  } else {
    logger.warn(
      {
        error: err.message,
        method: req.method,
        path: req.path,
        statusCode: status
      },
      'Client error'
    );
  }

  res.status(status).json({
    error: err.message || 'Internal Server Error',
    ...(isDev && { stack: err.stack })
  });
};