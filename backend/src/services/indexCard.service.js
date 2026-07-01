import { IndexCard } from '../models/mongo/indexCard.model.js';
import { checkPermission } from './permission.service.js';

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

export async function getIndexCard(cardId) {
  return await IndexCard.findById(cardId); // cardId nicht id!
}

export async function updateIndexCard(cardId, data, userId) {
  const card = await IndexCard.findById(cardId);
  if (!card){ 
    throw new Error('Karteikarte nicht gefunden');
  }

  await checkPermission(userId, card.study_group_id, ['ADMIN', 'MODERATOR']);
  return await IndexCard.findByIdAndUpdate(cardId, data, { new: true });
}

export async function deleteIndexCard(cardId, userId) {
  const card = await IndexCard.findById(cardId);
  if (!card){
    throw new Error('Karteikarte nicht gefunden');
  }
  await checkPermission(userId, card.study_group_id, ['ADMIN', 'MODERATOR']);
  return await IndexCard.findByIdAndDelete(cardId);
}

export async function createIndexCard(data, userId) {
  await checkPermission(userId, data.study_group_id, ['ADMIN', 'MODERATOR']);
  // creator_id immer aus dem JWT setzen, nicht vom Frontend übernehmen
  return await IndexCard.create({ ...data, creator_id: userId });
}