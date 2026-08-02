# PANA CARLOSA — Barber Shop Website

> **Bilingual (PL / EN).** Polish is the text written in `index.html`; the English
> version sits beside it in `data-en` attributes. See §6.
>
> **Content is real.** Services, prices, durations, opening hours, address, rating
> and reviews were taken from the shop's Booksy listing. See §8.


A single-page, fully responsive site built with plain **HTML + CSS + JavaScript**.
No build step, no frameworks, no dependencies.

```
Pana Carlosa/
├── index.html     ← all content and text
├── styles.css     ← all design (colours, fonts, spacing) — tokens at the top
├── script.js      ← nav, slider, lightbox, form, animations
├── images/        ← photos
├── telegram-proxy/ ← Cloudflare Worker that forwards the form to Telegram
├── booking-message.cjs ← shared Telegram message formatter
├── scripts/       ← test-telegram-booking.js, sends one message end-to-end
├── server.js      ← local preview server + POST /booking
└── README.md
```

---

## Running it

**Simplest:** double-click `index.html`.

**With a local server** (recommended — matches how it behaves when hosted):

```bash
node server.js       # → http://localhost:4321
```

```
lsof -ti :4321 | xargs kill
node server.js
```

**Publishing:** upload `index.html`, `styles.css`, `script.js` and `images/` to any
static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages, or plain shared hosting).
`server.js` and `README.md` are not needed on the server.

---

## 1 · Replacing the images

All 15 images are ordinary `<img>` tags in `index.html`. To swap one, drop your photo
into `images/` and point the tag at it:

```html
<img src="images/hero.svg"   →   <img src="images/hero.jpg"
```

(If you name your file exactly like the placeholder — `hero.svg` → `hero.jpg` — the
table below tells you which line to change. Any format works: `.jpg`, `.png`, `.webp`.)

| Line | File | What it should be | Suggested size |
|-----:|------|-------------------|----------------|
| 106 | `hero.svg`              | Carlos at work, wide shot   | 1800 × 1100 |
| 186 | `about.svg`             | Shaving brush / tools       | 900 × 1150 (4:5) |
| 244 | `services-bg.svg`       | Dark tools flat-lay         | 1800 × 1000 |
| 396 | `barber-1.svg`          | **Portrait of Pan Carlos**  | 900 × 1150 (4:5) |
| 508 | `appointment-chair.svg` | Vintage barber chair        | 900 × 1150 (4:5) |
| 598 | `hours-bg.svg`          | Dark tools / interior       | 1800 × 900 |
| 681–701 | `gallery-1…6.svg`   | Cuts, beards, tools, room   | 800–1200 wide |

`images/barber-2.svg` … `barber-4.svg` are left over from the earlier four-person
layout and are no longer referenced — delete them if you like.

> Photos are automatically cropped to fit and given a slight desaturation
> (`filter: grayscale(...)`) so mixed sources still look like one set.
> To turn that off, search `grayscale` in `styles.css`.

**Background images** (`hero`, `services-bg`, `hours-bg`) sit behind a dark scrim so
text stays readable. If your photo is bright, increase the darkening:
`styles.css` → `.bg-media img { filter: … brightness(.55) }` and `.hero__scrim`.

---

## 2 · Editing services and prices

Section 4 in `index.html` (search for `SERVICE MENU`). Every line is one `<li>`:

```html
<li>
  <p class="svc__row">
    <span class="svc__name" data-en="Classic Haircut">Strzyżenie klasyczne</span>
    <i class="svc__dots"></i>
    <span class="svc__price">25 zł</span>
  </p>
  <p class="svc__desc" data-en="Classic haircut for men">Klasyczne strzyżenie męskie</p>
</li>
```

- **Change a price** → edit the text inside `svc__price`. Prices are *not* translated,
  so you only change them in one place.
- **Add a service** → copy a whole `<li>` block and edit it.
- **Remove one** → delete the `<li>`.
- Leave `<i class="svc__dots"></i>` alone — it draws the dotted leader line.

The dropdown in the booking form lists the same services. If you change the menu,
update the `<option>` list too (search for `id="f-service"`).

---

## 3 · Editing text and details

Everything marked `[ Placeholder … ]` is meant to be replaced.

