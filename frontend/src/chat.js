// frontend/js/chat.js
import { saveMessages, loadMessages } from './db.js';

export class ChatClient {
  constructor(todoId, onMessage) {
    this.todoId = todoId;
    this.onMessage = onMessage;
    this.ws = null;
  }

  connect() {
    const wsUrl = `ws://localhost:4000/chat?todoId=${this.todoId}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'HISTORY') {
        // Verlauf in IndexedDB speichern
        await saveMessages(data.messages);
        data.messages.forEach(msg => this.onMessage(msg));
      }

      if (data.type === 'NEW_MESSAGE') {
        await saveMessages([data.message]);
        this.onMessage(data.message);
      }
    };

    this.ws.onerror = async () => {
      // Offline → aus IndexedDB laden
      console.warn('WebSocket nicht erreichbar, lade lokale Nachrichten');
      const cached = await loadMessages(this.todoId);
      cached.forEach(msg => this.onMessage(msg));
    };
  }

  send(author, text) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ author, text }));
    }
  }

  disconnect() {
    this.ws?.close();
  }
}