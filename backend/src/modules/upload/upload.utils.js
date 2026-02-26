const crypto = require('crypto');
const fs = require('fs');

/**
 * Validate supported MIME types
 */
function isSupportedAudio(mimeType) {
  const allowed = [
    // Standard MIME types
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/aac', 'audio/flac',
    // Non-standard variants (x- prefix)
    'audio/x-wav', 'audio/x-ogg', 'audio/x-m4a', 'audio/x-aac', 'audio/x-flac', 'audio/x-mpeg'
  ];
  return allowed.includes(mimeType);
}

/**
 * Compute SHA-256 hash using streaming
 */
function computeFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');

    const stream = fs.createReadStream(filePath);

    stream.on('data', chunk => {
      hash.update(chunk);
    });

    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });

    stream.on('error', err => {
      reject(err);
    });
  });
}

module.exports = {
  isSupportedAudio,
  computeFileHash
};