| What | Where |
|------|-------|
| Barber name / role | Section 5 — `master__name`, `master__role` |
| Testimonials | Section 7 — real Booksy reviews; copy a `<article class="tst__slide">` to add more |
| Working hours | Section 8 (boxes) **and** the footer list — update both |
| Phone number | Search `+48 XXX XXX XXX` — form placeholder, vertical detail, footer (`href="tel:…"` too) |
| Address / email | Footer, "Contact" column |
| Social links | Already wired to your real Facebook + Instagram, in three places: hero right rail, barber cards, footer |
| Copyright year | Filled in automatically by `script.js` |

---

## 4 · Changing the colours and fonts

Everything visual is controlled by tokens at the top of `styles.css`:

```css
:root{
  --gold:      #c6a165;   /* antique gold, as on the poster — change this first */
  --gold-lt:   #e3c894;   /* wheat highlight */
  --charcoal:  #13100b;   /* dark sections */
  --cream:     #f6f1e7;   /* light sections */
  --ink:       #0a0806;   /* deepest black */
  ...
  --f-logo:    'Cinzel', …;       /* logotype, small caps like the shop sign */
  --f-display: 'Bebas Neue', …;   /* big headings */
  --f-cond:    'Oswald', …;       /* nav, buttons, labels */
  --f-body:    'Barlow', …;       /* paragraphs */
  --f-serif:   'Cormorant Garamond', …;  /* italic accents */
}
```

Change a value there and it updates across the whole page. Fonts load from Google
Fonts via the `<link>` in `<head>`; swap the families there and in the tokens.

Other quick knobs:
- `--sect-y` — vertical breathing room of every section
- `--nav-h` — navbar height
- `--shell` — max content width
- Film grain strength: `.grain { opacity: .055 }`

---

## 5 · Connecting the booking form to Telegram

The form is the main way clients book, so it has to work in production. What it
sends is a *request*: it lands in Telegram and Carlos confirms by phone. It does not
write into Booksy's calendar — see §5b for why that is not possible.

Required fields: **name, phone, service, date, time**. Email and message are optional.

### Why a proxy is needed

A Telegram bot token is a password. Anything in `script.js` is readable by every
visitor, so putting the token there means losing the bot. `telegram-proxy/worker.js`
keeps it server-side.

```bash
npm i -g wrangler
wrangler login
cd telegram-proxy
wrangler deploy
wrangler secret put BOT_TOKEN    # from @BotFather
wrangler secret put CHAT_ID      # from @userinfobot, or a group id
```

Then paste the printed URL into `script.js`:

```js
var BOOKING_ENDPOINT = 'https://pana-carlosa.<you>.workers.dev';
```

While it is empty the form says so plainly instead of faking a success message.

Finally set `ALLOWED_ORIGIN` in `telegram-proxy/wrangler.toml` to your real domain —
`"*"` lets any website post through your bot.

### Testing locally

`server.js` serves `POST /booking` (and `/mock-booking` as an alias). Copy
`.env.example` to `.env`, fill in `BOT_TOKEN` and `CHAT_ID`, and it sends real
Telegram messages from your machine. With the token left blank it just logs the
payload instead.

The browser picks the endpoint up automatically: `server.js` publishes `.env` as
`/config.js`, and `script.js` reads `window.__ENV__.BOOKING_ENDPOINT`. Nothing to
edit by hand for local work.

`.env` is gitignored — keep it that way.

---

## 5b · The date & time picker

Custom, in `script.js` (section 7). No library.

- Opening hours live in the `OPENING` table — minutes from midnight, per weekday.
  Currently Mon–Fri 10:00–21:00, Sat 10:00–20:00, Sunday closed.
- Slot length = the duration of the selected service, read from `data-min` on each
  `<option>`. Pick a 15-minute beard trim and you get 44 starts; pick a 40-minute
  combo and you get 16. Changing the service re-renders the slots.
- Past days, Sundays and today's already-gone times are disabled.
- `BOOKING_MONTHS_AHEAD` limits how far forward clients can request.
- Month and weekday names follow the PL/EN switch automatically.

**It does not know what Booksy has booked.** Booksy publishes no API and a browser
cannot read it (CORS), so two people *can* request the same slot. Carlos sees both
requests in Telegram and confirms one. If you ever want real slot-locking, the site
would have to become the source of truth instead of Booksy.

