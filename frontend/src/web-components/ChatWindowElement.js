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
  }

  static get observedAttributes() {
    return ['chat-id', 'token', 'username']
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal !== newVal && this.getAttribute('chat-id') && this.getAttribute('token')) {
      if (this._rendered) {
        this.connect()
      }
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

    this.resetMessages()
    this.loadMessages()

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
        }
        this._messages.push(normalized)
        this.appendMessage(normalized)
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
    const div = document.createElement('div')
    div.className = 'message'
    div.innerHTML = `
      <div class="message-header">
        <span class="message-sender">${sender}</span>
        <span class="message-time">${time}</span>
      </div>
      <p class="message-content">${message.content}</p>
    `
    return div
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

  async loadMessages() {
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
      const normalizedForCache = messages.map((m) => ({ ...m, senderName: m.sender?.name }))
      cacheMessages(normalizedForCache)

      // Service gibt neueste zuerst zurück — umkehren für Anzeige
      const ordered = [...messages].reverse()
      ordered.forEach((m) => {
        const normalized = { ...m, senderName: m.sender?.name }
        this._messages.push(normalized)
        this.appendMessage(normalized)
      })
    } catch (err) {
      console.error('Fehler beim Laden der Nachrichten:', err)
      try {
        const cached = await getCachedMessages(chatId)
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
        const normalized = { ...m, senderName: m.sender?.name }
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

        @media (prefers-color-scheme: dark) {
          :host { background: #222222; border-color: rgba(84,84,84,0.48); }
          .header h3, .status { color: rgba(235,235,235,0.87); }
          .message-content { background: #282828; color: rgba(235,235,235,0.87); }
          .message-time { color: rgba(235,235,235,0.4); }
          .input-area input { background: #282828; border-color: rgba(84,84,84,0.48); color: rgba(235,235,235,0.87); }
          .close-btn { color: rgba(235,235,235,0.87); }
        }
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