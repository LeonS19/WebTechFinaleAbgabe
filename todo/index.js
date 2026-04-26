const express = require("express");
const { TodoRepository } = require("./model");
const { TodoController } = require("./controller");
const { TodoView } = require("./view");

const router = express.router;

const repo = new TodoRepository();
const controller = new TodoController(repo);