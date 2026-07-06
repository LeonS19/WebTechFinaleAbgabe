import mongoose from 'mongoose';

const enemySchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['NORMAL', 'BOSS'], required: true },
  max_health: { type: Number, required: true },
  current_health: { type: Number, required: true },
  base_damage: { type: Number, required: true },
}, { _id: false });

const combatSchema = new mongoose.Schema({
  run_id: { type: String, required: true },
  field_position: { type: Number, required: true },
  enemy: { type: enemySchema, required: true },
  hand: [{ type: mongoose.Schema.Types.ObjectId, ref: 'IndexCard' }],
  turn_start_hand_size: { type: Number, required: true },
  is_player_turn: { type: Boolean, default: true },
  status: { type: String, enum: ['ACTIVE', 'WON', 'LOST'], default: 'ACTIVE' },
});

export const Combat = mongoose.model('Combat', combatSchema, 'combats');