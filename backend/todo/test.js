const request = require('supertest');
const app = require('../app');
const db = require('../db');

describe('Todo API', () => {

  // Vor jedem einzelnen Test wird die Tabelle geleert und der ID-Zähler zurückgesetzt.
  // Das garantiert, dass jeder Test mit einem sauberen, vorhersagbaren Zustand startet.
  beforeEach(async () => {
    await db.query('TRUNCATE TABLE todos RESTART IDENTITY CASCADE');
  });

  // Nach allen Tests wird die Datenbankverbindung sauber geschlossen.
  // Das verhindert, dass Jest hängen bleibt.
  afterAll(async () => {
    await db.pool.end();
  });

  describe('GET /todos', () => {
    it('sollte ein leeres Array zurückgeben, wenn die DB leer ist', async () => {
      const response = await request(app).get('/todos');
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('POST /todos', () => {
    it('sollte ein Todo erstellen und mit Status 201 zurückgeben', async () => {
      const newTodo = { title: 'Test schreiben', priority: 1 };
      const response = await request(app).post('/todos').send(newTodo);

      expect(response.statusCode).toBe(201);
      expect(response.body.title).toBe(newTodo.title);
      expect(response.body).toHaveProperty('id');
    });

    it('sollte 400 für ungültige Eingabedaten zurückgeben (fehlender Titel)', async () => {
      const invalidTodo = { priority: 1 };
      const response = await request(app).post('/todos').send(invalidTodo);
      expect(response.statusCode).toBe(400);
    });
  });

  describe('Tests, die ein existierendes Todo benötigen', () => {
    let testTodo;

    // Erstelle vor jedem Test in diesem Block ein frisches Todo.
    beforeEach(async () => {
      const response = await request(app)
        .post('/todos')
        .send({ title: 'Ein Todo zum Testen', priority: 2 });
      testTodo = response.body;
    });

    it('GET /todos/:id -> sollte ein einzelnes Todo-Objekt zurückgeben', async () => {
      const response = await request(app).get(`/todos/${testTodo.id}`);
      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(testTodo.id);
    });

    it('PUT /todos/:id -> sollte ein Todo aktualisieren', async () => {
      const updatedData = { title: 'Aktualisierter Titel', completed: true };
      const response = await request(app).put(`/todos/${testTodo.id}`).send(updatedData);
      expect(response.statusCode).toBe(200);
      expect(response.body.title).toBe('Aktualisierter Titel');
    });

    it('DELETE /todos/:id -> sollte ein Todo löschen', async () => {
      await request(app).delete(`/todos/${testTodo.id}`).expect(204);
      await request(app).get(`/todos/${testTodo.id}`).expect(404);
    });

    it('GET /todos/:id -> sollte 404 für eine nicht existierende ID zurückgeben', async () => {
      await request(app).get('/todos/9999').expect(404);
    });
  });

  describe('Tests für Filtern und Sortieren', () => {
    // Erstelle vor jedem Test in diesem Block die benötigten Daten.
    beforeEach(async () => {
      await request(app).post('/todos').send({ title: 'Zuerst aufräumen', priority: 3 });
      await request(app).post('/todos').send({ title: 'Dann Code schreiben', priority: 1 });
      await request(app).post('/todos').send({ title: 'Zuletzt Kaffee trinken', priority: 2 });
    });

    it('sollte nach einem Suchbegriff filtern', async () => {
      const response = await request(app).get('/todos?search=aufräumen');
      expect(response.body.length).toBe(1);
      expect(response.body[0].title).toBe('Zuerst aufräumen');
    });

    it('sollte nach Priorität absteigend sortieren', async () => {
      const response = await request(app).get('/todos?sortBy=priority&order=desc');
      expect(response.body[0].priority).toBe(3);
    });

    it('sollte nach Priorität aufsteigend sortieren', async () => {
      const response = await request(app).get('/todos?sortBy=priority&order=asc');
      expect(response.body[0].priority).toBe(1);
    });
  });
});