require('dotenv').config();
const app = require('./app');
const logger = require('./modules/logging/logger');
const initializeDatabase = require('./db/init');
const redis = require('./config/redis');
const supabase = require('./config/supabase');
require('./jobs/fingerprint.processor');

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized successfully');

    // Check Redis connection
    await redis.ping();
    logger.info('Redis connected');

    // Check Supabase connection
    const { error } = await supabase.auth.getSession();
    if (error) {
      logger.warn({ error: error.message }, 'Supabase warning');
    } else {
      logger.info('Supabase connected');
    }

    // Start server
    app.listen(PORT, () => {
      logger.info(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, 'Failed to start server');
    process.exit(1);
  }
}

start();