# Audio Upload Deduplication System

A full-stack audio upload system with **intelligent duplicate detection** and **real-time similarity warnings**. Built with Node.js, Express, PostgreSQL, Redis, and Next.js.

---

## Quick Overview

### What It Does
1. Users upload audio files (MP3, FLAC, WAV, OGG, M4A, AAC)
2. System instantly detects **exact duplicates** (binary identical) and prevents storage
3. System asynchronously computes **audio fingerprints** and detects **similar re-uploads**
4. Users receive **real-time notifications** when similar files are detected
5. Supports **100+ concurrent uploads** without race conditions

### Key Features

#### Exact Duplicate Detection ✅
- SHA-256 binary hash with database UNIQUE constraint
- Duplicates **removed immediately** (synchronous)
- User gets instant feedback
- Zero duplicate files stored

#### Similarity Detection ✅
- Uses Chromaprint audio fingerprinting
- Detects same song in different formats/bitrates
- Asynchronous (doesn't block uploads)
- Real-time SSE notifications
- 70% similarity threshold

#### Concurrent Safety ✅
- Database-level UNIQUE constraint prevents race conditions
- Multiple identical uploads result in one stored file
- Atomic INSERT ... ON CONFLICT ensures consistency
- Tested with 10+ simultaneous identical uploads

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                        │
│  • Upload form with drag-and-drop                            │
│  • Real-time notification display (SSE)                      │
│  • Similarity warning history                                │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP / SSE
┌─────────────────────────▼───────────────────────────────────┐
│                Backend (Express/Node.js)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ POST /upload                                         │   │
│  │  1. Compute SHA-256 hash                            │   │
│  │  2. Check UNIQUE constraint                         │   │
│  │  3. Delete duplicate file if exists                 │   │
│  │  4. Queue fingerprint job                           │   │
│  │  5. Return response to client                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ BullMQ Worker (Fingerprinting)                       │   │
│  │  1. Compute audio fingerprint (fpcalc)              │   │
│  │  2. Store in database                               │   │
│  │  3. Check against all existing fingerprints         │   │
│  │  4. Broadcast SSE notification if similar           │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────┬──────────────────────────┬──────────────────┬────┘
           │                          │                  │
           ▼                          ▼                  ▼
    ┌────────────────┐       ┌──────────────┐   ┌────────────┐
    │  PostgreSQL    │       │    Redis     │   │   Storage  │
    │  ─────────────│       │  ─────────────│   │  ─────────│
    │  audio_files  │       │  Job Queue   │   │  /uploads  │
    │  similarity   │       │  Subscribers │   │  (Files)   │
    │  _warnings    │       │              │   │            │
    └────────────────┘       └──────────────┘   └────────────┘
```

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend** | Next.js 13+ | Web interface, real-time SSE |
| **Backend** | Node.js + Express | REST API, job queue management |
| **Database** | PostgreSQL | Persistent storage, UNIQUE constraints |
| **Cache/Queue** | Redis + BullMQ | Async fingerprint jobs |
| **Fingerprinting** | fpcalc/Chromaprint | Audio fingerprint computation |
| **File Storage** | Local filesystem | Uploading files |

---

## Deployment Architecture

### Development
```
Your Machine
  ├─ Frontend (Next.js) on :3000
  ├─ Backend (Express) on :5000
  ├─ PostgreSQL local
  └─ Redis local
```

### Production (Example)
```
Users
  │
  ├─→ Vercel (Frontend)
  │    └─→ https://audio-dedup.vercel.app
  │
  └─→ Docker Container (Backend)
       ├─→ RDS PostgreSQL (Managed)
       ├─→ ElastiCache Redis (Managed)
       └─→ S3 Storage (Optional)
```

---

## Quick Start

### Prerequisites
- Node.js 16+
- PostgreSQL 12+
- Redis 6+
- fpcalc (Chromaprint)

### Setup (5 minutes)

**1. Clone and install**
```bash
git clone <repo>
cd AudioDedup

# Install dependencies
cd backend && npm install
cd ../frontend && npm install
```

**2. Create databases**
```bash
createdb audio_dedup
psql audio_dedup < backend/src/db/schema.sql
```

**3. Start services**
```bash
# Terminal 1: Redis
redis-server

# Terminal 2: Backend
cd backend && npm run dev

# Terminal 3: Frontend
cd frontend && npm run dev
```

**4. Test**
- Open http://localhost:3000
- Upload an audio file
- Upload same file again → See "duplicate" error
- Upload same audio in different format → See similarity warning

---

## Upload Flow (Step-by-Step)

### Scenario: User uploads same song in different formats

**Time 0ms: User uploads Song.flac**
```
Frontend sends: POST /upload with Song.flac
```

**Time 50ms: Hash computed**
```
Backend: SHA-256(Song.flac) = "abc123..."
Backend: INSERT audio_files (content_hash="abc123...")
Result: Success, audioId="uuid-1"
```

**Time 60ms: Response to user**
```
Frontend receives: { "duplicate": false, "audioId": "uuid-1" }
Frontend: Open SSE connection to listen for warnings
Backend: Queue fingerprint job
```

**Time 100-300ms: Fingerprint computed (async)**
```
Worker: Run fpcalc on Song.flac
Worker: Store fingerprint in database
Worker: Compare against all existing fingerprints
Result: No matches (first upload)
```

**Time 2 seconds: User uploads Song.mp3**
```
Frontend sends: POST /upload with Song.mp3
```

**Time 2.05s: Hash computed**
```
Backend: SHA-256(Song.mp3) = "def456..." (different binary content)
Backend: INSERT audio_files (content_hash="def456...")
Result: Success, audioId="uuid-2"
Backend: Queue fingerprint job
```

**Time 2.1s: Response to user**
```
Frontend receives: { "duplicate": false, "audioId": "uuid-2" }
Frontend: Open SSE connection for this audioId
```

**Time 2.2-2.4s: Fingerprints compared (async)**
```
Worker: Run fpcalc on Song.mp3
Worker: Compute fingerprint
Worker: Compare against uuid-1's fingerprint
Result: 76% match! (Above 70% threshold)
Worker: INSERT similarity_warnings (...)
Worker: Call notifyWarning() for SSE broadcast
```

**Time 2.4s: Real-time notification**
```
Backend: Send SSE message to all subscribers of uuid-2
Frontend: Receive event: {
  "type": "similarity_detected",
  "file1": { "id": "uuid-1", "filename": "Song.flac" },
  "file2": { "id": "uuid-2", "filename": "Song.mp3" },
  "similarityPercent": 76.24
}
Frontend: Display alert: "Song.mp3 is 76% similar to Song.flac"
```

---

## Files Structure

```
AudioDedup/
├── backend/
│   ├── src/
│   │   ├── app.js                 # Express app setup
│   │   ├── server.js              # Server entry point
│   │   ├── config/                # Configuration (DB, Redis, etc.)
│   │   ├── db/
│   │   │   ├── schema.sql         # Database schema
│   │   │   └── init.js            # Database initialization
│   │   ├── modules/
│   │   │   ├── upload/            # Upload handling
│   │   │   │   ├── upload.controller.js
│   │   │   │   ├── upload.service.js
│   │   │   │   ├── upload.utils.js
│   │   │   │   ├── upload.routes.js
│   │   │   │   ├── warnings.controller.js  # Warning endpoints
│   │   │   │   └── sse.controller.js       # Real-time notifications
│   │   │   ├── audio/             # Fingerprinting
│   │   │   │   ├── fingerprint.service.js  # fpcalc wrapper
│   │   │   │   └── similarity.service.js   # Hamming distance
│   │   │   └── logging/
│   │   │       └── logger.js
│   │   ├── jobs/
│   │   │   ├── queue.js           # BullMQ setup
│   │   │   └── fingerprint.processor.js  # Worker
│   │   └── middleware/
│   │       ├── errorHandler.js
│   │       └── rateLimiter.js
│   ├── package.json
│   ├── README_DETAILED.md         # Full documentation
│   └── .env.example
│
├── frontend/
│   ├── app/
│   │   ├── upload/
│   │   │   ├── page.tsx           # Upload page
│   │   │   ├── UploadForm.tsx     # Upload component
│   │   │   ├── SimilarityAlert.tsx # Warning display
│   │   │   └── WarningsList.tsx   # History view
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── lib/
│   │   ├── api.ts                 # API client
│   │   └── useSSE.ts              # Real-time hook
│   ├── package.json
│   ├── README.md                  # Frontend docs
│   └── next.config.js
│
└── README.MD                      # This file
```

---

## Assumptions & Trade-offs

### Assumptions
- Files < 50MB
- Exact duplicates are primary concern
- Similar file detection is advisory (doesn't prevent upload)
- Fingerprinting latency (~200ms) is acceptable
- Single-server deployment (no distributed workers)

### What Works Well
✅ Duplicate detection is 100% reliable  
✅ Concurrent uploads handled safely  
✅ Real-time notifications via SSE  
✅ Format-agnostic fingerprinting  
✅ No complex distributed system

### Limitations
❌ 70% similarity threshold is fixed  
❌ No machine learning scoring  
❌ Requires local fpcalc binary  
❌ Single-server only  

---

## API Reference

### Upload Audio
```
POST /upload
Content-Type: multipart/form-data

Request: audio=<file>
Response (unique): { "duplicate": false, "audioId": "uuid" }
Response (duplicate): { "duplicate": true, "message": "..." }
```

### Real-Time Warnings (SSE)
```
GET /upload/:audioId/subscribe

Returns: EventStream
Message: { "type": "similarity_detected", "file1": {...}, "file2": {...}, ... }
```

### Get Warnings
```
GET /upload/:audioId/warnings
GET /upload/warnings

Response: { "warnings": [...] }
```

---

## Detailed Documentation

For comprehensive documentation, see:

- **[Backend README](./backend/README_DETAILED.md)** - Assumptions, duplicate detection, similarity matching, concurrency handling, database schema, API details
- **[Frontend README](./frontend/README.md)** - Components, hooks, setup, testing, troubleshooting

---

## Common Questions

**Q: How are duplicates detected?**  
A: SHA-256 content hash with database UNIQUE constraint. Detects binary-identical files instantly.

**Q: How are similar files detected?**  
A: Chromaprint audio fingerprinting computed asynchronously. Compared using Hamming distance (70% threshold).

**Q: What happens if I upload the same file twice?**  
A: First upload succeeds. Second upload is detected as duplicate, file is deleted, user gets error response instantly.

**Q: What if I upload the same song in different formats (MP3 vs FLAC)?**  
A: Both uploads succeed (different binary content). Similarity detected asynchronously. User notified via real-time SSE message within ~500ms.

**Q: How is concurrency handled?**  
A: Database UNIQUE constraint at atomic level. If 10 identical files uploaded simultaneously, only 1 succeeds. Others fail with duplicate error.

**Q: Can it scale to 1000 concurrent uploads?**  
A: Yes for uploads. Fingerprinting would become bottleneck - requires distributed workers (future improvement).

**Q: Why use fpcalc?**  
A: Industry-standard audio fingerprinting (AcoustID). Works across formats/bitrates. Lightweight and fast (~100ms per file).

---

## Troubleshooting

### Backend won't start
```bash
# Check Redis
redis-cli ping

# Check PostgreSQL
psql postgres -c "SELECT 1"

# Check fpcalc
fpcalc --version
```

### Duplicates not detected
- Check database UNIQUE constraint exists
- Check file is actually identical (binary)
- Check logs for insertion errors

### Similarity warnings not appearing
- Check backend fingerprint.processor.js is running
- Check Redis queue has jobs
- Check browser EventSource connection is open
- Wait 200-300ms after upload

### Upload stuck
- Check backend is running: `curl http://localhost:5000/health`
- Check file size < 50MB
- Check file is valid audio

---

## Performance

| Operation | Latency | Notes |
|-----------|---------|-------|
| Hash computation | 50-200ms | Depends on file size |
| Duplicate check | <5ms | Database query |
| Upload response | ~200ms | For unique files |
| Fingerprinting | 100-500ms | Async, doesn't block user |
| Similarity check | 10-100ms | Comparing against N files |
| Notification broadcast | <100ms | SSE push to subscribers |

**Throughput:**
- ~100 concurrent uploads
- ~5-10 fingerprint jobs/sec per worker
- ~1000 similarity comparisons/sec

---

## Production Checklist

- [ ] Backend: Configure SSL/TLS
- [ ] Backend: Enable CORS for frontend domain
- [ ] Backend: Set up monitoring (Sentry, LogRocket)
- [ ] Backend: Configure logs aggregation
- [ ] Frontend: Build optimization (`npm run build`)
- [ ] Database: Enable backups and replication
- [ ] Redis: Enable persistence and replication
- [ ] Storage: Configure cleanup job for orphaned files
- [ ] Deployment: Health checks on all services

---

## Future Improvements

- Distributed fingerprint workers (horizontal scaling)
- User-configurable similarity threshold
- Cloud storage integration (S3, GCS)
- Advanced similarity metrics (tempo, key)
- Machine learning-based scoring
- Duplicate management UI (view, compare, delete)
- Partial upload resume
- Batch upload
- API rate limiting
- User authentication

---

## License

MIT

---

## Support

For issues or questions:
1. Check [Backend README](./backend/README_DETAILED.md) for detailed info
2. Check [Frontend README](./frontend/README.md) for UI/UX issues
3. Review logs in `backend/logs/` directory
4. Check database schema in `backend/src/db/schema.sql`
