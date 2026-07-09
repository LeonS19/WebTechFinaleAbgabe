import { Message } from '../models/mongo/message.model.js';
import { findByChatId } from '../models/sql/studyGroup.model.js';
import { checkPermission } from './permission.service.js';
import { findOne } from '../models/sql/membership.model.js';

export async function getSenderRole(chatId, userId) {
  const studyGroup = await findByChatId(chatId);
  if (!studyGroup) return null;
  const membership = await findOne(userId, studyGroup.id);
  return membership?.role || null;
}

export async function verifyChatMembership(chatId, userId) {
  const studyGroup = await findByChatId(chatId)
  if (!studyGroup) throw new Error('Lerngruppe nicht gefunden')
  await checkPermission(userId, studyGroup.id, ['ADMIN', 'MODERATOR', 'MEMBER'])
}

export async function saveMessage(chatId, senderId, content) {
  const studyGroup = await findByChatId(chatId);
  if (!studyGroup) {
    throw new Error('Lerngruppe nicht gefunden');
  }
  await checkPermission(senderId, studyGroup.id, ['ADMIN', 'MODERATOR', 'MEMBER']);
  return await Message.create({ chat_id: chatId, sender_id: senderId, content });
}

export async function getMessages(chatId, limit = 50, before = null, userId) {
  // 1. Permission-Check
  const studyGroup = await findByChatId(chatId);
  if (!studyGroup) {
    throw new Error('Lerngruppe nicht gefunden');
  }
  await checkPermission(userId, studyGroup.id, ['ADMIN', 'MODERATOR', 'MEMBER']);

  // 2. Filter aufbauen
  const filter = { chat_id: chatId };

  if (before) {
    // Nachricht mit dieser ID holen um ihr sent_at zu bekommen
    const beforeMessage = await Message.findById(before);
    if (!beforeMessage) {
      throw new Error('Referenz-Nachricht nicht gefunden');
    }
    // Nur Nachrichten die ÄLTER sind als diese. sent_at allein reicht als
    // Sortier-/Cursor-Kriterium nicht aus: haben zwei Nachrichten exakt
    // denselben Zeitstempel (z.B. durch seed:demo im selben Millisekunden-
    // Fenster erzeugt), wäre die Reihenfolge zwischen zwei Queries nicht
    // stabil und Nachrichten könnten übersprungen oder doppelt geliefert
    // werden. _id ist dagegen garantiert eindeutig und monoton aufsteigend
    // (MongoDB ObjectId), daher als Tie-Breaker ergänzt: bei gleichem
    // sent_at entscheidet zusätzlich die _id.
    filter.$or = [
      { sent_at: { $lt: beforeMessage.sent_at } },
      { sent_at: beforeMessage.sent_at, _id: { $lt: beforeMessage._id } },
    ];
  }

  return await Message.find(filter)
    .sort({ sent_at: -1, _id: -1 })  // neueste zuerst
    .limit(limit);
}

export async function deleteMessage(messageId, userId) {
  const message = await Message.findById(messageId);
  if (!message){
    throw new Error('Nachricht nicht gefunden');
  }
  
  // study_group über chat_id finden
  const studyGroup = await findByChatId(message.chat_id);
  if (!studyGroup){
    throw new Error('Lerngruppe nicht gefunden');
  }
  
  // Permission-Check
  await checkPermission(userId, studyGroup.id, ['ADMIN', 'MODERATOR']);
  
  await Message.findByIdAndDelete(messageId);
}