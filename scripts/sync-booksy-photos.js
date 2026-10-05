#!/usr/bin/env node
/**
 * Sync gallery photos and testimonials from the public Booksy listing.
 *
 *   node scripts/sync-booksy-photos.js
 *
 * Photos stay on Booksy's CDN. A small blocklist drops shots that are
 * not barber work (meme dog, unrelated selfie).
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
const BOOKSY_API = 'https://pl.booksy.com/core/v2/customer_api/businesses/185319';
/* Public key used by Booksy's own website (not a private secret). */
const BOOKSY_API_KEY = 'web-e3d812bf-d7a2-445d-ab38-55589ae6a121';
const BUSINESS_ID = 185319;
const CATS = ['service_photos', 'inspiration', 'biz_photo', 'resource_photos'];
const GALLERY_START = '<!-- booksy-gallery:start -->';
const GALLERY_END = '<!-- booksy-gallery:end -->';
const REVIEWS_START = '<!-- booksy-reviews:start -->';
const REVIEWS_END = '<!-- booksy-reviews:end -->';
const REVIEW_LIMIT = 24;
const REVIEW_MIN_LEN = 20;
/* Filenames that must never appear in the gallery. */
const BLOCKED_FILES = new Set([
  '0e1e21b9b8c64c50bbf07b7deb5dad24.jpeg', // dog with a fade
  'a98628d8cc0443e3b933151cb61e7db1.jpeg' // unrelated selfie
]);
const CAPTION = {
  service_photos: { pl: 'Realizacja', en: 'Our work' },
  inspiration: { pl: 'Inspiracja', en: 'Inspiration' },
  biz_photo: { pl: 'Salon', en: 'Shop' },
  resource_photos: { pl: 'Salon', en: 'Shop' }
};
const STAR = '<svg class="ico"><use href="#i-star"/></svg>';

function fetchText(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib
      .get(
        url,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            Accept: 'application/json, text/html',
            ...headers
          }
        },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return fetchText(res.headers.location, headers).then(resolve, reject);
          }
          if (res.statusCode !== 200) {
            reject(new Error(`GET ${url} → ${res.statusCode}`));
            return;
          }
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        }
      )
      .on('error', reject);
  });
}

function fetchJson(url) {
  return fetchText(url, {
    'X-Api-Key': BOOKSY_API_KEY,
    Accept: 'application/json'
  }).then((body) => JSON.parse(body));
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
      `https://d375139ucebi94.cloudfront.net/region2/pl/${BUSINESS_ID}/${cat}/${m[2]}`
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

function dropBlocked(items) {
  return items.filter((i) => !BLOCKED_FILES.has(i.file));
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
    GALLERY_START,
    `      <p class="section-head__sub" data-en="A selection from our Booksy portfolio.">`,
    `        Wybór z naszego portfolio na Booksy.`,
    `      </p>`,
    `    </header>`,
    ``,
    `    <div class="gal__grid" data-reveal>`,
    figures,
    `    </div>`,
    moreBtn,
    GALLERY_END
  ].join('\n');
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initials(name) {
  const letters = String(name || '')
    .replace(/[^\p{L}\s]/gu, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!letters.length) return 'PC';
  if (letters.length === 1) return letters[0].slice(0, 2).toUpperCase();
  return (letters[0][0] + letters[1][0]).toUpperCase();
}

function shortService(name) {
  if (!name) return 'Booksy';
  return name.split('/')[0].replace(/\s+/g, ' ').trim();
}

function formatRank(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '4,9';
  return v.toFixed(1).replace('.', ',');
}

function plOpinie(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} opinia`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} opinie`;
  return `${n} opinii`;
}

async function fetchReviews() {
  const all = [];
  let page = 1;
  let total = Infinity;
  let rank = 4.9;
  while (all.length < total && page <= 20) {
    const data = await fetchJson(
      `${BOOKSY_API}/reviews?reviews_page=${page}&reviews_per_page=50`
    );
    if (page === 1) {
      total = Number(data.reviews_count) || all.length;
      rank = Number(data.reviews_rank) || Number(data.reviews_stars) || 4.9;
    }
    const batch = data.reviews || [];
    all.push(...batch);
    if (!batch.length) break;
    page++;
  }
  const picked = all
    .filter((r) => String(r.review || '').trim().length >= REVIEW_MIN_LEN)
    .slice(0, REVIEW_LIMIT)
    .map((r) => ({
      id: r.id,
      name: (r.user && r.user.first_name) || 'Klient',
      rank: Number(r.rank) || 5,
      text: String(r.review || '').trim(),
      service: shortService((r.services && r.services[0] && r.services[0].name) || '')
    }));
  return { reviews: picked, count: Number.isFinite(total) ? total : all.length, rank };
}

function starsHtml(rank) {
  const n = Math.max(1, Math.min(5, Math.round(rank)));
  return Array.from({ length: n }, () => STAR).join('');
}

