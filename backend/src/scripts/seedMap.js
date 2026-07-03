import { connectMongo } from '../config/db.mongo.js';
import { Map } from '../models/mongo/map.model.js';

await connectMongo();

// Spalten-Definition: Spalte → [Feld-Positionen von oben nach unten]
const columns = {
  0:  [0, 1, 2, 3],
  1:  [4, 5, 6, 7, 8],
  2:  [9, 10, 11, 12, 13],
  3:  [14, 15, 16, 17],
  4:  [18, 19],
  5:  [20, 21, 22, 23],
  6:  [24, 25, 26, 27, 28],
  7:  [29, 30, 31, 32, 33],
  8:  [34, 35, 36, 37],
  9:  [38, 39, 40],
  10: [41, 42, 43, 44, 45, 46],
  11: [47, 48, 49, 50],
  12: [51, 52, 53],
  13: [54, 55, 56, 57],
  14: [58, 59],
  15: [60],
};

// Koordinaten aufbauen: position → { x, y }
const coords = {};
for (const [x, positions] of Object.entries(columns)) {
  positions.forEach((pos, i) => {
    coords[pos] = { x: parseInt(x), y: i };
  });
}

// Spalten-basierter Damage — je weiter rechts, desto stärker
// Spalte 0: 30hp / 5dmg, Spalte 15: 480hp / 80dmg
function enemy(position, name = 'Skeleton', type = 'NORMAL') {
  const x = coords[position].x;
  return [{
    name,
    type,
    base_health: x * 30,
    base_damage: x * 5,
  }];
}

await Map.deleteMany({});

