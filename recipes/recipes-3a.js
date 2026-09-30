/* /recipes — 3a: grouped master list + recipe detail. No dependencies. */
(() => {
  const CFG = {
    recipe: 'article.recipe',                    // one element per recipe, carrying the id (#daal)
    slot: '.rx-slot',                            // optional: where the nutrition panel goes (else after the h2)
    ingredient: '.ing-list li:not(.ing-group)',  // checkable rows (exclude group headings)
    amount: '.ing-qty',                          // element holding "½ cup" inside each ingredient row
    courses: ['Main', 'Side', 'Pasta', 'Dessert', 'Condiment'],
    courseLabels: { Main: 'Mains', Side: 'Sides', Pasta: 'Pasta', Dessert: 'Desserts', Condiment: 'Sauces' },
    mobile: '(max-width: 899px)'
  };

  // Recipe metadata. serves = servings the listed amounts make (the scaler's base). per = shown as "Makes …" when serves is 1.
  const DATA = {
    'yellow-rice':               { name: 'Instant Pot Yellow Rice', course: 'Side', method: 'Instant Pot', time: '~25 min', serves: 4, per: '1 of 4', pairs: ['daal', 'jerk-chicken'] },
    'pizza-dipping-sauce':       { name: 'Pepperoncini Dipping Sauce', course: 'Condiment', method: 'No cook', time: '~10 min', serves: 12, per: '2 tbsp' },
    'daal':                      { name: 'Instant Pot Daal', course: 'Main', method: 'Instant Pot', time: '~50 min', serves: 4, per: 'per bowl', pairs: ['rice-and-peas', 'yellow-rice'] },
    'jerk-chicken':              { name: 'Jerk Chicken', course: 'Main', method: 'Oven', time: '4–8 hr + 25', serves: 8, per: '2 thighs', pairs: ['rice-and-peas', 'cilantro-lime-rice'] },
    'rice-and-peas':             { name: 'Rice and Peas', course: 'Side', method: 'Instant Pot', time: '~30 min', serves: 6, per: 'per cup', pairs: ['jerk-chicken'] },
    'fettuccine':                { name: 'Fresh Fettuccine', course: 'Pasta', method: 'Stand mixer', time: '~1 hr', serves: 3, per: 'per nest', pairs: ['cajun-sausage-fettuccine'] },
    'cajun-sausage-fettuccine':  { name: 'Cajun Sausage Fettuccine', course: 'Main', method: 'Skillet', time: '~25 min', serves: 2, per: 'per plate, incl. pasta', pairs: ['fettuccine'] },
    'birria-tacos':              { name: 'Birria Tacos', course: 'Main', method: 'Instant Pot', time: '~2 hr', serves: 5, per: '3 tacos' },
    'banana-pudding-ice-cream':  { name: 'Banana Pudding Ice Cream', course: 'Dessert', method: 'Ninja Creami', time: '24 hr freeze', serves: 1, per: 'half pint', pairs: ['chocolate-banana-ice-cream'] },
    'strawberry-ice-cream':      { name: 'Strawberry Ice Cream', course: 'Dessert', method: 'Ninja Creami', time: '24 hr freeze', serves: 1, per: 'half pint', pairs: ['banana-pudding-ice-cream'] },
    'chocolate-banana-ice-cream':{ name: 'Chocolate Banana Ice Cream', course: 'Dessert', method: 'Ninja Creami', time: '24 hr freeze', serves: 1, per: 'half pint', pairs: ['banana-pudding-ice-cream'] },
    'cilantro-lime-rice':        { name: 'Cilantro Lime Rice', course: 'Side', method: 'Instant Pot', time: '~25 min', serves: 2, per: 'per serving', pairs: ['jerk-chicken'] }
  };

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const articles = $$(CFG.recipe).filter(a => a.id && DATA[a.id]);
  if (!articles.length) return;
  const mq = matchMedia(CFG.mobile);

  const R = articles.map(el => {
    const d = DATA[el.id];
    return { ...d, id: el.id, el, pairs: d.pairs || [], serves: d.serves || 1, text: el.textContent.toLowerCase() };
  });
  const byId = Object.fromEntries(R.map(r => [r.id, r]));
  const courses = [...CFG.courses, ...new Set(R.map(r => r.course).filter(c => !CFG.courses.includes(c)))];
  const st = { q: '', serv: {}, cur: null, closed: new Set(), pushed: false, wantWake: false };
  let checks = {};
  try { checks = JSON.parse(localStorage.getItem('rx-checks') || '{}'); } catch (e) {}

  // Amount scaling: scales every number in an amount ("1½", "2 cups · 300g", "12–16", "1/16").
  const U = { '⅛': .125, '¼': .25, '⅓': 1 / 3, '½': .5, '⅔': 2 / 3, '¾': .75 };
  const FR = [[0, ''], [.125, '⅛'], [.25, '¼'], [1 / 3, '⅓'], [.5, '½'], [2 / 3, '⅔'], [.75, '¾'], [1, '']];
  const fmt = x => {
    if (x >= 10) return String(Math.round(x));
    if (x < .1) return String(+x.toFixed(2));
    const w = Math.floor(x); let b = FR[0];
    for (const o of FR) if (Math.abs(x - w - o[0]) < Math.abs(x - w - b[0])) b = o;
    const n = b[0] === 1 ? w + 1 : w;
    return ((n ? n : '') + b[1]) || '0';
  };
  const TOK = /(\d+)?([⅛¼⅓½⅔¾])|(\d+)\/(\d+)|\d+(?:\.\d+)?/g;
  const scaleText = (t, k) => t.replace(TOK, (m, w, u, n, d) => fmt((u ? Number(w || 0) + U[u] : n ? n / d : Number(m)) * k));

  // Shell
  const shell = document.createElement('div');
  shell.className = 'rx';
  shell.innerHTML = `
    <div class="rx-bar">
      <input type="search" class="rx-search" placeholder="Search recipes or ingredients" aria-label="Search recipes">
    </div>
    <div class="rx-grid">
      <nav class="rx-list" aria-label="All recipes"></nav>
      <div class="rx-detail"></div>
    </div>`;
  articles[0].before(shell);
  const list = $('.rx-list', shell), detail = $('.rx-detail', shell);

  R.forEach(r => {
    detail.appendChild(r.el);
    r.el.hidden = true;
    const pairs = r.pairs.filter(id => byId[id]);
    const panel = document.createElement('section');
    panel.className = 'rx-panel';
    panel.setAttribute('aria-label', 'Recipe tools');
    panel.innerHTML = `
      <div class="rx-tools">
        ${r.serves > 1 ? `<div class="rx-step"><span class="rx-k">Serves</span>
          <button type="button" data-d="-1" aria-label="Fewer servings">−</button><b class="rx-serv" aria-live="polite">${r.serves}</b><button type="button" data-d="1" aria-label="More servings">+</button></div>` : ''}
      </div>
      ${pairs.length ? `<p class="rx-pairs"><span class="rx-k">Goes with</span> ${pairs.map(id => `<a href="#${id}">${esc(byId[id].name)}</a>`).join(' ')}</p>` : ''}
      <div class="rx-actions">
        <button type="button" class="rx-wake" aria-pressed="false"${'wakeLock' in navigator ? '' : ' hidden'}>Keep screen on</button>
        <button type="button" class="rx-link">Copy link</button>
        <button type="button" class="rx-print">Print</button>
      </div>`;
    const slot = $(CFG.slot, r.el);
    if (slot) slot.replaceWith(panel); else ($('h2', r.el) || r.el.firstElementChild).after(panel);
    r.panel = panel;

    const close = document.createElement('button');
    close.type = 'button'; close.className = 'rx-close'; close.textContent = '← All recipes';
    close.addEventListener('click', closeDetail);
    r.el.prepend(close);

    r.amounts = $$(CFG.amount, r.el).map(el => ({ el, orig: el.textContent }));
    $$(CFG.ingredient, r.el).forEach((li, i) => {
      const key = r.id + ':' + i;
      li.classList.add('rx-ing'); li.tabIndex = 0; li.setAttribute('role', 'checkbox');
      const set = v => { li.classList.toggle('is-done', v); li.setAttribute('aria-checked', String(v)); };
      const flip = () => {
        if (checks[key]) delete checks[key]; else checks[key] = 1;
        set(!!checks[key]);
        try { localStorage.setItem('rx-checks', JSON.stringify(checks)); } catch (e) {}
      };
      set(!!checks[key]);
      li.addEventListener('click', e => { if (!e.target.closest('a')) flip(); });
      li.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
    });

    panel.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.d) { st.serv[r.id] = Math.max(1, Math.min(r.serves * 4, (st.serv[r.id] ?? r.serves) + Number(b.dataset.d))); paintDetail(); }
      else if (b.classList.contains('rx-link')) {
        navigator.clipboard?.writeText(location.origin + location.pathname + '#' + r.id);
        b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy link'; }, 1500);
      }
      else if (b.classList.contains('rx-print')) window.print();
      else if (b.classList.contains('rx-wake')) toggleWake();
    });
  });

  function rowHTML(r) {
    const on = r.id === st.cur;
    return `<a class="rx-row${on ? ' is-on' : ''}" href="#${r.id}"${on ? ' aria-current="true"' : ''}>
      <span class="rx-nm"><b>${esc(r.name)}</b><small>${esc([r.method, r.time].filter(Boolean).join(' · '))}</small></span>
    </a>`;
  }

  function paintList() {
    const rows = R.filter(r => !st.q || r.text.includes(st.q));
    const groups = courses.map(c => ({ c, label: CFG.courseLabels[c] || c, items: rows.filter(r => r.course === c) })).filter(g => g.items.length);
    list.innerHTML = `` +
      (groups.length ? groups.map(g => {
        const closed = st.closed.has(g.c) && !st.q;
        return `<div class="rx-group">
          <button type="button" class="rx-gh" data-c="${g.c}" aria-expanded="${!closed}"><span>${esc(g.label)} <small>${g.items.length}</small></span><span aria-hidden="true">${closed ? '▸' : '▾'}</span></button>
          ${closed ? '' : g.items.map(rowHTML).join('')}
        </div>`;
      }).join('') : '<p class="rx-empty">Nothing matches.</p>');
  }

  function paintDetail() {
    R.forEach(r => { r.el.hidden = r.id !== st.cur; });
    const open = !!st.cur && mq.matches;
    document.documentElement.classList.toggle('rx-open', open);
    const r = byId[st.cur]; if (!r) return;
    const serv = st.serv[r.id] ?? r.serves, k = serv / r.serves;
    const sv = $('.rx-serv', r.panel); if (sv) sv.textContent = serv;
    r.amounts.forEach(a => { a.el.textContent = k === 1 ? a.orig : scaleText(a.orig, k); });
  }

  function select(id, { push = false, silent = false } = {}) {
    st.cur = byId[id] ? id : null;
    if (!silent) {
      const url = location.pathname + location.search + (st.cur ? '#' + st.cur : '');
      if (push) { history.pushState({ rx: st.cur }, '', url); st.pushed = true; }
      else history.replaceState({ rx: st.cur }, '', url);
    }
    paintList(); paintDetail();
    if (!st.cur) return;
    if (mq.matches) detail.scrollTop = 0;
    else { const top = detail.getBoundingClientRect().top; if (top < 0) window.scrollTo({ top: scrollY + top - 24 }); }
  }

  function closeDetail() {
    if (st.pushed) history.back();
    else select(null);
  }

  let lock = null;
  async function toggleWake() {
    st.wantWake = !lock;
    try {
      if (lock) { await lock.release(); lock = null; }
      else { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; syncWake(); }); }
    } catch (e) { st.wantWake = false; }
    syncWake();
  }
  function syncWake() {
    $$('.rx-wake').forEach(b => { b.setAttribute('aria-pressed', String(!!lock)); b.textContent = lock ? 'Screen stays on ✓' : 'Keep screen on'; });
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && st.wantWake && !lock) toggleWake(); });

  // Any in-page link to a recipe id (list rows, "Goes with", links inside recipe text) opens that recipe.
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const id = decodeURIComponent(a.getAttribute('href').slice(1)); if (!byId[id]) return;
    e.preventDefault();
    select(id, { push: mq.matches && !st.cur });
  });
  shell.addEventListener('click', e => {
    const g = e.target.closest('.rx-gh');
    if (g) { const c = g.dataset.c; st.closed.has(c) ? st.closed.delete(c) : st.closed.add(c); paintList(); }
  });
  $('.rx-search', shell).addEventListener('input', e => { st.q = e.target.value.trim().toLowerCase(); paintList(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && st.cur && mq.matches) closeDetail(); });
  const fromHash = () => { const x = decodeURIComponent(location.hash.slice(1)); return byId[x] ? x : (mq.matches ? null : (st.cur || R[0].id)); };
  addEventListener('popstate', () => { st.pushed = false; select(fromHash(), { silent: true }); });
  mq.addEventListener('change', () => { if (!mq.matches && !st.cur) select(R[0].id, { silent: true }); else paintDetail(); });

  select(fromHash(), { silent: true });
})();
