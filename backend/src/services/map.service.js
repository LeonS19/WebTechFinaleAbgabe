import { Map } from '../models/mongo/map.model.js';
import { seedMap } from '../scripts/seedMap.js';


export async function getMap() {
  return await Map.findOne();
}

export async function ensureMapExists() {
  const existing = await Map.findOne();
  if (!existing) {
    console.log('Keine Map gefunden – seede automatisch...');
    await seedMap();
  }
}