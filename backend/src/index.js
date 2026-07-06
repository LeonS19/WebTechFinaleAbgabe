import 'dotenv/config';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { readFileSync } from 'fs';
import { connectMongo } from './config/db.mongo.js';
import { resolvers } from './graphql/resolvers/index.js';
import { createContext } from './graphql/context.js';

const typeDefs = readFileSync('./schema/schema.graphql', 'utf-8');

await connectMongo();

const server = new ApolloServer({ typeDefs, resolvers });

const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
  context: async ({ req }) => createContext({ req }),
});

console.log(`Apollo-Server ready at ${url}`);