import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { PDFArray, PDFDocument, PDFRawStream } from 'pdf-lib';
import { stringify } from 'yaml';
import { build } from '../src/build.js';
import { loadSheet, loadSheets, parseSheet, projectRoot } from '../src/content.js';
import { checkLayout, renderSheet } from '../src/render.js';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'spanish-render-test-'));
  t.after(() => rm(root, { recursive: true }));
  await mkdir(path.join(root, 'content/sheets'), { recursive: true });
  await cp(path.join(projectRoot, 'assets/images'), path.join(root, 'assets/images'), { recursive: true });
  return root;
}

function pageStreams(pdf, index) {
  const contents = pdf.getPage(index).node.Contents();
  const references = contents instanceof PDFArray ? contents.asArray() : [contents];
  return references.map((reference) => Buffer.from(pdf.context.lookup(reference, PDFRawStream).getContents()));
}

describe('print renderer', () => {
  let browser;
  before(async () => { browser = await chromium.launch(); });
  after(async () => { if (browser) await browser.close(); });

  async function pageFor(t, html) {
    const page = await browser.newPage();
    t.after(() => page.close());
    await page.emulateMedia({ media: 'print' });
    await page.setContent(html, { waitUntil: 'load' });
    return page;
  }

  test('all starter illustrations decode and PDFs are two Letter pages with readable font sizes', async (t) => {
    for (const sheet of await loadSheets()) {
      const page = await pageFor(t, renderSheet(sheet));
      await checkLayout(page, sheet.id);
      const sizes = await page.evaluate(() => ({
        vocabulary: parseFloat(getComputedStyle(document.querySelector('.card h2')).fontSize),
        phrases: parseFloat(getComputedStyle(document.querySelector('.spanish')).fontSize),
        pictures: [...document.images].every((image) => image.naturalWidth > 0),
        pictureHeight: document.querySelector('.card img').getBoundingClientRect().height,
      }));
      assert.ok(sizes.vocabulary >= 23);
      assert.ok(sizes.phrases >= 20);
      assert.ok(sizes.pictures);
      assert.equal(sizes.pictureHeight, 112);
      const pdf = await PDFDocument.load(await page.pdf({ preferCSSPageSize: true, printBackground: true }));
      assert.equal(pdf.getPageCount(), 2);
      for (const printed of pdf.getPages()) {
        assert.deepEqual(printed.getSize(), { width: 612, height: 792 });
      }
    }
  });

  test('maximum density fits: eight vocabulary items and three phrases per page', async (t) => {
    const sheet = (await loadSheets())[2];
    for (const [pageIndex, group] of sheet.pages.entries()) {
      const originals = [...group.vocabulary];
      while (group.vocabulary.length < 8) {
        const item = structuredClone(originals[group.vocabulary.length - 6]);
        item.id = `extra-${pageIndex}-${group.vocabulary.length}`;
        group.vocabulary.push(item);
      }
      group.phrases.push({ spanish: 'Me cepillo los dientes antes de dormir.', english: 'I brush my teeth before going to sleep.' });
    }
    parseSheet(stringify(sheet), 'maximum.yaml');
    const page = await pageFor(t, renderSheet(sheet));
    await checkLayout(page, sheet.id);
    assert.equal(await page.locator('.card img').first().evaluate((image) => image.getBoundingClientRect().height), 76);
    const pdf = await PDFDocument.load(await page.pdf({ preferCSSPageSize: true }));
    assert.equal(pdf.getPageCount(), 2);
  });

  test('oversized vocabulary, phrases, and titles fail actual layout checks with page context', async (t) => {
    for (const field of ['vocabulary', 'phrases', 'title']) {
      const sheet = (await loadSheets())[0];
      const longText = 'palabra '.repeat(250);
      if (field === 'vocabulary') sheet.pages[0].vocabulary[0].spanish = longText;
      if (field === 'phrases') sheet.pages[0].phrases[0].spanish = longText;
      if (field === 'title') sheet.title = longText;
      const page = await pageFor(t, renderSheet(sheet));
      await assert.rejects(checkLayout(page, sheet.id), /refrigerator: layout failed:\n.*page 1/);
    }
  });

  test('corrupt image bytes fail decoding rather than rendering a placeholder', async (t) => {
    const sheet = (await loadSheets())[0];
    sheet.pages[0].vocabulary[0].image = 'data:image/png;base64,aW52YWxpZA==';
    const page = await pageFor(t, renderSheet(sheet));
    await assert.rejects(checkLayout(page, sheet.id), /refrigerator: image\/font readiness failed:.*page 1, milk image: Unable to decode image: milk/);
  });

  test('PNG and JPEG replacements decode, preserve aspect ratio, and build without a server', async (t) => {
    const root = await fixture(t);
    const imagePage = await browser.newPage({ viewport: { width: 300, height: 100 } });
    t.after(() => imagePage.close());
    await imagePage.setContent('<html><body style="background:#376b70">Local test picture</body></html>');
    await imagePage.screenshot({ path: path.join(root, 'assets/images/photo.png') });
    await imagePage.screenshot({ path: path.join(root, 'assets/images/photo.jpg'), type: 'jpeg' });
    const example = parseSheet(await readFile(path.join(projectRoot, 'examples/new-sheet.yaml'), 'utf8'), 'example.yaml');
    example.pages[0].vocabulary[0].image = 'photo.png';
    example.pages[0].vocabulary[1].image = 'photo.jpg';
    const filename = path.join(root, 'content/sheets/01-example.yaml');
    await writeFile(filename, stringify(example));
    const sheet = await loadSheet(filename, root);
    const page = await pageFor(t, renderSheet(sheet));
    await checkLayout(page, sheet.id);
    assert.equal(await page.locator('.card img').first().evaluate((image) => getComputedStyle(image).objectFit), 'contain');
    assert.equal(await page.locator('.card img').first().evaluate((image) => image.naturalWidth / image.naturalHeight), 3);
    assert.deepEqual(await build(root), { topics: 1, pages: 1 });
  });

  test('build combines sheets in order, creates offline previews, removes stale output, and preserves output after failures', async (t) => {
    const root = await fixture(t);
    await cp(path.join(projectRoot, 'content/sheets'), path.join(root, 'content/sheets'), { recursive: true });
    assert.deepEqual(await build(root), { topics: 6, pages: 12 });
    const combinedFile = path.join(root, 'dist/pdf/all-sheets.pdf');
    const original = await readFile(combinedFile);
    const combined = await PDFDocument.load(original);
    assert.equal(combined.getPageCount(), 12);
    assert.equal((await readdir(path.join(root, 'dist/pdf'))).length, 7);
    let offset = 0;
    for (const sheet of await loadSheets(root)) {
      const individual = await PDFDocument.load(await readFile(path.join(root, 'dist/pdf', `${sheet.id}.pdf`)));
      for (const index of individual.getPageIndices()) {
        assert.deepEqual(pageStreams(combined, offset++), pageStreams(individual, index));
      }
    }
    const page = await browser.newPage();
    t.after(() => page.close());
    const requests = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.goto(pathToFileURL(path.join(root, 'dist/html/refrigerator.html')).href);
    await checkLayout(page, 'offline refrigerator');
    assert.ok(requests.every((url) => url.startsWith('file:') || url.startsWith('data:')));
    await page.goto(pathToFileURL(path.join(root, 'dist/index.html')).href);
    assert.equal(await page.locator('li').count(), 6);
    assert.equal(await page.locator('li a').first().getAttribute('href'), 'html/refrigerator.html');

    const filename = path.join(root, 'content/sheets/01-refrigerator.yaml');
    const sheet = parseSheet(await readFile(filename, 'utf8'), filename);
    sheet.pages[0].phrases[0].spanish = 'palabra '.repeat(250);
    await writeFile(filename, stringify(sheet));
    await assert.rejects(build(root), /layout failed/);
    assert.deepEqual(await readFile(combinedFile), original);
    assert.ok(!(await readdir(root)).some((name) => name.startsWith('.dist-')));

    await rm(filename);
    assert.deepEqual(await build(root), { topics: 5, pages: 10 });
    await assert.rejects(readFile(path.join(root, 'dist/pdf/refrigerator.pdf')), /ENOENT/);
    assert.equal((await PDFDocument.load(await readFile(combinedFile))).getPageCount(), 10);
    assert.ok(!(await readdir(root)).some((name) => name.startsWith('.dist-')));
  });

  test('copyable example builds as an additional topic without modifying renderer code', async (t) => {
    const root = await fixture(t);
    await cp(path.join(projectRoot, 'examples/new-sheet.yaml'), path.join(root, 'content/sheets/07-reading.yaml'));
    assert.deepEqual(await build(root), { topics: 1, pages: 1 });
    const pdf = await PDFDocument.load(await readFile(path.join(root, 'dist/pdf/reading-corner.pdf')));
    assert.equal(pdf.getPageCount(), 1);
  });
});
