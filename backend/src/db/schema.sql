CREATE TABLE IF NOT EXISTS audio_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_hash TEXT NOT NULL UNIQUE,
    perceptual_hash TEXT,
    storage_path TEXT NOT NULL,
    original_filename TEXT,
    file_size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    duration_seconds NUMERIC,
    similarity_status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE upload_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_hash TEXT,
    was_duplicate BOOLEAN,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS similarity_warnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audio_id_a UUID NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
    audio_id_b UUID NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
    filename_a TEXT,
    filename_b TEXT,
    similarity_percent NUMERIC,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(audio_id_a, audio_id_b)
);