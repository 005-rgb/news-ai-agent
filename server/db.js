'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: 2,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

// ── Migration DDL ─────────────────────────────────────────────────────────────

const MIGRATION_SQL = `
-- Pastikan gen_random_uuid() tersedia di semua versi PostgreSQL
-- PG 13+: built-in. PG < 13: coba pgcrypto, fallback ke fungsi manual.
DO $$
BEGIN
  -- Coba pakai yang sudah ada dulu
  PERFORM gen_random_uuid();
EXCEPTION WHEN undefined_function THEN
  -- Coba aktifkan pgcrypto
  BEGIN
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
  EXCEPTION WHEN OTHERS THEN
    -- pgcrypto tidak tersedia, buat fungsi fallback manual
    CREATE OR REPLACE FUNCTION gen_random_uuid()
    RETURNS uuid
    LANGUAGE sql
    AS $func$
      SELECT uuid_in(
        overlay(
          overlay(
            md5(random()::text || ':' || random()::text || ':' || clock_timestamp()::text)
            placing '4' from 13
          )
          placing to_hex(floor(random() * 4 + 8)::int) from 17
        )::cstring
      );
    $func$;
  END;
END $$;

-- ── 1. sites ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sites (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        VARCHAR(255) NOT NULL,
  url                         TEXT NOT NULL,
  wordpress_api_url           TEXT,
  wordpress_username          VARCHAR(255),
  wordpress_app_password_enc  TEXT,            -- AES-256-GCM encrypted
  niche                       VARCHAR(100),
  categories                  TEXT[]           DEFAULT '{}',
  status                      VARCHAR(50)      DEFAULT 'active',
  config                      JSONB            DEFAULT '{}',
  persona_memory              TEXT,
  persona_description         TEXT,
  created_at                  TIMESTAMPTZ      DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ      DEFAULT NOW()
);

-- ── 2. api_keys ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          VARCHAR(100) NOT NULL,
  label             VARCHAR(255),
  key_encrypted     TEXT NOT NULL,             -- AES-256-GCM encrypted
  status            VARCHAR(50)  DEFAULT 'active',
  usage_today       INTEGER      DEFAULT 0,
  usage_this_month  INTEGER      DEFAULT 0,
  daily_limit       INTEGER      DEFAULT 1000,
  monthly_limit     INTEGER      DEFAULT 30000,
  last_used_at      TIMESTAMPTZ,
  reset_at          TIMESTAMPTZ,
  error_count       INTEGER      DEFAULT 0,
  last_error        TEXT,
  metadata          JSONB        DEFAULT '{}',
  created_at        TIMESTAMPTZ  DEFAULT NOW()
);

-- ── 3. sources ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sources (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    VARCHAR(255) NOT NULL,
  url                     TEXT NOT NULL,
  rss_url                 TEXT,
  type                    VARCHAR(50),         -- rss | api | scrape
  categories              TEXT[]  DEFAULT '{}',
  credibility_score       FLOAT   DEFAULT 5.0,
  is_active               BOOLEAN DEFAULT true,
  fetch_interval_minutes  INTEGER DEFAULT 30,
  last_fetched_at         TIMESTAMPTZ,
  cached_items            JSONB   DEFAULT '[]',
  css_selectors           JSONB   DEFAULT '{}',
  metadata                JSONB   DEFAULT '{}',
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. articles ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS articles (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id                 UUID REFERENCES sites(id) ON DELETE SET NULL,
  title                   TEXT,
  content                 TEXT,
  content_versions        JSONB   DEFAULT '{}',
  status                  VARCHAR(50)  DEFAULT 'draft',
  format                  VARCHAR(50),
  category                VARCHAR(100),
  tags                    TEXT[]  DEFAULT '{}',
  source_urls             TEXT[]  DEFAULT '{}',
  brief_data              JSONB   DEFAULT '{}',
  seo_data                JSONB   DEFAULT '{}',
  image_data              JSONB   DEFAULT '{}',
  schema_markup           TEXT,
  quality_score           FLOAT,
  eeat_score              FLOAT,
  prompt_version          VARCHAR(50),
  provider_used           VARCHAR(100),
  scheduled_at            TIMESTAMPTZ,
  published_at            TIMESTAMPTZ,
  wordpress_post_id       INTEGER,
  wordpress_url           TEXT,
  is_evergreen_candidate  BOOLEAN DEFAULT false,
  last_updated_at         TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. job_queue ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_queue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id    UUID REFERENCES articles(id) ON DELETE CASCADE,
  job_type      VARCHAR(100),
  status        VARCHAR(50)  DEFAULT 'pending',
  priority      VARCHAR(50)  DEFAULT 'normal',
  attempts      INTEGER      DEFAULT 0,
  max_attempts  INTEGER      DEFAULT 3,
  payload       JSONB        DEFAULT '{}',
  error_message TEXT,
  scheduled_at  TIMESTAMPTZ  DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- ── 6. content_calendar ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_calendar (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           UUID REFERENCES sites(id) ON DELETE CASCADE,
  topic             TEXT NOT NULL,
  category          VARCHAR(100),
  format            VARCHAR(50),
  priority          VARCHAR(50) DEFAULT 'normal',
  scheduled_date    DATE,
  status            VARCHAR(50) DEFAULT 'planned',
  rapat_session_id  UUID,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. rapat_notes ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rapat_notes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date       DATE NOT NULL,
  summary            TEXT,
  trend_data         JSONB DEFAULT '{}',
  performance_report JSONB DEFAULT '{}',
  recommendations    JSONB DEFAULT '{}',
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ── 8. usage_stats ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_stats (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                DATE NOT NULL,
  site_id             UUID REFERENCES sites(id) ON DELETE SET NULL,
  api_key_id          UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  articles_generated  INTEGER DEFAULT 0,
  tokens_used         INTEGER DEFAULT 0,
  images_generated    INTEGER DEFAULT 0,
  errors_count        INTEGER DEFAULT 0,
  avg_quality_score   FLOAT,
  avg_eeat_score      FLOAT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── 9. system_logs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level      VARCHAR(50),
  agent      VARCHAR(100),
  message    TEXT,
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 10. prompt_versions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prompt_versions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(255),
  agent_type        VARCHAR(100),
  category          VARCHAR(100),
  format_key        VARCHAR(100),
  prompt_template   TEXT,
  performance_score FLOAT   DEFAULT 0,
  sample_count      INTEGER DEFAULT 0,
  is_champion       BOOLEAN DEFAULT false,
  is_active         BOOLEAN DEFAULT true,
  status            VARCHAR(50) DEFAULT 'active',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
-- Add format_key column if it doesn't exist (idempotent migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prompt_versions' AND column_name = 'format_key'
  ) THEN
    ALTER TABLE prompt_versions ADD COLUMN format_key VARCHAR(100);
  END IF;
END $$;

-- ── 11. competitor_data ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS competitor_data (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          UUID REFERENCES sites(id) ON DELETE CASCADE,
  competitor_url   TEXT,
  topics_covered   TEXT[]  DEFAULT '{}',
  last_checked_at  TIMESTAMPTZ,
  gap_opportunities JSONB  DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 12. trend_predictions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trend_predictions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic               TEXT NOT NULL,
  category            VARCHAR(100),
  confidence_score    FLOAT,
  predicted_peak_date DATE,
  source_signals      JSONB DEFAULT '{}',
  status              VARCHAR(50) DEFAULT 'predicted',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── 13 (Phase 10). article_links — Link Intelligence Network ─────────────────
CREATE TABLE IF NOT EXISTS article_links (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_article_id   UUID REFERENCES articles(id) ON DELETE CASCADE,
  target_article_id   UUID REFERENCES articles(id) ON DELETE CASCADE,
  target_url          TEXT NOT NULL,
  anchor_text         TEXT,
  is_cross_site       BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source_article_id, target_article_id)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_articles_site_status    ON articles(site_id, status);
CREATE INDEX IF NOT EXISTS idx_articles_published_at   ON articles(published_at);
CREATE INDEX IF NOT EXISTS idx_articles_status         ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_site_id        ON articles(site_id);
CREATE INDEX IF NOT EXISTS idx_job_queue_status        ON job_queue(status, priority, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_job_queue_article       ON job_queue(article_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_level       ON system_logs(level, created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_created     ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_provider       ON api_keys(provider, status);
CREATE INDEX IF NOT EXISTS idx_sources_categories      ON sources USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_content_cal_site_date   ON content_calendar(site_id, scheduled_date, status);
CREATE INDEX IF NOT EXISTS idx_usage_stats_date        ON usage_stats(date, site_id);
CREATE INDEX IF NOT EXISTS idx_article_links_source    ON article_links(source_article_id);
CREATE INDEX IF NOT EXISTS idx_article_links_target    ON article_links(target_article_id, created_at);
CREATE INDEX IF NOT EXISTS idx_article_links_cross     ON article_links(is_cross_site, created_at);

-- Unique constraint for daily stats upsert (date + site_id combo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usage_stats_date_site_id_key'
  ) THEN
    ALTER TABLE usage_stats ADD CONSTRAINT usage_stats_date_site_id_key UNIQUE (date, site_id);
  END IF;
END $$;

-- ── Phase 11: system_alerts ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        VARCHAR(100) NOT NULL,
  severity    VARCHAR(50)  DEFAULT 'warning',
  title       TEXT         NOT NULL,
  message     TEXT,
  metadata    JSONB        DEFAULT '{}',
  is_resolved BOOLEAN      DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_system_alerts_active ON system_alerts(is_resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_alerts_type   ON system_alerts(type, is_resolved);

-- ── 13. system_settings (Phase 7 — editable runtime config) ─────────────────
CREATE TABLE IF NOT EXISTS system_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default values (on conflict = keep existing)
INSERT INTO system_settings (key, value) VALUES
  ('humanizer_level',          '3'),
  ('quality_score_threshold',  '75'),
  ('eeat_score_threshold',     '80'),
  ('key_warning_threshold',    '80'),
  ('human_review_enabled',     'false'),
  ('image_fallback_chain',     '["ai_generate","unsplash","pexels","placeholder"]')
ON CONFLICT (key) DO NOTHING;

-- ── Phase 7: add human_review columns to articles ────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='articles' AND column_name='needs_human_review') THEN
    ALTER TABLE articles ADD COLUMN needs_human_review BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='articles' AND column_name='human_review_notes') THEN
    ALTER TABLE articles ADD COLUMN human_review_notes TEXT;
  END IF;
END $$;
`;

