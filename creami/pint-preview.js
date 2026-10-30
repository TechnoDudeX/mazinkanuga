/* A progressive ingredient cutaway, sourced from the recipes below it. */
(() => {
  const root = document.getElementById('pint-preview');
  if (!root) return;
  const $ = selector => root.querySelector(selector);
  const picker = $('.preview-picker');
  const ledger = $('.preview-ledger');
  const fill = $('.glass-fill');
  const pint = $('.glass-pint');
  const readout = $('.preview-layer-readout');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const kinds = {
    milk:       { name: 'Milk', colour: '#f1eadb' },
    chikoo:     { name: 'Chikoo', colour: '#b78359' },
    banana:     { name: 'Banana', colour: '#e5c86e' },
    strawberry: { name: 'Strawberries', colour: '#d77d92' },
    whey:       { name: 'Vanilla whey', colour: '#d7bd94' },
    pudding:    { name: 'Pudding mix', colour: '#e7cd83' },
    extras:     { name: 'Sweetener & extras', colour: '#e4dfc9' },
    mixins:     { name: 'Biscuit mix-in', colour: '#b88958' }
  };
  const palettes = {
    'chikoo-banana': { lid: '#b7cf82', tint: '#edf0e3', pudding: '#e7cd83', label: 'Green lid' },
    'chocolate-biscoff': { lid: '#c7cbc8', tint: '#e9e9e3', pudding: '#80503d', label: 'Grey lid' },
    strawberry: { lid: '#edb7c4', tint: '#f5e8e9', pudding: '#e7a4b3', label: 'Pink lid' },
    'biscoff-cheesecake': { lid: '#84c4ba', tint: '#e5eeea', pudding: '#e8d1a7', label: 'Teal lid' },
    'banana-pudding-ice-cream': { lid: '#e2ce9c', tint: '#f1ecdf', pudding: '#e8d59a', label: 'Fairlife 2%' },
    'chocolate-banana-ice-cream': { lid: '#c1a18b', tint: '#eee7df', pudding: '#80503d', label: 'Fairlife 2%' }
  };
  const make = (tag, className, text) => {
    const el = document.createElement(tag);
    el.className = className;
    if (text) el.textContent = text;
    return el;
  };
  const groupFor = name => {
    if (/milk/i.test(name)) return 'milk';
    if (/whey/i.test(name)) return 'whey';
    if (/mix|pudding/i.test(name)) return 'pudding';
    if (/chikoo/i.test(name)) return 'chikoo';
    if (/banana/i.test(name)) return 'banana';
    if (/strawberr/i.test(name)) return 'strawberry';
    if (/biscuit|wafer|biscoff|parle/i.test(name)) return 'mixins';
    return 'extras';
  };
  // Weights only shape the illustration. Exact cooking measures stay in the ledger.
  function visualWeight(name, amount) {
    const grams = amount.match(/(\d+(?:\.\d+)?)\s*(?:g|ml)\b/i);
    if (grams) return Number(grams[1]);
    const spoon = amount.replace('1½', '1.5').replace('½', '0.5').replace('⅛', '0.125').replace('1/16', '0.0625');
    const quantity = window.CreamiPints?.parseAmount(amount) || parseFloat(spoon) || .1;
    if (/wafer/i.test(name)) return quantity * 4;
    if (/allulose/i.test(name)) return quantity * (/tbsp/.test(spoon) ? 12 : 4);
    if (/vanilla/i.test(name)) return quantity * 4;
    if (/xanthan/i.test(name)) return quantity * 3.2;
    if (/lemon/i.test(name)) return quantity * 5;
    return /pinch/i.test(amount) ? Math.max(.1, quantity * .1) : .1;
  }

  function readRecipe(el, index) {
    const groups = {};
    el.querySelectorAll('.ingredients label').forEach(label => {
      const name = label.querySelector('.ingredient-name').firstChild.textContent.trim();
      const amount = label.querySelector('.ingredient-amount').textContent.trim();
      const key = groupFor(name);
      groups[key] ??= { items: [], weight: 0 };
      groups[key].items.push({ name, amount });
      groups[key].weight += visualWeight(name, amount);
    });
    const macros = [...el.querySelectorAll('.macro-summary b')].map(b => b.textContent);
    return {
      id: el.id, index, name: el.querySelector('.recipe-title').textContent.replace(' with Parle-G', ''),
      description: el.querySelector('.recipe-intro > p').textContent,
      servings: el.querySelector('.recipe-quick span').textContent,
      macros, groups, ...palettes[el.id]
    };
  }
  const recipes = [...document.querySelectorAll('details.recipe')].filter(el => palettes[el.id]).map(readRecipe);
  if (!recipes.length) return;
  const byId = new Map(recipes.map(recipe => [recipe.id, recipe]));
  const layerNodes = new Map();
  const rowNodes = new Map();
  let selected = null;
  let tiltAnimation = null;
  let textAnimation = null;

  function highlight(key) {
    if (key && !selected?.groups[key]) return;
    fill.classList.toggle('is-highlighting', !!key);
    layerNodes.forEach((layer, id) => layer.classList.toggle('is-highlighted', key === id));
    rowNodes.forEach((row, id) => row.classList.toggle('is-highlighted', key === id));
    const group = key && selected.groups[key];
    readout.firstElementChild.textContent = group ? kinds[key].name : 'Tap an ingredient';
    readout.lastElementChild.textContent = group ? group.items.map(item => key === 'extras' ? item.name : `${item.name} · ${item.amount}`).join(' / ') : 'Take a closer look.';
  }

  Object.entries(kinds).forEach(([key, kind]) => {
    const layer = make('button', 'glass-layer');
    layer.type = 'button'; layer.tabIndex = -1; layer.dataset.layer = key;
    layer.setAttribute('aria-hidden', 'true');
    layer.append(make('span', '', kind.name));
    fill.append(layer);
    layerNodes.set(key, layer);

    const row = make('li', 'preview-ingredient');
    row.dataset.layer = key;
    const shell = make('div', '');
    const button = make('button', '');
    button.type = 'button';
    const dot = make('span', 'preview-ingredient-dot');
    dot.setAttribute('aria-hidden', 'true');
    button.append(dot, make('span', 'preview-ingredient-name'), make('span', 'preview-ingredient-amount'));
    shell.append(button); row.append(shell); ledger.append(row);
    rowNodes.set(key, row);
    for (const el of [button, layer]) {
      el.addEventListener('pointerenter', () => highlight(key));
      el.addEventListener('pointerleave', () => {
        if (document.activeElement !== button) highlight(null);
      });
      el.addEventListener('click', () => highlight(key));
    }
    button.addEventListener('focus', () => highlight(key));
    button.addEventListener('blur', () => highlight(null));
  });

  recipes.forEach(recipe => {
    const choice = make('button', 'preview-choice');
    choice.type = 'button'; choice.dataset.recipe = recipe.id;
    choice.setAttribute('aria-pressed', 'false');
    choice.setAttribute('aria-controls', 'preview-name');
    choice.style.setProperty('--choice-colour', recipe.lid);
    const dot = make('span', 'preview-choice-dot');
    dot.setAttribute('aria-hidden', 'true');
    const text = make('span', '');
    text.append(make('b', '', recipe.name.replace(' with Parle-G', '')), make('small', '', recipe.label));
    choice.append(dot, text); picker.append(choice);
    choice.addEventListener('click', () => select(recipe.id));
  });

  function select(id, { force = false } = {}) {
    const next = byId.get(id);
    if (!next || (next === selected && !force)) return;
    const previous = selected;
    selected = next;
    root.dataset.recipe = id;
    const container = window.CreamiPints?.getState() || { size: 'original', label: 'Original', ounces: 16 };
    root.dataset.pintSize = container.size;
    root.style.setProperty('--preview-lid', next.lid);
    root.style.setProperty('--preview-tint', next.tint);
    picker.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.recipe === id)));
    $('.preview-edition').textContent = `${String(next.index + 1).padStart(2, '0')} / ${next.label}`;
    $('.preview-stage-top span:last-child').textContent = `${container.label} · ${container.ounces} fl oz`;
    $('.preview-kicker').textContent = `${next.label} · ${container.label} size · 24 hr freeze`;
    $('#preview-name').textContent = next.name;
    $('.preview-description').textContent = next.description;
    $('.preview-servings').textContent = `${next.servings} · ${id === 'banana-pudding-ice-cream' ? 'estimates exclude optional wafers' : 'nutrition estimates for the whole batch'}`;
    $('.preview-recipe-link').href = '#' + id;
    $('.preview-nutrition').replaceChildren(...['cal ≈', 'protein ≈'].map((label, index) => {
      const value = make('span', '');
      value.append(make('b', '', next.macros[index]), document.createTextNode(label));
      return value;
    }));
    pint.setAttribute('aria-label', `${next.name}, ${container.label} ${container.ounces} fl oz container: an illustrated cutaway of the ingredients listed alongside it.`);

    const visible = Object.keys(kinds).filter(key => next.groups[key]);
    const total = visible.reduce((sum, key) => sum + next.groups[key].weight, 0);
    const minimum = 4.8; // Give small ingredients a visible band, rather than a hairline.
    let bottom = 0;
    Object.entries(kinds).forEach(([key, kind]) => {
      const group = next.groups[key];
      const height = group ? minimum + group.weight / total * (100 - minimum * visible.length) : 0;
      const colour = key === 'pudding' ? next.pudding : kind.colour;
      const layer = layerNodes.get(key);
      const row = rowNodes.get(key);
      layer.style.height = `${height}%`;
      layer.style.bottom = `${bottom}%`;
      layer.style.opacity = group ? '1' : '0';
      layer.style.setProperty('--layer-colour', colour);
      layer.style.setProperty('--layer-ink', colour === '#80503d' ? '#fff4e6' : '#20251f');
      layer.firstElementChild.style.opacity = height >= 8 ? '.75' : '0';
      layer.disabled = !group;
      bottom += height;
      row.classList.toggle('is-visible', !!group);
      row.style.setProperty('--layer-colour', colour);
      const button = row.querySelector('button');
      button.disabled = !group;
      button.tabIndex = group ? 0 : -1;
      row.setAttribute('aria-hidden', String(!group));
      if (!group) return;
      const name = row.querySelector('.preview-ingredient-name');
      const amount = row.querySelector('.preview-ingredient-amount');
      if (key === 'extras') {
        name.replaceChildren(document.createTextNode(kind.name), make('small', '', group.items.map(item => `${item.name.replace(' extract', '').replace(' gum', '')} ${item.amount}`).join(' · ')));
        amount.textContent = '';
      } else {
        name.textContent = group.items.map(item => item.name).join(' + ');
        if (key === 'mixins') name.append(make('small', '', id === 'banana-pudding-ice-cream' ? 'Optional · after spinning' : 'After spinning'));
        amount.textContent = group.items.map(item => item.amount).join(' + ');
      }
    });
    highlight(null);
    $('.preview-announcement').textContent = `${next.name} selected. Ingredient layers and amounts updated.`;
    if (previous && !reducedMotion.matches && pint.animate) {
      tiltAnimation?.cancel(); textAnimation?.cancel();
      const direction = next.index > previous.index ? 1 : -1;
      tiltAnimation = pint.animate([
        { transform: 'rotate(0deg) translateY(0)' },
        { transform: `rotate(${direction * 2}deg) translateY(-5px)`, offset: .3 },
        { transform: 'rotate(0deg) translateY(0)' }
      ], { duration: 850, easing: 'cubic-bezier(.22, 1, .36, 1)' });
      textAnimation = $('.preview-recipe-meta').animate([{ opacity: .3, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 450, easing: 'ease-out' });
    }
  }

  picker.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...picker.querySelectorAll('button')];
    const index = buttons.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault();
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[target].focus(); select(buttons[target].dataset.recipe);
  });
  root.addEventListener('keydown', event => { if (event.key === 'Escape') highlight(null); });
  const fromHash = () => {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    if (id === 'strawberry-ice-cream') id = 'strawberry';
    if (byId.has(id)) select(id);
  };
  select(recipes[0].id);
  fromHash();
  root.hidden = false;
  window.addEventListener('hashchange', fromHash);
  window.addEventListener('creami:pint-size-change', () => {
    recipes.forEach(recipe => Object.assign(recipe, readRecipe(document.getElementById(recipe.id), recipe.index)));
    select(selected.id, { force: true });
  });
})();
