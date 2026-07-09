import { IndexCard } from '../models/mongo/indexCard.model.js';
import { checkPermission } from './permission.service.js';

export async function getIndexCards(studyGroupId, tags, search, creatorId, userId) {
  await checkPermission(userId, studyGroupId, ['ADMIN', 'MODERATOR', 'MEMBER']);
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

export async function getIndexCard(cardId, userId) {
  const card = await IndexCard.findById(cardId);
  if (!card) {
    throw new Error('Karteikarte nicht gefunden');
  }
  await checkPermission(userId, card.study_group_id, ['ADMIN', 'MODERATOR', 'MEMBER']);
  return card;
}

export async function getIndexCardsByIds(cardIds) {
  const cards = await IndexCard.find({ _id: { $in: cardIds } });
  const cardMap = new Map(cards.map(c => [c._id.toString(), c]));
  return cardIds.map(id => cardMap.get(id.toString()));
}

export async function updateIndexCard(cardId, data, userId) {
  const card = await IndexCard.findById(cardId);
  if (!card){ 
    //throw new Error('Karteikarte nicht gefunden');
    throw new Error('Karteikarte inzwischen gelöscht');
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
  await IndexCard.findByIdAndDelete(cardId);
  return { id: cardId, studyGroupId: card.study_group_id };
}

export async function createIndexCard(data, userId) {
  await checkPermission(userId, data.study_group_id, ['ADMIN', 'MODERATOR']);
  // creator_id immer aus dem JWT setzen, nicht vom Frontend übernehmen
  return await IndexCard.create({ ...data, creator_id: userId });
}

export async function recordAnswer(cardId, userId, studyGroupId, wasCorrect) {
  const card = await IndexCard.findById(cardId);
  if (!card) {
    throw new Error('Karteikarte nicht gefunden');
  }

  // --- group_stats aktualisieren ---
  let groupStat = card.group_stats.find(s => s.study_group_id.toString() === studyGroupId.toString());
  if (!groupStat) {
    groupStat = { study_group_id: studyGroupId, total_attempts: 0, correct_answers: 0 };
    card.group_stats.push(groupStat);
    groupStat = card.group_stats[card.group_stats.length - 1];
  }
  groupStat.total_attempts += 1;
  if (wasCorrect) {
    groupStat.correct_answers += 1;
  }

  // --- user_stats aktualisieren ---
  let userStat = card.user_stats.find(s => s.user_id.toString() === userId.toString());
  if (!userStat) {
    userStat = { user_id: userId, total_attempts: 0, correct_answers: 0, last_seen_at: null };
    card.user_stats.push(userStat);
    userStat = card.user_stats[card.user_stats.length - 1];
  }
  userStat.total_attempts += 1;
  if (wasCorrect) {
    userStat.correct_answers += 1;
  }
  userStat.last_seen_at = new Date();

  await card.save();
  return card;
}