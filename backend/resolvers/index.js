const Todo = require("../models/Todo");
const { todoService } = require("../services/todoService");
const { pubsub, EVENTS } = require("../pubsub");

const resolvers = {
  Query: {
    todos: async (_, { status, tag, priority }) => {
      const filter = {};
      if (status) filter.status = status;
      if (tag) filter.tags = tag;
      if (priority) filter.priority = priority;
      return Todo.find(filter);
    },

    todo: async (_, { id }) => {
      return Todo.findById(id);
    },
  },

  Mutation: {
    createTodo: (_, { input }) => todoService.create(input),
    updateTodo: (_, { id, input }) => todoService.update(id, input),
    deleteTodo: (_, { id }) => todoService.delete(id),
    addComment: (_, { todoId, text, author }) =>
      todoService.addComment(todoId, { text, author }),
    addChecklistItem: (_, { todoId, label, description }) =>
      todoService.addChecklistItem(todoId, { label, description }),
    updateChecklistItem: (_, { todoId, itemId, label, description, checked }) =>
      todoService.updateChecklistItem(todoId, itemId, { label, description, checked }),
    deleteChecklistItem: (_, { todoId, itemId }) =>
      todoService.deleteChecklistItem(todoId, itemId),
  },

  Subscription: {
    todoCreated: {
      subscribe: () => pubsub.asyncIterableIterator([EVENTS.TODO_CREATED]),
    },
    todoUpdated: {
      subscribe: () => pubsub.asyncIterableIterator([EVENTS.TODO_UPDATED]),
    },
    todoDeleted: {
      subscribe: () => pubsub.asyncIterableIterator([EVENTS.TODO_DELETED]),
    },
  },

  Todo: {
    id: (todo) => todo._id.toString(),
    dueDate: (todo) => todo.dueDate?.toISOString() ?? null,
    createdAt: (todo) => todo.createdAt.toISOString(),
    updatedAt: (todo) => todo.updatedAt.toISOString(),
  },

  ChecklistItem: {
    id: (item) => item._id.toString(),
  },
  
};

module.exports = { resolvers };