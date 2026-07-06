import { Map } from '../models/mongo/map.model.js';

export async function getMap() {
  return await Map.findOne();
}