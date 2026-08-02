/* ═══════════════════════════════════════════════════════════════════
   PAN CARLOS — interactions
   1. Sticky nav + mobile menu + active link
   2. Smooth-scroll offset for anchor links
   3. Scroll reveal
   4. Hero parallax
   5. Testimonial slider
   6. Gallery lightbox
   7. Booking form (front-end validation only — see README)
   8. Back to top + footer year
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 0 · LANGUAGE (PL / EN) ────────────────────────────────────────
     Polish is what's written in index.html. The English version lives in
     data-en / data-en-placeholder / data-en-aria / data-en-label
     attributes next to it, so both languages sit side by side in the
     markup and stay easy to edit.
     TO ADD A STRING: put data-en="..." on the element. Nothing else. */
  /* current language + the strings that live in JS rather than in the markup
     (form validation messages). Edit both columns to change the wording. */
  var LANG = 'pl';
  var MSG = {
    required:  { pl: 'To pole jest wymagane.',              en: 'This field is required.' },
    email:     { pl: 'Podaj poprawny adres e-mail.',        en: 'Please enter a valid email address.' },
    phone:     { pl: 'Podaj poprawny numer telefonu.',      en: 'Please enter a valid phone number.' },
    checkForm: { pl: 'Sprawdź zaznaczone pola.',            en: 'Please check the highlighted fields.' },
    pickSlot:  { pl: 'Wybierz dzień i godzinę.',            en: 'Pick a day and a time.' },
    sending:   { pl: 'Wysyłanie…',                          en: 'Sending…' },
    sendFailed:{ pl: 'Nie udało się wysłać. Zadzwoń lub napisz na Booksy.',
                 en: 'Could not send. Please call us or book on Booksy.' },
    noEndpoint:{ pl: 'Formularz nie jest jeszcze podłączony (patrz README §9).',
                 en: 'The form is not connected yet (see README §9).' },
    sent:      { pl: 'Dziękujemy — zgłoszenie wysłane. Potwierdzimy termin telefonicznie.',
                 en: 'Thank you — request sent. We will confirm your slot by phone.' }
  };
  function t(key) { return MSG[key][LANG] || MSG[key].pl; }

  (function i18n() {
    var buttons = $$('.lang__btn');
    if (!buttons.length) return;

    var META = {
      pl: {
        title: 'Pana Carlosa — Barber Shop',
        desc: 'Pana Carlosa Barber Shop — tradycyjne barberstwo, klasyczne strzyżenia i golenie na gorący ręcznik.'
      },
      en: {
        title: 'Pana Carlosa — Barber Shop',
        desc: 'Pana Carlosa Barber Shop — traditional barbering, classic cuts and hot towel shaves.'
      }
    };

    /* attribute suffix → the DOM property/attribute it drives */
    var MAP = [
      { attr: 'en', apply: function (el, v) { el.textContent = v; }, read: function (el) { return el.textContent; } },
      { attr: 'enPlaceholder', apply: function (el, v) { el.placeholder = v; }, read: function (el) { return el.placeholder; } },
      { attr: 'enAria', apply: function (el, v) { el.setAttribute('aria-label', v); }, read: function (el) { return el.getAttribute('aria-label'); } },
      { attr: 'enLabel', apply: function (el, v) { el.label = v; }, read: function (el) { return el.label; } }
    ];

    /* stash the Polish original the first time we translate away from it */
    MAP.forEach(function (m) {
      $$('[data-' + m.attr.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }) + ']')
        .forEach(function (el) {
          if (el.dataset[m.attr + 'Pl'] === undefined) {
            el.dataset[m.attr + 'Pl'] = (m.read(el) || '').trim();
          }
        });
    });

    function setLang(lang) {
      var toEnglish = lang === 'en';
      LANG = lang;

      MAP.forEach(function (m) {
        var sel = '[data-' + m.attr.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }) + ']';
        $$(sel).forEach(function (el) {
          var value = toEnglish ? el.dataset[m.attr] : el.dataset[m.attr + 'Pl'];
          if (typeof value === 'string') m.apply(el, value);
        });
      });

      document.documentElement.lang = lang;
      document.title = META[lang].title;
      var desc = $('meta[name="description"]');
      if (desc) desc.setAttribute('content', META[lang].desc);

      buttons.forEach(function (b) {
        var on = b.dataset.lang === lang;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
      });

      /* month names, weekday names and the summary line are locale-driven */
      if (typeof picker !== 'undefined' && picker) picker.redraw();

      try { localStorage.setItem('pc-lang', lang); } catch (err) { /* private mode */ }
    }

    buttons.forEach(function (b) {
      b.addEventListener('click', function () { setLang(b.dataset.lang); });
    });

    /* saved choice, else follow the browser, else Polish */
    var saved = null;
    try { saved = localStorage.getItem('pc-lang'); } catch (err) { saved = null; }
    var initial = saved || ((navigator.language || 'pl').toLowerCase().indexOf('pl') === 0 ? 'pl' : 'en');
    if (initial === 'en') setLang('en');
    else setLang('pl');
  })();

  /* ── 1 · NAVIGATION ────────────────────────────────────────────── */
  var nav    = $('#siteNav');
  var burger = $('#navBurger');
  var menu   = $('#navMenu');
  var links  = $$('.nav__link');

  function closeMenu() {
    menu.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    document.body.classList.remove('is-locked');
  }

  burger.addEventListener('click', function () {
    var open = menu.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('is-locked', open);
  });

  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) closeMenu();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) {
      closeMenu();
      burger.focus();
    }
  });

  // reset the mobile menu if the viewport grows past the breakpoint
  window.matchMedia('(min-width: 981px)').addEventListener('change', function (e) {
    if (e.matches) closeMenu();
  });

  /* sticky style + back-to-top visibility, batched into one scroll handler */
  var toTop = $('#toTop');
  var ticking = false;

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    nav.classList.toggle('is-stuck', y > 60);
    toTop.classList.toggle('is-on', y > 700);
    if (!reduced) parallax(y);
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
  }, { passive: true });

  /* active section highlighting */
  var sections = links
    .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ── 2 · ANCHOR SCROLLING (accounts for the fixed navbar) ──────── */
  function goTo(target, smooth) {
    var navH = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--nav-h'), 10) || 88;
    var top = target.getBoundingClientRect().top + window.scrollY -
      (target.id === 'home' ? 0 : navH - 1);

    /* 'instant', not 'auto' — 'auto' defers to CSS scroll-behavior, which is
       smooth here, so corrections would animate and interleave with each other */
    window.scrollTo({
      top: Math.max(top, 0),
      behavior: (smooth && !reduced) ? 'smooth' : 'instant'
    });
  }

  /* The display font changes heading heights when it swaps in, which moves every
     section. If a link is clicked before that happens the scroll lands short, so
     we re-align once the fonts have settled. */
  function fontsSettled(fn) {
    if (document.fonts && document.fonts.status !== 'loaded') {
      document.fonts.ready.then(fn).catch(function () {});
    }
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (id === '#' || id.length < 2) return;
    var target = document.querySelector(id);
    if (!target) return;

    e.preventDefault();
    goTo(target, true);
    fontsSettled(function () { goTo(target, false); });
    history.replaceState(null, '', id);
  });

  /* Opening the page directly on an anchor (/#services) is unreliable on its own:
     the browser jumps before images and fonts have settled, so re-align once
     everything has actually loaded. */
  if (location.hash.length > 1) {
    var landing = null;
    try { landing = document.querySelector(location.hash); } catch (err) { landing = null; }
    if (landing) {
      /* the moment the visitor takes control, stop re-positioning them */
      var claimed = false;
      var claim = function () { claimed = true; };
      ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (ev) {
        window.addEventListener(ev, claim, { passive: true, once: true });
      });

      var align = function () { if (!claimed) goTo(landing, false); };

      align();                              /* first guess */
      fontsSettled(align);                  /* again once the display font swaps */
      window.addEventListener('load', align);  /* and once images have real heights */
    }
  }

  /* ── 3 · SCROLL REVEAL ─────────────────────────────────────────── */
  var revealables = $$('[data-reveal]');
  if (reduced || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var revealer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        obs.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    revealables.forEach(function (el) { revealer.observe(el); });
  }

  /* ── 4 · HERO PARALLAX ─────────────────────────────────────────── */
  var heroMedia = $('.hero__media');
  function parallax(y) {
    if (!heroMedia || window.innerWidth < 900) return;
    if (y < window.innerHeight * 1.2) {
      heroMedia.style.transform = 'translate3d(0,' + (y * 0.18).toFixed(1) + 'px,0)';
    }
  }

  /* ── 5 · TESTIMONIAL SLIDER ────────────────────────────────────── */
  (function slider() {
    var track = $('#tstTrack');
    if (!track) return;

    var slides = $$('.tst__slide', track);
    var prev = $('#tstPrev');
    var next = $('#tstNext');
    var dots = $('#tstDots');
    var index = 0;
    var timer = null;

    function perView() {
      return window.matchMedia('(min-width: 900px)').matches ? 2 : 1;
    }
    function maxIndex() {
      return Math.max(0, slides.length - perView());
    }

    function render() {
      var pv = perView();
      index = Math.min(index, maxIndex());
      slides.forEach(function (s) { s.style.flexBasis = (100 / pv) + '%'; });
      track.style.transform = 'translate3d(' + (-index * (100 / pv)) + '%,0,0)';

      prev.disabled = index === 0;
      next.disabled = index === maxIndex();

      $$('button', dots).forEach(function (d, i) {
        var on = i === index;
        d.classList.toggle('is-on', on);
        d.setAttribute('aria-current', on ? 'true' : 'false');
      });

      slides.forEach(function (s, i) {
        var visible = i >= index && i < index + pv;
        s.setAttribute('aria-hidden', visible ? 'false' : 'true');
      });
    }

    function buildDots() {
      dots.innerHTML = '';
      for (var i = 0; i <= maxIndex(); i++) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', 'Go to review ' + (i + 1));
        b.dataset.i = i;
        dots.appendChild(b);
      }
    }

    function go(i) {
      index = (i + maxIndex() + 1) % (maxIndex() + 1);
      render();
    }

    prev.addEventListener('click', function () { go(index - 1); restart(); });
    next.addEventListener('click', function () { go(index + 1); restart(); });
    dots.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) { go(Number(b.dataset.i)); restart(); }
    });

    /* keyboard + touch */
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { go(index - 1); restart(); }
      if (e.key === 'ArrowRight') { go(index + 1); restart(); }
    });

    var x0 = null;
    track.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 45) { go(index + (dx < 0 ? 1 : -1)); restart(); }
      x0 = null;
    }, { passive: true });

    /* gentle autoplay, paused on hover/focus */
    function restart() {
      clearInterval(timer);
      if (reduced || maxIndex() === 0) return;
      timer = setInterval(function () { go(index + 1); }, 7000);
    }
    var slid = $('.tst__slider');
    ['mouseenter', 'focusin'].forEach(function (ev) {
      slid.addEventListener(ev, function () { clearInterval(timer); });
    });
    ['mouseleave', 'focusout'].forEach(function (ev) {
      slid.addEventListener(ev, restart);
    });

    var resizeT;
    window.addEventListener('resize', function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(function () { buildDots(); render(); restart(); }, 160);
    });

    buildDots();
    render();
    restart();
  })();

  /* ── 6 · GALLERY LIGHTBOX ──────────────────────────────────────── */
  (function lightbox() {
    var items = $$('.gal__item');
    var box = $('#lightbox');
    if (!items.length || !box) return;

    var img = $('#lbImg');
    var cap = $('#lbCap');
    var at = 0;
    var lastFocus = null;

    function show(i) {
      at = (i + items.length) % items.length;
      var src = $('img', items[at]);
      var label = $('figcaption span', items[at]);
      img.src = src.getAttribute('src');
      img.alt = src.getAttribute('alt') || '';
      cap.textContent = label ? label.textContent : '';
    }

    function open(i) {
      lastFocus = document.activeElement;
      show(i);
      box.hidden = false;
      document.body.classList.add('is-locked');
      requestAnimationFrame(function () { box.classList.add('is-open'); });
      $('#lbClose').focus();
    }

    function close() {
      box.classList.remove('is-open');
      document.body.classList.remove('is-locked');
      setTimeout(function () { box.hidden = true; img.src = ''; }, 320);
      if (lastFocus) lastFocus.focus();
    }

    items.forEach(function (fig, i) {
      fig.setAttribute('tabindex', '0');
      fig.setAttribute('role', 'button');
      fig.setAttribute('aria-label', 'Open gallery image ' + (i + 1));
      fig.addEventListener('click', function () { open(i); });
      fig.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); }
      });
    });

    $('#lbClose').addEventListener('click', close);
    $('#lbPrev').addEventListener('click', function () { show(at - 1); });
    $('#lbNext').addEventListener('click', function () { show(at + 1); });
    box.addEventListener('click', function (e) { if (e.target === box) close(); });

    document.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(at - 1);
      if (e.key === 'ArrowRight') show(at + 1);
    });
  })();

  /* ── 7 · DATE + TIME PICKER ────────────────────────────────────────
     Booksy stays the real booking system, so this picker does NOT reserve
     anything — it only lets a client say when they would like to come, and
     that request goes to Telegram for Carlos to confirm.

     Slots are generated from the opening hours below, stepped by the
     duration of the service the client picked (data-min on each <option>),
     so a 40-minute combo offers fewer starts than a 15-minute beard trim.  */
  var OPENING = {          /* day → [open, close] in minutes from midnight  */
    0: null,                                   /* Sunday — closed          */
    1: [600, 1260], 2: [600, 1260], 3: [600, 1260],
    4: [600, 1260], 5: [600, 1260],            /* Mon–Fri 10:00–21:00      */
    6: [600, 1200]                             /* Saturday 10:00–20:00     */
  };
  var BOOKING_MONTHS_AHEAD = 3;

  var picker = (function () {
    var root = $('#picker');
    if (!root) return null;

    var elMonth = $('#calMonth'), elWeek = $('#calWeekdays'),
        elDays = $('#calDays'), elSlots = $('#calSlots'),
        elSummary = $('#calSummary'),
        inDate = $('#f-date'), inTime = $('#f-time'),
        service = $('#f-service');

    var today = startOfDay(new Date());
    var view = new Date(today.getFullYear(), today.getMonth(), 1);
    var chosenDate = null, chosenTime = null;

    function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
    function iso(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
             '-' + String(d.getDate()).padStart(2, '0');
    }
    function locale() { return LANG === 'en' ? 'en-GB' : 'pl-PL'; }
    function hhmm(min) {
      return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
    }
    function duration() {
      var opt = service && service.selectedOptions && service.selectedOptions[0];
      return (opt && Number(opt.dataset.min)) || 30;
    }
    function maxDate() {
      return new Date(today.getFullYear(), today.getMonth() + BOOKING_MONTHS_AHEAD + 1, 0);
    }
    function isOpen(d) { return Boolean(OPENING[d.getDay()]); }
    function selectable(d) { return d >= today && d <= maxDate() && isOpen(d); }

    /* ── month grid ── */
    function renderWeekdays() {
      var names = [];
      /* 1 Jun 2025 was a Sunday; walk Mon→Sun for a Monday-first calendar */
      for (var i = 2; i <= 8; i++) {
        names.push(new Date(2025, 5, i).toLocaleDateString(locale(), { weekday: 'short' }));
      }
      elWeek.innerHTML = names
        .map(function (n) { return '<span>' + n.replace('.', '') + '</span>'; }).join('');
    }

    function renderMonth() {
      elMonth.textContent = view.toLocaleDateString(locale(), { month: 'long', year: 'numeric' });

      var first = new Date(view.getFullYear(), view.getMonth(), 1);
      var lead = (first.getDay() + 6) % 7;                 /* Monday-first  */
      var total = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();

      var html = '';
      for (var i = 0; i < lead; i++) html += '<span class="picker__pad"></span>';

      for (var day = 1; day <= total; day++) {
        var d = new Date(view.getFullYear(), view.getMonth(), day);
        var ok = selectable(d);
        var cls = 'picker__day';
        if (!ok) cls += ' is-off';
        if (chosenDate && iso(d) === iso(chosenDate)) cls += ' is-on';
        if (iso(d) === iso(today)) cls += ' is-today';
        html += '<button type="button" class="' + cls + '" data-date="' + iso(d) + '"' +
                (ok ? '' : ' disabled') + '>' + day + '</button>';
      }
      elDays.innerHTML = html;

      var limit = maxDate();
      $('#calPrev').disabled = view <= new Date(today.getFullYear(), today.getMonth(), 1);
      $('#calNext').disabled = new Date(view.getFullYear(), view.getMonth() + 1, 1) > limit;
    }

    /* ── time column ── */
    function renderSlots() {
      if (!chosenDate) {
        elSlots.innerHTML = '<p class="picker__hint">' +
          (LANG === 'en' ? 'Pick a day first' : 'Najpierw wybierz dzień') + '</p>';
        return;
      }
      var hours = OPENING[chosenDate.getDay()];
      var step = duration();
      var now = new Date();
      var isToday = iso(chosenDate) === iso(today);
      var html = '', any = false;

      for (var m = hours[0]; m + step <= hours[1]; m += step) {
        var past = isToday && m <= now.getHours() * 60 + now.getMinutes();
        if (past) continue;
        any = true;
        html += '<button type="button" class="picker__slot' +
                (chosenTime === hhmm(m) ? ' is-on' : '') +
                '" data-time="' + hhmm(m) + '">' + hhmm(m) + '</button>';
      }
      elSlots.innerHTML = any ? html : '<p class="picker__hint">' +
        (LANG === 'en' ? 'No times left today' : 'Brak wolnych godzin tego dnia') + '</p>';
    }

    function renderSummary() {
      if (!chosenDate || !chosenTime) {
        elSummary.textContent = LANG === 'en'
          ? 'Choose a day and a time.' : 'Wybierz dzień i godzinę.';
        elSummary.classList.remove('is-set');
        return;
      }
      var pretty = chosenDate.toLocaleDateString(locale(),
        { weekday: 'long', day: 'numeric', month: 'long' });
      elSummary.textContent = (LANG === 'en'
        ? 'Requested: ' + pretty + ' at ' + chosenTime
        : 'Termin: ' + pretty + ', godz. ' + chosenTime) + ' · ' + duration() + ' min';
      elSummary.classList.add('is-set');
    }

    function sync() {
      inDate.value = chosenDate ? iso(chosenDate) : '';
      inTime.value = chosenTime || '';
      renderSummary();
      root.dispatchEvent(new Event('picker:change', { bubbles: true }));
    }

    /* ── events ── */
    $('#calPrev').addEventListener('click', function () {
      view = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderMonth();
    });
    $('#calNext').addEventListener('click', function () {
      view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderMonth();
    });

    elDays.addEventListener('click', function (e) {
      var b = e.target.closest('.picker__day'); if (!b || b.disabled) return;
      var parts = b.dataset.date.split('-');
      chosenDate = new Date(+parts[0], parts[1] - 1, +parts[2]);
      chosenTime = null;
      renderMonth(); renderSlots(); sync();
    });

    elSlots.addEventListener('click', function (e) {
      var b = e.target.closest('.picker__slot'); if (!b) return;
      chosenTime = b.dataset.time;
      renderSlots(); sync();
    });

    /* a different service means different slot lengths */
    if (service) {
      service.addEventListener('change', function () {
        chosenTime = null; renderSlots(); sync();
      });
    }

    function redraw() { renderWeekdays(); renderMonth(); renderSlots(); renderSummary(); }
    redraw();

    return { redraw: redraw, reset: function () {
      chosenDate = null; chosenTime = null; renderMonth(); renderSlots(); sync();
    } };
  })();


  /* ── 8 · BOOKING REQUEST → TELEGRAM ───────────────────────────────
     The bot token must NEVER live in this file — anyone can read it.
     Point BOOKING_ENDPOINT at the proxy in telegram-proxy/worker.js,
     which keeps the token server-side. See README §9.                */
  /* Local dev: server.js serves /config.js from .env. Production: set the Worker URL here. */
  var BOOKING_ENDPOINT =
    (window.__ENV__ && window.__ENV__.BOOKING_ENDPOINT) ||
    '';   /* e.g. 'https://pana-carlosa.<you>.workers.dev' */

  (function booking() {
    var form = $('#bookingForm');
    if (!form) return;
    var status = $('#formStatus');
    var submitBtn = form.querySelector('button[type="submit"]');

    function setError(field, msg) {
      var wrap = field.closest('.field');
      if (!wrap) return;
      wrap.classList.toggle('is-invalid', Boolean(msg));
      var slot = $('[data-err]', wrap);
      if (slot) slot.textContent = msg || '';
      field.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }

    function validate(field) {
      var v = (field.value || '').trim();
      if (field.hasAttribute('required') && !v) {
        setError(field, field.type === 'hidden' ? t('pickSlot') : t('required'));
        return false;
      }
      if (field.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
        setError(field, t('email')); return false;
      }
      if (field.type === 'tel' && v && v.replace(/\D/g, '').length < 9) {
        setError(field, t('phone')); return false;
      }
      setError(field, '');
      return true;
    }

    var fields = $$('input, select, textarea', form)
      .filter(function (f) { return f.name !== 'company'; });

    fields.forEach(function (f) {
      if (f.type === 'hidden') return;
      f.addEventListener('blur', function () { validate(f); });
      f.addEventListener('input', function () {
        var w = f.closest('.field');
        if (w && w.classList.contains('is-invalid')) validate(f);
      });
    });

    /* clear the date/time error as soon as a slot is picked */
    document.addEventListener('picker:change', function () {
      var d = $('#f-date');
      if (d && d.value) { setError(d, ''); setError($('#f-time'), ''); }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      /* honeypot: only a bot fills this */
      if (form.company && form.company.value) return;

      var ok = true, first = null;
      fields.forEach(function (f) {
        if (!validate(f)) { ok = false; if (!first) first = f; }
      });
      if (!ok) {
        status.classList.remove('is-ok');
        status.textContent = t('checkForm');
        if (first) (first.type === 'hidden' ? $('#picker') : first).scrollIntoView({ block: 'center' });
        if (first && first.type !== 'hidden') first.focus();
        return;
      }

      var data = Object.fromEntries(new FormData(form).entries());
      delete data.company;
      data.lang = LANG;
      data.duration = ($('#f-service').selectedOptions[0] || {}).dataset
        ? Number($('#f-service').selectedOptions[0].dataset.min) : null;

      if (!BOOKING_ENDPOINT) {
        status.classList.remove('is-ok');
        status.textContent = t('noEndpoint');
        console.warn('BOOKING_ENDPOINT is empty — nothing was sent. See README §9.', data);
        return;
      }

      submitBtn.disabled = true;
      status.classList.remove('is-ok');
      status.textContent = t('sending');

      fetch(BOOKING_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function () {
          status.classList.add('is-ok');
          status.textContent = t('sent');
          form.reset();
          if (picker) picker.reset();
          fields.forEach(function (f) { setError(f, ''); });
        })
        .catch(function (err) {
          status.classList.remove('is-ok');
          status.textContent = t('sendFailed');
          console.error('Booking request failed:', err);
        })
        .then(function () { submitBtn.disabled = false; });
    });
  })();

  /* ── 8 · MISC ──────────────────────────────────────────────────── */
  $('#toTop').addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });

  var year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  onScroll();
})();
