-- ============================================================
-- Anime Rating Platform — PostgreSQL Schema
-- Stack: NestJS + Prisma ORM + Next.js
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive text for email/username

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role       AS ENUM ('user', 'admin');
CREATE TYPE anime_status    AS ENUM ('airing', 'completed', 'upcoming');
CREATE TYPE comment_like_v  AS ENUM ('1', '-1');  -- like / dislike stored as smallint

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  username              CITEXT        NOT NULL UNIQUE,
  email                 CITEXT        NOT NULL UNIQUE,
  password_hash         TEXT          NOT NULL,
  role                  user_role     NOT NULL DEFAULT 'user',

  -- Account health
  is_banned             BOOLEAN       NOT NULL DEFAULT FALSE,
  ban_reason            TEXT,
  banned_until          TIMESTAMPTZ,                  -- NULL = permanent ban

  -- Brute-force protection (handled in app layer too, but store state here)
  failed_login_attempts SMALLINT      NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,

  -- Audit
  last_login_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT username_length CHECK (char_length(username) BETWEEN 3 AND 30),
  CONSTRAINT email_format    CHECK (email ~* '^[^@]+@[^@]+\.[^@]+$')
);

CREATE INDEX idx_users_email    ON users (email);
CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_role     ON users (role);

-- ============================================================
-- ANIME
-- ============================================================

CREATE TABLE anime (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(255)  NOT NULL,
  description     TEXT,
  cover_image_url TEXT,
  release_year    SMALLINT      CHECK (release_year BETWEEN 1960 AND 2100),
  has_dub         BOOLEAN       NOT NULL DEFAULT FALSE,
  status          anime_status  NOT NULL DEFAULT 'completed',

  -- Denormalised averages — updated via trigger or scheduled job
  -- Avoids expensive aggregation on every page load
  avg_sub_rating  NUMERIC(3,2),
  avg_dub_rating  NUMERIC(3,2),
  total_votes     INTEGER       NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_anime_title        ON anime (title);
CREATE INDEX idx_anime_release_year ON anime (release_year);
CREATE INDEX idx_anime_status       ON anime (status);
CREATE INDEX idx_anime_avg_sub      ON anime (avg_sub_rating DESC NULLS LAST);

-- Full-text search index on title + description
CREATE INDEX idx_anime_fts ON anime
  USING GIN (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')));

-- ============================================================
-- GENRES
-- ============================================================

CREATE TABLE genres (
  id    SERIAL        PRIMARY KEY,
  name  VARCHAR(50)   NOT NULL UNIQUE
);

INSERT INTO genres (name) VALUES
  ('Action'), ('Adventure'), ('Comedy'), ('Drama'), ('Fantasy'),
  ('Horror'), ('Mecha'), ('Mystery'), ('Romance'), ('Sci-Fi'),
  ('Slice of Life'), ('Sports'), ('Supernatural'), ('Thriller');

-- ============================================================
-- ANIME ↔ GENRES  (many-to-many)
-- ============================================================

CREATE TABLE anime_genres (
  anime_id  UUID    NOT NULL REFERENCES anime   (id) ON DELETE CASCADE,
  genre_id  INTEGER NOT NULL REFERENCES genres  (id) ON DELETE CASCADE,
  PRIMARY KEY (anime_id, genre_id)
);

CREATE INDEX idx_anime_genres_genre ON anime_genres (genre_id);

-- ============================================================
-- RATINGS
-- ============================================================

CREATE TABLE ratings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  anime_id    UUID        NOT NULL REFERENCES anime (id) ON DELETE CASCADE,

  -- NULL means the user hasn't rated that version
  sub_rating  SMALLINT    CHECK (sub_rating BETWEEN 1 AND 5),
  dub_rating  SMALLINT    CHECK (dub_rating BETWEEN 1 AND 5),

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One row per user per anime — UPDATE to change ratings
  UNIQUE (user_id, anime_id),

  -- Must rate at least one version
  CONSTRAINT rating_not_empty CHECK (sub_rating IS NOT NULL OR dub_rating IS NOT NULL)
);

CREATE INDEX idx_ratings_anime ON ratings (anime_id);
CREATE INDEX idx_ratings_user  ON ratings (user_id);

-- ============================================================
-- TRIGGER: keep avg_sub_rating / avg_dub_rating / total_votes
--          in sync after every INSERT / UPDATE / DELETE on ratings
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_anime_rating_stats()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_anime_id UUID;
BEGIN
  target_anime_id := COALESCE(NEW.anime_id, OLD.anime_id);

  UPDATE anime SET
    avg_sub_rating = (
      SELECT ROUND(AVG(sub_rating)::NUMERIC, 2)
      FROM ratings
      WHERE anime_id = target_anime_id AND sub_rating IS NOT NULL
    ),
    avg_dub_rating = (
      SELECT ROUND(AVG(dub_rating)::NUMERIC, 2)
      FROM ratings
      WHERE anime_id = target_anime_id AND dub_rating IS NOT NULL
    ),
    total_votes = (
      SELECT COUNT(*) FROM ratings WHERE anime_id = target_anime_id
    ),
    updated_at = NOW()
  WHERE id = target_anime_id;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_rating_stats
AFTER INSERT OR UPDATE OR DELETE ON ratings
FOR EACH ROW EXECUTE FUNCTION refresh_anime_rating_stats();

-- ============================================================
-- COMMENTS
-- ============================================================

CREATE TABLE comments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users   (id) ON DELETE CASCADE,
  anime_id    UUID        NOT NULL REFERENCES anime   (id) ON DELETE CASCADE,
  parent_id   UUID        REFERENCES comments (id) ON DELETE SET NULL,  -- nested reply

  content     TEXT        NOT NULL,
  is_deleted  BOOLEAN     NOT NULL DEFAULT FALSE,   -- soft delete (keep thread structure)

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT content_length CHECK (char_length(content) BETWEEN 1 AND 2000)
);

