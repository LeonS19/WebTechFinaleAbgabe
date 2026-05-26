// backend/tests/testServer.js
const { ApolloServer } = require('@apollo/server');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { resolvers } = require('../resolvers/index.js');

// GraphQL-Schema aus Datei laden (mit absolutem Pfad)
const typeDefs = fs.readFileSync(path.join(__dirname, '../scheme.graphql'), 'utf8');

async function startTestServer() {
  // Mit Test-Datenbank verbinden
  await mongoose.connect('mongodb://root:root@localhost:27017/todos_test', {
    authSource: 'admin'
  });

  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();
  return server;
}

async function stopTestServer(server) {
  await server.stop();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

// Hilfsfunktion damit Tests lesbarer werden
async function execute(server, query, variables = {}) {
  const res = await server.executeOperation({ query, variables });
  return res.body.singleResult;
}

module.exports = { startTestServer, stopTestServer, execute };