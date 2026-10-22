-- Trigram matching makes substring search over every title and alternative title fast.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "AnimeStatus" AS ENUM ('airing', 'completed', 'upcoming');

-- CreateEnum
CREATE TYPE "AnimeFormat" AS ENUM ('TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(30) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "ban_reason" TEXT,
    "banned_until" TIMESTAMPTZ,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anime" (
    "id" VARCHAR(64) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "sort_title" TEXT NOT NULL,
    "search_text" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "cover_image_url" TEXT,
    "release_year" INTEGER,
    "has_dub" BOOLEAN NOT NULL DEFAULT false,
    "status" "AnimeStatus" NOT NULL DEFAULT 'completed',
    "format" "AnimeFormat",
    "episodes" INTEGER,
    "alternative_titles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "external_ids" JSONB NOT NULL DEFAULT '{}',
    "popularity" INTEGER,
    "sub_sum" INTEGER NOT NULL DEFAULT 0,
    "sub_count" INTEGER NOT NULL DEFAULT 0,
    "dub_sum" INTEGER NOT NULL DEFAULT 0,
    "dub_count" INTEGER NOT NULL DEFAULT 0,
    "total_votes" INTEGER NOT NULL DEFAULT 0,
    "avg_sub_rating" DOUBLE PRECISION,
    "avg_dub_rating" DOUBLE PRECISION,
    "best_rating" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "anime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genres" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anime_genres" (
    "anime_id" VARCHAR(64) NOT NULL,
    "genre_id" INTEGER NOT NULL,

    CONSTRAINT "anime_genres_pkey" PRIMARY KEY ("anime_id","genre_id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "anime_id" VARCHAR(64) NOT NULL,
    "sub_rating" SMALLINT,
    "dub_rating" SMALLINT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "anime_id" VARCHAR(64) NOT NULL,
    "parent_id" TEXT,
    "content" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_likes" (
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "value" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("comment_id","user_id")
);

-- CreateTable
CREATE TABLE "dub_reports" (
    "id" TEXT NOT NULL,
    "anime_id" VARCHAR(64) NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dub_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "replaced_by_token_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_logs" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "target_type" VARCHAR(32),
    "target_id" VARCHAR(64),
    "metadata" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "anime_sort_title_idx" ON "anime"("sort_title");

-- CreateIndex
CREATE INDEX "anime_popularity_idx" ON "anime"("popularity" DESC);

-- CreateIndex
CREATE INDEX "anime_release_year_idx" ON "anime"("release_year");

-- CreateIndex
CREATE INDEX "anime_best_rating_idx" ON "anime"("best_rating" DESC);

-- CreateIndex
CREATE INDEX "anime_total_votes_idx" ON "anime"("total_votes" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "genres_name_key" ON "genres"("name");

-- CreateIndex
CREATE INDEX "anime_genres_genre_id_idx" ON "anime_genres"("genre_id");

-- CreateIndex
CREATE INDEX "ratings_anime_id_idx" ON "ratings"("anime_id");

-- CreateIndex
CREATE INDEX "ratings_user_id_updated_at_idx" ON "ratings"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ratings_user_id_anime_id_key" ON "ratings"("user_id", "anime_id");

-- CreateIndex
CREATE INDEX "comments_anime_id_parent_id_created_at_idx" ON "comments"("anime_id", "parent_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_parent_id_idx" ON "comments"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "dub_reports_anime_id_user_id_key" ON "dub_reports"("anime_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "admin_logs_created_at_idx" ON "admin_logs"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "anime_genres" ADD CONSTRAINT "anime_genres_anime_id_fkey" FOREIGN KEY ("anime_id") REFERENCES "anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anime_genres" ADD CONSTRAINT "anime_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_anime_id_fkey" FOREIGN KEY ("anime_id") REFERENCES "anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_anime_id_fkey" FOREIGN KEY ("anime_id") REFERENCES "anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dub_reports" ADD CONSTRAINT "dub_reports_anime_id_fkey" FOREIGN KEY ("anime_id") REFERENCES "anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dub_reports" ADD CONSTRAINT "dub_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Search: titles are matched with LIKE '%needle%' against the folded search_text.
CREATE INDEX "anime_search_text_trgm_idx" ON "anime" USING GIN ("search_text" gin_trgm_ops);
