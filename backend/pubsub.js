const { PubSub } =  require('graphql-subscriptions');

const pubsub = new PubSub();

const EVENTS = {
  TODO_CREATED: 'TODO_CREATED',
  TODO_UPDATED: 'TODO_UPDATED',
  TODO_DELETED: 'TODO_DELETED'
};

module.exports = { pubsub, EVENTS };