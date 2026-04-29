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


});