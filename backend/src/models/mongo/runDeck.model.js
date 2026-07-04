import mongoose from 'mongoose';

const runDeckSchema = new mongoose.Schema({
  run_id: { type: String, required: true },
  deck: [{ type: mongoose.Schema.Types.ObjectId, ref: 'IndexCard' }],
  discard_pile: [{ type: mongoose.Schema.Types.ObjectId, ref: 'IndexCard' }],
});

export const RunDeck = mongoose.model('RunDeck', runDeckSchema, 'run_decks');