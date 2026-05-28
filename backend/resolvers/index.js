const Todo = require("../models/Todo");
const { todoService } = require("../services/todoService");
const { pubsub, EVENTS } = require("../pubsub");
const fs = require("fs");
const path = require("path"); 

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
      todoService.updateChecklistItem(todoId, itemId, {
        label,
        description,
        checked,
      }),
    deleteChecklistItem: (_, { todoId, itemId }) =>
      todoService.deleteChecklistItem(todoId, itemId),

    addAttachment: async (_, { todoId, filename, originalname, url }) => {
      const todo = await Todo.findByIdAndUpdate(
        todoId,
        {
          $push: {
            attachments: { filename, originalname, url },
          },
        },
        { returnDocument: 'after' },
      );
      pubsub.publish(EVENTS.TODO_UPDATED, { todoUpdated: todo });
      return todo;
    },

    deleteAttachment: async (_, { todoId, attachmentId }) => {
      // Erst das Attachment finden, um den Dateinamen zu kennen
      const todo = await Todo.findById(todoId);
      const attachment = todo.attachments.id(attachmentId);

      if (attachment) {
        const filePath = path.join(
          __dirname,
          "../uploads",
          attachment.filename,
        );
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Datei gelöscht: ${filePath}`);
          }
        } catch (error) {
          console.error("Fehler beim Löschen der Datei:", error);
          // Nicht abbrechen, auch wenn Datei-Löschung fehlschlägt
        }
      }

      const updatedTodo = await Todo.findByIdAndUpdate(
        todoId,
        { $pull: { attachments: { _id: attachmentId } } },
        { returnDocument: 'after' },
      );

      pubsub.publish(EVENTS.TODO_UPDATED, { todoUpdated: updatedTodo });
      return updatedTodo;
    },
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
