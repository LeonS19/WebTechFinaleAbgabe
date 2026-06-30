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
-- MAP & FIELDS
-- ============================================

CREATE TABLE map (
    id      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name    VARCHAR(255) NOT NULL
);

CREATE TYPE field_type AS ENUM ('START', 'NORMAL', 'FIGHT', 'BOSS', 'HEAL');

CREATE TABLE field (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    map_id      UUID NOT NULL REFERENCES map(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,                   -- position on the map
    type        field_type NOT NULL,
    enemy_id    UUID,                               -- FK to enemy, only for FIGHT/BOSS
    UNIQUE (map_id, position)
);

-- ============================================
-- ENEMY
-- ============================================

CREATE TYPE enemy_type AS ENUM ('NORMAL', 'BOSS');

CREATE TABLE enemy (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    type            enemy_type NOT NULL DEFAULT 'NORMAL',
    base_health     INTEGER NOT NULL,
    base_damage     INTEGER NOT NULL
);

-- Add FK after enemy table exists
ALTER TABLE field
    ADD CONSTRAINT fk_field_enemy
    FOREIGN KEY (enemy_id) REFERENCES enemy(id) ON DELETE SET NULL;

-- ============================================
-- RUN
-- ============================================

CREATE TABLE run (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    study_group_id      UUID NOT NULL REFERENCES study_group(id) ON DELETE CASCADE,
    map_id              UUID NOT NULL REFERENCES map(id),
    successful          BOOLEAN,                    -- NULL while run is active
    start_time          TIMESTAMP DEFAULT NOW(),
    duration            INTEGER,                    -- in seconds, NULL while active
    hit_rate            FLOAT,                      -- % of correctly answered cards
    current_position    INTEGER NOT NULL DEFAULT 0
);
