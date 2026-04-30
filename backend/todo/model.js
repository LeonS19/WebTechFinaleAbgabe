const db = require('../db');

class Todo {
  constructor({
    id,
    title,
    description = null,
    completed = false,
    dueDate = null,
    createDate,
    editedDate,
    priority,
  }) {
    //Required parameters werden abgecheckt
    if (!title || !title.trim()) {
      throw new Error("title ist erforderlich");
    }
    if (priority === undefined || priority === null) {
      throw new Error("priority ist erforderlich");
    }
    if (![1, 2, 3].includes(priority)) {
      throw new Error("priority muss 1, 2 oder 3 sein");
    }

    this.id = id;
    this.title = title.trim();
    this.description = description;
    this.completed = completed;
    this.dueDate = dueDate;
    this.createDate = createDate || new Date().toISOString(); // wird gesplittet, damit Zeit nicht angezeigt wird
    this.editedDate = editedDate || new Date().toISOString();
    this.priority = priority;
  }
}

class TodoRepository {
  
async findAll({ search, sortBy, priority, completed, order = "asc" } = {}) {
    let query = 'SELECT * FROM todos';
    const params = [];
    const whereClauses = [];

    // 1. WHERE-Klausel für die Suche dynamisch hinzufügen
    if (search) {
      params.push(`%${search}%`); // Füge Wildcards für die LIKE-Suche hinzu
      // ILIKE ist wie LIKE, aber ignoriert Groß-/Kleinschreibung
      whereClauses.push(`title ILIKE $${params.length}`);
    }

    // 2. WHERE-Klausel für den Prioritätsfilter dynamisch hinzufügen
    if (priority) {
      params.push(priority);
      whereClauses.push(`priority = $${params.length}`);
    }

    // Logik für den "completed"-Filter
    if (completed !== undefined) {
      const isCompleted = completed === 'true'; 
      params.push(isCompleted);
      whereClauses.push(`completed = $${params.length}`);
    }

    // Füge alle WHERE-Bedingungen zur Haupt-Query hinzu
    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    // 3. ORDER BY-Klausel für die Sortierung dynamisch hinzufügen
    const allowedSortBy = ['dueDate', 'priority', 'title']; // Spaltennamen in Anführungszeichen, falls nötig
    if (allowedSortBy.includes(sortBy)) {
      // WICHTIG: Spaltennamen und Sortierrichtung dürfen aus Sicherheitsgründen
      // nicht als Parameter ($) übergeben werden. Sie müssen direkt in den String.
      const sortColumn = `"${sortBy}"`; 
      const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query += ` ORDER BY ${sortColumn} ${sortOrder}`;
    }

    // Führe die fertig zusammengebaute Query aus
    const { rows } = await db.query(query, params);
    return rows;
  }

  
  async findById(id) {
    const { rows } = await db.query('SELECT * FROM todos WHERE id = $1', [id]);
    return rows[0] || null;
  }

  
  async create(input) {
    const todoToCreate = new Todo(input); // Validierung
    const { title, description, dueDate, priority, completed } = todoToCreate;
    
    const sql = `
      INSERT INTO todos (title, description, "dueDate", priority, completed)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const params = [title, description, dueDate, priority, completed ?? false];
    const { rows } = await db.query(sql, params);
    return rows[0];
  }

  
  async update(id, input) {
    // Hier kommt die SQL-Logik für das Update...
    const { title, description, dueDate, priority, completed } = input;
    const sql = `
      UPDATE todos
      SET 
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        "dueDate" = COALESCE($3, "dueDate"),
        priority = COALESCE($4, priority),
        completed = COALESCE($5, completed),
        "editedDate" = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *;
    `;
    const params = [title, description, dueDate, priority, completed, id];
    const { rows } = await db.query(sql, params);
    return rows[0] || null;
  }

  
  async delete(id) {
    const result = await db.query('DELETE FROM todos WHERE id = $1', [id]);
    // rowCount gibt an, wie viele Zeilen gelöscht wurden.
    return result.rowCount > 0;
  }
}

module.exports = { Todo, TodoRepository };
