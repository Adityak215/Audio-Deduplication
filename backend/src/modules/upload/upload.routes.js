const express = require('express');
const multer = require('multer');
const path = require('path');
const { uploadAudio } = require('./upload.controller');
const { getWarnings, getAllWarnings } = require('./warnings.controller');
const { subscribeToWarnings } = require('./sse.controller');

const router = express.Router();

// Store locally in uploads/
const upload = multer({
  dest: path.join(__dirname, '../../../uploads')
});

router.post('/', upload.single('audio'), uploadAudio);

// Warnings endpoints
router.get('/warnings', getAllWarnings);
router.get('/:audioId/warnings', getWarnings);

// SSE endpoint for real-time notifications
router.get('/:audioId/subscribe', subscribeToWarnings);

module.exports = router;