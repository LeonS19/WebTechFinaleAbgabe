// scripts/pwa-check.js
// PWA / Service Worker checks using Puppeteer
// Dependencies: puppeteer
const puppeteer = require('puppeteer');

const FRONTEND = 'http://localhost:8080';
const CACHE_NAME = 'todo-app-v1';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    await page.goto(FRONTEND, { waitUntil: 'networkidle2', timeout: 10000 });

    // 1) Prüfe Service Worker Registration
    const swRegistered = await page.evaluate(() => {
      return navigator.serviceWorker.getRegistration().then(r => !!r).catch(() => false);
    });
    console.log('Service Worker registriert:', swRegistered);

    // 2) Prüfe Cache-Namen
    const cacheKeys = await page.evaluate(() => caches.keys());
    console.log('Caches:', cacheKeys);
    const cachePresent = cacheKeys.includes(CACHE_NAME);
    console.log(`${CACHE_NAME} vorhanden:`, cachePresent);

    // 3) Simuliere Offline und reload -> prüfe, dass App-Shell noch Rendert
    await page.setOfflineMode(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const headingExists = await page.$eval('h1', el => el.textContent.includes('Meine Todos')).catch(() => false);
    console.log('App-Shell offline renderbar (h1 gefunden):', headingExists);

    await browser.close();

    const ok = swRegistered && cachePresent && headingExists;
    if (!ok) {
      console.error('PWA-Checks nicht bestanden');
      process.exit(2);
    }
    console.log('PWA-Checks: OK');
    process.exit(0);
  } catch (err) {
    console.error('Fehler bei PWA-Check:', err);
    await browser.close();
    process.exit(1);
  }
})();
