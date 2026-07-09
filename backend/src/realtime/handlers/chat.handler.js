import { saveMessage, deleteMessage, getSenderRole, verifyChatMembership } from '../../services/chat.service.js';
import { verifyToken } from '../../services/auth/token.service.js';
import { findById } from '../../models/sql/user.model.js';

// Map: chatId → Set von WebSocket-Clients
const chatRooms = new Map();

export function handleChatConnection(ws) {
  let currentUser = null;
  let currentChatId = null;
  let currentUserName = null

  ws.on('message', async (raw) => {
    try {
        const data = JSON.parse(raw);
    
        if (data.type === 'join') {
        currentUser = verifyToken(data.token)
        currentChatId = data.chatId
        const user = await findById(currentUser.userId)
        if (!user) throw new Error("User nicht gefunden") // Unwahrscheinlicher Fall, zu dem Zeitpunkt, aber sicher ist sicher :)

        await verifyChatMembership(currentChatId, currentUser.userId)

        currentUserName = user.name
            
            //Chat-Room anlegen falls noch nicht da
            if(!chatRooms.has(currentChatId)){
                chatRooms.set(currentChatId, new Set());
            }
            chatRooms.get(currentChatId).add(ws);
        }

        if(data.type === 'message'){
            if (!currentUser) {
                throw new Error('Nicht eingeloggt');
            }
            if (!currentChatId) {
                throw new Error('keinem Chat beigetreten');
            }
            const message = await saveMessage(currentChatId, currentUser.userId, data.content)
            const senderRole = await getSenderRole(currentChatId, currentUser.userId)


            const payload = JSON.stringify({ 
                type: 'message', 
                message: { ...message.toObject(),
                    id: message._id.toString(),
                    senderName: currentUserName, senderRole }
            });
            for(const client of chatRooms.get(currentChatId)){
                client.send(payload)
            }
        }
        if (data.type === 'delete') {
            if (!currentUser) {
                throw new Error('Nicht eingeloggt');
            }
            await deleteMessage(data.messageId, currentUser.userId);

            const payload = JSON.stringify({
                type: 'delete',
                messageId: data.messageId,
            });
            for (const client of chatRooms.get(currentChatId)) {
                client.send(payload)
            }
        }
    } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }

  });

  ws.on('close', () => {
    if (currentChatId && chatRooms.has(currentChatId)) {
        chatRooms.get(currentChatId).delete(ws);
    }
  });
}