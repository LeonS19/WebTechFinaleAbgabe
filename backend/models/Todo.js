const mongoose = require("mongoose");

// implementieren der Datenstruktur aus scheme.graphql
const SubtaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  done:  { type: Boolean, default: false }
});

const CommentSchema = new mongoose.Schema({
  text:      { type: String, required: true },
  author:    { type: String, default: 'Anonymous' },
  createdAt: { type: Date, default: Date.now }
});

const ChecklistItemSchema = new mongoose.Schema({
  label:   { type: String, required: true },
  checked: { type: Boolean, default: false }
});

const HistoryEntrySchema = new mongoose.Schema({
  changedAt: { type: Date, default: Date.now },
  field:     { type: String, required: true },
  oldValue:  String,
  newValue:  String
});

const TodoSchema = new mongoose.Schema({
  title:          { type: String, required: true },
  status:         { type: String, enum: ['OPEN','IN_PROGRESS','DONE'], default: 'OPEN' },
  priority:       { type: String, enum: ['LOW','MEDIUM','HIGH'] },
  dueDate:        { type: Date },
  tags:           [String],
  subtasks:       [SubtaskSchema],
  comments:       [CommentSchema],
  checklistItems: [ChecklistItemSchema],
  history:        [HistoryEntrySchema]
}, { timestamps: true });

module.exports = mongoose.model('Todo', TodoSchema);