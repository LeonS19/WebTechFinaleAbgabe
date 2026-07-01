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

// TODO Tag 2 – Person A: Google OAuth implementieren
// TODO Tag 2 – Person A: Passkey Registration + Login implementieren
// TODO Tag 2 – Person A: JWT Token Middleware implementieren
import { authRoutes } from './api/rest/routes/auth.routes.js';
import { authMiddleware } from './api/rest/middleware/auth.middleware.js';

// TODO Tag 3 – Person A: File Upload/Download + Berechtigungslogik implementieren
import { fileRoutes } from './api/rest/routes/file.routes.js';

// TODO Tag 2 – Person B: GraphQL Context mit User aus JWT aufbauen
import { createContext } from './graphql/context.js';

// TODO Tag 2 – Person B: Study Group Queries + Mutations implementieren
// TODO Tag 3 – Person B: IndexCard Queries + Mutations implementieren
// TODO Tag 5 – Person B: Run + Kampfsystem Resolvers implementieren
import { resolvers } from './graphql/resolvers/index.js';

// TODO Tag 4 – Person A: WebSocket Server aufsetzen + Chat Nachrichten in MongoDB speichern
// TODO Tag 4 – Person B: Chat Web Component bauen + Echtzeit Updates verdrahten
import { initWebSocket } from './realtime/websocket.js';

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
// WEBSOCKET SERVER (für Chat)
// ============================================
const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql',         // GraphQL Subscriptions laufen hier
});

const wsServerCleanup = useServer(
  {
    schema,
    context: async (ctx) => {
      // Auth Token aus WebSocket Connection Params auslesen
      const token = ctx.connectionParams?.authorization?.replace('Bearer ', '');
      return createContext({ token });
    },
  },
  wsServer
);

// Chat WebSocket läuft auf eigenem Pfad
initWebSocket(httpServer);

// ============================================
// APOLLO SERVER (GraphQL)
// ============================================
const apolloServer = new ApolloServer({
  schema,
  plugins: [
    // Graceful Shutdown für HTTP Server
    ApolloServerPluginDrainHttpServer({ httpServer }),
    // Graceful Shutdown für WebSocket Server
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

// Health Check
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
      console.log('[graphql] authorization header:', req.headers.authorization);
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
// START
// ============================================
async function start() {
  try {
    await connectPostgres();
    await connectMongo();

    httpServer.listen(env.PORT, () => {
      console.log(`Server running on http://localhost:${env.PORT}`);
      console.log(`GraphQL:  http://localhost:${env.PORT}/graphql`);
      console.log(`Swagger:  http://localhost:${env.PORT}/api/docs`);
      console.log(`Health:   http://localhost:${env.PORT}/api/v1/health`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
