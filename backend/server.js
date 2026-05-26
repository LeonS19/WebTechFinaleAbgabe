const { ApolloServer } = require('@apollo/server');
const { startStandaloneServer } = require('@apollo/server/standalone');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { resolvers } = require('./resolvers/index.js');

const typeDefs = fs.readFileSync(path.join(__dirname, './scheme.graphql'), 'utf8');

const server = new ApolloServer({
  typeDefs,
  resolvers
});

(async () => {
  await mongoose.connect('mongodb://root:root@localhost:27017/todoapp', {
    authSource: 'admin'
  });
  console.log('MongoDB verbunden');

  const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 }
  });

  console.log(`Server läuft auf ${url}`);
})();