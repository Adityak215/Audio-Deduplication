const { execFile } = require('child_process');
const pool = require('../../config/db');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const logger = require('../logging/logger');
const similarityService = require('./similarity.service');
const supabase = require('../../config/supabase');

const fpcalcPath = path.join(__dirname, '../../../fpcalc.exe');

/**
 * Run fpcalc on a local file
 */
async function runFpcalc(localFilePath) {
  return new Promise((resolve, reject) => {
    execFile(fpcalcPath, [localFilePath], (error, stdout, stderr) => {
      if (error) {
        logger.error(
          { localFilePath, error: error.message, stderr },
          'Fingerprint computation failed'
        );
        return reject(error);
      }

      const lines = stdout.split('\n');
      const fingerprintLine = lines.find(line =>
        line.startsWith('FINGERPRINT=')
      );
      const durationLine = lines.find(line =>
        line.startsWith('DURATION=')
      );

      if (!fingerprintLine) {
        return reject(new Error('Fingerprint not generated'));
      }

      const fingerprint = fingerprintLine.split('=')[1];
      const duration = durationLine
        ? parseFloat(durationLine.split('=')[1])
        : null;

      resolve({ fingerprint, duration });
    });
  });
}

/**
 * Download file from Supabase and store temporarily
 */
async function downloadFromSupabase(storagePath) {
  const { data, error } = await supabase.storage
    .from('audio-files')
    .download(storagePath);

  if (error) {
    throw error;
  }

  const buffer = Buffer.from(await data.arrayBuffer());

  const tempFileName = `fp_${crypto.randomUUID()}.tmp`;
  const tempFilePath = path.join(os.tmpdir(), tempFileName);

  fs.writeFileSync(tempFilePath, buffer);

  return tempFilePath;
}

async function process(audioId) {
  let tempFilePath;

  try {
    logger.info({ audioId }, 'Starting fingerprint processing');

    // 1️⃣ Fetch file metadata from DB
    const result = await pool.query(
      `SELECT storage_path, original_filename
       FROM audio_files
       WHERE id=$1`,
      [audioId]
    );

    if (result.rowCount === 0) {
      throw new Error('Audio not found');
    }

    const { storage_path: storagePath, original_filename: filename } =
      result.rows[0];

    logger.debug(
      { audioId, storagePath },
      'Downloading file from Supabase'
    );

    // 2️⃣ Download file locally
    tempFilePath = await downloadFromSupabase(storagePath);

    logger.debug(
      { audioId, tempFilePath },
      'File downloaded for fingerprinting'
    );

    // 3️⃣ Run fingerprint
    const { fingerprint, duration } = await runFpcalc(tempFilePath);

    logger.debug(
      { audioId, fingerprintLength: fingerprint.length },
      'Fingerprint generated'
    );

    // 4️⃣ Store fingerprint in DB
    await pool.query(
      `UPDATE audio_files
       SET perceptual_hash=$1,
           duration_seconds=$2,
           similarity_status='processed'
       WHERE id=$3`,
      [fingerprint, duration, audioId]
    );

    logger.info({ audioId }, 'Fingerprint stored in database');

    // 5️⃣ Compare similarity
    const similar = await similarityService.findSimilar(
      audioId,
      fingerprint,
      filename
    );

    if (similar) {
      logger.warn(
        {
          audioId,
          similarAudioId: similar.id,
          similarity: similar.similarity
        },
        'Similar audio detected'
      );

      await pool.query(
        `UPDATE audio_files
         SET similarity_status='similar_found'
         WHERE id=$1`,
        [audioId]
      );
    }

    logger.info({ audioId }, 'Fingerprint processing completed');
  } catch (err) {
    logger.error(
      { audioId, error: err.message, stack: err.stack },
      'Fingerprint processing failed'
    );
    throw err;
  } finally {
    // 6️⃣ Cleanup temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      logger.debug(
        { audioId, tempFilePath },
        'Temporary fingerprint file removed'
      );
    }
  }
}

module.exports = {
  process
};