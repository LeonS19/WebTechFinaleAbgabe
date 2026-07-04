// ============================================
// Learning Platform with RPG Gameplay
// MongoDB Document Schemas
// ============================================

// ============================================
// COLLECTION: indexcards
// ============================================
// One document per flashcard.
// Belongs to a study group, created by a user.
// Contains tags, attachments, and stats.

const indexCardSchema = {
    _id: "UUID",                        // matches SQL reference if needed
    study_group_id: "UUID",             // references SQL study_group.id
    creator_id: "UUID",                 // references SQL user.id
    question: "String",
    answer: "String",
    tags: ["String"],                   // e.g. ["math", "algebra"]
    created_at: "Date",
    updated_at: "Date",

    // File attachments embedded directly in the card
    attachments: [
        {
            _id: "UUID",
            filename: "String",
            file_path: "String",        // path in file storage (e.g. S3 or local)
            mime_type: "String",        // e.g. "image/png", "application/pdf"
            size_in_bytes: "Number",
            uploaded_at: "Date",
            uploaded_by: "UUID"         // references SQL user.id
        }
    ],

    // Stats per study group → used for dynamic difficulty calculation
    // difficulty = correct_answers / total_attempts (across all group members)
    // Cold-start protection: below 10 total_attempts, a default difficulty is
    // assumed instead (see combat.service.js:calculateCardDamage), to avoid a
    // single early answer skewing the perceived difficulty.
    group_stats: [
        {
            study_group_id: "String",   // references SQL study_group.id
            total_attempts: "Number",
            correct_answers: "Number"
            // difficulty is always calculated, never stored:
            // difficulty = correct_answers / total_attempts
        }
    ],

    // Stats per user → personal learning progress
    // Also used to weight deck selection at run start (see deckBuilder.service.js):
    // cards with a low personal success rate are drawn more often.
    user_stats: [
        {
            user_id: "UUID",            // references SQL user.id
            total_attempts: "Number",
            correct_answers: "Number",
            last_seen_at: "Date"
        }
    ]
};

// Example document
const indexCardExample = {
    _id: "550e8400-e29b-41d4-a716-446655440000",
    study_group_id: "660e8400-e29b-41d4-a716-446655440001",
    creator_id: "770e8400-e29b-41d4-a716-446655440002",
    question: "Was ist die Ableitung von x²?",
    answer: "2x",
    tags: ["math", "calculus"],
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T10:00:00Z",

    attachments: [
        {
            _id: "880e8400-e29b-41d4-a716-446655440003",
            filename: "graph.png",
            file_path: "/uploads/880e8400-graph.png",
            mime_type: "image/png",
            size_in_bytes: 204800,
            uploaded_at: "2024-01-15T10:05:00Z",
            uploaded_by: "770e8400-e29b-41d4-a716-446655440002"
        }
    ],

    group_stats: [
        {
            study_group_id: "660e8400-e29b-41d4-a716-446655440001",
            total_attempts: 42,
            correct_answers: 30
            // difficulty = 30/42 = 0.71 → berechnet zur Laufzeit
        }
    ],

    user_stats: [
        {
            user_id: "770e8400-e29b-41d4-a716-446655440002",
            total_attempts: 10,
            correct_answers: 8,
            last_seen_at: "2024-01-15T09:00:00Z"
        },
        {
            user_id: "990e8400-e29b-41d4-a716-446655440004",
            total_attempts: 5,
            correct_answers: 3,
            last_seen_at: "2024-01-14T14:00:00Z"
        }
    ]
};

// Recommended indexes
// db.indexcards.createIndex({ study_group_id: 1 })         -- filter by group
// db.indexcards.createIndex({ study_group_id: 1, tags: 1 }) -- filter by group + tag
// db.indexcards.createIndex({ creator_id: 1 })             -- filter by creator


// ============================================
// COLLECTION: messages
// ============================================
// One document per chat message.
// Belongs to a chat (= study group).

const messageSchema = {
    _id: "UUID",
    chat_id: "UUID",                    // references SQL study_group.chat_id
    sender_id: "UUID",                  // references SQL user.id
    content: "String",
    sent_at: "Date"
};

// Example document
const messageExample = {
    _id: "aa0e8400-e29b-41d4-a716-446655440005",
    chat_id: "bb0e8400-e29b-41d4-a716-446655440006",
    sender_id: "770e8400-e29b-41d4-a716-446655440002",
    content: "Hat jemand die Karteikarte zur Kettenregel schon bearbeitet?",
    sent_at: "2024-01-15T11:00:00Z"
};

// Recommended indexes
// db.messages.createIndex({ chat_id: 1, sent_at: -1 })     -- fetch latest messages per chat
// db.messages.createIndex({ sender_id: 1 })                -- filter by sender


