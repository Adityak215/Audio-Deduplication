const { Worker } = require('bullmq');
const connection = require('../config/redis');
const logger = require('../modules/logging/logger');
const fingerprintService = require('../modules/audio/fingerprint.service');

const worker = new Worker(
  'fingerprintQueue',
  async job => {
    await fingerprintService.process(job.data.audioId);
  },
  { connection }
);

worker.on('completed', job => {
  logger.debug({ jobId: job.id }, 'Fingerprint job completed');
});

worker.on('failed', (job, err) => {
  logger.error(
    { jobId: job.id, error: err.message },
    'Fingerprint job failed'
  );
});

logger.info('Fingerprint worker started');