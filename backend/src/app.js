const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');
const logger = require('./modules/logging/logger');
const rateLimiter = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const uploadRoutes = require('./modules/upload/upload.routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(
  pinoHttp({
    logger,
    quietReqLogger: false,
    autoLogging: {
      ignorePaths: ['/health']
    }
  })
);
app.use(rateLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/upload', uploadRoutes);
app.use(errorHandler);

module.exports = app;