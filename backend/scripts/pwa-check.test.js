// scripts/pwa-check.test.js
// PWA / Service Worker checks using Puppeteer
const FRONTEND = 'http://localhost:8080';
const CACHE_NAME = 'todo-app-v1';

(async () => {
  let browser;

  try {
    const puppeteer = (await import('puppeteer')).default;
    browser = await puppeteer.launch({ headless: 'new' });

    const page = await browser.newPage();

    await page.goto(FRONTEND, { waitUntil: 'networkidle2', timeout: 15000 });

    const swRegistered = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return !!registration;
    });
    console.log('Service Worker registriert:', swRegistered);

    const cacheKeys = await page.evaluate(() => caches.keys());
    console.log('Caches:', cacheKeys);

    const cachePresent = cacheKeys.includes(CACHE_NAME);
    console.log(`${CACHE_NAME} vorhanden:`, cachePresent);

    await page.setOfflineMode(true);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });

    const headingExists = await page
      .$eval('h1', (el) => el.textContent.includes('Meine Todos'))
      .catch(() => false);

    console.log('App-Shell offline renderbar (h1 gefunden):', headingExists);

    const ok = swRegistered && cachePresent && headingExists;
    if (!ok) {
      console.error('PWA-Checks nicht bestanden');
      process.exit(2);
    }

    console.log('PWA-Checks: OK');
    process.exit(0);
  } catch (err) {
    console.error('Fehler bei PWA-Check:', err);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
})();