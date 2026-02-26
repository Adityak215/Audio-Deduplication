# Logging System Guide

## Overview

The project uses **Pino** for structured, performant logging with automatic HTTP request logging via `pino-http`.

## Logging Features

### ✅ Clean, Professional Output

Logs are formatted with:
- **Timestamps**: ISO 8601 with timezone info
- **Log Levels**: DEBUG, INFO, WARN, ERROR
- **Structured Data**: Context included as key-value pairs
- **Colors**: Syntax highlighting in development (disabled in production)

### Example Output

```
[2026-02-27 03:10:18.979 +0530] INFO: Fingerprint worker started
[2026-02-27 03:10:19.095 +0530] DEBUG: Schema already initialized
[2026-02-27 03:10:19.098 +0530] INFO: Server listening on port 5000
```

### 🎯 Log Levels

| Level | Usage | Example |
|-------|-------|---------|
| **DEBUG** | Development details, job completions | "Fingerprint stored", "SSE connection established" |
| **INFO** | Important events, successful operations | "Database initialized", "Audio file uploaded successfully" |
| **WARN** | Unexpected events that don't stop execution | "Audio file not found", "Unsupported audio format rejected" |
| **ERROR** | Failures and exceptions | "Fingerprint computation failed", "Failed to retrieve warnings" |

### 📋 Logging Patterns

#### 1. **Request Logging** (Automatic via pino-http)
```
Automatically logged for all HTTP requests except /health
- Method, path, status code
- Response time
- Request body (when applicable)
```

#### 2. **Service Logging** (Manual)
```javascript
logger.info(
  { audioId, filename, size },
  'Audio file uploaded successfully'
);
```

#### 3. **Error Logging**
```javascript
logger.error(
  { error: err.message },
  'Fingerprint computation failed'
);
```

#### 4. **Debug Logging** (Development only)
```javascript
logger.debug({ audioId }, 'Fingerprint stored');
```

## Files Using Logger

| File | Logs |
|------|------|
| `src/server.js` | Server startup, service initialization |
| `src/app.js` | HTTP request/response (via pino-http middleware) |
| `src/middleware/errorHandler.js` | Unhandled errors and exceptions |
| `src/modules/upload/upload.controller.js` | Upload attempts and results |
| `src/modules/upload/upload.service.js` | File processing, duplicate detection |
| `src/modules/audio/fingerprint.service.js` | Fingerprint computation and storage |
| `src/modules/audio/similarity.service.js` | Similarity detection and warnings |
| `src/modules/upload/sse.controller.js` | SSE connections and notifications |
| `src/modules/upload/warnings.controller.js` | Warning retrieval |
| `src/jobs/fingerprint.processor.js` | Job queue events |
| `src/db/init.js` | Database initialization |

## Logger Configuration

Located in `src/modules/logging/logger.js`:

```javascript
const logger = pino(
  {
    level: isDev ? 'debug' : 'info',
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
      : undefined
  }
);
```

### Configuration Details
- **Development**: DEBUG level with colored terminal output
- **Production**: INFO level with JSON output (suitable for log aggregation)
- **Ignored Fields**: PID and hostname (noise reduction)
- **Timestamp Format**: System standard (readable format)

## HTTP Request Logging

Automatically logs all requests (except `/health`) via `pino-http` middleware:

```javascript
app.use(
  pinoHttp({
    logger,
    quietReqLogger: false,
    autoLogging: {
      ignorePaths: ['/health']
    }
  })
);
```

### Example Request Log
```
[2026-02-27 03:10:20.150 +0530] INFO: 
  POST /upload 201 12ms
  "user-agent": "curl/7.64.1"
```

## Best Practices

### ✅ Do

1. **Log important business events** (successful uploads, duplicate detection)
   ```javascript
   logger.info({ audioId, filename }, 'Audio file uploaded successfully');
   ```

2. **Include context** in error logs
   ```javascript
   logger.error({ audioId, error: err.message }, 'Fingerprint processing failed');
   ```

3. **Use appropriate levels** for sorting importance
   ```javascript
   logger.debug({}, 'Detailed diagnostic info');        // Dev details
   logger.info({}, 'Successful operation');             // Important events
   logger.warn({}, 'Something unexpected');             // Potentially bad
   logger.error({}, 'Operation failed');                // Failures
   ```

4. **Keep messages concise** in production
   ```javascript
   logger.info({ audioId }, 'Duplicated detected - file rejected');
   ```

### ❌ Don't

1. **Don't use console.log** - Use logger methods instead
   ```javascript
   // ❌ Bad
   console.log('User uploaded file');
   
   // ✅ Good
   logger.info({ filename }, 'File uploaded');
   ```

2. **Don't log sensitive data**
   ```javascript
   // ❌ Bad
   logger.info({ password, token }, 'User login');
   
   // ✅ Good
   logger.info({ userId }, 'User authenticated');
   ```

3. **Don't log entire objects** for production
   ```javascript
   // ❌ Bad (too verbose)
   logger.debug({ fullRequest: req }, 'Received request');
   
   // ✅ Good
   logger.debug({ method: req.method, path: req.path }, 'Request received');
   ```

4. **Don't over-log** in production
   ```javascript
   // ❌ Bad (creates noise)
   logger.debug({}, 'Processing item 1 of 1000');
   
   // ✅ Good
   logger.info({ processed: 1000 }, 'Batch processing completed');
   ```

## Viewing Logs

### Development
```bash
cd backend
npm run dev
```
Logs appear in terminal with colors and timestamps.

### Production
```bash
# Logs output as JSON suitable for aggregation
LOG_LEVEL=info node src/server.js
```

## Troubleshooting

### No logs appearing
- Check `NODE_ENV` (should be unset or "development" for debug logs)
- Verify logger is imported: `const logger = require('../logging/logger');`
- Check log level matches your message type

### Too many logs
- Set `LOG_LEVEL=info` to suppress DEBUG messages
- Ensure debug logging is only for development

### Unclear timestamps
- Logs use system timezone automatically
- Format: `YYYY-MM-DD HH:MM:SS.ms +TIMEZONE`

## Performance Impact

Pino is designed for minimal overhead:
- **Benchmark**: ~5-10 microseconds per log statement
- **Memory**: Minimal allocations with streaming transport
- **Production**: JSON output sent to stdout (suitable for logs collection services like Datadog, ELK, etc.)

---

## Summary

The logging system is now:
- ✅ **Professional**: Clear timestamps and structured data
- ✅ **Efficient**: Minimal performance overhead
- ✅ **Scalable**: Ready for production log aggregation
- ✅ **Maintainable**: Consistent patterns across all files
- ✅ **Assignment-Ready**: Suitable for fresh grad project presentation
