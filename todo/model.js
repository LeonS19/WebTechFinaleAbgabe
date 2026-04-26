const { randomUUID } = require("crypto");
class Todo {
  constructor({
    id = randomUUID(),
    title,
    completed = false,
    importance = false,
    createdAt = new Date(),
    updatedAt = new Date()
    }) {

        if (!title || !title.trim()) {
        throw new Error("title ist erforderlich");
        }

        this.id = id;
        this.title = title.trim();
        this.completed = completed;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.importance = importance;
    }
}

class TodoRepository {
  constructor() {
    this.items = [];
  }

  findAll() {
    return this.items;
  }

  findById(id) {
    return this.items.find((todo) => todo.id === id) || null;
  }

  create(input) {
    const todo = new Todo(input);
    this.items.push(todo);
    return todo;
  }

  update(id, patch) { //patch = neue Werte zum updaten
    const todo = this.findById(id);
    if (!todo) return null;

    if (typeof patch.title === "string") {
      if (!patch.title.trim()) {
        throw new Error("title darf nicht leer sein");
      }
      todo.title = patch.title.trim();
    }

    if (typeof patch.completed === "boolean") {
      todo.completed = patch.completed;
    }

    if (typeof patch.importance === "number") {
        todo.importance = patch.importance;
    }

    todo.updatedAt = new Date();
    return todo;
  }

  delete(id) {
    const index = this.items.findIndex((todo) => todo.id === id);
    if (index === -1) return false;

    this.items.splice(index, 1); //entfernen von 1 element an stelle index
    return true;
  }
}

module.exports = { Todo, TodoRepository };