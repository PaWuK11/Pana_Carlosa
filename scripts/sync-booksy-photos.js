#!/usr/bin/env node
/**
 * Sync the site gallery from the public Booksy listing.
 * Photos stay on Booksy's CDN — nothing is stored under images/booksy/
 * except a small URL manifest.
 *
 *   node scripts/sync-booksy-photos.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const OUT_DIR = path.join(ROOT, 'images', 'booksy');
const BOOKSY_URL =
  'https://booksy.com/pl-pl/185319_pana-carlosa_barber-shop_13750_wroclaw';
const CATS = ['service_photos', 'inspiration', 'biz_photo', 'resource_photos'];
const START = '<!-- booksy-gallery:start -->';
const END = '<!-- booksy-gallery:end -->';
const CAPTION = {
  service_photos: { pl: 'Realizacja', en: 'Our work' },
  inspiration: { pl: 'Inspiracja', en: 'Inspiration' },
  biz_photo: { pl: 'Salon', en: 'Shop' },
  resource_photos: { pl: 'Salon', en: 'Shop' }
};

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchText(res.headers.location).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`GET ${url} → ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      })
      .on('error', reject);
  });
}

function extractItems(html) {
  const unescaped = html.replace(/\\u002F/g, '/').replace(/\\\//g, '/');
  const re =
    /d375139ucebi94\.cloudfront\.net\/region2\/pl\/185319\/(biz_photo|inspiration|service_photos|review_photos|resource_photos|logo)\/([a-zA-Z0-9._-]+\.jpe?g)/g;
  const byCat = Object.fromEntries(CATS.map((c) => [c, new Set()]));
  for (const m of unescaped.matchAll(re)) {
    const cat = m[1];
    if (!byCat[cat]) continue;
    byCat[cat].add(
      `https://d375139ucebi94.cloudfront.net/region2/pl/185319/${cat}/${m[2]}`
    );
  }
  const items = [];
  for (const cat of CATS) {
    for (const src of [...byCat[cat]].sort()) {
      items.push({ src, cat, file: path.basename(src) });
    }
  }
  return items;
}

function mosaicClass(i) {
  return i < 6 ? ` gal__item--${'abcdef'[i]}` : '';
}

function buildGalleryBlock(items) {
  const figures = items
    .map((item, i) => {
      const cap = CAPTION[item.cat] || CAPTION.service_photos;
      const loading = i < 6 ? 'eager' : 'lazy';
      return [
        `      <figure class="gal__item${mosaicClass(i)}">`,
        `        <img src="${item.src}" alt="${cap.pl}" loading="${loading}" decoding="async" referrerpolicy="no-referrer">`,
        `        <figcaption><span data-en="${cap.en}">${cap.pl}</span><svg class="ico"><use href="#i-plus"/></svg></figcaption>`,
        `      </figure>`
      ].join('\n');
    })
    .join('\n');

  const extra = Math.max(0, items.length - 6);
  const moreBtn =
    extra > 0
      ? [
          `    <div class="gal__more">`,
          `      <button type="button" class="btn btn--dark" id="galMore"`,
          `        data-en-more="Show all ${items.length} photos"`,
          `        data-en-less="Show less"`,
          `        data-pl-more="Pokaż wszystkie ${items.length} zdjęć"`,
          `        data-pl-less="Pokaż mniej"`,
          `        aria-expanded="false">`,
          `        Pokaż wszystkie ${items.length} zdjęć`,
          `      </button>`,
          `    </div>`
        ].join('\n')
      : '';

  return [
    START,
    `      <p class="section-head__sub" data-en="A selection from our Booksy portfolio.">`,
    `        Wybór z naszego portfolio na Booksy.`,
    `      </p>`,
    `    </header>`,
    ``,
    `    <div class="gal__grid" data-reveal>`,
    figures,
    `    </div>`,
    moreBtn,
    END
  ].join('\n');
}

function patchIndex(block) {
  let html = fs.readFileSync(INDEX, 'utf8');
  if (!html.includes(START) || !html.includes(END)) {
    throw new Error('Gallery markers missing in index.html');
  }
  const next = html.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);
  if (next === html && !html.includes(block)) {
    throw new Error('Could not replace booksy-gallery markers in index.html');
  }
  fs.writeFileSync(INDEX, next);
}

function clearLocalPhotos() {
  if (!fs.existsSync(OUT_DIR)) return 0;
  let removed = 0;
  for (const name of fs.readdirSync(OUT_DIR)) {
    if (name === 'manifest.json') continue;
    const dest = path.join(OUT_DIR, name);
    if (!fs.statSync(dest).isFile()) continue;
    fs.unlinkSync(dest);
    removed++;
  }
  return removed;
}

async function main() {
  console.log('Fetching Booksy page…');
  const items = extractItems(await fetchText(BOOKSY_URL));
  if (!items.length) throw new Error('No Booksy portfolio photos found');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify(items, null, 2) + '\n'
  );

  patchIndex(buildGalleryBlock(items));
  const removed = clearLocalPhotos();

  console.log(`Gallery: ${items.length} photos from Booksy (CDN, not stored locally).`);
  if (removed) console.log(`Removed ${removed} local copies from images/booksy/.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
