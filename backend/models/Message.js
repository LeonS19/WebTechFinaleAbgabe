const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  todoId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Todo', required: true },
  author:  { type: String, default: 'Anonymous' },
  text:    { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);