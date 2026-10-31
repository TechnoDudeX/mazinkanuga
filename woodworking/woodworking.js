(() => {
  const filters = document.querySelector('.filters');
  const cards = [...document.querySelectorAll('.project')];
  filters.hidden = false;
  filters.addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    filters.querySelectorAll('button').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
    cards.forEach(card => { card.hidden = button.dataset.filter !== 'all' && card.dataset.category !== button.dataset.filter; });
    const count = cards.filter(card => !card.hidden).length;
    document.getElementById('project-status').textContent = `${count} project${count === 1 ? '' : 's'} shown.`;
  });
  const choice = document.getElementById('model-choice');
  const full = document.querySelector('.model-full');
  document.querySelector('.model-launcher').hidden = false;
  const routes = { cabinet: '/cabinet/model.html', console: '/console/model.html', closet: '/closet/model.html' };
  choice.addEventListener('change', () => { full.href = routes[choice.value]; });
  document.getElementById('load-model').addEventListener('click', () => {
    const frame = document.createElement('iframe');
    frame.title = `${choice.selectedOptions[0].textContent} interactive 3D model`;
    frame.src = routes[choice.value] + '?embed';
    document.getElementById('model-stage').replaceChildren(frame);
    full.href = routes[choice.value];
  });
})();