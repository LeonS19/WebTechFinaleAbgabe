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
    this.createDate = createDate || new Date().toISOString().split("T")[0]; // wird gesplittet, damit Zeit nicht angezeigt wird
    this.editedDate = editedDate || new Date().toISOString().split("T")[0];
    this.priority = priority;
  }
}

class TodoRepository {
  constructor() {
    this.items = [];
    this.nextId = 1;
  }

  findAll({ search, sortBy, priority } = {}) {
    let result = [...this.items];

    //filtert result nach Gesuchtem, wenn in 'search' etwas drin steht
    if (typeof search === "string" && search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q),
      );
    }

    //filtert result nach priority, wenn priority gegeben wurds
    if (priority !== undefined) {
      const p = Number(priority);
      result = result.filter((t) => t.priority === p);
    }

    //sortiert gefilterte/ungefilterte ergebnisse nach "sortby"
    const allowedSort = ["dueDate", "priority", "title"];
    if (allowedSort.includes(sortBy)) {
      result.sort((a, b) => {
        const av = a[sortBy] ?? "";
        const bv = b[sortBy] ?? "";
        if (av < bv) return -1;
        if (av > bv) return 1;
        return 0;
      });
    }

    //gibt sortierte und gefilterte liste zurücl
    return result;
  }

  findById(id) {
    const numericId = Number(id);
    return this.items.find((t) => t.id === numericId) || null;
  }

  create(input) {
    const todo = new Todo({
      id: this.nextId++,
      ...input,
    });
    this.items.push(todo);
    return todo;
  }

  update(id, input) {
    const todo = this.findById(id);
    if (!todo) return null;

    const next = new Todo({
      id: todo.id,
      title: input.title,
      priority: input.priority,
      description: input.description ?? null,
      completed: input.completed ?? false,
      dueDate: input.dueDate ?? null,
      createDate: todo.createDate,
      editedDate: new Date().toISOString().split("T")[0],
    });

    Object.assign(todo, next);
    return todo;
  }

  delete(id) {
    const numericId = Number(id);
    const idx = this.items.findIndex((t) => t.id === numericId);
    if (idx === -1) return false;
    this.items.splice(idx, 1);
    return true;
  }
}

module.exports = { Todo, TodoRepository };
