# Spanish at home

Illustrated wall sheets for an English-speaking adult beginning Latin American
Spanish. Put each topic near the objects it describes and practice saying the
words and phrases during daily routines.

The starter set covers **refrigerator, kitchen, bathroom, bedroom, living room,
and office**: 12 vocabulary items and four practical phrases per topic, across two
US Letter portrait pages. Each word has its Spanish article, English meaning, and
an original illustration. There are no pronunciation guides or audio in this
release.

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
grayscale. Print single-sided if you want to display both pages at once.

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

This short snippet illustrates the fields; starter sheets contain six vocabulary
items and two phrases in each page group. Preserve indentation with spaces.
Quote text containing `: ` or `#`, and preserve accents and inverted Spanish
question/exclamation marks.

- `id`: unique lowercase, hyphen-separated topic identifier; controls output
  filenames. Use letters and digits, beginning with a letter. `all-sheets` is reserved.
- `title` and `subtitle`: displayed on every page.
- `pages`: one or two explicit page groups, in display order.
- `vocabulary`: one to eight items per page. Each needs an `id`, `spanish`,
  `english`, and `image`; vocabulary IDs must be unique within the topic.
- `phrases`: one to three Spanish/English pairs per page.
- `image`: a path relative to `assets/images/`, not to the YAML file.

The six starter topics use **12 items and four phrases over two pages**. For
expansion, aim for 12–16 items and 4–6 phrases, or use a smaller one-page topic like
the example. Explicit page groups let you keep related items together. Short
labels and phrases make sheets easier to read from a wall.

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

The **72 included SVG illustrations are original, simple editable drawings
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
`.yml` are accepted. The example is a complete smaller one-page topic.

## Language conventions

The starter vocabulary leans toward common Mexican/Latin American household terms:
`refrigerador`, `jugo`, `estufa`, `clóset`, `cobija`, and `computadora`. Latin America
is not uniform: words like `gancho`, `pijama`, `bolígrafo`, and `audífonos` vary by
country. Edit them to match the learner's community.

Articles are part of each vocabulary label. **Agua is feminine**, although the
singular is `el agua` because its initial stressed *a* takes `el`; an adjective
still agrees in the feminine, for example `el agua fría`. Plural labels such as
`los huevos` show a useful everyday form rather than forcing everything into the
singular.

Phrases include polite requests, first-person routines, and informal singular
(`tú`) instructions. They are short examples, not a grammar course or a safety
manual. Use the first page for recognition, then say one phrase aloud while
performing the matching routine; swap in phrases relevant to the learner.

## Tests and troubleshooting

```sh
npm test
```

Tests cover validation failures, HTML escaping, asset path boundaries, decoding
SVG/PNG/JPEG images, maximum page density, overflow rejection, Letter dimensions,
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
