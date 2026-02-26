const { Queue } = require('bullmq');
const connection = require('../config/redis');

const fingerprintQueue = new Queue('fingerprintQueue', {
  connection
});

module.exports = fingerprintQueue;