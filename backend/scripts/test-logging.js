#!/usr/bin/env node

/**
 * Logging Test Script
 * Tests the complete upload and warning logging pipeline
 * 
 * Usage:
 *   node scripts/test-logging.js <path-to-audio-file>
 * 
 * Example:
 *   node scripts/test-logging.js ../uploads/sample.mp3
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const http = require('http');

const API_URL = 'http://localhost:5000';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(color, label, message) {
  console.log(`${color}${colors.bright}[${label}]${colors.reset} ${message}`);
}

async function uploadFile(filePath) {
  return new Promise((resolve, reject) => {
    const filename = path.basename(filePath);
    const fileStream = fs.createReadStream(filePath);
    const form = new FormData();
    form.append('audio', fileStream, filename);

    const url = new URL(`${API_URL}/upload`);
    const options = {
      method: 'POST',
      headers: form.getHeaders(),
      hostname: url.hostname,
      port: url.port,
      path: url.pathname
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: data
          });
        }
      });
    });

    req.on('error', reject);
    form.pipe(req);
  });
}

async function getWarnings(audioId) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_URL}/upload/${audioId}/warnings`);
    const options = {
      method: 'GET',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: data
          });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function getAllWarnings() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_URL}/upload/warnings`);
    const options = {
      method: 'GET',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: data
          });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    log(colors.yellow, 'USAGE', 'node test-logging.js <audio-file-path>');
    log(colors.yellow, 'USAGE', 'Example: node test-logging.js ../uploads/sample.mp3');
    process.exit(1);
  }

  const audioFile = args[0];

  if (!fs.existsSync(audioFile)) {
    log(colors.yellow, 'ERROR', `File not found: ${audioFile}`);
    process.exit(1);
  }

  const filename = path.basename(audioFile);
  log(colors.blue, 'TEST', `Starting logging test with file: ${filename}`);
  console.log('');

  try {
    // Test 1: Upload original file
    log(colors.blue, 'TEST 1', 'Uploading original file...');
    log(colors.yellow, 'EXPECT', 'See: "Original audio file stored - fingerprinting queued" (INFO)');
    const upload1 = await uploadFile(audioFile);
    console.log(`Status: ${upload1.status}`);
    console.log(`AudioId: ${upload1.body.audioId}`);
    console.log(`Duplicate: ${upload1.body.duplicate}`);
    const audioId = upload1.body.audioId;
    console.log('✅ Check server logs above for original file logs');
    console.log('');

    // Wait for fingerprinting to complete
    log(colors.blue, 'TEST', 'Waiting 3 seconds for fingerprinting to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('');

    // Test 2: Call warnings endpoint for specific file
    log(colors.blue, 'TEST 2', 'Calling warnings endpoint for specific file...');
    log(colors.yellow, 'EXPECT', 'See: "Warnings endpoint called - found X similarity warning(s)" (INFO)');
    const warnings = await getWarnings(audioId);
    console.log(`Status: ${warnings.status}`);
    console.log(`Warning count: ${warnings.body.warnings?.length || 0}`);
    console.log('✅ Check server logs above for warnings endpoint logs');
    console.log('');

    // Test 3: Call all warnings endpoint
    log(colors.blue, 'TEST 3', 'Calling all warnings endpoint...');
    log(colors.yellow, 'EXPECT', 'See: "All warnings endpoint called - found X total similarity warning(s)" (INFO)');
    const allWarnings = await getAllWarnings();
    console.log(`Status: ${allWarnings.status}`);
    console.log(`Total warnings: ${allWarnings.body.total}`);
    console.log('✅ Check server logs above for all warnings endpoint logs');
    console.log('');

    // Test 4: Upload duplicate
    log(colors.blue, 'TEST 4', 'Uploading duplicate file...');
    log(colors.yellow, 'EXPECT', 'See: "Duplicate file rejected - identical file already exists" (WARN)');
    const upload2 = await uploadFile(audioFile);
    console.log(`Status: ${upload2.status}`);
    console.log(`Duplicate: ${upload2.body.duplicate}`);
    console.log('✅ Check server logs above for duplicate detection logs');
    console.log('');

    log(colors.green, 'COMPLETE', 'All logging tests finished! Check your server logs above.');
  } catch (error) {
    log(colors.yellow, 'ERROR', `Test failed: ${error.message}`);
    process.exit(1);
  }
}

main();
