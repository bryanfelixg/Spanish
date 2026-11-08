import { chromium } from 'playwright';
import { loadSheets } from './content.js';
import { checkLayout, renderSheet } from './render.js';

let browser;
try {
  const sheets = await loadSheets();
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.emulateMedia({ media: 'print' });
  for (const sheet of sheets) {
    await page.setContent(renderSheet(sheet), { waitUntil: 'load' });
    await checkLayout(page, sheet.id);
  }
  console.log(`Validated ${sheets.length} topics: content, images, and printable layout.`);
} catch (error) {
  console.error(`Validation failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
