export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 10000,
  collectCoverage: false, // per Default aus, nur bei --coverage-Flag an
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/scripts/**',      // Seed-Scripts nicht mitzählen
    '!src/server.js',       // reiner Startpunkt, nichts zu testen
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html'], // Konsolen-Ausgabe + HTML-Report zum Anschauen
};