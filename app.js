const express = require('express')
const app = express()
const port = 3000

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

const todoRouter = require('./todo');

app.use(express.json());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @openapi
 * /:
 *   get:
 *     summary: Root endpoint
 *     responses:
 *       200:
 *         description: Hello World Antwort
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.use('/todos', todoRouter);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
