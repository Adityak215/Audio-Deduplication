const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const logger = require('../modules/logging/logger');

dotenv.config();

const DB_NAME = process.env.DB_NAME || 'audio_dedup';

async function initializeDatabase() {
  const baseClient = new Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: 'postgres'
  });

  try {
    await baseClient.connect();

    const res = await baseClient.query(
      `SELECT 1 FROM pg_database WHERE datname=$1`,
      [DB_NAME]
    );

    if (res.rowCount === 0) {
      logger.info({ database: DB_NAME }, 'Creating database');
      await baseClient.query(`CREATE DATABASE ${DB_NAME}`);
    }

    await baseClient.end();
  } catch (error) {
    await baseClient.end();
    throw error;
  }

  const appClient = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await appClient.connect();

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    await appClient.query(schema);

    await appClient.end();
    logger.info('Database schema initialized');
  } catch (error) {
    await appClient.end();
    if (error.message.includes('already exists')) {
      logger.debug({}, 'Schema already initialized');
    } else {
      throw error;
    }
  }
}

module.exports = initializeDatabase;