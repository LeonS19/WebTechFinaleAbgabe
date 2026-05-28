const todoList = document.getElementById('todo-list');
const newTodoForm = document.getElementById('new-todo-form');
const titleInput = document.getElementById('todo-title-input');
const priorityInput = document.getElementById('todo-priority-input');
const descriptionInput = document.getElementById('todo-description-input');
const dueDateInput = document.getElementById('todo-duedate-input');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const filterSelect = document.getElementById('filter-select');

const API_URL = 'http://localhost:3000/todos';
const WS_URL = 'ws://localhost:3000';

// Speichert aktive WebSocket-Verbindungen pro Todo: { todoId -> WebSocket }
const activeChats = {};

// ─── TODOS LADEN & RENDERN ────────────────────────────────────────────────────

async function fetchAndRenderTodos() {
    const searchTerm = searchInput.value;
    const sortValue = sortSelect.value;
    const filterValue = filterSelect.value;

    const url = new URL(API_URL);
    if (searchTerm) url.searchParams.append('search', searchTerm);
    if (sortValue) {
        const [sortBy, order] = sortValue.split('-');
        url.searchParams.append('sortBy', sortBy);
        url.searchParams.append('order', order);
    }
    if (filterValue && filterValue !== 'all') {
        const [filterBy, value] = filterValue.split('-');
        url.searchParams.append(filterBy, value);
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP-Fehler! Status: ${response.status}`);
        const todos = await response.json();

        // Todos lokal speichern
        await saveTodos(todos);

        renderTodos(todos);
    } catch (error) {
        console.warn("Server nicht erreichbar, lade aus IndexedDB...");

        // Offline-Fallback
        const todos = await loadTodos();
        renderTodos(todos);
    }
}

function renderTodos(todos) {
    todoList.innerHTML = '';
    todos.forEach(todo => {
        const card = document.createElement('todo-card');
        card.setAttribute('todo-id', todo.id);
        card.setAttribute('todo-title', todo.title);
        card.setAttribute('todo-priority', todo.priority);
        card.setAttribute('todo-desc', todo.description || '');
        card.setAttribute('todo-duedate', todo.dueDate || '');
        card.setAttribute('todo-createdate', todo.createDate);
        card.setAttribute('todo-editeddate', todo.editedDate);
        card.setAttribute('todo-completed', todo.completed);
        todoList.appendChild(card);
    });
}

// ─── CHAT-FUNKTIONEN ──────────────────────────────────────────────────────────

// Chat für ein Todo öffnen/schließen und WebSocket verbinden
function toggleChat(todoId) {
    const panel = document.getElementById(`chat-${todoId}`);
    const isOpen = panel.style.display !== 'none';

    if (isOpen) {
        // Chat schließen und WebSocket trennen
        panel.style.display = 'none';
        if (activeChats[todoId]) {
            activeChats[todoId].close();
            delete activeChats[todoId];
        }
    } else {
        // Chat öffnen und WebSocket verbinden
        panel.style.display = 'block';
        connectChat(todoId);
    }
}

// WebSocket-Verbindung aufbauen und Nachrichten empfangen
function connectChat(todoId) {
    // Nicht doppelt verbinden
    if (activeChats[todoId]) return;

    const ws = new WebSocket(WS_URL);
    activeChats[todoId] = ws;

    ws.onopen = () => {
        // Dem Server mitteilen, welches Todo wir gerade geöffnet haben
        ws.send(JSON.stringify({ type: 'join', todoId }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const messagesContainer = document.getElementById(`chat-messages-${todoId}`);

        if (data.type === 'history') {
            // Alle bisherigen Nachrichten anzeigen
            messagesContainer.innerHTML = '';
            data.messages.forEach(msg => appendMessage(messagesContainer, msg));
        }

        if (data.type === 'message') {
            // Neue Nachricht live hinzufügen
            appendMessage(messagesContainer, data.message);
        }

        // Automatisch nach unten scrollen
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    ws.onerror = () => {
        console.error(`WebSocket-Fehler für Todo ${todoId}`);
    };

    ws.onclose = () => {
        delete activeChats[todoId];
    };
}

// Eine einzelne Nachricht ins Chat-Panel einfügen
function appendMessage(container, msg) {
    const div = document.createElement('div');
    div.className = 'chat-message';
    const time = new Date(msg.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `<span class="chat-user">${msg.username}</span> <span class="chat-time">${time}</span><p>${msg.message}</p>`;
    container.appendChild(div);
}

// Nachricht absenden
function sendMessage(todoId, username, message) {
    const ws = activeChats[todoId];
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!username.trim() || !message.trim()) return;

    ws.send(JSON.stringify({ type: 'message', todoId, username: username.trim(), message: message.trim() }));
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', fetchAndRenderTodos);
searchInput.addEventListener('input', fetchAndRenderTodos);
sortSelect.addEventListener('change', fetchAndRenderTodos);
filterSelect.addEventListener('change', fetchAndRenderTodos);

newTodoForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!navigator.onLine) {
        alert('Du bist offline – Todos können nur gelesen, nicht erstellt werden.');
        return;
    }

    const title = titleInput.value.trim();
    const priority = parseInt(priorityInput.value, 10);
    const description = descriptionInput.value.trim();
    const dueDate = dueDateInput.value;

    if (!title || !priority) return;

    const newTodo = { title, priority };
    if (description) newTodo.description = description;
    if (dueDate) newTodo.dueDate = dueDate;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTodo),
        });
        if (!response.ok) throw new Error(`HTTP-Fehler! Status: ${response.status}`);
        newTodoForm.reset();
        await fetchAndRenderTodos();
    } catch (error) {
        console.error("Fehler beim Erstellen des Todos:", error);
    }
});


todoList.addEventListener('todo-delete', async (e) => {
    if (!navigator.onLine) {
        alert('Du bist offline – Todos können nur gelesen, nicht gelöscht werden.');
        return;
    }

    if (!confirm('Wirklich löschen?')) return;
    await fetch(`${API_URL}/${e.detail.id}`, { method: 'DELETE' });
    fetchAndRenderTodos();
});

todoList.addEventListener('todo-complete', async (e) => {
  await fetch(`${API_URL}/${e.detail.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed: !e.detail.completed }),
  });
  fetchAndRenderTodos();
});

