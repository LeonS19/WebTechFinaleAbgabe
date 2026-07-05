-- ============================================
-- Learning Platform with RPG Gameplay
-- PostgreSQL Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- USER & AUTHENTICATION
-- ============================================

CREATE TABLE "user" (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255) UNIQUE,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Passkey authentication (one user can have multiple devices)
CREATE TABLE passkey (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    credential_id   TEXT NOT NULL UNIQUE,
    public_key      TEXT NOT NULL,
    counter         INTEGER NOT NULL DEFAULT 0,
    device_name     VARCHAR(255),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- WebAuthn Challenge Storage (temporär, für Registration + Login Flow)
CREATE TABLE webauthn_challenge (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID REFERENCES "user"(id) ON DELETE CASCADE,  -- nullable! beim Login weiß man User noch nicht zwingend
    challenge   TEXT NOT NULL,
    type        VARCHAR(20) NOT NULL,   -- 'REGISTRATION' oder 'AUTHENTICATION'
    expires_at  TIMESTAMP NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- OAuth accounts (one user can have multiple providers)
CREATE TABLE oauth_account (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    provider            VARCHAR(50) NOT NULL,       -- e.g. 'google'
    provider_user_id    TEXT NOT NULL,
    access_token        TEXT,
    refresh_token       TEXT,
    created_at          TIMESTAMP DEFAULT NOW(),
    UNIQUE (provider, provider_user_id)             -- no duplicate account per provider
);

-- ============================================
-- STUDY GROUP & MEMBERSHIP
-- ============================================

CREATE TABLE study_group (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    chat_id     UUID,                               -- references MongoDB Chat document
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TYPE role AS ENUM ('ADMIN', 'MODERATOR', 'MEMBER');

CREATE TABLE membership (
    user_id         UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    study_group_id  UUID NOT NULL REFERENCES study_group(id) ON DELETE CASCADE,
    role            role NOT NULL DEFAULT 'MEMBER',
    joined_at       TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, study_group_id)           -- no duplicate membership
);

-- ============================================
-- RUN
-- ============================================

CREATE TABLE run (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    study_group_id      UUID NOT NULL REFERENCES study_group(id) ON DELETE CASCADE,
    map_id              TEXT NOT NULL,              -- references MongoDB Map document
    successful          BOOLEAN,                    -- NULL while run is active
    start_time          TIMESTAMPTZ DEFAULT NOW(),
    duration            INTEGER,                    -- in seconds, NULL while active
    correct_answers     INTEGER DEFAULT 0,                      -- absolute count, used for ranking
    total_answers       INTEGER DEFAULT 0,                      -- absolute count, hit_rate = correct/total
    current_position    INTEGER NOT NULL DEFAULT 0,
    level               INTEGER NOT NULL DEFAULT 1,
    max_health           INTEGER NOT NULL DEFAULT 100,
    current_health       INTEGER NOT NULL DEFAULT 100
);
