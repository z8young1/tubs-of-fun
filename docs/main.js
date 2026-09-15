/* Tubs of Fun! homepage behaviour
   1. Header shadow + mobile menu
   2. Live "open now" status per showroom (Central time, from data-hours)
   3. Live outside temperature in the hero (Open-Meteo, no key). Hidden if it can't load.
   4. Steam over the hero photo
   5. Scroll reveal from a visible resting state
   6. Find-your-tub quiz
   7. Test dip booking form (GHL inbound webhook, demo mode when empty) */
(function () {
  'use strict';
  document.documentElement.classList.add('js');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 1. Header ------------------------------------------------------------ */
  var header = document.querySelector('.site-header');
  var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); }
    });
  }

  /* 2. Open now ---------------------------------------------------------- */
  // data-hours: {"1":[9,18], ...} keyed by weekday (0 = Sunday), hours in 24h Central time.
  function centralNow() {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false
    }).formatToParts(new Date());
    var get = function (t) { var p = parts.find(function (x) { return x.type === t; }); return p ? p.value : ''; };
    var days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { day: days[get('weekday')], mins: (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10) };
  }
  function fmt(h) {
    var hr = Math.floor(h), m = Math.round((h - hr) * 60);
    var suffix = hr >= 12 ? 'pm' : 'am';
    var h12 = hr % 12 === 0 ? 12 : hr % 12;
    return h12 + (m ? ':' + String(m).padStart(2, '0') : '') + ' ' + suffix;
  }
  var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function storeStatus(hours) {
    var now = centralNow();
    var today = hours[now.day];
    if (today && now.mins >= today[0] * 60 && now.mins < today[1] * 60) {
      return { open: true, text: 'Open now until ' + fmt(today[1]) };
    }
    for (var i = 0; i < 8; i++) {
      var d = (now.day + i) % 7;
      var h = hours[d];
      if (!h) continue;
      if (i === 0 && now.mins >= h[0] * 60) continue;
      var when = i === 0 ? 'today' : i === 1 ? 'tomorrow' : dayNames[d];
      return { open: false, text: 'Closed. Opens ' + when + ' at ' + fmt(h[0]) };
    }
    return { open: false, text: 'Call for hours' };
  }

  function paintStatus() {
    document.querySelectorAll('[data-hours]').forEach(function (el) {
      var s;
      try { s = storeStatus(JSON.parse(el.getAttribute('data-hours'))); } catch (e) { return; }
      var dot = el.querySelector('.dot');
      var label = el.querySelector('.status-text');
      if (dot) { dot.classList.toggle('is-open', s.open); dot.classList.toggle('is-closed', !s.open); }
      if (label) label.textContent = s.text;
    });
  }
  paintStatus();
  setInterval(paintStatus, 60000);

  /* 3. Outside temperature ---------------------------------------------- */
  var outEl = document.querySelector('[data-temp-out]');
  var noteEl = document.querySelector('[data-temp-note]');
  if (outEl && window.fetch) {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=46.8769&longitude=-96.9003' +
      '&current=temperature_2m&temperature_unit=fahrenheit&timezone=America%2FChicago';
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 4000);
    fetch(url, ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        clearTimeout(timer);
        var t = data && data.current && data.current.temperature_2m;
        if (typeof t !== 'number') return;
        var rounded = Math.round(t);
        outEl.querySelector('.num').textContent = rounded + '\u00B0';
        outEl.hidden = false;
        if (noteEl) {
          var gap = 104 - rounded;
          noteEl.textContent = gap > 0
            ? 'That is ' + gap + ' degrees warmer than West Fargo right now. Come feel the difference.'
            : 'Hot out there? Our tubs run cool too. Come feel the difference.';
        }
      })
      .catch(function () { clearTimeout(timer); /* keep the static note */ });
  }

  // Count the tub temperature up once on load
  var inEl = document.querySelector('[data-temp-in]');
  if (inEl && !reduceMotion) {
    var target = 104, start = null, from = 72;
    var step = function (ts) {
      if (!start) start = ts;
      var p = Math.min(1, (ts - start) / 1600);
      var eased = 1 - Math.pow(1 - p, 3);
      inEl.textContent = Math.round(from + (target - from) * eased);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* 4. Steam ------------------------------------------------------------- */
  var canvas = document.querySelector('.thermal canvas');
  if (canvas && !reduceMotion && canvas.getContext) {
    var ctx = canvas.getContext('2d');
    var wisps = [], W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2), running = true;
    var size = function () {
      var r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    var spawn = function (initial) {
      return {
        x: W * (0.15 + Math.random() * 0.7),
        y: initial ? H * (0.3 + Math.random() * 0.7) : H * (0.78 + Math.random() * 0.25),
        r: 40 + Math.random() * 90,
        vy: 0.18 + Math.random() * 0.35,
        drift: Math.random() * Math.PI * 2,
        life: 0,
        max: 520 + Math.random() * 480
      };
    };
    size();
    for (var i = 0; i < 18; i++) wisps.push(spawn(true));
    window.addEventListener('resize', size);

    var draw = function () {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      for (var j = 0; j < wisps.length; j++) {
        var w = wisps[j];
        w.life++;
        w.y -= w.vy;
        w.drift += 0.006;
        w.x += Math.sin(w.drift) * 0.35;
        w.r += 0.12;
        var t = w.life / w.max;
        var alpha = Math.sin(Math.PI * Math.min(1, t)) * 0.085;
        var g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.r);
        g.addColorStop(0, 'rgba(255,255,255,' + alpha + ')');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
        ctx.fill();
        if (w.life > w.max || w.y + w.r < 0) wisps[j] = spawn(false);
      }
      requestAnimationFrame(draw);
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var vis = entries[0].isIntersecting;
        if (vis && !running) { running = true; requestAnimationFrame(draw); }
        if (!vis) running = false;
      }).observe(canvas);
    }
    requestAnimationFrame(draw);
  }

  /* 5. Reveal ------------------------------------------------------------ */
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.remove('is-below'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) {
      if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add('is-below'); io.observe(el); }
    });
  }

  /* 6. Quiz -------------------------------------------------------------- */
  var quiz = document.getElementById('tub-quiz');
  if (quiz) {
    var result = document.getElementById('quiz-result');
    var hint = quiz.querySelector('.quiz-hint');
    var recs = window.TOF_QUIZ || {};
    quiz.addEventListener('change', function () {
      var who = (quiz.querySelector('input[name="q_who"]:checked') || {}).value;
      var why = (quiz.querySelector('input[name="q_why"]:checked') || {}).value;
      var how = (quiz.querySelector('input[name="q_how"]:checked') || {}).value;
      if (!who || !why || !how) return;
      var key = why === 'swim' ? 'swim' : why === 'heat' ? 'sauna' : 'tub-' + how;
      var rec = recs[key];
      if (!rec) return;
      var extra = '';
      if (why === 'therapy' && rec.therapy) extra = ' ' + rec.therapy;
      if (why === 'family' && key.indexOf('tub-') === 0) extra = ' Bring the whole crew so everyone can find a seat.';
      result.querySelector('h3').textContent = rec.title;
      result.querySelector('.quiz-result > p:not(.eyebrow)').textContent = rec.body + extra;
      var pick = result.querySelector('[data-pick]');
      if (pick) pick.setAttribute('data-pick', rec.interest);
      result.hidden = false;
      if (hint) hint.hidden = true;
    });
  }

  // Any [data-pick] link preselects the interest on the booking form
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-pick]');
    if (!a) return;
    var box = document.querySelector('#book-form input[name="interest"][value="' + a.getAttribute('data-pick') + '"]');
    if (box) box.checked = true;
  });

  /* 7. Booking form ------------------------------------------------------ */
  var form = document.getElementById('book-form');
  if (form) {
    var btn = form.querySelector('button[type="submit"]');
    var doneEl = document.getElementById('book-done');
    var busy = false;
    var params = new URLSearchParams(location.search);

    var collect = function () {
      var d = {};
      var interests = [];
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name || el.disabled) return;
        if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
        if (el.name === 'interest') { interests.push(el.value); return; }
        d[el.name] = el.value;
      });
      return {
        firstName: d.first_name || '', lastName: d.last_name || '',
        phone: d.phone || '', email: d.email || '',
        showroom: d.showroom || '', visitWhen: d.visit_when || '',
        interest: interests.join(', '), notes: d.notes || '',
        page: 'home', pageUrl: location.href, submittedAt: new Date().toISOString(),
        utmSource: params.get('utm_source') || '', utmMedium: params.get('utm_medium') || '',
        utmCampaign: params.get('utm_campaign') || '', gclid: params.get('gclid') || '',
        fbclid: params.get('fbclid') || '', referrer: document.referrer || ''
      };
    };
    var finish = function (payload) {
      form.hidden = true;
      doneEl.querySelector('[data-name]').textContent = payload.firstName || 'friend';
      doneEl.hidden = false;
      doneEl.focus();
    };
    var fail = function () {
      busy = false;
      btn.disabled = false;
      btn.textContent = btn.dataset.label;
      var err = form.querySelector('.form-err');
      err.hidden = false;
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var payload = collect();
      var hook = form.getAttribute('data-webhook') || '';
      if (!hook) { finish(payload); return; } // demo mode until the GHL webhook is pasted in

      busy = true;
      btn.dataset.label = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Sending...';
      var body = JSON.stringify(payload);
      fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body })
        .then(function (r) { if (!r.ok) throw new Error(r.status); finish(payload); })
        .catch(function () {
          // GHL hook endpoints send no CORS headers; an opaque send still delivers the body
          fetch(hook, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: body })
            .then(function () { finish(payload); })
            .catch(fail);
        });
    });
  }
})();
