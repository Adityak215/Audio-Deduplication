const pool = require('../../config/db');
const logger = require('../logging/logger');

/**
 * Get similarity warnings for an audio file
 */
async function getWarnings(req, res, next) {
  try {
    const { audioId } = req.params;

    if (!audioId) {
      return res.status(400).json({ error: 'audioId parameter required' });
    }

    const { rows } = await pool.query(
      `SELECT id, audio_id_a, audio_id_b, filename_a, filename_b, similarity_percent, created_at
       FROM similarity_warnings
       WHERE audio_id_a = $1 OR audio_id_b = $1
       ORDER BY created_at DESC`,
      [audioId]
    );

    logger.info(
      { audioId, warningCount: rows.length },
      `Warnings endpoint called - found ${rows.length} similarity warning(s)`
    );

    res.json({
      audioId,
      warnings: rows.map(row => ({
        id: row.id,
        file1: {
          id: row.audio_id_a,
          filename: row.filename_a
        },
        file2: {
          id: row.audio_id_b,
          filename: row.filename_b
        },
        similarityPercent: parseFloat(row.similarity_percent),
        detectedAt: row.created_at
      }))
    });
  } catch (err) {
    logger.error({ error: err.message }, 'Failed to retrieve warnings');
    next(err);
  }
}

/**
 * Get all similarity warnings
 */
async function getAllWarnings(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT id, audio_id_a, audio_id_b, filename_a, filename_b, similarity_percent, created_at
       FROM similarity_warnings
       ORDER BY created_at DESC
       LIMIT 100`
    );

    logger.info(
      { warningCount: rows.length },
      `All warnings endpoint called - found ${rows.length} total similarity warning(s)`
    );

    res.json({
      total: rows.length,
      warnings: rows.map(row => ({
        id: row.id,
        file1: {
          id: row.audio_id_a,
          filename: row.filename_a
        },
        file2: {
          id: row.audio_id_b,
          filename: row.filename_b
        },
        similarityPercent: parseFloat(row.similarity_percent),
        detectedAt: row.created_at
      }))
    });
  } catch (err) {
    logger.error({ error: err.message }, 'Failed to retrieve all warnings');
    next(err);
  }
}

module.exports = {
  getWarnings,
  getAllWarnings
};
