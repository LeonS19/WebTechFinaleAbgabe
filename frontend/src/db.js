// frontend/js/db.js
const DB_NAME = 'todo-app-db';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const db = e.target.result;
      // Todos lokal speichern
      if (!db.objectStoreNames.contains('todos')) {
        db.createObjectStore('todos', { keyPath: 'id' });
      }
      // Chat-Nachrichten lokal speichern
      if (!db.objectStoreNames.contains('messages')) {
        const store = db.createObjectStore('messages', { keyPath: '_id' });
        store.createIndex('todoId', 'todoId', { unique: false });
      }
    };

    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

// Todos speichern/laden
async function saveTodos(todos) {
  const db = await openDB();
  const tx = db.transaction('todos', 'readwrite');
  todos.forEach(todo => tx.objectStore('todos').put(todo));
  return tx.complete;
}

async function loadTodos() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('todos').objectStore('todos').getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

// Nachrichten speichern/laden
async function saveMessages(messages) {
  const db = await openDB();
  const tx = db.transaction('messages', 'readwrite');
  messages.forEach(msg => tx.objectStore('messages').put(msg));
}

async function loadMessages(todoId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('messages').objectStore('messages')
      .index('todoId').getAll(todoId);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

export { saveTodos, loadTodos, saveMessages, loadMessages };