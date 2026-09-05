#!/usr/bin/env node
/**
 * Pull public portfolio photos from the Pana Carlosa Booksy page and
 * rebuild the gallery markup in index.html.
 *
 *   node scripts/sync-booksy-photos.js
 *
 * Downloads shop-owned photos only (biz / inspiration / service / resource).
 * Skips customer review photos and the logo.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'images', 'booksy');
const INDEX = path.join(ROOT, 'index.html');
const BOOKSY_URL =
  'https://booksy.com/pl-pl/185319_pana-carlosa_barber-shop_13750_wroclaw';
const CATS = ['service_photos', 'inspiration', 'biz_photo', 'resource_photos'];
const CAPTION = {
  service_photos: { pl: 'Realizacja', en: 'Our work' },
  inspiration: { pl: 'Inspiracja', en: 'Inspiration' },
  biz_photo: { pl: 'Salon', en: 'Shop' },
  resource_photos: { pl: 'Salon', en: 'Shop' }
};

const START = '<!-- booksy-gallery:start -->';
const END = '<!-- booksy-gallery:end -->';

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

function fetchFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlink(dest, () => {});
          return fetchFile(res.headers.location, dest).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(dest, () => {});
          return reject(new Error(`${url} → ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(dest)));
      })
      .on('error', (err) => {
        try {
          fs.unlinkSync(dest);
        } catch {}
        reject(err);
      });
  });
}

function extractUrls(html) {
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
  return Object.fromEntries(
    Object.entries(byCat).map(([k, v]) => [k, [...v].sort()])
  );
}

function mosaicClass(i) {
  return i < 6 ? ` gal__item--${'abcdef'[i]}` : '';
}

function buildGalleryBlock(manifest) {
  const figures = manifest
    .map((item, i) => {
      const cap = CAPTION[item.cat] || CAPTION.service_photos;
      const loading = i < 6 ? 'eager' : 'lazy';
      return [
        `      <figure class="gal__item${mosaicClass(i)}">`,
        `        <img src="${item.src}" alt="${cap.pl}" loading="${loading}" decoding="async">`,
        `        <figcaption><span data-en="${cap.en}">${cap.pl}</span><svg class="ico"><use href="#i-plus"/></svg></figcaption>`,
        `      </figure>`
      ].join('\n');
    })
    .join('\n');

  const extra = Math.max(0, manifest.length - 6);
  const moreBtn =
    extra > 0
      ? [
          `    <div class="gal__more">`,
          `      <button type="button" class="btn btn--dark" id="galMore"`,
          `        data-en-more="Show all ${manifest.length} photos"`,
          `        data-en-less="Show less"`,
          `        data-pl-more="Pokaż wszystkie ${manifest.length} zdjęć"`,
          `        data-pl-less="Pokaż mniej">`,
          `        Pokaż wszystkie ${manifest.length} zdjęć`,
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
  ]
    .filter(Boolean)
    .join('\n');
}

function ensureMarkers(html) {
  if (html.includes(START) && html.includes(END)) return html;

  // First sync: wrap the gallery section-head subtitle + grid.
  const wrapped = html.replace(
    /(<section class="gal section section--light" id="gallery">[\s\S]*?<span class="ornament"[^>]*><\/span>\s*)([\s\S]*?)(\s*<\/div>\s*<\/section>)/,
    (_, head, mid, tail) => {
      // mid is subtitle + grid; replace with markers around fresh content later
      return `${head}${START}\n${mid.trim()}\n${END}${tail}`;
    }
  );
  if (!wrapped.includes(START)) {
    throw new Error('Could not locate gallery section to insert sync markers');
  }
  return wrapped;
}

function patchIndex(block) {
  let html = fs.readFileSync(INDEX, 'utf8');
  html = ensureMarkers(html);
  const next = html.replace(
    new RegExp(`${START}[\\s\\S]*?${END}`),
    block
  );
  if (next === html && !html.includes(block)) {
    throw new Error('Could not replace booksy-gallery markers in index.html');
  }
  fs.writeFileSync(INDEX, next);
}

async function main() {
  console.log('Fetching Booksy page…');
  const page = await fetchText(BOOKSY_URL);
  const byCat = extractUrls(page);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const jobs = [];
  for (const cat of CATS) {
    for (const url of byCat[cat] || []) {
      const file = `${cat}-${path.basename(url)}`;
      jobs.push({
        url,
        file,
        dest: path.join(OUT_DIR, file),
        src: `images/booksy/${file}`,
        cat
      });
    }
  }
  console.log(`Found ${jobs.length} portfolio photos.`);

  const keep = new Set(jobs.map((j) => j.file));
  for (const name of fs.readdirSync(OUT_DIR)) {
    if (name === 'manifest.json') continue;
    if (!keep.has(name)) {
      fs.unlinkSync(path.join(OUT_DIR, name));
      console.log(`removed stale ${name}`);
    }
  }

  let downloaded = 0;
  const queue = [...jobs];
  async function worker() {
    while (queue.length) {
      const job = queue.shift();
      if (fs.existsSync(job.dest) && fs.statSync(job.dest).size > 1000) continue;
      await fetchFile(job.url, job.dest);
      downloaded++;
      console.log(`✓ ${job.file}`);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);

  const manifest = jobs.filter((j) => fs.existsSync(j.dest));
  fs.writeFileSync(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify(
      manifest.map(({ src, file, cat }) => ({ src, file, cat })),
      null,
      2
    )
  );

  patchIndex(buildGalleryBlock(manifest));
  console.log(
    `\nSynced ${manifest.length} photos (${downloaded} newly downloaded). Gallery updated.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
