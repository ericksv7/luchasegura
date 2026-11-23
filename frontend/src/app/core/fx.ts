function reduced() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function highlight(el: Element) {
  if (reduced() || !('animate' in el)) return;
  el.animate(
    [
      { outline: '2px solid var(--bad-fg)' },
      { outline: '2px solid transparent' }
    ],
    { duration: 180, easing: 'ease-out' }
  );
}

const box = (el: Element) => el.closest('.input-wrap') ?? el.closest('.field') ?? el;

export function highlightInvalid() {
  document.querySelectorAll('form').forEach((f) => {
    const targets = new Set<Element>();
    f.querySelectorAll('[aria-invalid="true"]').forEach((el) => targets.add(box(el)));
    if (!targets.size && f.querySelector('.error')) {
      f.querySelectorAll('input:not([type=checkbox]):not([type=search])').forEach((el) => targets.add(box(el)));
      const err = f.querySelector('.error');
      if (err) targets.add(err);
    }
    targets.forEach(highlight);
  });
}

export function startFx() {
  // Espera a que Angular pinte los errores.
  document.addEventListener('submit', () => setTimeout(highlightInvalid, 80), true);
}
