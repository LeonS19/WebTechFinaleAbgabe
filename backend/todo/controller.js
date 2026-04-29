class TodoController {
    constructor(todoRepository) {
        this.todoRepository = todoRepository;
    }

    allTodos(query) {
        return this.todoRepository.findAll(query);
    }

    getTodoById(id) {
        return this.todoRepository.findById(id);
    }

    createTodo(input) {
        return this.todoRepository.create(input);
    }

    updateTodo(id, input) {
        return this.todoRepository.update(id, input);
    }

    deleteTodo(id) {
        return this.todoRepository.delete(id);
    }
}

module.exports = { TodoController };