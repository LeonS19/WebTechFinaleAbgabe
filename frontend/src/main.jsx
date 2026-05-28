import React from 'react'
import ReactDOM from 'react-dom/client'
import { ApolloProvider } from '@apollo/client/react'
import { client } from './apolloClient'
import { TodoList } from './components/ToDoList'
import './index.css'

// Service Worker registrieren
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <TodoList />
    </ApolloProvider>
  </React.StrictMode>,
)