---

## 6 · The two languages

Polish is the text you see in `index.html`. English lives next to it in attributes:

```html
<h2 class="title" data-en="Service Menu">Cennik usług</h2>
<input placeholder="Jan Kowalski" data-en-placeholder="Your full name">
<button aria-label="Menu" data-en-aria="Open menu">
<optgroup label="Strzyżenie" data-en-label="Haircuts">
```

| Attribute | Swaps |
|---|---|
| `data-en` | the element's text |
| `data-en-placeholder` | an input/textarea placeholder |
| `data-en-aria` | the `aria-label` |
| `data-en-label` | an `<optgroup>` label |

**To add a translatable string:** write the Polish as normal text and add
`data-en="…"`. Nothing else — the switcher picks it up automatically.

**Keep HTML out of these attributes** — the switcher sets text, not markup. If you
need a line break, use two sibling `<span>`s (see the footer address).

Form validation messages live in JS instead, in the `MSG` table at the top of
`script.js` — edit both the `pl` and `en` column.

The visitor's choice is remembered in `localStorage`. First-time visitors get Polish
unless their browser is set to something else, in which case they get English.

---

## 7 · Poster-style decoration

Elements taken from the printed promo poster, all inline SVG:

| Class | What it is | Where |
|---|---|---|
| `.oframe` | double gold rule with flourished corners | hero, services, hours |
| `.pole` | barber pole line art | hero, left edge |
| `.artline--clipper` / `--comb` | clipper and comb line art | working hours |
| `.promo__rays` | ray burst either side of the promo text | promo banner |
| `.promo__script` | brush-script kicker (Caveat), like "NA LIPIEC" | promo banner |
| `.signplate` | the shop-sign lockup | footer |
| `.emblem` | round badge, crossed razors, arced name | hero |

The frames and line art are decorative and hidden on small screens. Adjust their
strength with the `opacity` values in section 3 of `styles.css`.

---

## 8 · Where the content came from

Everything factual on the page was taken from the shop's Booksy listing:

<https://booksy.com/pl-pl/185319_pana-carlosa_barber-shop_13750_wroclaw>

| On the page | Value |
|---|---|
| Services + prices + durations | 7 services, 25–130 zł, 15–40 min |
| Opening hours | Mon–Fri 10:00–21:00 · Sat 10:00–20:00 · Sun closed |
| Address | Pasaż Zielińskiego, Aleja Niebieska, stand 11.11, 50-088 Wrocław, Krzyki |
| Rating | 4.9 / 5 from 332 reviews |
| Testimonials | Three real reviews, first names as shown publicly |
| Legal entity | Afro fashion Polska sp. z o.o. |
| Promo | The referral offer from the printed poster (bring a friend, 20 zł off combo) |

**Still placeholders** — Booksy does not publish them: the phone number
(`+48 XXX XXX XXX`) and the email (`kontakt@example.com`). Search and replace both.

### The form is the main route; Booksy is the fallback

Every "Umów wizytę" button — nav, hero, about, barber, promo banner, footer — scrolls
to the form at `#appointment`. The form is the primary way to book.

Booksy now appears in exactly one place: a quiet line under the submit button
("Wolisz zarezerwować sam? Jesteśmy też na Booksy"). To flip the priority back,
point those buttons at the Booksy URL again and promote that link to a button.

**What this means in practice.** A submission is a *request*, not a confirmed slot —
nothing writes into Booksy's calendar (§5b explains why that is not possible). Carlos
gets the request in Telegram and confirms by phone. Two people can still ask for the
same time; he sees both and confirms one.

Because the form is now the main route, it needs to actually work in production:
deploy the Worker and set `BOOKING_ENDPOINT` (§5) before going live. Until then the
form tells visitors it is not connected rather than pretending to succeed.

---

## Notes

- Works in all current browsers. Respects `prefers-reduced-motion` (animations off).
- Keyboard accessible: tab navigation, Esc closes the menu and lightbox,
  arrow keys move through the gallery and reviews.
- The vintage monogram, the section ornaments and all service icons are inline SVG —
  no icon font, nothing to download.
