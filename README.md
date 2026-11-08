# Spanish at home

Illustrated wall sheets for an English-speaking adult beginning Latin American
Spanish. Put each topic near the objects it describes and practice saying the
words and phrases during daily routines.

The starter set covers **refrigerator, kitchen, bathroom, bedroom, living room,
and office**: two US Letter portrait pages per topic, each with 16 vocabulary
items in a **4×4 grid** and **12 bilingual sentences in two columns**. Each word
has its Spanish article, English meaning, and an original illustration.
That is 32 distinct vocabulary labels and 24 sentences per topic, or 192
vocabulary entries and 144 sentences across the set (some everyday words recur
across rooms). There are no pronunciation guides or audio in this
release. Visible headers, footers, section labels, and decorative card borders
are omitted so the printable area is devoted to learning content. The combined
starter PDF has 12 pages.

## Quick start

Install **Node.js 20 or newer** and npm. From this directory:

```sh
npm ci
npm run setup:browser
npm run build
```

The first two commands need internet access to install packages and Chromium.
Subsequent builds run locally without a hosted service, API key, or paid tool.
Playwright is pinned to a version compatible with Node 20.0; when upgrading it,
check Node compatibility, reinstall its browser, and run the tests.

Open [dist/index.html](./dist/index.html) after building:

- `dist/html/<topic-id>.html`: self-contained previews with embedded pictures.
- `dist/pdf/<topic-id>.pdf`: individual topic PDFs.
- [dist/pdf/all-sheets.pdf](./dist/pdf/all-sheets.pdf): the complete printable set.

Print the PDFs on **US Letter, portrait, actual size / 100%**. Do not add printer
headers or footers. Pages have a 0.45-inch margin; check your printer's printable
area. White backgrounds, dark outlines, and restrained accents work in color or
grayscale. Print single-sided to display both pages of a topic together.

## Project layout

```text
content/sheets/       One YAML file per topic; filename order is print order
assets/images/       Original SVGs and your replacement SVG/PNG/JPEG pictures
examples/            Copyable starter example; excluded from normal builds
src/                 Shared validation, print template, CSS, and build code
tests/               Content, image, layout, and PDF-output tests
dist/                Generated previews and PDFs (ignored by Git)
```

Edit source content and images, **not generated output**. A successful build
replaces `dist/`, including removing outputs for deleted topics. Failed validation
or rendering leaves the previous successful output intact. Temporary build
directories are cleaned up; an output rollback failure preserves its backup
rather than discarding the last good files. Do not run simultaneous builds in the
same directory.

## Edit vocabulary and phrases

Open a topic such as [01-refrigerator.yaml](./content/sheets/01-refrigerator.yaml).
The structure is:

```yaml
id: refrigerator
title: El refrigerador
subtitle: Refrigerator · Food and drinks
pages:
  - vocabulary:
      - id: milk
        spanish: la leche
        english: milk
        image: milk.svg
    phrases:
      - spanish: "¿Hay leche en el refrigerador?"
        english: "Is there milk in the refrigerator?"
```

This short snippet illustrates the fields, not a valid complete page (at least
six sentences are required); starter sheets contain 16 vocabulary items and 12
sentences in each page group. Preserve indentation with spaces.
Quote text containing `: ` or `#`, and preserve accents and inverted Spanish
question/exclamation marks.

- `id`: unique lowercase, hyphen-separated topic identifier; controls output
  filenames. Use letters and digits, beginning with a letter. `all-sheets` is reserved.
- `title`: browser title, accessible page label, and topic name in the preview index;
  not printed on the sheet. `subtitle`: descriptive source metadata, also not printed.
- `pages`: one or two explicit page groups, in display order.
- `vocabulary`: one to 16 items per page, arranged in four columns (four rows for
  16 items). Each needs an `id`, `spanish`,
  `english`, and `image`; vocabulary IDs must be unique within the topic.
- `phrases`: six to 12 Spanish/English sentence pairs per page; starter pages use
  12. Each pair occupies half the page width. Read left to right across a row,
  then move to the next row. All sentences must pass actual layout checks.
- `image`: a path relative to `assets/images/`, not to the YAML file.

Each starter topic now has **two pages with 16 items and 12 sentences each**.
Page one preserves the previous 16 vocabulary items; page two adds 16 different
items for the same location. Phrases on both pages have been reviewed and
simplified for beginners. Shared household items reuse illustrations across
rooms. The copyable example remains a single complete 16-item, 12-sentence page.
Keep sentences functional: asking for an item, checking supplies, finding objects,
or describing a routine.

The compact layout uses fixed 18px Spanish labels/sentences, 13px English
vocabulary meanings, 14px English sentence translations, and 76px image boxes.
Text can wrap normally, but never auto-shrinks. This prioritizes density over
the first version's larger type; read these sheets at close range.

Run:

```sh
npm run validate
npm run build
```

Validation checks schema fields, IDs, page/item limits, local image paths, actual
image decoding, and browser-measured print layout. Builds also verify PDF page
counts. Overlong content **fails explicitly** with topic/page context rather than
being silently clipped, reduced to tiny text, or spread onto extra pages.
Shorten the text, move it to the other page, or create another topic.

## Add or replace pictures

1. Put a local `.svg`, `.png`, `.jpg`, or `.jpeg` file in
   [assets/images/](./assets/images/). Subfolders and filenames with spaces are
   supported. Use your own pictures or images you have permission to use.
