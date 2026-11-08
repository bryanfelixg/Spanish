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

  test('every topic PDF has two Letter pages, each with a 4x4 grid and 12 half-width bilingual sentences', async (t) => {
    for (const sheet of await loadSheets()) {
      const page = await pageFor(t, renderSheet(sheet));
      await checkLayout(page, sheet.id);
      const sizes = await page.evaluate(() => ({
        vocabulary: parseFloat(getComputedStyle(document.querySelector('.card h2')).fontSize),
        phrases: parseFloat(getComputedStyle(document.querySelector('.spanish')).fontSize),
        pictures: [...document.images].every((image) => image.naturalWidth > 0),
        pictureHeight: document.querySelector('.card img').getBoundingClientRect().height,
      }));
      assert.equal(sizes.vocabulary, 18);
      assert.equal(sizes.phrases, 18);
      assert.ok(sizes.pictures);
      assert.equal(sizes.pictureHeight, 76);
      for (const [index, sourcePage] of sheet.pages.entries()) {
        const printed = page.locator('.sheet').nth(index);
        const geometry = await printed.evaluate((sheet) => {
          const cards = [...sheet.querySelectorAll('.card')].map((card) => card.getBoundingClientRect());
          const grid = sheet.querySelector('.phrases');
          const phrases = [...grid.children].map((phrase) => phrase.getBoundingClientRect());
          const gap = parseFloat(getComputedStyle(grid).columnGap);
          return {
            vocabularyColumns: new Set(cards.map((card) => card.left)).size,
            vocabularyRows: new Set(cards.map((card) => card.top)).size,
            phraseColumns: new Set(phrases.map((phrase) => phrase.left)).size,
            phraseRows: new Set(phrases.map((phrase) => phrase.top)).size,
            halfWidth: phrases.every((phrase) => Math.abs(phrase.width - (grid.clientWidth - gap) / 2) < 1),
            rowMajor: phrases.every((phrase, i) => i % 2 === 0 || phrase.top === phrases[i - 1].top),
          };
        });
        assert.deepEqual(geometry, {
          vocabularyColumns: 4, vocabularyRows: 4,
          phraseColumns: 2, phraseRows: 6,
          halfWidth: true, rowMajor: true,
        });
        assert.equal(await printed.locator('.card').count(), 16);
        assert.equal(await printed.locator('.phrase .spanish').count(), 12);
        assert.equal(await printed.locator('.phrase .english').count(), 12);
        assert.deepEqual(await printed.locator('.phrase .spanish').allTextContents(),
          sourcePage.phrases.map((phrase) => phrase.spanish));
      }
      assert.equal(await page.locator('header, footer, h1, .phrases h2').count(), 0);
      assert.ok(!(await page.locator('body').innerText()).includes(sheet.title));
      const pdf = await PDFDocument.load(await page.pdf({ preferCSSPageSize: true, printBackground: true }));
      assert.equal(pdf.getPageCount(), 2);
      for (const printed of pdf.getPages()) {
        assert.deepEqual(printed.getSize(), { width: 612, height: 792 });
      }
    }
  });

  test('smaller six-sentence custom pages still use two columns', async (t) => {
    const sheet = (await loadSheets())[0];
    sheet.pages = sheet.pages.slice(0, 1);
    sheet.pages[0].phrases = sheet.pages[0].phrases.slice(0, 6);
    parseSheet(stringify(sheet), 'smaller.yaml');
    const page = await pageFor(t, renderSheet(sheet));
    await checkLayout(page, sheet.id);
    assert.equal(await page.locator('.card img').first().evaluate((image) => image.getBoundingClientRect().height), 76);
    const pdf = await PDFDocument.load(await page.pdf({ preferCSSPageSize: true }));
    assert.equal(pdf.getPageCount(), 1);
  });

  test('two-column English overflow and overlapping phrase cells are rejected', async (t) => {
    const sheet = (await loadSheets())[0];
    sheet.pages[0].phrases[0].english = 'overflow '.repeat(250);
    const page = await pageFor(t, renderSheet(sheet));
    await assert.rejects(checkLayout(page, sheet.id), /layout failed/);
    await page.setContent(renderSheet((await loadSheets())[0]), { waitUntil: 'load' });
    await page.addStyleTag({ content: '.phrase:nth-child(2) { transform: translateX(-200px); }' });
    await assert.rejects(checkLayout(page, sheet.id), /phrase 1 overlaps phrase 2/);
  });

  test('oversized vocabulary and sentences fail actual layout checks with page context', async (t) => {
    for (const field of ['vocabulary', 'phrases']) {
      const sheet = (await loadSheets())[0];
      const longText = 'palabra '.repeat(250);
      if (field === 'vocabulary') sheet.pages[0].vocabulary[0].spanish = longText;
      if (field === 'phrases') sheet.pages[0].phrases[0].spanish = longText;
      const page = await pageFor(t, renderSheet(sheet));
      await assert.rejects(checkLayout(page, sheet.id), /refrigerator: layout failed:\n.*page 1/);
    }
  });

  test('titles remain accessible metadata without consuming printable space', async (t) => {
    const sheet = (await loadSheets())[0];
    sheet.title = 'A long title '.repeat(100);
    sheet.subtitle = 'A long subtitle '.repeat(100);
    const page = await pageFor(t, renderSheet(sheet));
    await checkLayout(page, sheet.id);
    assert.ok((await page.title()).startsWith(sheet.title));
    assert.equal(await page.locator('.sheet').first().getAttribute('aria-label'), `${sheet.title} — page 1`);
    assert.ok(!(await page.locator('body').innerText()).includes('A long title'));
    assert.ok(!(await page.locator('body').innerText()).includes('A long subtitle'));
  });

  test('explicit two-page topics still render correctly with unique vocabulary IDs', async (t) => {
    const sheet = (await loadSheets())[0];
    sheet.pages = sheet.pages.slice(0, 1);
    const second = structuredClone(sheet.pages[0]);
    for (const item of second.vocabulary) item.id = `second-${item.id}`;
    sheet.pages.push(second);
    parseSheet(stringify(sheet), 'two-pages.yaml');
    const page = await pageFor(t, renderSheet(sheet));
    await checkLayout(page, sheet.id);
    assert.equal(await page.locator('.sheet').count(), 2);
    assert.equal(await page.locator('.phrase').count(), 24);
    const pdf = await PDFDocument.load(await page.pdf({ preferCSSPageSize: true }));
    assert.equal(pdf.getPageCount(), 2);
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
