import { IndexCard } from '../models/mongo/indexCard.model.js';

export async function getIndexCards(studyGroupId, tags, search, creatorId) {
  const filter = { study_group_id: studyGroupId };
  
  if (tags && tags.length > 0) {
    filter.tags = { $in: tags };
  }

  if(creatorId) {
    filter.creator_id = creatorId;
  }
  
  if (search) {
    filter.$or = [
        { question: { $regex: search, $options: 'i' } },
        { answer: { $regex: search, $options: 'i' } }
    ];
  }
  
  return await IndexCard.find(filter);
}

// Eine einzelne Karte holen
export async function getIndexCard(id) {
  // ???
}

// Neue Karte anlegen
export async function createIndexCard(data) {
  // ???
}

// Karte bearbeiten
export async function updateIndexCard(id, data) {
  // ???
}

// Karte löschen
export async function deleteIndexCard(id) {
  // ???
}