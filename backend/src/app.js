import express from 'express';
import http from 'http';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
import { readFileSync } from 'fs';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

import { connectPostgres } from './config/db.postgres.js';
import { connectMongo } from './config/db.mongo.js';
import { env } from './config/env.js';

import { authRoutes } from './api/rest/routes/auth.routes.js';
import { authMiddleware } from './api/rest/middleware/auth.middleware.js';
import { fileRoutes } from './api/rest/routes/file.routes.js';
import { createContext } from './graphql/context.js';
import { resolvers } from './graphql/resolvers/index.js';
import { handleChatConnection } from './realtime/handlers/chat.handler.js';
import { ensureMapExists } from './services/map.service.js';

// ============================================
// SCHEMA
// ============================================
const typeDefs = readFileSync('./schema/schema.graphql', 'utf8');
const schema = makeExecutableSchema({ typeDefs, resolvers });

// ============================================
// EXPRESS + HTTP SERVER
// ============================================
const app = express();
const httpServer = http.createServer(app);

// ============================================
// WEBSOCKET SERVER
// ============================================
const wsServer = new WebSocketServer({ noServer: true });
const chatServer = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;

  if (pathname === '/graphql') {
    wsServer.handleUpgrade(request, socket, head, (ws) => {
      wsServer.emit('connection', ws, request);
    });
  } else if (pathname === '/chat') {
    chatServer.handleUpgrade(request, socket, head, (ws) => {
      chatServer.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

const wsServerCleanup = useServer(
  {
    schema,
    context: async (ctx) => {
      const token = ctx.connectionParams?.authorization?.replace('Bearer ', '');
      return createContext({ token });
    },
  },
  wsServer
);

chatServer.on('connection', (ws) => {
  handleChatConnection(ws);
});

// ============================================
// APOLLO SERVER (GraphQL)
// ============================================
const apolloServer = new ApolloServer({
  schema,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await wsServerCleanup.dispose();
          },
        };
      },
    },
  ],
});

await apolloServer.start();

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));

app.use(express.json());

// ============================================
// SWAGGER UI
// ============================================
const swaggerDoc = YAML.load('./docs/openapi.yaml');
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// ============================================
// REST ROUTEN
// ============================================
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/index-cards', authMiddleware, fileRoutes);

app.get('/api/v1/health', async (req, res) => {
  res.json({
    status: 'ok',
    postgres: 'connected',
    mongodb: 'connected',
  });
});

// ============================================
// GRAPHQL ENDPUNKT
// ============================================
app.use(
  '/graphql',
  expressMiddleware(apolloServer, {
    context: async ({ req }) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      return createContext({ token });
    },
  })
);

// ============================================
// FEHLERBEHANDLUNG
// ============================================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'Something went wrong',
  });
});

// ============================================
// EXPORTS — App-Aufbau, kein automatischer Start
// ============================================
export { app, httpServer };

export async function start() {
  await connectPostgres();
  await connectMongo();
  await ensureMapExists();

  return new Promise((resolve) => {
    httpServer.listen(env.PORT, () => {
      console.log(`Server running on http://localhost:${env.PORT}`);
      console.log(`GraphQL:  http://localhost:${env.PORT}/graphql`);
      console.log(`Swagger:  http://localhost:${env.PORT}/api/docs`);
      console.log(`Health:   http://localhost:${env.PORT}/api/v1/health`);
      resolve();
    });
  });
}