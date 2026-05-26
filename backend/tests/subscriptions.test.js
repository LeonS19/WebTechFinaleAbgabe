const { startTestServer, stopTestServer, execute } = require('./testServer.js');
const { pubsub, EVENTS } = require('../pubsub');
const Todo = require('../models/Todo.js');

let server;

beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await stopTestServer(server); });
afterEach(async () => { await Todo.deleteMany({}); });

test('todoCreated-Subscription feuert wenn createTodo aufgerufen wird', async () => {
  const iterator = pubsub.asyncIterableIterator([EVENTS.TODO_CREATED]);

  // Mutation ausführen
  const mutationPromise = execute(server, `
    mutation { createTodo(input: { title: "Subscription Test" }) { id } }
  `);

  // Auf Event warten (mit Timeout)
  const { value } = await Promise.race([
    iterator.next(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Event nicht empfangen')), 1000)
    )
  ]);

  await mutationPromise;

  expect(value.todoCreated.title).toBe('Subscription Test');
  expect(value.todoCreated.status).toBe('OPEN');
}, 10000);

test('todoUpdated-Subscription feuert bei Statusänderung', async () => {
  const todo = await Todo.create({ title: 'Todo für Subscription' });

  const iterator = pubsub.asyncIterableIterator([EVENTS.TODO_UPDATED]);

  const mutationPromise = execute(server, `
    mutation UpdateTodo($id: ID!, $input: UpdateTodoInput!) {
      updateTodo(id: $id, input: $input) { id }
    }
  `, { id: todo._id.toString(), input: { status: 'DONE' } });

  const { value } = await Promise.race([
    iterator.next(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Event nicht empfangen')), 1000)
    )
  ]);

  await mutationPromise;

  expect(value.todoUpdated.status).toBe('DONE');
}, 10000);

test('todoDeleted-Subscription liefert die ID des gelöschten Todos', async () => {
  const todo = await Todo.create({ title: 'Zu löschendes Todo' });

  const iterator = pubsub.asyncIterableIterator([EVENTS.TODO_DELETED]);

  const mutationPromise = execute(server, `
    mutation DeleteTodo($id: ID!) { deleteTodo(id: $id) }
  `, { id: todo._id.toString() });

  const { value } = await Promise.race([
    iterator.next(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Event nicht empfangen')), 1000)
    )
  ]);

  await mutationPromise;

  expect(value.todoDeleted).toBe(todo._id.toString());
}, 10000);