/**
 * db.js – lokale Datenhaltung mit IndexedDB
 * 
 * Speichert:
 *   - Todos (Object Store: "todos")
 *   - Chat-Nachrichten (Object Store: "messages")
 * 
 * Wird verwendet um Daten offline verfügbar zu machen.
 * Bei vorhandener Verbindung werden Daten vom Server geladen UND lokal gespeichert.
 * Bei fehlender Verbindung werden die lokal gespeicherten Daten angezeigt.
 */

const DB_NAME = 'todo-app-db';
const DB_VERSION = 1;

// Datenbank öffnen / anlegen
const openDB = () => {
  return idb.openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Object Store für Todos
      if (!db.objectStoreNames.contains('todos')) {
        db.createObjectStore('todos', { keyPath: 'id' });
        console.log('[DB] Object Store "todos" erstellt');
      }
      // Object Store für Chat-Nachrichten
      if (!db.objectStoreNames.contains('messages')) {
        const store = db.createObjectStore('messages', { keyPath: 'id' });
        // Index damit wir schnell alle Nachrichten eines Todos finden können
        store.createIndex('todo_id', 'todo_id');
        console.log('[DB] Object Store "messages" erstellt');
      }
    },
  });
};

// ─── TODOS ────────────────────────────────────────────────────────────────────

// Alle Todos lokal speichern (überschreibt vorhandene)
const saveTodos = async (todos) => {
  const db = await openDB();
  const tx = db.transaction('todos', 'readwrite');
  await Promise.all(todos.map(todo => tx.store.put(todo)));
  await tx.done;
};

// Alle lokal gespeicherten Todos laden
const loadTodos = async () => {
  const db = await openDB();
  return db.getAll('todos');
};

// ─── NACHRICHTEN ──────────────────────────────────────────────────────────────

// Nachrichten eines Todos lokal speichern
const saveMessages = async (messages) => {
  const db = await openDB();
  const tx = db.transaction('messages', 'readwrite');
  await Promise.all(messages.map(msg => tx.store.put(msg)));
  await tx.done;
};

// Eine einzelne neue Nachricht lokal speichern
const saveMessage = async (message) => {
  const db = await openDB();
  await db.put('messages', message);
};

// Alle Nachrichten eines bestimmten Todos laden
const loadMessages = async (todoId) => {
  const db = await openDB();
  const tx = db.transaction('messages', 'readonly');
  // Index benutzen um nur Nachrichten des richtigen Todos zu holen
  return tx.store.index('todo_id').getAll(Number(todoId));
};