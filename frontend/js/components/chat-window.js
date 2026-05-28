/**
 * <chat-window> Web Component
 *
 * Attribute:
 *   todo-id - ID des Todos, zu dem dieser Chat gehört
 *
 * Wird von <todo-card> verwendet und intern gesteuert.
 */
class ChatWindow extends HTMLElement {
  constructor() {
    super();
    this.ws = null; // WebSocket-Verbindung
    this.isOpen = false;
  }

  connectedCallback() {
    this.render();
    this.addEventListeners();
  }

  render() {
    const id = this.getAttribute('todo-id');
    this.style.display = 'block';
    this.innerHTML = `
      <div class="chat-panel" style="display:none;">
        <div class="chat-messages" id="chat-messages-${id}"></div>
        <div class="chat-input-row">
          <input type="text" class="chat-username" placeholder="Dein Name" />
          <input type="text" class="chat-message-input" placeholder="Nachricht..." />
          <button class="chat-send-btn">Senden</button>
        </div>
      </div>
    `;
  }

  addEventListeners() {
    const sendBtn = this.querySelector('.chat-send-btn');
    const messageInput = this.querySelector('.chat-message-input');

    sendBtn.addEventListener('click', () => this.sendMessage());

    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });
  }

  // Chat öffnen oder schließen
  toggle() {
    const panel = this.querySelector('.chat-panel');
    this.isOpen = !this.isOpen;
    panel.style.display = this.isOpen ? 'block' : 'none';

    if (this.isOpen) {
      this.connect();
    } else {
      this.disconnect();
    }
  }

  // WebSocket-Verbindung aufbauen
  connect() {
    if (this.ws) return; // Bereits verbunden

    // Offline: lokal gespeicherte Nachrichten anzeigen
    if (!navigator.onLine) {
        const container = this.querySelector('.chat-messages');
        loadMessages(this.getAttribute('todo-id'))
            .then(messages => messages.forEach(msg => this.appendMessage(container, msg)));
        return;
    }

    const todoId = this.getAttribute('todo-id');
    this.ws = new WebSocket('ws://localhost:3000');

    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({ type: 'join', todoId }));
    };

    this.ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        const container = this.querySelector('.chat-messages');

        if (data.type === 'history') {
            container.innerHTML = '';
            // Nachrichten lokal speichern
            await saveMessages(data.messages);
            data.messages.forEach(msg => this.appendMessage(container, msg));
        }

        if (data.type === 'message') {
            // Neue Nachricht lokal speichern
            await saveMessage(data.message);
            this.appendMessage(container, data.message);
        }

        container.scrollTop = container.scrollHeight;
    };

    this.ws.onerror = () => console.error('[ChatWindow] WebSocket-Fehler');
    this.ws.onclose = () => { this.ws = null; };
  }

  // WebSocket-Verbindung trennen
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // Nachricht absenden
  sendMessage() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const username = this.querySelector('.chat-username').value.trim();
    const messageInput = this.querySelector('.chat-message-input');
    const message = messageInput.value.trim();

    if (!username || !message) return;

    const todoId = this.getAttribute('todo-id');
    this.ws.send(JSON.stringify({ type: 'message', todoId, username, message }));
    messageInput.value = '';
  }

  // Eine Nachricht ins Panel einfügen
  appendMessage(container, msg) {
    const div = document.createElement('div');
    div.className = 'chat-message';
    const time = new Date(msg.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `
      <span class="chat-user">${msg.username}</span>
      <span class="chat-time">${time}</span>
      <p>${msg.message}</p>
    `;
    container.appendChild(div);
  }

  // Wenn die Komponente aus dem DOM entfernt wird, WebSocket trennen
  disconnectedCallback() {
    this.disconnect();
  }
}

customElements.define('chat-window', ChatWindow);
