import * as ChatService from '../../services/chat.service.js';
import * as UserModel from '../../models/sql/user.model.js';

export const chatResolvers = {
  Query: {
    getMessages: async (_, { chatId, limit, before }, context) => {
      if (!context.user) throw new Error('Nicht authentifiziert');
      const messages = await ChatService.getMessages(chatId, limit, before, context.user.id);
      return messages.map(m => ({
        id: m._id.toString(),
        chatId: m.chat_id,
        content: m.content,
        sentAt: m.sent_at?.toString(),
        senderId: m.sender_id
      }));
    },
  },
  Message: {
    sender: async (parent) => {
      const user = await UserModel.findById(parent.senderId);
      if (!user) {
        return { id: parent.senderId, name: 'Gelöschter Nutzer', email: null, createdAt: null };
      }
      return user;
    },
    senderRole: async (parent) => {
      return await ChatService.getSenderRole(parent.chatId, parent.senderId);
    },
  },
};