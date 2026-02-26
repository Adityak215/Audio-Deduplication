const pool = require('../../config/db');
const logger = require('../logging/logger');

const warningSubscribers = new Map();

/**
 * Subscribe to similarity warnings for a specific audio file
 */
async function subscribeToWarnings(req, res, next) {
  const { audioId } = req.params;

  if (!audioId) {
    return res.status(400).json({ error: 'audioId parameter required' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Send initial connection message
  res.write(
    `data: ${JSON.stringify({ type: 'connected', message: 'Listening for similarity warnings' })}\n\n`
  );

  // Store this connection
  if (!warningSubscribers.has(audioId)) {
    warningSubscribers.set(audioId, []);
  }
  warningSubscribers.get(audioId).push(res);

  logger.info(
    { audioId, activeConnections: warningSubscribers.get(audioId).length },
    'SSE listener subscribed to similarity warnings'
  );

  // Handle client disconnect
  req.on('close', () => {
    const subscribers = warningSubscribers.get(audioId);
    if (subscribers) {
      const index = subscribers.indexOf(res);
      if (index > -1) {
        subscribers.splice(index, 1);
      }
    }
    logger.info({ audioId }, 'SSE listener disconnected');
    res.end();
  });

  // Handle errors
  req.on('error', err => {
    logger.error({ audioId, error: err.message }, 'SSE connection error');
    const subscribers = warningSubscribers.get(audioId);
    if (subscribers) {
      const index = subscribers.indexOf(res);
      if (index > -1) {
        subscribers.splice(index, 1);
      }
    }
  });
}

/**
 * Broadcast warning notification to subscribers
 */
function notifyWarning(audioIdA, audioIdB, filenameA, filenameB, similarityPercent) {
  const warning = {
    type: 'similarity_detected',
    file1: {
      id: audioIdA,
      filename: filenameA
    },
    file2: {
      id: audioIdB,
      filename: filenameB
    },
    similarityPercent: parseFloat(similarityPercent),
    timestamp: new Date().toISOString()
  };

  // Notify subscribers of both files
  [audioIdA, audioIdB].forEach(audioId => {
    if (warningSubscribers.has(audioId)) {
      const subscribers = warningSubscribers.get(audioId);
      subscribers.forEach(res => {
        try {
          res.write(`data: ${JSON.stringify(warning)}\n\n`);
        } catch (err) {
          logger.error({ error: err.message }, 'Failed to send notification');
        }
      });
    }
  });

  logger.info(
    { audioIdA, audioIdB, similarity: `${similarityPercent}%` },
    'Similarity warning notification broadcast to subscribers'
  );
}

module.exports = {
  subscribeToWarnings,
  notifyWarning
};
