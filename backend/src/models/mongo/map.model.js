import mongoose from 'mongoose';

const mapSchema = new mongoose.Schema({
    name: {type: String, required: true},
    fields: [{
        position:   { type: Number, required: true },
        x:          { type: Number, required: true },
        y:          { type: Number, required: true },
        type:       { type: String, enum: ['START', 'NORMAL', 'FIGHT', 'BOSS', 'HEAL'], required: true },
        nextFields: [Number],
        enemies: [{
            name:        { type: String, required: true },
            type:        { type: String, enum: ['NORMAL', 'BOSS'], required: true },
            base_health: { type: Number, required: true },
            base_damage: { type: Number, required: true },
        }]
    }]
});

export const Map = mongoose.model('map', mapSchema);