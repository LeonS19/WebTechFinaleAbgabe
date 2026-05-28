import { ApolloClient, InMemoryCache, split, HttpLink } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';

// Direkte Backend-URLs (nicht durch Proxy)
const BACKEND_URL = 'http://localhost:4000/graphql';
const BACKEND_WS = 'ws://localhost:4000/graphql';

const httpLink = new HttpLink({ uri: BACKEND_URL });

const wsLink = new GraphQLWsLink(
  createClient({ 
    url: BACKEND_WS,
    connectionParams: {},
    shouldRetry: () => true
  })
);

export const client = new ApolloClient({
  link: split(
    ({ query }) => {
      const def = getMainDefinition(query);
      return def.kind === 'OperationDefinition' && def.operation === 'subscription';
    },
    wsLink,
    httpLink
  ),
  cache: new InMemoryCache()
});