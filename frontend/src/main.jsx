import React from 'react'
import ReactDOM from 'react-dom/client'
import { ApolloProvider } from '@apollo/client'
import { client } from './apolloClient'
import { TodoList } from './components/ToDoList'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <TodoList />
    </ApolloProvider>
  </React.StrictMode>,
)