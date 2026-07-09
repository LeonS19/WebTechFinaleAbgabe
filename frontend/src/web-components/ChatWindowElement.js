import { cacheMessages, getCachedMessages } from '../services/offlineStorage.service.js'

class ChatWindowElement extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this._ws = null
    this._messages = []
    this._connected = false
    this._rendered = false
    this._loadingMore = false
    this._connectionId = 0
  }

  static get observedAttributes() {
    return ['chat-id', 'token', 'username', 'role']
  }

  get role() { return this.getAttribute('role') || '' }
  set role(value) { this.setAttribute('role', value) }

  get canDelete() {
    return this.role === 'ADMIN' || this.role === 'MODERATOR'
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return

    // Nur bei chat-id/token neu verbinden — bei einem Gruppenwechsel ändern sich
    // oft mehrere Attribute (z.B. auch "role", falls die Rolle in der neuen Gruppe
    // anders ist) fast gleichzeitig. Würden wir bei JEDEM Attribut connect()
    // aufrufen, liefen zwei parallele loadMessages()-Aufrufe gegeneinander und
    // die Nachrichten verdoppelten sich im UI (siehe Bugfix: doppelte Nachrichten
    // beim schnellen Gruppenwechsel).
    if (name !== 'chat-id' && name !== 'token') return

    if (this.getAttribute('chat-id') && this.getAttribute('token') && this._rendered) {
      this.connect()
    }
  }

  connectedCallback() {
    this.render()
    this._rendered = true
    if (this.chatId && this.token) {
      this.connect()
    }

    this._onlineHandler = () => this.handleOnline()
    this._offlineHandler = () => this.handleOffline()
    window.addEventListener('online', this._onlineHandler)
    window.addEventListener('offline', this._offlineHandler)
  }

  disconnectedCallback() {
    this.disconnect()
    // Listener für Online, Offline Check aufräumen
    window.removeEventListener('online', this._onlineHandler)
    window.removeEventListener('offline', this._offlineHandler)
  }

  handleOnline() {
    // Wieder online: Verbindung + Nachrichten frisch laden
    if (this.chatId && this.token) {
      this.connect()
    }
  }

  handleOffline() {
    // Offline geworden: WebSocket ist eh tot, nur Status anzeigen
    this._connected = false
    this.updateStatus('Offline')
  }

  get chatId() { return this.getAttribute('chat-id') || '' }
  set chatId(value) { this.setAttribute('chat-id', value) }

  get token() { return this.getAttribute('token') || '' }
  set token(value) { this.setAttribute('token', value) }

  get username() { return this.getAttribute('username') || '' }
  set username(value) { this.setAttribute('username', value) }

  resetMessages() {
    this._messages = []
    const list = this.shadowRoot.querySelector('.messages')
    if (list) list.innerHTML = ''
  }

  connect() {
    if (this._ws) {
      this._ws.close()
    }

    // Verbindungs-Generation: verhindert, dass ein veralteter, noch laufender
    // loadMessages()-Aufruf seine Ergebnisse anhängt, nachdem längst ein
    // neuerer connect() lief (siehe Bugfix doppelte Nachrichten).
    this._connectionId = (this._connectionId || 0) + 1
    const myConnectionId = this._connectionId

    this.resetMessages()
    this.loadMessages(myConnectionId)

    this._ws = new WebSocket('ws://localhost:3000/chat')

    this._ws.onopen = () => {
      this._connected = true
      this._ws.send(JSON.stringify({
        type: 'join',
        token: this.token,
        chatId: this.chatId,
      }))
      this.updateStatus('Verbunden')
    }

    this._ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'message') {
        const msg = data.message
        const normalized = {
          ...msg,
          sentAt: msg.sent_at || msg.sentAt,
          senderName: msg.senderName,
          senderRole: msg.senderRole,
        }
        this._messages.push(normalized)
        this.appendMessage(normalized)
      } else if (data.type === 'delete') {
        this._messages = this._messages.filter((m) => m.id !== data.messageId)
        const el = this.shadowRoot.querySelector(`[data-message-id="${data.messageId}"]`)
        if (el) el.remove()
      } else if (data.type === 'error') {
        this.updateStatus(`Fehler: ${data.message}`)
      }
    }

    this._ws.onclose = () => {
      this._connected = false
      this.updateStatus('Getrennt')
    }

    this._ws.onerror = () => {
      this.updateStatus('Verbindungsfehler')
    }
  }

  disconnect() {
    if (this._ws) {
      this._ws.close()
      this._ws = null
    }
  }

  send(content) {
    if (!this._ws || !this._connected) return
    this._ws.send(JSON.stringify({ type: 'message', content }))
  }

  buildMessageHTML(message) {
    const time = message.sentAt
      ? new Date(message.sentAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      : ''
    const sender = message.senderName || message.sender?.name || 'Unbekannt'
    const roleClass = message.senderRole ? `role-${message.senderRole.toLowerCase()}` : ''
    const div = document.createElement('div')
    div.className = 'message'
    div.dataset.messageId = message.id
    div.innerHTML = `
      <div class="message-header">
        <span class="message-sender ${roleClass}">${sender}</span>
        <span class="message-time">${time}</span>
        ${this.canDelete ? '<button class="delete-btn" title="Nachricht löschen">×</button>' : ''}
      </div>
      <p class="message-content">${message.content}</p>
    `
    if (this.canDelete) {
      div.querySelector('.delete-btn').addEventListener('click', () => {
        this.deleteMessage(message.id)
      })
    }
    return div
  }

  deleteMessage(messageId) {
    if (!this._ws || !this._connected) return
    this._ws.send(JSON.stringify({ type: 'delete', messageId }))
  }

  appendMessage(message) {
    const list = this.shadowRoot.querySelector('.messages')
    if (!list) return
    list.appendChild(this.buildMessageHTML(message))
    list.scrollTop = list.scrollHeight
  }

  prependMessage(message) {
    const list = this.shadowRoot.querySelector('.messages')
    if (!list) return
    list.prepend(this.buildMessageHTML(message))
  }

  async loadMessages(connectionId) {
    const token = this.token
    const chatId = this.chatId
    if (!token || !chatId) return

    try {
      const res = await fetch('http://localhost:3000/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: `
            query GetMessages($chatId: ID!) {
              getMessages(chatId: $chatId) {
                id
                chatId
                content
                sentAt
                senderRole
                sender { id name }
              }
            }
          `,
          variables: { chatId },
        }),
      })

      const data = await res.json()
      const messages = data?.data?.getMessages ?? []

      // erfolgreich geladene Nachrichten cachen
      const normalizedForCache = messages.map((m) => ({ ...m, senderName: m.sender?.name, senderRole: m.senderRole }))
      cacheMessages(normalizedForCache)

      // Veraltete Antwort (ein neuerer connect() lief inzwischen) verwerfen
      if (connectionId !== this._connectionId) return

      // Service gibt neueste zuerst zurück — umkehren für Anzeige
      const ordered = [...messages].reverse()
      ordered.forEach((m) => {
        const normalized = { ...m, senderName: m.sender?.name, senderRole: m.senderRole }
        this._messages.push(normalized)
        this.appendMessage(normalized)
      })
    } catch (err) {
      console.error('Fehler beim Laden der Nachrichten:', err)
      try {
        const cached = await getCachedMessages(chatId)
        if (connectionId !== this._connectionId) return
        const ordered = [...cached].sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt))
        ordered.forEach((m) => {
          this._messages.push(m)
          this.appendMessage(m)
        })
        this.updateStatus('Offline')
      } catch (cacheErr) {
        console.error('Kein Cache verfügbar:', cacheErr)
      }
    }
  }

  async loadMoreMessages() {
    if (this._loadingMore || this._messages.length === 0) return
    this._loadingMore = true

    const oldestId = this._messages[0]?.id
    if (!oldestId) {
      this._loadingMore = false
      return
    }

    try {
      const res = await fetch('http://localhost:3000/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          query: `
            query GetMessages($chatId: ID!, $before: ID) {
              getMessages(chatId: $chatId, before: $before) {
                id
                chatId
                content
                sentAt
                senderRole
                sender { id name }
              }
            }
          `,
          variables: { chatId: this.chatId, before: oldestId },
        }),
      })

      const data = await res.json()
      const messages = data?.data?.getMessages ?? []

      if (messages.length === 0) {
        this._loadingMore = false
        return
      }

      const ordered = [...messages].reverse()
      const list = this.shadowRoot.querySelector('.messages')
      const oldScrollHeight = list.scrollHeight

      ordered.forEach((m) => {
        const normalized = { ...m, senderName: m.sender?.name, senderRole: m.senderRole }
        this._messages.unshift(normalized)
        this.prependMessage(normalized)
      })

      // Scroll-Position halten
      list.scrollTop = list.scrollHeight - oldScrollHeight

    } catch (err) {
      console.error('Fehler beim Nachladen:', err)
    } finally {
      this._loadingMore = false
    }
  }

  updateStatus(text) {
    const status = this.shadowRoot.querySelector('.status')
    if (status) status.textContent = text
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }

        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          font-family: Inter, -apple-system, sans-serif;
          background: #ffffff;
          border-left: 1px solid rgba(60,60,60,0.12);
        }

        .header {
          padding: 1rem;
          border-bottom: 1px solid rgba(60,60,60,0.12);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        }

        .header h3 {
          font-size: 0.95rem;
          font-weight: 600;
          color: #2c3e50;
        }

        .status {
          font-size: 0.75rem;
          opacity: 0.5;
          color: #2c3e50;
        }

        .messages {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          min-height: 0;
        }

        .message {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .message-header {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
        }

        .message-sender {
          font-size: 0.75rem;
          font-weight: 600;
          color: #4f8ef7;
        }

        .message-sender.role-admin { color: #ff5252; }
        .message-sender.role-moderator { color: #17ebb6; }
        .message-sender.role-member { color: #4f8ef7; }

        .message-time {
          font-size: 0.7rem;
          opacity: 0.4;
          color: #2c3e50;
        }

        .message-content {
          font-size: 0.9rem;
          color: #2c3e50;
          background: #f2f2f2;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          word-break: break-word;
        }

        .input-area {
          padding: 1rem;
          border-top: 1px solid rgba(60,60,60,0.12);
          display: flex;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .input-area input {
          flex: 1;
          padding: 0.5rem 0.75rem;
          border: 1px solid rgba(60,60,60,0.2);
          border-radius: 0.5rem;
          font-size: 0.9rem;
          font-family: inherit;
          color: #2c3e50;
          background: #f8f8f8;
          outline: none;
        }

        .input-area input:focus { border-color: #4f8ef7; }

        .send-btn {
          padding: 0.5rem 1rem;
          background: #4f8ef7;
          color: white;
          border: none;
          border-radius: 0.5rem;
          font-size: 0.9rem;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.2s;
        }

        .send-btn:hover { background: #3a7ae0; }

        .close-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1rem;
          color: #2c3e50;
          opacity: 0.5;
        }

        .close-btn:hover { opacity: 1; }

        .delete-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1.5rem;
          line-height: 1;
          padding: 0.15rem 0.4rem;
          color: #ff5252;
          opacity: 0.4;
          margin-left: auto;
        }

        .delete-btn:hover { opacity: 1; color: #ff5252; }
      </style>

      <div class="header">
        <h3>Chat</h3>
        <div style="display:flex;align-items:center;gap:0.75rem">
          <span class="status">Verbinde...</span>
          <button class="close-btn" id="close-btn">✕</button>
        </div>
      </div>

      <div class="messages"></div>

      <div class="input-area">
        <input type="text" placeholder="Nachricht eingeben..." id="msg-input" />
        <button class="send-btn" id="send-btn">Senden</button>
      </div>
    `

    const input = this.shadowRoot.querySelector('#msg-input')
    const sendBtn = this.shadowRoot.querySelector('#send-btn')
    const closeBtn = this.shadowRoot.querySelector('#close-btn')
    const messagesList = this.shadowRoot.querySelector('.messages')

    sendBtn.addEventListener('click', () => {
      const content = input.value.trim()
      if (!content) return
      this.send(content)
      input.value = ''
    })

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const content = input.value.trim()
        if (!content) return
        this.send(content)
        input.value = ''
      }
    })

    closeBtn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('chat-close', {
        bubbles: true,
        composed: true,
      }))
    })

    // Scroll-Listener für Pagination — hier am Ende von render()
    messagesList.addEventListener('scroll', () => {
      if (messagesList.scrollTop === 0) {
        this.loadMoreMessages()
      }
    })
  }
}

customElements.define('chat-window', ChatWindowElement)