2. Change the item's `image`, for example `image: my-photos/milk.jpg`.
3. Run `npm run build`.

Pictures are centered and scaled proportionally into their card, never stretched
or cropped. Prefer a single recognizable object, a plain/transparent background,
and a tightly trimmed image; very wide pictures will look smaller. Use standalone
SVGs without external fonts/assets. SVGs are loaded as images, not injected into
the page. Unsupported formats, empty or missing files, corrupt images, paths
outside the image directory, and escaping symlinks are rejected.

The **159 included SVG illustrations are original, simple editable drawings
created for this project**, not stock images, AI-generated photos, or a downloaded
icon pack. They need no external image-generation service. Their consistent
outlines and soft fills are defined directly in each SVG; edit them in an SVG
editor or replace them with photos. No third-party artwork attribution is needed
for the included drawings. No repository-wide license is selected yet; choose one
before publishing if you want to specify reuse terms.

## Add a topic

Copy [examples/new-sheet.yaml](./examples/new-sheet.yaml) into
`content/sheets/`, for example:

```sh
cp examples/new-sheet.yaml content/sheets/07-reading-corner.yaml
```

Change its ID, title, vocabulary, and phrases. Reuse any existing image by its
filename or add your own. Add a second page group if needed; you never need to
change renderer code just to add content. Filenames are sorted lexicographically,
so two-digit numeric prefixes give a clear combined-PDF order. Both `.yaml` and
`.yml` are accepted. The example is a complete 4×4, 12-sentence one-page topic.

## Language conventions

The starter vocabulary leans toward common Mexican/Latin American household terms:
`refrigerador`, `jugo`, `estufa`, `clóset`, `cobija`, and `computadora`. Latin America
is not uniform: words like `gancho`, `pijama`, `bolígrafo`, and `audífonos` vary by
country. `Limón` can refer to a lemon or a lime depending on the region; the
illustration and translation show both. Edit terms to match the learner's community.

Articles are part of each vocabulary label. **Agua is feminine**, although the
singular is `el agua` because its initial stressed *a* takes `el`; an adjective
still agrees in the feminine, for example `el agua fría`. Plural labels such as
`los huevos` show a useful everyday form rather than forcing everything into the
singular.

### Beginner phrase guidelines

The current sentences use short, single-clause patterns, with no past tense,
subjunctive, idioms, multi-clause alternatives, or attached object pronouns:

- `¿Hay leche?` / `No hay papel.` — checking supplies.
- `¿Dónde está el cepillo?` — finding an object (`están` for plural objects).
- `Necesito una toalla.` / `Quiero agua, por favor.` — simple needs and requests.
- `La taza está en la mesa.` — location; `está fría/limpia` for a simple state.
- `¿Me pasas el queso?` — a common request to learn as a complete phrase.

Present-tense routines (`Uso...`, `Escribo...`, `Me lavo...`), common likes
(`Me gustan las uvas.`), and informal singular (`tú`) requests such as
`Abre la ventana, por favor.` are included as reusable beginner chunks.
Present-tense conjugations, reflexive forms, and irregular commands may still
need a short explanation; beginners are not expected to derive their grammar
from the sheet. This is an editorial beginner review, not formal CEFR certification.

Keep new examples around eight Spanish words or fewer, tied to visible vocabulary.
Avoid making them complex just to mention more items. The tests enforce a few
editorial regression checks (length and removed constructions); they cannot
determine proficiency level or replace a language review.

The sheets are not a grammar course or a safety manual.
Use the vocabulary grid for recognition, then say one sentence aloud while
performing the matching routine; swap in phrases relevant to the learner.

## Tests and troubleshooting

```sh
npm test
```

Tests cover validation failures, HTML escaping, asset path boundaries, decoding
SVG/PNG/JPEG images, actual 4×4 vocabulary grids and half-width sentence geometry,
12 sentences per starter page, beginner editorial regression checks,
absence of printed headings/footers, maximum page density, overflow rejection, Letter dimensions,
PDF page counts, offline previews, failed-build preservation, stale-output
removal, and building the copyable example. The tests use temporary fixture
directories rather than changing your topic files or `dist/`.

- **Browser executable missing:** run `npm run setup:browser` again, especially
  after updating Playwright. On Linux, Chromium may also need OS libraries;
  consult Playwright's installation guidance before installing system packages.
- **YAML error:** use spaces, check indentation/required fields, and quote strings
  with YAML punctuation. The error identifies the file and field.
- **Image error:** check spelling/case, format, and path relative to
  `assets/images/`; rebuild after replacing an image.
- **Layout error:** shorten labels/phrases or redistribute page content. The
  maximum item count does not guarantee that arbitrary long text will fit.
- **Want a different page size or visual layout:** edit
  [src/sheet.css](./src/sheet.css) and update the Letter-size assertions in
  [tests/render.test.js](./tests/render.test.js), then run tests and visually check
  output. Browser typography can differ slightly between operating systems.
- **Preview printing looks different:** print the generated PDF for the
  validated page layout. If printing HTML directly, select Letter and turn off
  browser headers/footers.

This directory is already a Git repository. Generated files and installed
dependencies are ignored; source YAML, illustrations, code, tests, and the npm
lockfile are intended for version control. No remote or commit is created by
the build commands.
