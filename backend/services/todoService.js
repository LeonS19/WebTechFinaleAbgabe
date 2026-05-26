const Todo = require('../models/Todo');
const { pubsub, EVENTS } = require('../pubsub');

const todoService = {

  async getAll({ status, tag, priority } = {}) {
    const filter = {};
    if (status)   filter.status = status;
    if (tag)      filter.tags = tag;
    if (priority) filter.priority = priority;
    return Todo.find(filter);
  },

  async getById(id) {
    return Todo.findById(id);
  },

  async create(input) {
    const todo = new Todo(input);
    await todo.save();
    pubsub.publish(EVENTS.TODO_CREATED, { todoCreated: todo });
    return todo;
  },

  async update(id, input) {
    const old = await Todo.findById(id);

    const historyEntries = [];
    for (const [key, value] of Object.entries(input)) {
      if (old[key]?.toString() !== value?.toString()) {
        historyEntries.push({
          field:    key,
          oldValue: String(old[key] ?? ''),
          newValue: String(value)
        });
      }
    }

    const todo = await Todo.findByIdAndUpdate(
      id,
      { ...input, $push: { history: { $each: historyEntries } } },
      { returnDocument: 'after' }
    );
    pubsub.publish(EVENTS.TODO_UPDATED, { todoUpdated: todo });
    return todo;
  },

  async delete(id) {
    await Todo.findByIdAndDelete(id);
    pubsub.publish(EVENTS.TODO_DELETED, { todoDeleted: id });
    return true;
  },

  async addComment(todoId, { text, author }) {
    const todo = await Todo.findByIdAndUpdate(
      todoId,
      { $push: { comments: { text, author } } },
      { returnDocument: 'after' }
    );
    pubsub.publish(EVENTS.TODO_UPDATED, { todoUpdated: todo });
    return todo;
  },

  async addChecklistItem(todoId, { label, description = '' }) {
    const todo = await Todo.findByIdAndUpdate(
      todoId,
      { $push: { checklistItems: { label, description, checked: false } } },
      { returnDocument: 'after' }
    );
    pubsub.publish(EVENTS.TODO_UPDATED, { todoUpdated: todo });
    return todo;
  },

  async updateChecklistItem(todoId, itemId, updates) {
    const todo = await Todo.findById(todoId);
    const item = todo.checklistItems.id(itemId);
    
    if (!item) throw new Error('Checklist item not found');
    
    if (updates.label !== undefined) item.label = updates.label;
    if (updates.description !== undefined) item.description = updates.description;
    if (updates.checked !== undefined) item.checked = updates.checked;
    
    await todo.save();
    pubsub.publish(EVENTS.TODO_UPDATED, { todoUpdated: todo });
    return todo;
  },

  async deleteChecklistItem(todoId, itemId) {
    const todo = await Todo.findByIdAndUpdate(
      todoId,
      { $pull: { checklistItems: { _id: itemId } } },
      { returnDocument: 'after' }
    );
    pubsub.publish(EVENTS.TODO_UPDATED, { todoUpdated: todo });
    return todo;
  }
};

module.exports = { todoService };