CREATE INDEX idx_comments_anime      ON comments (anime_id, created_at DESC);
CREATE INDEX idx_comments_user       ON comments (user_id);
CREATE INDEX idx_comments_parent     ON comments (parent_id) WHERE parent_id IS NOT NULL;

-- ============================================================
-- COMMENT LIKES / DISLIKES
-- ============================================================

CREATE TABLE comment_likes (
  comment_id  UUID        NOT NULL REFERENCES comments (id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users    (id) ON DELETE CASCADE,
  value       SMALLINT    NOT NULL CHECK (value IN (1, -1)),  -- 1 = like, -1 = dislike
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (comment_id, user_id)  -- one vote per user per comment
);

CREATE INDEX idx_comment_likes_comment ON comment_likes (comment_id);

-- ============================================================
-- PASSWORD RESET TOKENS
-- ============================================================

CREATE TABLE password_reset_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,   -- store hash, never raw token
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,                   -- NULL = not yet used
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prt_user      ON password_reset_tokens (user_id);
CREATE INDEX idx_prt_token     ON password_reset_tokens (token_hash);

-- Auto-purge expired tokens (run via pg_cron or app-level scheduler)
-- DELETE FROM password_reset_tokens WHERE expires_at < NOW();

-- ============================================================
-- REFRESH TOKENS  (JWT refresh token rotation)
-- ============================================================

CREATE TABLE refresh_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  ip_address  INET,
  user_agent  TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,                   -- NULL = still valid
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rt_user  ON refresh_tokens (user_id);
CREATE INDEX idx_rt_token ON refresh_tokens (token_hash);

-- ============================================================
-- ADMIN LOGS
-- ============================================================

CREATE TABLE admin_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID        NOT NULL REFERENCES users (id) ON DELETE SET NULL,
  action       VARCHAR(64) NOT NULL,      -- e.g. 'BAN_USER', 'DELETE_COMMENT', 'ADD_ANIME'
  target_type  VARCHAR(32),               -- e.g. 'user', 'comment', 'anime'
  target_id    UUID,
  metadata     JSONB,                     -- extra context (old values, reason, etc.)
  ip_address   INET,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_logs_admin      ON admin_logs (admin_id);
CREATE INDEX idx_admin_logs_target     ON admin_logs (target_type, target_id);
CREATE INDEX idx_admin_logs_created    ON admin_logs (created_at DESC);
CREATE INDEX idx_admin_logs_metadata   ON admin_logs USING GIN (metadata);

-- ============================================================
-- RATE LIMIT TRACKING  (optional — can also live in Redis)
-- ============================================================

CREATE TABLE rate_limit_log (
  ip_address  INET        NOT NULL,
  endpoint    VARCHAR(64) NOT NULL,
  hit_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rll_ip_endpoint ON rate_limit_log (ip_address, endpoint, hit_at DESC);

-- ============================================================
-- UPDATED_AT AUTO-UPDATE TRIGGER  (apply to all relevant tables)
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_anime_updated_at
  BEFORE UPDATE ON anime
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_ratings_updated_at
  BEFORE UPDATE ON ratings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — optional but recommended
-- Enable when connecting via Supabase or a direct user-scoped role
-- ============================================================

-- ALTER TABLE ratings   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE comments  ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY ratings_owner  ON ratings  USING (user_id = current_setting('app.current_user_id')::UUID);
-- CREATE POLICY comments_owner ON comments USING (user_id = current_setting('app.current_user_id')::UUID);

-- ============================================================
-- USEFUL VIEWS
-- ============================================================

-- Anime catalog with aggregated genre list
CREATE VIEW anime_catalog AS
SELECT
  a.id,
  a.title,
  a.cover_image_url,
  a.release_year,
  a.status,
  a.has_dub,
  a.avg_sub_rating,
  a.avg_dub_rating,
  a.total_votes,
  ARRAY_AGG(g.name ORDER BY g.name) FILTER (WHERE g.name IS NOT NULL) AS genres
FROM anime a
LEFT JOIN anime_genres ag ON ag.anime_id = a.id
LEFT JOIN genres g        ON g.id = ag.genre_id
GROUP BY a.id;

-- Comment with like/dislike score
CREATE VIEW comments_with_score AS
SELECT
  c.*,
  u.username,
  COALESCE(SUM(cl.value), 0) AS score
FROM comments c
JOIN users u ON u.id = c.user_id
LEFT JOIN comment_likes cl ON cl.comment_id = c.id
WHERE c.is_deleted = FALSE
GROUP BY c.id, u.username;
