const request = require('supertest');
const app = require('../app'); // Importiere die app.js aus dem Hauptverzeichnis

// Gruppiert alle Tests für die "Todo API"
describe('Todo API', () => {

  /**
   * Testfall 1: Überprüft den GET-Endpunkt.
   * Dieser Test sendet eine GET-Anfrage an /todos und erwartet,
   * dass der Server mit dem Status 200 (OK) und einem Array als Antwort-Body reagiert.
   */
  test('GET /todos -> sollte ein Array zurückgeben', async () => {
    const response = await request(app).get('/todos');

    expect(response.statusCode).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
  });

  /**
   * Testfall 2: Überprüft den POST-Endpunkt.
   * Dieser Test sendet ein neues Todo-Objekt per POST-Anfrage an /todos.
   * Er erwartet, dass der Server mit dem Status 201 (Created) antwortet und
   * das neu erstellte Todo (mit dem korrekten Titel) zurückgibt.
   */
  test('POST /todos -> sollte ein Todo erstellen', async () => {
    const newTodo = { title: 'Test schreiben', priority: 1 };
    
    const response = await request(app)
      .post('/todos')
      .send(newTodo);

    expect(response.statusCode).toBe(201); // 201 Created
    expect(response.body.title).toBe(newTodo.title);
  });


  // Hält das zuletzt erstellte Todo für die nachfolgenden Tests
  let createdTodo;

  // Dieser Test läuft vor den anderen und erstellt ein Todo, das wir dann verwenden können
  beforeAll(async () => {
    const res = await request(app)
      .post('/todos')
      .send({ title: 'Ein Todo zum Testen', priority: 2 });
    createdTodo = res.body;
  });

  /**
   * Testfall 3: GET /todos/:id -> Ein einzelnes Todo abrufen
   */
  test('GET /todos/:id -> sollte ein einzelnes Todo-Objekt zurückgeben', async () => {
    const response = await request(app).get(`/todos/${createdTodo.id}`);
    
    expect(response.statusCode).toBe(200);
    expect(response.body.id).toBe(createdTodo.id);
    expect(response.body.title).toBe('Ein Todo zum Testen');
  });

  /**
   * Testfall 4: PUT /todos/:id -> Ein bestehendes Todo aktualisieren
   */
  test('PUT /todos/:id -> sollte ein Todo aktualisieren und zurückgeben', async () => {
    const updatedData = { title: 'Aktualisierter Titel', completed: true };
    
    const response = await request(app)
      .put(`/todos/${createdTodo.id}`)
      .send(updatedData);

    expect(response.statusCode).toBe(200);
    expect(response.body.title).toBe('Aktualisierter Titel');
    expect(response.body.completed).toBe(true);
  });

  /**
   * Testfall 5: DELETE /todos/:id -> Ein Todo löschen
   */
  test('DELETE /todos/:id -> sollte ein Todo löschen und Status 204 zurückgeben', async () => {
    await request(app)
      .delete(`/todos/${createdTodo.id}`)
      .expect(204); // Erwartet "No Content"

    // Überprüfen, ob das Todo wirklich weg ist (sollte 404 zurückgeben)
    await request(app)
      .get(`/todos/${createdTodo.id}`)
      .expect(404);
  });


  /**
   * Testfall 6: Fehlerfall -> Ungültige ID
   */
  test('GET /todos/:id -> sollte 404 für eine nicht existierende ID zurückgeben', async () => {
    await request(app).get('/todos/9999').expect(404);
  });

  /**
   * Testfall 7: Fehlerfall -> Ungültige Eingabe beim Erstellen
   */
  test('POST /todos -> sollte 400 für ungültige Eingabedaten zurückgeben (fehlender Titel)', async () => {
    const invalidTodo = { priority: 1 }; // Titel fehlt
    
    const response = await request(app)
      .post('/todos')
      .send(invalidTodo);

    expect(response.statusCode).toBe(400);
  });

    /**
   * Testfall 8: GET /todos mit Query-Parametern -> Filtern und Sortieren
   */
  describe('GET /todos mit Query-Parametern', () => {
    // Erstellt vor diesen Tests ein paar Einträge
    beforeAll(async () => {
      await request(app).post('/todos').send({ title: 'Zuerst aufräumen', priority: 3 });
      await request(app).post('/todos').send({ title: 'Dann Code schreiben', priority: 1 });
    });

    test('sollte nach einem Suchbegriff filtern', async () => {
      const response = await request(app).get('/todos?search=aufräumen');
      
      expect(response.body.length).toBe(1);
      expect(response.body[0].title).toBe('Zuerst aufräumen');
    });

    test('sollte nach Priorität sortieren', async () => {
      const response = await request(app).get('/todos?sortBy=priority&order=desc');
      
      // Erwartet, dass das Todo mit der höchsten Priorität (3) zuerst kommt
      expect(response.body[0].priority).toBe(3);
    });
  });


});