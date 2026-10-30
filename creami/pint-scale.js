/* Container-size scaling. Always render from the unscaled source amounts. */
(() => {
  const SIZES = {
    original: { label: 'Original', ounces: 16, ml: 473, factor: 1 },
    deluxe: { label: 'Deluxe', ounces: 24, ml: 709, factor: 1.5 }
  };
  const UNICODE = { '¼': .25, '½': .5, '¾': .75, '⅛': .125, '⅜': .375, '⅝': .625, '⅞': .875, '⅓': 1 / 3, '⅔': 2 / 3 };
  const TOKEN = /(?:(\d+)\s+)?(\d+)\/(\d+)|(\d+)?([¼½¾⅛⅜⅝⅞⅓⅔])|\d+(?:\.\d+)?/g;
  let size = 'original';
  const validSize = value => value === 'original' || value === 'deluxe';

  function parseAmount(text) {
    const match = String(text).match(new RegExp(TOKEN.source));
    if (!match) return NaN;
    if (match[2]) return Number(match[1] || 0) + Number(match[2]) / Number(match[3]);
    if (match[5]) return Number(match[4] || 0) + UNICODE[match[5]];
    return Number(match[0]);
  }
  const decimal = value => String(Math.round((value + 1e-8) * 10) / 10);
  function fraction(value) {
    const whole = Math.floor(value + 1e-8);
    const rest = value - whole;
    if (Math.abs(rest) < 1e-7) return String(whole);
    for (const denominator of [2, 3, 4, 8, 16, 32]) {
      const numerator = Math.round(rest * denominator);
      if (Math.abs(rest - numerator / denominator) > 1e-7) continue;
      const symbol = Object.keys(UNICODE).find(key => Math.abs(UNICODE[key] - rest) < 1e-7);
      if (symbol) return (whole ? String(whole) : '') + symbol;
      return (whole ? whole + ' ' : '') + numerator + '/' + denominator;
    }
    return decimal(value);
  }
  function scaleText(text, factor, { fractions = true } = {}) {
    if (factor === 1) return text;
    if (/^(?:small )?pinch$/i.test(text)) return fraction(factor) + (/small/i.test(text) ? ' small pinches' : ' pinches');
    return text.replace(TOKEN, (...args) => {
      const token = args[0];
      const offset = args[args.length - 2];
      const suffix = text.slice(offset + token.length);
      if (/^\s*%/.test(suffix)) return token;
      const unit = suffix.match(/^\s*(g|mg|ml|cal|kcal|calories)\b/i);
      const value = parseAmount(token) * factor;
      return fractions && !unit ? fraction(value) : decimal(value);
    }).replace(/([\d¼½¾⅛⅜⅝⅞⅓⅔]) scoop\b/g, '$1 scoops');
  }
  window.CreamiPints = Object.freeze({
    parseAmount, scaleText,
    getState: () => ({ size, ...SIZES[size] })
  });

  const toolbar = document.getElementById('pint-size-toolbar');
  if (!toolbar) return;
  const recipes = [...document.querySelectorAll('details.recipe')];
  const amounts = new Map();
  const remember = (el, fractions = true) => {
    if (el && !amounts.has(el)) amounts.set(el, { text: el.textContent, fractions });
  };
  const quickFacts = [];
  const gumNotes = [];
  recipes.forEach(recipe => {
    const control = document.createElement('div');
    control.className = 'pint-size-control';
    control.dataset.pintSizeControl = '';
    recipe.querySelector('.recipe-columns').before(control);
    recipe.querySelectorAll('.ingredients label').forEach(label => {
      remember(label.querySelector('.ingredient-amount'));
      const note = label.querySelector('.ingredient-name small');
      if (/xanthan/i.test(label.querySelector('.ingredient-name').firstChild.textContent)) {
        if (note) gumNotes.push(note);
      } else remember(note);
    });
    recipe.querySelectorAll('[data-scale-amount]').forEach(el => remember(el));
    recipe.querySelectorAll('.macro-summary b, .nutrition-detail td, [data-scale-decimal]').forEach(el => remember(el, false));
    const quick = recipe.querySelector('.recipe-quick');
    quickFacts.push({ quick, serving: quick.querySelector('span'), protein: parseAmount(recipe.querySelectorAll('.macro-summary b')[1].textContent) });
  });
  document.querySelectorAll('.batch-table tbody tr').forEach(row => {
    remember(row.cells[1], false); remember(row.cells[2], false);
  });

  const controls = [...document.querySelectorAll('[data-pint-size-control]')];
  controls.forEach(control => {
    const label = document.createElement('span');
    label.className = 'pint-size-label'; label.textContent = 'Your pint size 🍦';
    const group = document.createElement('div');
    group.className = 'pint-size-buttons'; group.setAttribute('role', 'group'); group.setAttribute('aria-label', 'Pint container size');
    Object.entries(SIZES).forEach(([key, config]) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'pint-size-button'; button.dataset.pintSize = key;
      const title = document.createElement('b'); title.textContent = config.label;
      const detail = document.createElement('small'); detail.textContent = `${config.ounces} fl oz · ${config.ml} ml · ${config.factor === 1 ? '1×' : '1½×'}`;
      button.append(title, detail); group.append(button);
      button.addEventListener('click', () => applySize(key));
    });
    control.append(label, group); control.hidden = false;
  });
  document.getElementById('pint-size-note').hidden = false;

  function applySize(next, { save = true, updateUrl = true } = {}) {
    if (!validSize(next)) return;
    size = next;
    const config = SIZES[size];
    document.body.dataset.pintSize = size;
    amounts.forEach(({ text, fractions }, el) => { el.textContent = scaleText(text, config.factor, { fractions }); });
    gumNotes.forEach(el => { el.textContent = `${size === 'deluxe' ? '¾' : '½'} of a level ⅛ tsp`; });
    quickFacts.forEach(({ quick, serving, protein }) => {
      serving.textContent = `${config.label} · ${config.ounces} fl oz · ${config.factor === 1 ? '1×' : '1½×'} recipe`;
      quick.replaceChildren(document.createTextNode(`${decimal(protein * config.factor)} g protein`), serving);
    });
    document.querySelectorAll('button[data-pint-size]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.pintSize === size)));
    document.querySelector('.batch-section .section-heading p').textContent = `Estimates for ${config.label} · ${config.factor === 1 ? '1×' : '1½×'} batch`;
    if (save) { try { localStorage.setItem('creami-pint-size', size); } catch {} }
    if (updateUrl) {
      const url = new URL(location.href); url.searchParams.set('size', size);
      history.replaceState(history.state, '', url);
    }
    const status = document.getElementById('recipe-status');
    if (status) status.textContent = `${config.label} size selected. Ingredients and batch nutrition ${config.factor === 1 ? 'reset to the listed recipe' : 'scaled to one and a half times the listed recipe'}.`;
    window.dispatchEvent(new CustomEvent('creami:pint-size-change', { detail: { size, ...config } }));
  }
  const fromUrl = () => new URL(location.href).searchParams.get('size');
  let initial = fromUrl();
  if (!validSize(initial)) {
    try { initial = localStorage.getItem('creami-pint-size'); } catch {}
  }
  applySize(validSize(initial) ? initial : 'original', { save: false });
  window.addEventListener('popstate', () => {
    const requested = fromUrl();
    if (validSize(requested) && requested !== size) applySize(requested, { updateUrl: false });
  });
})();
