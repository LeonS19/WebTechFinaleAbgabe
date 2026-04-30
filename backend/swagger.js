// backend/swagger.js

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

try {
  // Baue den absoluten Pfad zur YAML-Datei
  const filePath = path.join(__dirname, 'docs', 'openapi.yaml');
  
  // Lese den Inhalt der Datei
  const fileContents = fs.readFileSync(filePath, 'utf8');
  
  // Parse den YAML-Inhalt in ein JavaScript-Objekt
  const swaggerSpec = yaml.load(fileContents);
  
  // Exportiere das fertige Objekt
  module.exports = swaggerSpec;

} catch (e) {
  console.error('Fehler beim Laden der Swagger-Spezifikation:', e);
  // Exportiere ein leeres Objekt im Fehlerfall, damit die App nicht abstürzt
  module.exports = {}; 
}