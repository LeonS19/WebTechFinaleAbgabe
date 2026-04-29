class TodoController {
    constructor(todoRepository) { this.todoRepository = todoRepository; }

    async allTodos(query) { return await this.todoRepository.findAll(query); }

    async getTodoById(id) { return await this.todoRepository.findById(id); }

    async createTodo(input) { return await this.todoRepository.create(input); }

    async updateTodo(id, input) { return await this.todoRepository.update(id, input); }
    
    async deleteTodo(id) { return await this.todoRepository.delete(id); }
}
module.exports = { TodoController };