await Map.create({
  name: 'Dungeon of Knowledge',
  fields: [
    // ============================================
    // STARTFELDER (Spalte 0)
    // ============================================
    { position: 0,  ...coords[0],  type: 'START',  nextFields: [4, 5],      enemies: [] },
    { position: 1,  ...coords[1],  type: 'START',  nextFields: [6],          enemies: [] },
    { position: 2,  ...coords[2],  type: 'START',  nextFields: [7],          enemies: [] },
    { position: 3,  ...coords[3],  type: 'START',  nextFields: [8],          enemies: [] },

    // ============================================
    // SPALTE 1
    // ============================================
    { position: 4,  ...coords[4],  type: 'FIGHT',  nextFields: [9],          enemies: enemy(4) },
    { position: 5,  ...coords[5],  type: 'FIGHT',  nextFields: [10],         enemies: enemy(5) },
    { position: 6,  ...coords[6],  type: 'FIGHT',  nextFields: [11],         enemies: enemy(6) },
    { position: 7,  ...coords[7],  type: 'FIGHT',  nextFields: [12],         enemies: enemy(7) },
    { position: 8,  ...coords[8],  type: 'FIGHT',  nextFields: [13],         enemies: enemy(8) },

    // ============================================
    // SPALTE 2
    // ============================================
    { position: 9,  ...coords[9],  type: 'NORMAL', nextFields: [14],         enemies: [] },
    { position: 10, ...coords[10], type: 'FIGHT',  nextFields: [14, 15],     enemies: enemy(10) },
    { position: 11, ...coords[11], type: 'FIGHT',  nextFields: [15],         enemies: enemy(11) },
    { position: 12, ...coords[12], type: 'NORMAL', nextFields: [16],         enemies: [] },
    { position: 13, ...coords[13], type: 'FIGHT',  nextFields: [17],         enemies: enemy(13) },

    // ============================================
    // SPALTE 3
    // ============================================
    { position: 14, ...coords[14], type: 'NORMAL', nextFields: [18],         enemies: [] },
    { position: 15, ...coords[15], type: 'FIGHT',  nextFields: [18],         enemies: enemy(15) },
    { position: 16, ...coords[16], type: 'FIGHT',  nextFields: [19],         enemies: enemy(16) },
    { position: 17, ...coords[17], type: 'FIGHT',  nextFields: [19],         enemies: enemy(17) },

    // ============================================
    // SPALTE 4
    // ============================================
    { position: 18, ...coords[18], type: 'HEAL',   nextFields: [20, 21],     enemies: [] },
    { position: 19, ...coords[19], type: 'NORMAL', nextFields: [22, 23],     enemies: [] },

    // ============================================
    // SPALTE 5
    // ============================================
    { position: 20, ...coords[20], type: 'FIGHT',  nextFields: [24],         enemies: enemy(20) },
    { position: 21, ...coords[21], type: 'NORMAL', nextFields: [25, 26],     enemies: [] },
    { position: 22, ...coords[22], type: 'FIGHT',  nextFields: [27],         enemies: enemy(22) },
    { position: 23, ...coords[23], type: 'HEAL',   nextFields: [28],         enemies: [] },

    // ============================================
    // SPALTE 6
    // ============================================
    { position: 24, ...coords[24], type: 'FIGHT',  nextFields: [29],         enemies: enemy(24) },
    { position: 25, ...coords[25], type: 'FIGHT',  nextFields: [29],         enemies: enemy(25) },
    { position: 26, ...coords[26], type: 'NORMAL', nextFields: [30, 31],     enemies: [] },
    { position: 27, ...coords[27], type: 'FIGHT',  nextFields: [32],         enemies: enemy(27) },
    { position: 28, ...coords[28], type: 'NORMAL', nextFields: [33],         enemies: [] },

    // ============================================
    // SPALTE 7
    // ============================================
    { position: 29, ...coords[29], type: 'NORMAL', nextFields: [34, 35],     enemies: [] },
    { position: 30, ...coords[30], type: 'FIGHT',  nextFields: [35],         enemies: enemy(30) },
    { position: 31, ...coords[31], type: 'FIGHT',  nextFields: [36],         enemies: enemy(31) },
    { position: 32, ...coords[32], type: 'FIGHT',  nextFields: [36],         enemies: enemy(32) },
    { position: 33, ...coords[33], type: 'FIGHT',  nextFields: [37],         enemies: enemy(33) },

    // ============================================
    // SPALTE 8
    // ============================================
    { position: 34, ...coords[34], type: 'HEAL',   nextFields: [38],         enemies: [] },
    { position: 35, ...coords[35], type: 'FIGHT',  nextFields: [38, 39],     enemies: enemy(35) },
    { position: 36, ...coords[36], type: 'FIGHT',  nextFields: [40],         enemies: enemy(36) },
    { position: 37, ...coords[37], type: 'FIGHT',  nextFields: [40],         enemies: enemy(37) },

    // ============================================
    // SPALTE 9
    // ============================================
    { position: 38, ...coords[38], type: 'FIGHT',  nextFields: [41, 42],     enemies: enemy(38) },
    { position: 39, ...coords[39], type: 'HEAL',   nextFields: [43],         enemies: [] },
    { position: 40, ...coords[40], type: 'NORMAL', nextFields: [44, 45, 46], enemies: [] },

    // ============================================
    // SPALTE 10
    // ============================================
    { position: 41, ...coords[41], type: 'FIGHT',  nextFields: [47],         enemies: enemy(41) },
    { position: 42, ...coords[42], type: 'NORMAL', nextFields: [48],         enemies: [] },
    { position: 43, ...coords[43], type: 'FIGHT',  nextFields: [48],         enemies: enemy(43) },
    { position: 44, ...coords[44], type: 'FIGHT',  nextFields: [48],         enemies: enemy(44) },
    { position: 45, ...coords[45], type: 'FIGHT',  nextFields: [49],         enemies: enemy(45) },
    { position: 46, ...coords[46], type: 'HEAL',   nextFields: [50],         enemies: [] },

    // ============================================
    // SPALTE 11
    // ============================================
    { position: 47, ...coords[47], type: 'NORMAL', nextFields: [51],         enemies: [] },
    { position: 48, ...coords[48], type: 'FIGHT',  nextFields: [51, 52],     enemies: enemy(48) },
    { position: 49, ...coords[49], type: 'HEAL',   nextFields: [52],         enemies: [] },
    { position: 50, ...coords[50], type: 'FIGHT',  nextFields: [53],         enemies: enemy(50) },

    // ============================================
    // SPALTE 12
    // ============================================
    { position: 51, ...coords[51], type: 'HEAL',   nextFields: [54],         enemies: [] },
    { position: 52, ...coords[52], type: 'NORMAL', nextFields: [55, 56],     enemies: [] },
    { position: 53, ...coords[53], type: 'FIGHT',  nextFields: [57],         enemies: enemy(53) },

    // ============================================
    // SPALTE 13
    // ============================================
    { position: 54, ...coords[54], type: 'FIGHT',  nextFields: [58],         enemies: enemy(54) },
    { position: 55, ...coords[55], type: 'FIGHT',  nextFields: [58],         enemies: enemy(55) },
    { position: 56, ...coords[56], type: 'FIGHT',  nextFields: [59],         enemies: enemy(56) },
    { position: 57, ...coords[57], type: 'NORMAL', nextFields: [59],         enemies: [] },

    // ============================================
    // SPALTE 14
    // ============================================
    { position: 58, ...coords[58], type: 'NORMAL', nextFields: [60],         enemies: [] },
    { position: 59, ...coords[59], type: 'FIGHT',  nextFields: [60],         enemies: enemy(59) },

    // ============================================
    // BOSS (Spalte 15)
    // ============================================
    { position: 60, ...coords[60], type: 'BOSS',   nextFields: [],           enemies: [{
      name: 'The Knowledge Keeper',
      type: 'BOSS',
      base_health: 1000,
      base_damage: 100,
    }]},
  ]
});

console.log('Map "Dungeon of Knowledge" erfolgreich eingefügt!');
process.exit(0);