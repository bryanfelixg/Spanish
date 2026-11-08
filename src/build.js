import { access, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { loadSheets, projectRoot } from './content.js';
import { checkLayout, escapeHtml, renderSheet } from './render.js';

async function exists(filename) {
  try {
    await access(filename);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function publish(staging, root) {
  const destination = path.join(root, 'dist');
  const backup = await mkdtemp(path.join(root, '.dist-backup-'));
  const previous = path.join(backup, 'previous');
  let moved = false;
  try {
    if (await exists(destination)) {
      await rename(destination, previous);
      moved = true;
    }
    try {
      await rename(staging, destination);
    } catch (error) {
      if (moved) {
        await rename(previous, destination);
        moved = false;
      }
      throw error;
    }
  } finally {
    // Preserve the backup if rollback itself failed.
    if (!moved || await exists(destination)) {
      await rm(backup, { recursive: true });
    }
  }
}

export async function build(root = projectRoot) {
  const sheets = await loadSheets(root);
  const staging = await mkdtemp(path.join(root, '.dist-build-'));
  let browser;
  try {
    await mkdir(path.join(staging, 'html'));
    await mkdir(path.join(staging, 'pdf'));
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 900, height: 1100 } });
    await page.emulateMedia({ media: 'print' });
    const combined = await PDFDocument.create();
    for (const sheet of sheets) {
      const html = renderSheet(sheet);
      await writeFile(path.join(staging, 'html', `${sheet.id}.html`), html);
      await page.setContent(html, { waitUntil: 'load' });
      await checkLayout(page, sheet.id);
      const bytes = await page.pdf({ preferCSSPageSize: true, printBackground: true });
      const pdf = await PDFDocument.load(bytes);
      if (pdf.getPageCount() !== sheet.pages.length) {
        throw new Error(`${sheet.id}: expected ${sheet.pages.length} PDF pages, got ${pdf.getPageCount()}`);
      }
      for (const copied of await combined.copyPages(pdf, pdf.getPageIndices())) {
        combined.addPage(copied);
      }
      await writeFile(path.join(staging, 'pdf', `${sheet.id}.pdf`), bytes);
    }
    await writeFile(path.join(staging, 'pdf', 'all-sheets.pdf'), await combined.save());
    await writeFile(path.join(staging, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Spanish at home</title>
<style>body{font:18px Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;line-height:1.6}li{margin:12px 0}</style>
</head><body><h1>Spanish at home</h1><p>Print PDFs on US Letter paper at actual size (100%).</p>
<p><a href="pdf/all-sheets.pdf">All sheets — combined PDF</a></p><ul>
${sheets.map((sheet) => `<li>${escapeHtml(sheet.title)}: <a href="html/${sheet.id}.html">preview</a> · <a href="pdf/${sheet.id}.pdf">PDF</a></li>`).join('\n')}
</ul></body></html>`);
    await browser.close();
    browser = undefined;
    await publish(staging, root);
    return { topics: sheets.length, pages: combined.getPageCount() };
  } finally {
    try {
      if (browser) await browser.close();
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await build();
    console.log(`Built ${result.topics} topics / ${result.pages} pages in dist/. Open dist/index.html.`);
  } catch (error) {
    console.error(`Build failed: ${error.message}`);
    process.exitCode = 1;
  }
}
