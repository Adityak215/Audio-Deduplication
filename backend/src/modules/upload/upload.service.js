const pool = require('../../config/db');
const { computeFileHash } = require('./upload.utils');
const fingerprintQueue = require('../../jobs/queue');
const supabase = require('../../config/supabase');
const logger = require('../logging/logger');
const crypto = require('crypto');
const fs = require('fs');

async function processUpload(file) {
  const localPath = file.path;
  const mimeType = file.mimetype;
  const fileSize = file.size;
  const originalFilename = file.originalname;

  try {
    // Step 1: Compute SHA-256 hash
    logger.debug({ filename: originalFilename }, 'Computing file hash');
    const contentHash = await computeFileHash(localPath);

    // Generate temp and permanent file names
    const tempFileName = `${crypto.randomUUID()}_${originalFilename}`;
    const permanentFileName = `${contentHash}_${originalFilename}`;

    logger.debug(
      { filename: originalFilename, contentHash, tempFile: tempFileName },
      'Hash computed - uploading to temp bucket'
    );

    // Step 2: Read file and upload to temp bucket
    const fileBuffer = fs.readFileSync(localPath);

    const { error: uploadError } = await supabase.storage
      .from('temp-uploads')
      .upload(tempFileName, fileBuffer, {
        contentType: mimeType
      });

    if (uploadError) {
      logger.error(
        { filename: originalFilename, error: uploadError.message },
        'Temp upload to Supabase failed'
      );
      throw uploadError;
    }

    logger.debug(
      { filename: originalFilename, tempFile: tempFileName },
      'File uploaded to temp bucket'
    );

    // Step 3: Atomic database insert (concurrency safety)
    const result = await pool.query(
      `INSERT INTO audio_files (content_hash, storage_path, original_filename, file_size, mime_type)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (content_hash)
       DO NOTHING
       RETURNING id`,
      [contentHash, permanentFileName, originalFilename, fileSize, mimeType]
    );

    // Check if this was a duplicate
    if (result.rowCount === 0) {
      // Duplicate detected - file already exists
      logger.warn(
        {
          filename: originalFilename,
          fileSize,
          mimeType,
          isDuplicate: true,
          tempFile: tempFileName
        },
        'Duplicate file rejected - identical file already exists'
      );

      // Delete temp file
      const { error: deleteError } = await supabase.storage
        .from('temp-uploads')
        .remove([tempFileName]);

      if (deleteError) {
        logger.warn(
          { tempFile: tempFileName, error: deleteError.message },
          'Failed to delete duplicate from temp bucket'
        );
      }

      // Record duplicate attempt
      await pool.query(
        `INSERT INTO upload_attempts (content_hash, was_duplicate) VALUES ($1, $2)`,
        [contentHash, true]
      );

      return {
        duplicate: true,
        message: 'Exact duplicate detected'
      };
    }

    const audioId = result.rows[0].id;

    logger.debug(
      { audioId, tempFile: tempFileName, permanentFile: permanentFileName },
      'Moving file from temp to permanent bucket'
    );

    // Step 4: Move file from temp to permanent bucket
    const { error: moveError } = await supabase.storage
      .from('temp-uploads')
      .move(tempFileName, permanentFileName, {
        destinationBucket: 'audio-files'
      });

    if (moveError) {
      logger.error(
        { audioId, tempFile: tempFileName, error: moveError.message },
        'Failed to move file to permanent bucket'
      );
      throw moveError;
    }

    logger.info(
      {
        audioId,
        filename: originalFilename,
        fileSize,
        mimeType,
        status: 'ORIGINAL_FILE',
        storagePath: permanentFileName
      },
      'Original audio file stored in Supabase - fingerprinting queued'
    );

    // Step 5: Record successful upload
    await pool.query(
      `INSERT INTO upload_attempts (content_hash, was_duplicate) VALUES ($1, $2)`,
      [contentHash, false]
    );

    // Step 6: Queue fingerprint job
    await fingerprintQueue.add('fingerprint', { audioId, filename: originalFilename });
    logger.debug({ audioId }, 'Fingerprint job queued');

    return {
      duplicate: false,
      audioId
    };
  } catch (error) {
    logger.error(
      { filename: originalFilename, error: error.message },
      'Upload processing failed'
    );
    throw error;
  } finally {
    // Clean up local temp file
    try {
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
        logger.debug({ file: localPath }, 'Local temp file cleaned up');
      }
    } catch (err) {
      logger.warn(
        { file: localPath, error: err.message },
        'Failed to delete local temp file'
      );
    }
  }
}

module.exports = {
  processUpload
};