// backend/server.js
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@as-integrations/express5');
const { ApolloServerPluginDrainHttpServer } = require('@apollo/server/plugin/drainHttpServer');

const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/use/ws');

const { makeExecutableSchema } = require('@graphql-tools/schema');

const { resolvers } = require('./resolvers/index.js');

const typeDefs = fs.readFileSync(
  path.join(__dirname, './scheme.graphql'),
  'utf8'
);

async function startServer() {
  await mongoose.connect('mongodb://root:root@localhost:27017/todoapp', {
    authSource: 'admin',
  });
  console.log('MongoDB verbunden');

  const app = express();
  const httpServer = http.createServer(app);

  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  const serverCleanup = useServer(
    {
      schema,
    },
    wsServer
  );

  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();

  app.use(
    '/graphql',
    cors(),
    express.json(),
    expressMiddleware(server)
  );

  httpServer.listen(4000, () => {
    console.log('Server läuft auf http://localhost:4000/graphql');
    console.log('Subscriptions laufen auf ws://localhost:4000/graphql');
  });
}

startServer().catch((err) => {
  console.error('Fehler beim Starten des Servers:', err);
  process.exit(1);
});