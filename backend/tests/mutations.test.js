const { startTestServer, stopTestServer, execute } = require('./testServer.js');
const Todo = require('../models/Todo.js');

let server;

beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await stopTestServer(server); });
afterEach(async () => { await Todo.deleteMany({}); });

// --- createTodo ---

test('createTodo erstellt ein Todo mit Pflichtfeldern', async () => {
  const { data, errors } = await execute(server, `
    mutation {
      createTodo(input: { title: "Neues Todo" }) {
        id title status
      }
    }
  `);
  expect(errors).toBeUndefined();
  expect(data.createTodo.title).toBe('Neues Todo');
  expect(data.createTodo.status).toBe('OPEN');   // Default-Wert
  expect(data.createTodo.id).toBeDefined();
});

test('createTodo speichert optionale Felder', async () => {
  const { data } = await execute(server, `
    mutation {
      createTodo(input: {
        title: "Todo mit Extras"
        priority: HIGH
        tags: ["arbeit", "dringend"]
      }) {
        id title priority tags
      }
    }
  `);
  expect(data.createTodo.priority).toBe('HIGH');
  expect(data.createTodo.tags).toEqual(['arbeit', 'dringend']);
});

test('createTodo schlägt fehl wenn Titel fehlt', async () => {
  const { errors } = await execute(server, `
    mutation { createTodo(input: {}) { id } }
  `);
  expect(errors).toBeDefined();
});

// --- updateTodo ---

test('updateTodo ändert Status eines Todos', async () => {
  const todo = await Todo.create({ title: 'Zu updatendes Todo' });

  const { data } = await execute(server, `
    mutation UpdateTodo($id: ID!, $input: UpdateTodoInput!) {
      updateTodo(id: $id, input: $input) { id status }
    }
  `, { id: todo._id.toString(), input: { status: 'DONE' } });

  expect(data.updateTodo.status).toBe('DONE');
});

test('updateTodo legt Bearbeitungsverlauf an', async () => {
  const todo = await Todo.create({ title: 'Todo', status: 'OPEN' });

  await execute(server, `
    mutation UpdateTodo($id: ID!, $input: UpdateTodoInput!) {
      updateTodo(id: $id, input: $input) { id }
    }
  `, { id: todo._id.toString(), input: { status: 'DONE' } });

  // Direkt in DB prüfen
  const updated = await Todo.findById(todo._id);
  expect(updated.history).toHaveLength(1);
  expect(updated.history[0].field).toBe('status');
  expect(updated.history[0].oldValue).toBe('OPEN');
  expect(updated.history[0].newValue).toBe('DONE');
});

// --- deleteTodo ---

test('deleteTodo entfernt ein Todo aus der Datenbank', async () => {
  const todo = await Todo.create({ title: 'Zu löschendes Todo' });

  const { data } = await execute(server, `
    mutation DeleteTodo($id: ID!) { deleteTodo(id: $id) }
  `, { id: todo._id.toString() });

  expect(data.deleteTodo).toBe(true);
  const found = await Todo.findById(todo._id);
  expect(found).toBeNull();
});

// --- addComment ---

test('addComment fügt Kommentar zu Todo hinzu', async () => {
  const todo = await Todo.create({ title: 'Todo mit Kommentar' });

  const { data } = await execute(server, `
    mutation AddComment($todoId: ID!, $text: String!) {
      addComment(todoId: $todoId, text: $text, author: "Alice") {
        id comments { id text author }
      }
    }
  `, { todoId: todo._id.toString(), text: 'Mein Kommentar' });

  expect(data.addComment.comments).toHaveLength(1);
  expect(data.addComment.comments[0].text).toBe('Mein Kommentar');
  expect(data.addComment.comments[0].author).toBe('Alice');
});

// --- addSubtask / toggleSubtask ---

test('addSubtask fügt Subtask hinzu', async () => {
  const todo = await Todo.create({ title: 'Todo mit Subtask' });

  const { data } = await execute(server, `
    mutation AddSubtask($todoId: ID!, $title: String!) {
      addSubtask(todoId: $todoId, title: $title) {
        id subtasks { id title done }
      }
    }
  `, { todoId: todo._id.toString(), title: 'Mein Subtask' });

  expect(data.addSubtask.subtasks).toHaveLength(1);
  expect(data.addSubtask.subtasks[0].done).toBe(false);
});

test('toggleSubtask markiert Subtask als erledigt', async () => {
  const todo = await Todo.create({
    title: 'Todo',
    subtasks: [{ title: 'Subtask', done: false }]
  });
  const subtaskId = todo.subtasks[0]._id.toString();

  const { data } = await execute(server, `
    mutation ToggleSubtask($todoId: ID!, $subtaskId: ID!) {
      toggleSubtask(todoId: $todoId, subtaskId: $subtaskId) {
        subtasks { id done }
      }
    }
  `, { todoId: todo._id.toString(), subtaskId });

  expect(data.toggleSubtask.subtasks[0].done).toBe(true);
});