function buildReviewsBlock(reviews) {
  return [
    REVIEWS_START,
    ...reviews.map((r) => {
      const name = esc(r.name);
      const text = esc(r.text);
      const service = esc(r.service);
      return [
        `          <article class="tst__slide">`,
        `            <div class="tst__card">`,
        `              <svg class="tst__quote" aria-hidden="true"><use href="#i-quote"/></svg>`,
        `              <div class="tst__stars" aria-label="${r.rank}/5">`,
        `                ${starsHtml(r.rank)}`,
        `              </div>`,
        `              <blockquote>${text}</blockquote>`,
        `              <footer class="tst__who">`,
        `                <span class="tst__avatar" aria-hidden="true">${esc(initials(r.name))}</span>`,
        `                <span><strong>${name}</strong><em>${service} · Booksy</em></span>`,
        `              </footer>`,
        `            </div>`,
        `          </article>`
      ].join('\n');
    }),
    `        ` + REVIEWS_END
  ].join('\n');
}

function patchBlock(html, start, end, block) {
  if (!html.includes(start) || !html.includes(end)) {
    throw new Error(`Markers missing: ${start}`);
  }
  const next = html.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block);
  if (next === html && !html.includes(block)) {
    throw new Error(`Could not replace ${start}`);
  }
  return next;
}

function patchStats(html, { count, rank }) {
  const rankPl = formatRank(rank);
  const rankEn = rankPl.replace(',', '.');
  const rounded = Math.floor(count / 10) * 10;
  html = html.replace(
    /data-en="\d+ reviews on Booksy">[^<]*/,
    `data-en="${count} reviews on Booksy">${plOpinie(count)} na Booksy`
  );
  html = html.replace(
    /data-en="Over \d+ rated visits">[^<]*/,
    `data-en="Over ${rounded} rated visits">Ponad ${rounded} ocenionych wizyt`
  );
  html = html.replace(
    /<p class="section-head__sub" data-en="[\d.]+ out of 5 from \d+ reviews on Booksy\.">\s*[^<]+/,
    `<p class="section-head__sub" data-en="${rankEn} out of 5 from ${count} reviews on Booksy.">\n        ${rankPl} na 5 z ${count} opinii na Booksy.`
  );
  html = html.replace(
    /data-en="Traditional barbering in Pasaż Zielińskiego, Wrocław\. [\d.]+ out of 5 from \d+ reviews\.">\s*[^<]+/,
    `data-en="Traditional barbering in Pasaż Zielińskiego, Wrocław. ${rankEn} out of 5 from ${count} reviews.">\n        Tradycyjny barbering w Pasażu Zielińskiego we Wrocławiu. ${rankPl} na 5 z ${count} opinii.`
  );
  html = html.replace(
    /<div class="rating" aria-label="[^"]+">(\s*)<span class="rating__stars"[\s\S]*?<strong>[^<]+<\/strong>/,
    `<div class="rating" aria-label="${rankPl} / 5">$1<span class="rating__stars" aria-hidden="true">\n            <svg class="ico"><use href="#i-star"/></svg><svg class="ico"><use href="#i-star"/></svg><svg class="ico"><use href="#i-star"/></svg><svg class="ico"><use href="#i-star"/></svg><svg class="ico"><use href="#i-star"/></svg>\n          </span>\n          <strong>${rankPl}</strong>`
  );
  return html;
}

function clearLocalPhotos() {
  if (!fs.existsSync(OUT_DIR)) return 0;
  let removed = 0;
  for (const name of fs.readdirSync(OUT_DIR)) {
    if (name === 'manifest.json' || name === 'reviews.json') continue;
    const dest = path.join(OUT_DIR, name);
    if (!fs.statSync(dest).isFile()) continue;
    fs.unlinkSync(dest);
    removed++;
  }
  return removed;
}

async function main() {
  console.log('Fetching Booksy page and API…');
  const [html, reviewData] = await Promise.all([
    fetchText(BOOKSY_URL),
    fetchReviews()
  ]);

  let items = dropBlocked(extractItems(html));
  if (!items.length) throw new Error('No Booksy portfolio photos found');
  if (!reviewData.reviews.length) throw new Error('No Booksy reviews with text found');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(items, null, 2) + '\n');
  fs.writeFileSync(
    path.join(OUT_DIR, 'reviews.json'),
    JSON.stringify(
      {
        count: reviewData.count,
        rank: reviewData.rank,
        reviews: reviewData.reviews
      },
      null,
      2
    ) + '\n'
  );

  let page = fs.readFileSync(INDEX, 'utf8');
  page = patchBlock(page, GALLERY_START, GALLERY_END, buildGalleryBlock(items));
  page = patchBlock(page, REVIEWS_START, REVIEWS_END, buildReviewsBlock(reviewData.reviews));
  page = patchStats(page, reviewData);
  fs.writeFileSync(INDEX, page);

  const removed = clearLocalPhotos();
  console.log(`Gallery: ${items.length} photos (blocked ${BLOCKED_FILES.size} off-brief shots).`);
  console.log(`Reviews: ${reviewData.reviews.length} of ${reviewData.count} (${formatRank(reviewData.rank)}).`);
  if (removed) console.log(`Removed ${removed} local copies from images/booksy/.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