// ── Seed Data ─────────────────────────────────────────────────────────────────

const SEED_SOURCES_SQL = `
INSERT INTO sources (name, url, rss_url, type, categories, credibility_score, fetch_interval_minutes)
SELECT * FROM (VALUES
  ('Detik.com', 'https://www.detik.com', 'https://rss.detik.com/index.php/detikcom', 'rss', ARRAY['politik','bisnis','teknologi','kesehatan','olahraga'], 8.5, 30),
  ('Kompas.com', 'https://www.kompas.com', 'https://rss.kompas.com/breakingnews/', 'rss', ARRAY['politik','bisnis','teknologi','lifestyle'], 9.0, 30),
  ('Tempo.co', 'https://www.tempo.co', 'https://rss.tempo.co/', 'rss', ARRAY['politik','bisnis','hukum'], 8.8, 30),
  ('Antara News', 'https://www.antaranews.com', 'https://www.antaranews.com/rss/terkini.xml', 'rss', ARRAY['politik','bisnis','teknologi','olahraga'], 9.2, 30),
  ('CNN Indonesia', 'https://www.cnnindonesia.com', 'https://www.cnnindonesia.com/rss/', 'rss', ARRAY['politik','bisnis','teknologi','olahraga'], 8.7, 30),
  ('Republika', 'https://www.republika.co.id', 'https://www.republika.co.id/rss/', 'rss', ARRAY['politik','lifestyle','kesehatan'], 8.3, 60),
  ('Bisnis.com', 'https://ekonomi.bisnis.com', 'https://ekonomi.bisnis.com/rss/', 'rss', ARRAY['bisnis'], 8.9, 30),
  ('Kontan.co.id', 'https://www.kontan.co.id', 'https://www.kontan.co.id/rss/', 'rss', ARRAY['bisnis'], 8.6, 30),
  ('Kompas Tekno', 'https://tekno.kompas.com', 'https://rss.kompas.com/breakingnews/', 'rss', ARRAY['teknologi'], 9.0, 30),
  ('IDN Times', 'https://www.idntimes.com', 'https://www.idntimes.com/rss.xml', 'rss', ARRAY['lifestyle','teknologi'], 7.5, 60),
  ('Liputan6', 'https://www.liputan6.com', 'https://www.liputan6.com/rss/', 'rss', ARRAY['politik','bisnis','olahraga','lifestyle'], 8.0, 30),
  ('CNBC Indonesia', 'https://www.cnbcindonesia.com', 'https://www.cnbcindonesia.com/rss/', 'rss', ARRAY['bisnis','teknologi'], 8.8, 30),
  ('Okezone', 'https://www.okezone.com', 'https://rss.okezone.com/', 'rss', ARRAY['teknologi','olahraga','lifestyle'], 7.8, 60),
  ('Kumparan', 'https://kumparan.com', 'https://kumparan.com/rss/', 'rss', ARRAY['politik','teknologi','lifestyle'], 7.9, 60),
  ('Tribunnews', 'https://www.tribunnews.com', 'https://www.tribunnews.com/rss/', 'rss', ARRAY['politik','olahraga','hukum'], 7.5, 60),
  ('Hukum Online', 'https://www.hukumonline.com', NULL, 'scrape', ARRAY['hukum'], 9.2, 120),
  ('JDIH.go.id', 'https://jdih.go.id', NULL, 'scrape', ARRAY['hukum'], 9.5, 360),
  ('Alodokter', 'https://www.alodokter.com', 'https://www.alodokter.com/feed', 'rss', ARRAY['kesehatan'], 8.7, 120),
  ('Hello Sehat', 'https://hellosehat.com', 'https://hellosehat.com/feed/', 'rss', ARRAY['kesehatan'], 8.5, 120),
  ('PubMed', 'https://pubmed.ncbi.nlm.nih.gov', NULL, 'api', ARRAY['akademik','kesehatan'], 9.8, 60),
  ('arXiv', 'https://arxiv.org', 'https://arxiv.org/rss/', 'rss', ARRAY['akademik','teknologi'], 9.2, 60),
  ('Semantic Scholar', 'https://api.semanticscholar.org', NULL, 'api', ARRAY['akademik'], 8.9, 60),
  ('SINTA Kemdikbud', 'https://sinta.kemdikbud.go.id', NULL, 'scrape', ARRAY['akademik'], 9.0, 360),
  ('Garuda Portal', 'https://garuda.kemdikbud.go.id', NULL, 'scrape', ARRAY['akademik'], 8.7, 360),
  ('DOAJ', 'https://doaj.org', NULL, 'api', ARRAY['akademik'], 9.1, 360),
  ('WHO', 'https://www.who.int', 'https://www.who.int/rss-feeds/news-english.xml', 'rss', ARRAY['kesehatan','akademik'], 9.9, 360),
  ('Bola.com', 'https://www.bola.com', 'https://www.bola.com/rss/', 'rss', ARRAY['olahraga'], 8.3, 30),
  ('Goal.com Indonesia', 'https://www.goal.com/id', 'https://www.goal.com/id/feed/news', 'rss', ARRAY['olahraga'], 8.5, 30),
  ('Tirto.id', 'https://tirto.id', 'https://tirto.id/rss', 'rss', ARRAY['politik','hukum','bisnis'], 8.8, 60),
  ('Kata Data', 'https://katadata.co.id', 'https://katadata.co.id/rss.xml', 'rss', ARRAY['bisnis','teknologi'], 8.7, 60),

  -- ── Politik tambahan ──────────────────────────────────────────────────────
  ('Media Indonesia', 'https://mediaindonesia.com', 'https://mediaindonesia.com/rss/index.php', 'rss', ARRAY['politik','bisnis'], 8.5, 60),
  ('JPNN', 'https://www.jpnn.com', 'https://www.jpnn.com/rss/', 'rss', ARRAY['politik','hukum'], 7.8, 60),
  ('Setkab.go.id', 'https://setkab.go.id', NULL, 'scrape', ARRAY['politik'], 9.2, 360),
  ('DPR RI', 'https://dpr.go.id', NULL, 'scrape', ARRAY['politik','hukum'], 9.0, 360),

  -- ── Teknologi tambahan ────────────────────────────────────────────────────
  ('The Verge', 'https://www.theverge.com', 'https://www.theverge.com/rss/index.xml', 'rss', ARRAY['teknologi'], 8.8, 30),
  ('TechCrunch', 'https://techcrunch.com', 'https://techcrunch.com/feed/', 'rss', ARRAY['teknologi','bisnis'], 8.9, 30),
  ('Detik Inet', 'https://inet.detik.com', 'https://rss.detik.com/index.php/detikinet', 'rss', ARRAY['teknologi'], 8.3, 30),
  ('MIT Technology Review', 'https://www.technologyreview.com', 'https://www.technologyreview.com/feed/', 'rss', ARRAY['teknologi','sains'], 9.2, 60),
  ('Wired', 'https://www.wired.com', 'https://www.wired.com/feed/rss', 'rss', ARRAY['teknologi'], 8.7, 60),

  -- ── Bisnis tambahan ───────────────────────────────────────────────────────
  ('Bloomberg', 'https://www.bloomberg.com', 'https://feeds.bloomberg.com/markets/news.rss', 'rss', ARRAY['bisnis'], 9.5, 30),
  ('Bank Indonesia', 'https://www.bi.go.id', NULL, 'scrape', ARRAY['bisnis'], 9.5, 360),
  ('BPS Indonesia', 'https://www.bps.go.id', NULL, 'scrape', ARRAY['bisnis'], 9.3, 360),
  ('Fortune Indonesia', 'https://fortuneindonesia.com', 'https://fortuneindonesia.com/feed/', 'rss', ARRAY['bisnis'], 8.0, 60),

  -- ── Kesehatan tambahan ────────────────────────────────────────────────────
  ('Halodoc', 'https://www.halodoc.com', NULL, 'scrape', ARRAY['kesehatan'], 8.6, 120),
  ('Klikdokter', 'https://www.klikdokter.com', 'https://www.klikdokter.com/feed/', 'rss', ARRAY['kesehatan'], 8.4, 120),
  ('Kemenkes RI', 'https://www.kemkes.go.id', NULL, 'scrape', ARRAY['kesehatan'], 9.3, 360),
  ('CDC', 'https://www.cdc.gov', 'https://tools.cdc.gov/api/v2/resources/media/132608.rss', 'rss', ARRAY['kesehatan'], 9.5, 120),
  ('Mayo Clinic', 'https://www.mayoclinic.org', NULL, 'scrape', ARRAY['kesehatan'], 9.0, 360),

  -- ── Hukum tambahan ───────────────────────────────────────────────────────
  ('Mahkamah Agung', 'https://mahkamahagung.go.id', NULL, 'scrape', ARRAY['hukum'], 9.5, 360),
  ('MK RI', 'https://mkri.id', NULL, 'scrape', ARRAY['hukum'], 9.3, 360),

  -- ── Akademik tambahan ─────────────────────────────────────────────────────
  ('BRIN Repository', 'https://repository.brin.go.id', NULL, 'scrape', ARRAY['akademik','sains'], 8.8, 360),
  ('Google Scholar', 'https://scholar.google.com', NULL, 'scrape', ARRAY['akademik'], 9.0, 360),

  -- ── Sains & Lingkungan ───────────────────────────────────────────────────
  ('Nature', 'https://www.nature.com', 'https://www.nature.com/nature.rss', 'rss', ARRAY['sains','akademik'], 9.8, 60),
  ('Science Daily', 'https://www.sciencedaily.com', 'https://www.sciencedaily.com/rss/all.xml', 'rss', ARRAY['sains'], 8.5, 60),
  ('BRIN', 'https://www.brin.go.id', NULL, 'scrape', ARRAY['sains','akademik'], 8.8, 360),
  ('LAPAN / BRIN Dirgantara', 'https://lapan.go.id', NULL, 'scrape', ARRAY['sains'], 8.5, 360),
  ('BMKG', 'https://www.bmkg.go.id', 'https://www.bmkg.go.id/rss/', 'rss', ARRAY['sains'], 9.0, 120),
  ('National Geographic Indonesia', 'https://nationalgeographic.grid.id', 'https://nationalgeographic.grid.id/rss/', 'rss', ARRAY['sains','olahraga'], 8.3, 120),

  -- ── Olahraga tambahan ────────────────────────────────────────────────────
  ('ESPN', 'https://espn.com', 'https://www.espn.com/espn/rss/news', 'rss', ARRAY['olahraga'], 9.0, 30),
  ('BBC Sport', 'https://www.bbc.com/sport', 'https://feeds.bbci.co.uk/sport/rss.xml', 'rss', ARRAY['olahraga'], 9.3, 30),
  ('PSSI', 'https://pssi.org', NULL, 'scrape', ARRAY['olahraga'], 8.5, 360),
  ('Bola.net', 'https://bola.net', 'https://bola.net/feed/', 'rss', ARRAY['olahraga'], 8.0, 30),

  -- ── Berita Internasional ─────────────────────────────────────────────────
  ('Reuters', 'https://www.reuters.com', 'https://feeds.reuters.com/reuters/topNews', 'rss', ARRAY['internasional','bisnis'], 9.7, 15),
  ('AP News', 'https://apnews.com', 'https://rsshub.app/apnews/topics/apf-topnews', 'rss', ARRAY['internasional'], 9.6, 15),
  ('BBC Indonesia', 'https://www.bbc.com/indonesia', 'https://feeds.bbci.co.uk/indonesian/rss.xml', 'rss', ARRAY['internasional','politik'], 9.5, 30),
  ('VOA Indonesia', 'https://www.voaindonesia.com', 'https://www.voaindonesia.com/api/zmgqmeso_', 'rss', ARRAY['internasional'], 9.0, 30),
  ('DW Indonesia', 'https://www.dw.com/id', 'https://rss.dw.com/xml/rss-id-all', 'rss', ARRAY['internasional'], 8.8, 30),
  ('Al Jazeera Indonesia', 'https://www.aljazeera.com/indonesia', NULL, 'scrape', ARRAY['internasional'], 8.5, 60)
) AS v(name, url, rss_url, type, categories, credibility_score, fetch_interval_minutes)
WHERE NOT EXISTS (SELECT 1 FROM sources WHERE sources.url = v.url);
`;

