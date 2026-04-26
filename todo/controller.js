class TodoController {
    constructor(todoRepository) {
        this.todoRepository = todoRepository;
    }

    allTodos() {
        return this.todoRepository.findAll();
    }

    createTodo(input) {
        return this.todoRepository.create({title: input.title, completed: input.completed, importance: input.importance});
    }

    updateTodo(id, input) {
        return this.todoRepository.update(id, input);
    }

    deleteTodo(id) {
        return this.todoRepository.delete(id);
    }
}

module.exports = { TodoController };