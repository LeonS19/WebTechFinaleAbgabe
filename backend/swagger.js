const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'WebTech API',
      version: '1.0.0',
      description: 'Dokumentation der Express-API',
    },
    servers: [
      { url: 'http://localhost:3000' },
    ],
  },
  apis: ['./app.js'], // Dateien mit @openapi Kommentaren
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;