// ============================================
// COLLECTION: maps
// ============================================
// Single hardcoded map document with all fields and enemies embedded.
// Originally planned as separate SQL tables (map/field/enemy) — moved to
// MongoDB because fields have deeply nested, variable structure (embedded
// enemies, coordinates, branching nextFields), and to allow future random
// map generation without bloating relational tables.

const mapSchema = {
    _id: "ObjectId",
    name: "String",
    fields: [
        {
            position: "Number",          // unique position number (0-60)
            x: "Number",                 // column (frontend rendering)
            y: "Number",                 // row (frontend rendering)
            type: "String",              // START | NORMAL | FIGHT | BOSS | HEAL
            nextFields: ["Number"],      // reachable next positions (arrows, one-directional)
            enemies: [                   // empty for non-combat fields; currently only 1 entry used
                {
                    name: "String",
                    type: "String",       // NORMAL | BOSS
                    base_health: "Number", // x * 30
                    base_damage: "Number"  // x * 5
                }
            ]
        }
    ]
};

// Example document (excerpt)
const mapExample = {
    _id: "aa1e8400-e29b-41d4-a716-446655440010",
    name: "Dungeon of Knowledge",
    fields: [
        { position: 0, x: 0, y: 0, type: "START", nextFields: [4, 5], enemies: [] },
        {
            position: 4,
            x: 1,
            y: 0,
            type: "FIGHT",
            nextFields: [9],
            enemies: [{ name: "Schleim", type: "NORMAL", base_health: 30, base_damage: 5 }]
        },
        {
            position: 60,
            x: 15,
            y: 0,
            type: "BOSS",
            nextFields: [],
            enemies: [{ name: "Endboss", type: "BOSS", base_health: 480, base_damage: 80 }]
        }
    ]
};

// Recommended indexes
// none needed — single document, always fetched via findOne()


// ============================================
// COLLECTION: combats
// ============================================
// One document per active combat encounter.
// Created when a player moves onto a FIGHT/BOSS field (moveToField ->
// combat.service.js:startCombat). Only tracks the current hand and enemy
// state — the deck/discard pile live separately in run_decks, since those
// persist across multiple combats within the same run, while a combat
// document is created fresh per fight.
// No timestamps field: combats are short-lived, run-bound state objects
// with no need for an independent time history.

const combatSchema = {
    _id: "ObjectId",
    run_id: "UUID",                     // references SQL run.id
    field_position: "Number",           // which map field triggered this combat

    enemy: {
        name: "String",
        type: "String",                 // NORMAL | BOSS
        max_health: "Number",
        current_health: "Number",       // decreases as player answers correctly
        base_damage: "Number"
    },

    hand: ["ObjectId"],                 // references indexcards._id, max 5 cards
    turn_start_hand_size: "Number",     // hand size at the beginning of the current turn —
                                         // used to detect a "perfect round" (exactly 5/5 correct)
    is_player_turn: "Boolean",
    status: "String"                    // ACTIVE | WON | LOST
};

// Example document
const combatExample = {
    _id: "bb1e8400-e29b-41d4-a716-446655440011",
    run_id: "cc1e8400-e29b-41d4-a716-446655440012",
    field_position: 4,
    enemy: {
        name: "Schleim",
        type: "NORMAL",
        max_health: 30,
        current_health: 12,
        base_damage: 5
    },
    hand: [
        "550e8400-e29b-41d4-a716-446655440000",
        "551e8400-e29b-41d4-a716-446655440001"
    ],
    turn_start_hand_size: 5,
    is_player_turn: true,
    status: "ACTIVE"
};

// Recommended indexes
// db.combats.createIndex({ run_id: 1, status: 1 })   -- find the active combat for a run


// ============================================
// COLLECTION: run_decks
// ============================================
// One document per run. Holds the (up to) 20 cards drawn for that run,
// weighted towards cards the user personally answers poorly (cold-start
// protected — see deckBuilder.service.js). Persists across multiple
// combats within the same run; only the current hand (in combats) and
// this deck/discard pile change as the run progresses.

const runDeckSchema = {
    _id: "ObjectId",
    run_id: "UUID",                     // references SQL run.id
    deck: ["ObjectId"],                 // references indexcards._id, drawn from the front
    discard_pile: ["ObjectId"]          // references indexcards._id; reshuffled into deck
                                         // once both deck AND the current hand are empty
};

// Example document
const runDeckExample = {
    _id: "dd1e8400-e29b-41d4-a716-446655440013",
    run_id: "cc1e8400-e29b-41d4-a716-446655440012",
    deck: [
        "552e8400-e29b-41d4-a716-446655440002",
        "553e8400-e29b-41d4-a716-446655440003"
    ],
    discard_pile: [
        "554e8400-e29b-41d4-a716-446655440004"
    ]
};

// Recommended indexes
// db.run_decks.createIndex({ run_id: 1 })   -- lookup the deck for a given run