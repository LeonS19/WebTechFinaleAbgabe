const express = require("express");
const { TodoRepository } = require("./model");
const { TodoController } = require("./controller");

const router = express.Router();

const repo = new TodoRepository();
const controller = new TodoController(repo);

router.get("/", (req, res) => {
  const todos = controller.allTodos(req.query);
  res.json(todos);
});

router.get("/:id", (req, res) => {
  const todo = controller.getTodoById(req.params.id);

  if (!todo) {
    return res.status(404).json({ message: "To-Do-Eintrag nicht gefunden" });
  }

  res.json(todo);
});

router.post("/", (req, res) => {
  try {
    const createdTodo = controller.createTodo(req.body);
    res.status(201).json(createdTodo);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put("/:id", (req, res) => {
  try {
    const updatedTodo = controller.updateTodo(req.params.id, req.body);

    if (!updatedTodo) {
      return res.status(404).json({ message: "To-Do-Eintrag nicht gefunden" });
    }

    res.json(updatedTodo);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/:id", (req, res) => {
  const deleted = controller.deleteTodo(req.params.id);

  if (!deleted) {
    return res.status(404).json({ message: "To-Do-Eintrag nicht gefunden" });
  }

  res.sendStatus(204);
});

module.exports = router;