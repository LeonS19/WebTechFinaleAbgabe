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
    group_stats: [
        {
            study_group_id: "UUID",     // references SQL study_group.id
            total_attempts: "Number",
            correct_answers: "Number",
            // difficulty is always calculated, never stored:
            // difficulty = correct_answers / total_attempts
        }
    ],

    // Stats per user → personal learning progress
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
