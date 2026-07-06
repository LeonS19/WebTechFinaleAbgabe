import mongoose from 'mongoose';

const indexCardSchema = new mongoose.Schema({
  study_group_id: {type: String, required: true},
  creator_id: {type: String, required: true},
  question: {type: String, required: true},
  answer: {type: String, required: true},
  tags: [String],
  attachments: [{
    filename: {type: String, required: true},
    file_path: {type: String, required: true},
    mime_type: {type: String, required: true},
    size_in_bytes: {type: Number, required: true},
    uploaded_at: {type: Date, default: Date.now},
    uploaded_by: {type: String, required: true},
  }],
  group_stats: {
    type: [{
      study_group_id: {type: String, required: true},
      total_attempts: {type: Number, required: true},
      correct_answers: {type: Number, required: true},
    }],
    default: [],
  },

  user_stats: {
    type: [{
      user_id: {type: String, required: true},
      total_attempts: {type: Number, required: true},
      correct_answers: {type: Number, required: true},
      last_seen_at: {type: Date},
    }],
    default: [],
  },
  },{
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }   // timestamps: Mongoose setzt created_at und updated_at automatisch

});

export const IndexCard = mongoose.model('IndexCard', indexCardSchema);