todoList.addEventListener('todo-edit', async (e) => {

    if (!navigator.onLine) {
        alert('Du bist offline – Todos können nur gelesen, nicht bearbeitet werden.');
        return;
    }

  const id = e.detail.id;
  const card = todoList.querySelector(`[data-id="${id}"]`);
  const response = await fetch(`${API_URL}/${id}`);
  const todo = await response.json();
  card.innerHTML = `
    <div class="edit-form">
      <input type="text" class="edit-title" value="${todo.title}">
      <input type="number" class="edit-priority" value="${todo.priority}">
      <textarea class="edit-description">${todo.description || ''}</textarea>
      <input type="date" class="edit-dueDate" value="${todo.dueDate ? new Date(todo.dueDate).toISOString().split('T')[0] : ''}">
      <div class="edit-actions">
        <button class="save-btn">Speichern</button>
        <button class="cancel-btn">Abbrechen</button>
      </div>
    </div>
  `;
  card.querySelector('.save-btn').addEventListener('click', async () => {
    await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: card.querySelector('.edit-title').value,
        priority: parseInt(card.querySelector('.edit-priority').value),
        description: card.querySelector('.edit-description').value,
        dueDate: card.querySelector('.edit-dueDate').value || null,
      }),
    });
    fetchAndRenderTodos();
  });
  card.querySelector('.cancel-btn').addEventListener('click', () => fetchAndRenderTodos());
});

// Enter-Taste im Chat-Input abfangen
todoList.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.classList.contains('chat-message-input')) {
        const todoItem = event.target.closest('.todo-item');
        if (!todoItem) return;
        const todoId = todoItem.dataset.id;
        const username = todoItem.querySelector('.chat-username').value;
        sendMessage(todoId, username, event.target.value);
        event.target.value = '';
    }
});