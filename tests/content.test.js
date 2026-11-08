import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { stringify } from 'yaml';
import { loadSheet, loadSheets, parseSheet, projectRoot, readImage } from '../src/content.js';
import { escapeHtml, renderSheet } from '../src/render.js';

const source = await readFile(path.join(projectRoot, 'examples/new-sheet.yaml'), 'utf8');
const example = parseSheet(source, 'example.yaml');

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'spanish-content-test-'));
  t.after(() => rm(root, { recursive: true }));
  await mkdir(path.join(root, 'content/sheets'), { recursive: true });
  await cp(path.join(projectRoot, 'assets/images'), path.join(root, 'assets/images'), { recursive: true });
  return root;
}

test('starter topics have 12 vocabulary items, four phrases, and two pages each', async () => {
  const sheets = await loadSheets();
  assert.deepEqual(sheets.map((sheet) => sheet.id),
    ['refrigerator', 'kitchen', 'bathroom', 'bedroom', 'living-room', 'office']);
  for (const sheet of sheets) {
    assert.equal(sheet.pages.length, 2);
    assert.equal(sheet.pages.flatMap((page) => page.vocabulary).length, 12);
    assert.equal(sheet.pages.flatMap((page) => page.phrases).length, 4);
    assert.ok(sheet.pages.every((page) => page.vocabulary.every((item) => item.image.startsWith('data:image/svg+xml;base64,'))));
  }
});

test('schema reports the field, rejects empty text, unknown fields, invalid IDs, and reserved names', () => {
  for (const [change, pattern] of [
    [(sheet) => { sheet.title = ' '; }, /title/],
    [(sheet) => { sheet.id = '../other'; }, /id/],
    [(sheet) => { sheet.id = 'all-sheets'; }, /Reserved output name/],
    [(sheet) => { sheet.extra = true; }, /Unrecognized key/],
    [(sheet) => { sheet.pages[0].vocabulary[0].english = false; }, /pages.0.vocabulary.0.english/],
  ]) {
    const sheet = structuredClone(example);
    change(sheet);
    assert.throws(() => parseSheet(stringify(sheet), 'bad.yaml'), pattern);
  }
});

test('limits reject excess pages, vocabulary, phrases, and duplicate vocabulary IDs', () => {
  for (const [change, pattern] of [
    [(sheet) => { sheet.pages = Array(3).fill(sheet.pages[0]); }, /pages: Too big/],
    [(sheet) => { sheet.pages[0].vocabulary = Array(9).fill(sheet.pages[0].vocabulary[0]); }, /vocabulary: Too big/],
    [(sheet) => { sheet.pages[0].phrases = Array(4).fill(sheet.pages[0].phrases[0]); }, /phrases: Too big/],
    [(sheet) => { sheet.pages[0].vocabulary[1].id = 'book'; }, /duplicate vocabulary id/],
    [(sheet) => { sheet.pages = []; }, /pages: Too small/],
    [(sheet) => { sheet.pages[0].vocabulary = []; }, /vocabulary: Too small/],
  ]) {
    const sheet = structuredClone(example);
    change(sheet);
    assert.throws(() => parseSheet(stringify(sheet), 'bad.yaml'), pattern);
  }
});

test('malformed YAML and duplicate keys report filename', () => {
  assert.throws(() => parseSheet('pages: [', 'broken.yaml'), /broken.yaml/);
  assert.throws(() => parseSheet('id: one\nid: two\n', 'duplicate.yaml'), /duplicate.yaml/);
});

test('local assets reject missing, empty, unsupported, absolute, traversal, and escaping symlink paths', async (t) => {
  const root = await fixture(t);
  const images = path.join(root, 'assets/images');
  await writeFile(path.join(images, 'empty.svg'), '');
  await symlink(path.join(root, 'content'), path.join(images, 'outside'));
  for (const [reference, pattern] of [
    ['missing.svg', /ENOENT/],
    ['empty.svg', /empty/],
    ['book.gif', /Unsupported image format/],
    ['/tmp/image.svg', /relative path/],
    ['../book.svg', /escapes/],
    ['..\\book.svg', /relative path/],
    ['outside/photo.svg', /ENOENT/],
  ]) {
    await assert.rejects(readImage(reference, root), pattern);
  }
  await writeFile(path.join(root, 'content/photo.svg'), '<svg/>');
  await assert.rejects(readImage('outside/photo.svg', root), /symlink escapes/);
  assert.match(await readImage('book.svg', root), /^data:image\/svg\+xml;base64,/);
});

test('load errors identify topic file, page, and vocabulary item', async (t) => {
  const root = await fixture(t);
  const sheet = structuredClone(example);
  sheet.pages[0].vocabulary[0].image = 'missing.svg';
  const filename = path.join(root, 'content/sheets/broken.yaml');
  await writeFile(filename, stringify(sheet));
  await assert.rejects(loadSheet(filename, root), /broken.yaml: page 1, book:.*ENOENT/);
});

test('output order is filename order; empty directories and duplicate topic IDs fail', async (t) => {
  const root = await fixture(t);
  await assert.rejects(loadSheets(root), /No YAML sheets/);
  const first = structuredClone(example);
  first.id = 'first';
  const second = structuredClone(example);
  second.id = 'second';
  const directory = path.join(root, 'content/sheets');
  await writeFile(path.join(directory, '02-second.yml'), stringify(second));
  await writeFile(path.join(directory, '01-first.yaml'), stringify(first));
  assert.deepEqual((await loadSheets(root)).map((sheet) => sheet.id), ['first', 'second']);
  second.id = 'first';
  await writeFile(path.join(directory, '02-second.yml'), stringify(second));
  await assert.rejects(loadSheets(root), /duplicate sheet id "first"/);
});

test('HTML escapes all content and preserves Spanish accents', () => {
  assert.equal(escapeHtml('<>&"\''), '&lt;&gt;&amp;&quot;&#39;');
  const sheet = structuredClone(example);
  sheet.title = '<script>alert("test")</script>';
  sheet.pages[0].vocabulary[0].spanish = 'el libro & el lápiz';
  sheet.pages[0].vocabulary[0].english = '" onerror="alert(1)';
  const html = renderSheet(sheet);
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /el libro &amp; el lápiz/);
  assert.ok(!html.includes('alt="" onerror='));
});
