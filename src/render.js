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
      <div class="vocabulary" style="--rows:${Math.ceil(page.vocabulary.length / 4)}" data-check="vocabulary grid" aria-label="Vocabulary">
        ${page.vocabulary.map((item) => `
          <article class="card" data-check="${escapeHtml(item.id)}">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.english)}" data-check="${escapeHtml(item.id)} image">
            <h2 lang="es" data-check="${escapeHtml(item.id)} Spanish">${escapeHtml(item.spanish)}</h2>
            <p data-check="${escapeHtml(item.id)} English">${escapeHtml(item.english)}</p>
          </article>`).join('')}
      </div>
      <section class="phrases" data-check="phrases" aria-label="Useful sentences">
        ${page.phrases.map((phrase, phraseIndex) => `
          <div class="phrase" data-check="phrase ${phraseIndex + 1}">
            <p class="spanish" lang="es" data-check="phrase ${phraseIndex + 1} Spanish">${escapeHtml(phrase.spanish)}</p>
            <p class="english" data-check="phrase ${phraseIndex + 1} English">${escapeHtml(phrase.english)}</p>
          </div>`).join('')}
      </section>
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
      for (const selector of ['.vocabulary', '.phrases']) {
        const items = [...sheet.querySelector(selector).children];
        for (let i = 0; i < items.length; i++) {
          const first = items[i].getBoundingClientRect();
          for (let j = i + 1; j < items.length; j++) {
            const second = items[j].getBoundingClientRect();
            if (Math.min(first.right, second.right) - Math.max(first.left, second.left) > tolerance &&
                Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) > tolerance) {
              errors.push(`page ${index + 1}: ${items[i].dataset.check} overlaps ${items[j].dataset.check}`);
            }
          }
        }
      }
    });
    return errors;
  });
  if (errors.length) {
    throw new Error(`${id}: layout failed:\n${errors.join('\n')}`);
  }
}
