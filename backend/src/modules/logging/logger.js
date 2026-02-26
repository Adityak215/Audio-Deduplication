const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';

const logger = isDev
  ? pino({
      level: 'debug',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      }
    })
  : pino({
      level: 'info'
    });

module.exports = logger;