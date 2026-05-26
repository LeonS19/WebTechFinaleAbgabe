const { startTestServer, stopTestServer, execute } = require('./testServer.js');
const { pubsub, EVENTS } = require('../pubsub');
const Todo = require('../models/Todo.js');

let server;

beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await stopTestServer(server); });
afterEach(async () => { await Todo.deleteMany({}); });

test('todoCreated-Subscription feuert wenn createTodo aufgerufen wird', async () => {
  // Subscription anlegen und auf das erste Event warten
  const subResult = await server.executeOperation({
    query: `subscription { todoCreated { id title status } }`
  });

  // createTodo aufrufen — das soll die Subscription triggern
  await execute(server, `
    mutation { createTodo(input: { title: "Subscription Test" }) { id } }
  `);

  // Erstes Event aus dem AsyncIterator holen
  const iterator = subResult.body.initialResult.data.todoCreated;
  const { value } = await iterator.next();

  expect(value.todoCreated.title).toBe('Subscription Test');
  expect(value.todoCreated.status).toBe('OPEN');
});

test('todoUpdated-Subscription feuert bei Statusänderung', async () => {
  const todo = await Todo.create({ title: 'Todo für Subscription' });

  const subResult = await server.executeOperation({
    query: `subscription { todoUpdated { id status } }`
  });

  await execute(server, `
    mutation UpdateTodo($id: ID!, $input: UpdateTodoInput!) {
      updateTodo(id: $id, input: $input) { id }
    }
  `, { id: todo._id.toString(), input: { status: 'DONE' } });

  const iterator = subResult.body.initialResult.data.todoUpdated;
  const { value } = await iterator.next();

  expect(value.todoUpdated.status).toBe('DONE');
});

test('todoDeleted-Subscription liefert die ID des gelöschten Todos', async () => {
  const todo = await Todo.create({ title: 'Zu löschendes Todo' });

  const subResult = await server.executeOperation({
    query: `subscription { todoDeleted }`
  });

  await execute(server, `
    mutation DeleteTodo($id: ID!) { deleteTodo(id: $id) }
  `, { id: todo._id.toString() });

  const iterator = subResult.body.initialResult.data.todoDeleted;
  const { value } = await iterator.next();

  expect(value.todoDeleted).toBe(todo._id.toString());
});