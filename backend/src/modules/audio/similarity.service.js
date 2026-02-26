const pool = require('../../config/db');
const logger = require('../logging/logger');
const { notifyWarning } = require('../upload/sse.controller');

const SIMILARITY_THRESHOLD = 70; // 70% similarity match tolerance

function hammingDistance(a, b) {
  const fp1 = (a || '').trim();
  const fp2 = (b || '').trim();

  if (!fp1 || !fp2) {
    return Infinity;
  }

  try {
    const bin1 = Buffer.from(fp1, 'base64');
    const bin2 = Buffer.from(fp2, 'base64');

    const minLen = Math.min(bin1.length, bin2.length);
    let distance = Math.abs(bin1.length - bin2.length) * 8;

    for (let i = 0; i < minLen; i++) {
      let xor = bin1[i] ^ bin2[i];
      while (xor) {
        distance += xor & 1;
        xor >>= 1;
      }
    }

    return distance;
  } catch (err) {
    logger.error({ error: err.message }, 'Fingerprint decoding failed');
    return Infinity;
  }
}

async function findSimilar(audioId, fingerprint, filename) {
  try {
    logger.debug(
      { audioId, filename },
      'Starting similarity check against existing files'
    );

    // Find all processed fingerprints
    const result = await pool.query(
      `SELECT id, perceptual_hash, original_filename
       FROM audio_files
       WHERE id != $1 AND perceptual_hash IS NOT NULL`,
      [audioId]
    );

    logger.debug(
      { audioId, filesChecked: result.rowCount },
      `Comparing against ${result.rowCount} existing fingerprints`
    );

    // Check similarity against all existing fingerprints
    for (const row of result.rows) {
      const distance = hammingDistance(fingerprint, row.perceptual_hash);
      const maxBits = Math.max(fingerprint.length, row.perceptual_hash.length) * 6;
      const similarityPercent = ((maxBits - distance) / maxBits) * 100;

      if (similarityPercent >= SIMILARITY_THRESHOLD) {
        // Log similar file found
        logger.warn(
          {
            audioId,
            filename,
            similarAudioId: row.id,
            similarFilename: row.original_filename,
            similarity: `${similarityPercent.toFixed(2)}%`,
            status: 'SIMILAR_FILE'
          },
          'Similar audio file detected - warning generated'
        );

        // Store warning in database
        await pool.query(
          `INSERT INTO similarity_warnings (audio_id_a, audio_id_b, filename_a, filename_b, similarity_percent)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (audio_id_a, audio_id_b) DO NOTHING`,
          [audioId, row.id, filename, row.original_filename, similarityPercent.toFixed(2)]
        );

        // Notify connected clients
        notifyWarning(audioId, row.id, filename, row.original_filename, similarityPercent.toFixed(2));

        return {
          id: row.id,
          filename: row.original_filename,
          similarity: similarityPercent.toFixed(2)
        };
      }
    }

    logger.debug(
      { audioId, filename },
      'No similar files found - file stored successfully'
    );

    return null;
  } catch (err) {
    logger.error(
      { audioId, error: err.message },
      'Similarity check failed'
    );
    throw err;
  }
}

module.exports = {
  findSimilar
};