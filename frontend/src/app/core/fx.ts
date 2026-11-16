function reduced() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function shake(el: Element) {
  if (reduced() || !('animate' in el)) return;
  el.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-8px)' },
      { transform: 'translateX(7px)' },
      { transform: 'translateX(-5px)' },
      { transform: 'translateX(3px)' },
      { transform: 'translateX(0)' }
    ],
    { duration: 420, easing: 'ease-in-out' }
  );
}

const box = (el: Element) => el.closest('.input-wrap') ?? el.closest('.field') ?? el;

// Hace vibrar los campos inválidos. Si el error viene del servidor (por ejemplo, contraseña incorrecta),
// vibran los campos de texto del formulario.
export function shakeInvalid() {
  document.querySelectorAll('form').forEach((f) => {
    const targets = new Set<Element>();
    f.querySelectorAll('[aria-invalid="true"]').forEach((el) => targets.add(box(el)));
    if (!targets.size && f.querySelector('.error')) {
      f.querySelectorAll('input:not([type=checkbox]):not([type=search])').forEach((el) => targets.add(box(el)));
      const err = f.querySelector('.error');
      if (err) targets.add(err);
    }
    targets.forEach(shake);
  });
}

export function startFx() {
  // Espera a que Angular pinte los errores antes de moverlos
  document.addEventListener('submit', () => setTimeout(shakeInvalid, 80), true);
}