// ── Public API ────────────────────────────────────────────────────────────────

async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (err) {
    throw err;
  }
}

async function getClient() {
  return pool.connect();
}

async function checkConnection() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    return true;
  } finally {
    client.release();
  }
}

async function seedPromptVersions() {
  const { TEMPLATES } = require('./config/promptTemplates');
  for (const [key, tpl] of Object.entries(TEMPLATES)) {
    // Upsert by format_key: insert if no row with this format_key exists
    const existing = await pool.query(
      `SELECT id FROM prompt_versions WHERE format_key = $1`, [key]
    ).catch(() => ({ rows: [] }));
    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO prompt_versions (id, name, agent_type, category, format_key, prompt_template, is_champion, is_active, status)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, true, 'active')`,
        [tpl.name, tpl.agentType || 'writer', tpl.category || key, key, tpl.template]
      ).catch(() => {});
    } else {
      // Ensure format_key is set on existing rows (migration fix for rows seeded before format_key was added)
      await pool.query(
        `UPDATE prompt_versions SET format_key = $1 WHERE format_key IS NULL AND name = $2`,
        [key, tpl.name]
      ).catch(() => {});
    }
  }
  const { rows } = await pool.query(`SELECT count(*) FROM prompt_versions`);
  console.log(`[DB] Prompt versions: ${rows[0].count} records.`);
}

async function migrate() {
  console.log('[DB] Running migration...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(MIGRATION_SQL);
    await client.query('COMMIT');
    console.log('[DB] Migration completed — 12 tables created/verified.');

    // Seed sources
    console.log('[DB] Seeding default sources...');
    await pool.query(SEED_SOURCES_SQL);
    const { rows } = await pool.query('SELECT count(*) FROM sources');
    console.log(`[DB] Sources table: ${rows[0].count} records.`);

    // Seed prompt versions (Phase 4)
    console.log('[DB] Seeding default prompt versions...');
    await seedPromptVersions();
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DB] Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, getClient, checkConnection, migrate };

// ── CLI runner ───────────────────────────────────────────────────────────────
if (require.main === module) {
  const command = process.argv[2];
  if (command === 'migrate' || command === 'seed') {
    migrate()
      .then(() => { console.log('[DB] Done.'); process.exit(0); })
      .catch((err) => { console.error(err); process.exit(1); });
  } else {
    console.log('Usage: node server/db.js migrate');
    process.exit(1);
  }
}
