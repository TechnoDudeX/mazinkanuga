/* Progressive enhancements: every recipe is readable without JavaScript. */
(() => {
  const recipes = [...document.querySelectorAll('details.recipe')];
  const byId = new Map(recipes.map(recipe => [recipe.id, recipe]));
  // Older shared strawberry links open the current pink-lid recipe.
  byId.set('strawberry-ice-cream', byId.get('strawberry'));
  const status = document.getElementById('recipe-status');
  const storageKey = 'creami-ingredient-checks';
  let checks = {};
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) checks = stored;
  } catch { /* The checklist still works when storage is unavailable. */ }

  document.querySelectorAll('[data-check]').forEach(input => {
    input.checked = checks[input.dataset.check] === true;
    input.addEventListener('change', () => {
      checks[input.dataset.check] = input.checked;
      try { localStorage.setItem(storageKey, JSON.stringify(checks)); } catch {}
    });
  });

  function openHash() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const recipe = byId.get(id);
    if (!recipe) return;
    recipe.open = true;
    requestAnimationFrame(() => recipe.scrollIntoView({ block: 'start' }));
  }
  window.addEventListener('hashchange', openHash);
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    // A link to the current hash must also reopen a manually closed recipe.
    if (link.hash === location.hash && byId.has(link.hash.slice(1))) openHash();
  });
  openHash();

  document.querySelectorAll('[data-copy]').forEach(button => {
    button.addEventListener('click', async () => {
      const url = new URL(location.href);
      url.hash = button.dataset.copy;
      try {
        await navigator.clipboard.writeText(url.href);
        button.textContent = 'Copied ✓';
        status.textContent = 'Recipe link copied.';
        setTimeout(() => { button.textContent = 'Copy link'; }, 1800);
      } catch {
        // A selectable URL remains available if the browser blocks clipboard access.
        window.prompt('Copy this recipe link:', url.href);
      }
    });
  });

  let printState = null;
  function preparePrint() {
    if (printState) return;
    printState = [...document.querySelectorAll('details')].map(detail => [detail, detail.open]);
    printState.forEach(([detail]) => { detail.open = true; });
  }
  function restorePrint() {
    printState?.forEach(([detail, open]) => { detail.open = open; });
    printState = null;
    delete document.body.dataset.printRecipe;
    recipes.forEach(recipe => recipe.classList.remove('print-selected'));
  }
  window.addEventListener('beforeprint', preparePrint);
  window.addEventListener('afterprint', restorePrint);
  document.querySelectorAll('[data-print]').forEach(button => {
    button.addEventListener('click', () => {
      const recipe = byId.get(button.dataset.print);
      if (!recipe) return;
      document.body.dataset.printRecipe = recipe.id;
      recipe.classList.add('print-selected');
      preparePrint();
      window.print();
    });
  });
})();
