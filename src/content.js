import { readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { z } from 'zod';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const text = z.string().trim().min(1);
const identifier = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);

export const sheetSchema = z.strictObject({
  id: identifier.refine((value) => value !== 'all-sheets', 'Reserved output name'),
  title: text,
  subtitle: text,
  pages: z.array(z.strictObject({
    vocabulary: z.array(z.strictObject({
      id: identifier,
      spanish: text,
      english: text,
      image: text,
    })).min(1).max(16),
    phrases: z.array(z.strictObject({
      spanish: text,
      english: text,
    })).min(6).max(12),
  })).min(1).max(2),
});

const imageTypes = new Map([
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
]);

export function parseSheet(source, filename) {
  const document = parseDocument(source);
  if (document.errors.length) {
    throw new Error(`${filename}: ${document.errors.map((error) => error.message).join('; ')}`);
  }
  let data;
  try {
    data = document.toJS({ maxAliasCount: 20 });
  } catch (error) {
    throw new Error(`${filename}: ${error.message}`, { cause: error });
  }
  const result = sheetSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`${filename}: ${result.error.issues.map((issue) =>
      `${issue.path.join('.') || 'sheet'}: ${issue.message}`).join('; ')}`);
  }
  const ids = new Set();
  for (const [pageIndex, page] of result.data.pages.entries()) {
    for (const item of page.vocabulary) {
      if (ids.has(item.id)) {
        throw new Error(`${filename}: page ${pageIndex + 1}: duplicate vocabulary id "${item.id}"`);
      }
      ids.add(item.id);
    }
  }
  return result.data;
}

function isInside(directory, filename) {
  const relative = path.relative(directory, filename);
  return relative !== '' && relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export async function readImage(reference, root = projectRoot) {
  const directory = await realpath(path.join(root, 'assets/images'));
  if (path.isAbsolute(reference) || reference.includes('\\')) {
    throw new Error(`Image must be a relative path inside assets/images: "${reference}"`);
  }
  const requested = path.resolve(directory, reference);
  if (!isInside(directory, requested)) {
    throw new Error(`Image path escapes assets/images: "${reference}"`);
  }
  const mime = imageTypes.get(path.extname(reference).toLowerCase());
  if (!mime) {
    throw new Error(`Unsupported image format: "${reference}" (use SVG, PNG, or JPEG)`);
  }
  const resolved = await realpath(requested);
  if (!isInside(directory, resolved)) {
    throw new Error(`Image symlink escapes assets/images: "${reference}"`);
  }
  const bytes = await readFile(resolved);
  if (!bytes.length) {
    throw new Error(`Image is empty: "${reference}"`);
  }
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

export async function loadSheet(filename, root = projectRoot) {
  const sheet = parseSheet(await readFile(filename, 'utf8'), filename);
  for (const [pageIndex, page] of sheet.pages.entries()) {
    for (const item of page.vocabulary) {
      try {
        item.image = await readImage(item.image, root);
      } catch (error) {
        throw new Error(`${filename}: page ${pageIndex + 1}, ${item.id}: ${error.message}`, { cause: error });
      }
    }
  }
  return sheet;
}

export async function loadSheets(root = projectRoot) {
  const directory = path.join(root, 'content/sheets');
  const filenames = (await readdir(directory)).filter((name) => /\.ya?ml$/i.test(name)).sort();
  if (!filenames.length) {
    throw new Error(`No YAML sheets found in ${directory}`);
  }
  const sheets = [];
  const ids = new Set();
  for (const filename of filenames) {
    const sheet = await loadSheet(path.join(directory, filename), root);
    if (ids.has(sheet.id)) {
      throw new Error(`${filename}: duplicate sheet id "${sheet.id}"`);
    }
    ids.add(sheet.id);
    sheets.push(sheet);
  }
  return sheets;
}
