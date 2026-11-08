import { readFile } from 'node:fs/promises';

const stylesheet = await readFile(new URL('./sheet.css', import.meta.url), 'utf8');

export function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

export function renderSheet(sheet) {
  const pages = sheet.pages.map((page, index) => `
    <section class="sheet" aria-label="${escapeHtml(sheet.title)} — page ${index + 1}">
      <header data-check="title">
        <h1 lang="es">${escapeHtml(sheet.title)}</h1>
        <p>${escapeHtml(sheet.subtitle)}</p>
      </header>
      <div class="vocabulary" style="--rows:${Math.ceil(page.vocabulary.length / 2)}" data-check="vocabulary grid">
        ${page.vocabulary.map((item) => `
          <article class="card" data-check="${escapeHtml(item.id)}">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.english)}" data-check="${escapeHtml(item.id)} image">
            <h2 lang="es" data-check="${escapeHtml(item.id)} Spanish">${escapeHtml(item.spanish)}</h2>
            <p data-check="${escapeHtml(item.id)} English">${escapeHtml(item.english)}</p>
          </article>`).join('')}
      </div>
      <section class="phrases" data-check="phrases">
        <h2>Frases útiles <span lang="en">/ Useful phrases</span></h2>
        ${page.phrases.map((phrase, phraseIndex) => `
          <div class="phrase" data-check="phrase ${phraseIndex + 1}">
            <p class="spanish" lang="es" data-check="phrase ${phraseIndex + 1} Spanish">${escapeHtml(phrase.spanish)}</p>
            <p class="english" data-check="phrase ${phraseIndex + 1} English">${escapeHtml(phrase.english)}</p>
          </div>`).join('')}
      </section>
      <footer data-check="footer"><span>Español en casa · Spanish at home</span><span>${index + 1} / ${sheet.pages.length}</span></footer>
    </section>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(sheet.title)} — Spanish at home</title>
<style>${stylesheet}</style></head><body>${pages}</body></html>`;
}

export async function checkLayout(page, id) {
  try {
    await page.evaluate(async () => {
      await document.fonts.ready;
      const sheets = [...document.querySelectorAll('.sheet')];
      await Promise.all([...document.images].map(async (image) => {
        const location = `page ${sheets.indexOf(image.closest('.sheet')) + 1}, ${image.dataset.check}`;
        try {
          await image.decode();
        } catch {
          throw new Error(`${location}: Unable to decode image: ${image.alt}`);
        }
        if (!image.naturalWidth || !image.naturalHeight) {
          throw new Error(`${location}: Image has no dimensions: ${image.alt}`);
        }
      }));
    });
  } catch (error) {
    throw new Error(`${id}: image/font readiness failed: ${error.message}`, { cause: error });
  }
  const errors = await page.evaluate(() => {
    const errors = [];
    const tolerance = 1;
    document.querySelectorAll('.sheet').forEach((sheet, index) => {
      const outer = sheet.getBoundingClientRect();
      const style = getComputedStyle(sheet);
      const bounds = {
        left: outer.left + parseFloat(style.paddingLeft),
        right: outer.right - parseFloat(style.paddingRight),
        top: outer.top + parseFloat(style.paddingTop),
        bottom: outer.bottom - parseFloat(style.paddingBottom),
      };
      sheet.querySelectorAll('[data-check]').forEach((element) => {
        const rect = element.getBoundingClientRect();
        const label = `page ${index + 1}, ${element.dataset.check}`;
        if (rect.left < bounds.left - tolerance || rect.right > bounds.right + tolerance ||
            rect.top < bounds.top - tolerance || rect.bottom > bounds.bottom + tolerance) {
          errors.push(`${label}: outside printable bounds`);
        }
        if (element.scrollWidth > element.clientWidth + tolerance ||
            element.scrollHeight > element.clientHeight + tolerance) {
          errors.push(`${label}: content overflow`);
        }
        const parent = element.closest('.card, .phrase');
        if (parent && parent !== element) {
          const container = parent.getBoundingClientRect();
          if (rect.bottom > container.bottom + tolerance || rect.right > container.right + tolerance ||
              rect.left < container.left - tolerance || rect.top < container.top - tolerance) {
            errors.push(`${label}: outside its card/phrase`);
          }
        }
      });
      const sections = [...sheet.children].map((element) => element.getBoundingClientRect());
      for (let i = 1; i < sections.length; i++) {
        if (sections[i].top < sections[i - 1].bottom - tolerance) {
          errors.push(`page ${index + 1}: sections overlap`);
        }
      }
    });
    return errors;
  });
  if (errors.length) {
    throw new Error(`${id}: layout failed:\n${errors.join('\n')}`);
  }
}
