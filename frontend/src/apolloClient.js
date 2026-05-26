import { ApolloClient, InMemoryCache, split, HttpLink } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';

const httpLink = new HttpLink({ uri: 'http://localhost:4000/graphql' });
const wsLink = new GraphQLWsLink(createClient({ url: 'ws://localhost:4000/graphql' }));

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