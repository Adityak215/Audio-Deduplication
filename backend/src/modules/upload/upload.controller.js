const { processUpload } = require('./upload.service');
const { isSupportedAudio } = require('./upload.utils');
const logger = require('../logging/logger');

async function uploadAudio(req, res, next) {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!isSupportedAudio(file.mimetype)) {
      logger.warn(
        { mimeType: file.mimetype, filename: file.originalname },
        'Unsupported audio format rejected'
      );
      return res.status(400).json({ error: 'Unsupported audio format' });
    }

    const result = await processUpload(file);

    if (result.duplicate) {
      logger.info(
        { filename: file.originalname },
        'Duplicate detected - file rejected'
      );
      return res.status(409).json(result);
    }

    logger.info(
      { audioId: result.audioId, filename: file.originalname, size: file.size },
      'Audio file uploaded successfully'
    );
    res.status(201).json(result);
  } catch (err) {
    logger.error(
      { error: err.message },
      'Upload processing failed'
    );
    next(err);
  }
}

module.exports = {
  uploadAudio
};