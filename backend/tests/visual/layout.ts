export function inspectLayout() {
  const documentWidth = document.documentElement.clientWidth;
  const problems: string[] = [];
  if (document.documentElement.scrollWidth > documentWidth + 1) {
    const elements = Array.from(document.querySelectorAll("main *"))
      .filter(element => element.getBoundingClientRect().right > documentWidth + 1)
      .filter(element => element.getClientRects().length && getComputedStyle(element).position !== "fixed")
      .slice(0, 4).map(element => element.tagName.toLowerCase() + "." + String(element.className).slice(0, 70));
    problems.push(`página desbordada (${document.documentElement.scrollWidth}/${documentWidth}) ${elements.join(", ")}`);
  }

  const controls = Array.from(document.querySelectorAll<HTMLElement>(
    "main button, main input:not([type=hidden]), main select, main textarea, main summary, main a[href]"
  )).filter(element => {
    if (!element.getClientRects().length || element.closest("[inert]")) return false;
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (parent.matches("details:not([open])") && !parent.querySelector(":scope > summary")?.contains(element)) return false;
    }
    const style = getComputedStyle(element);
    return style.visibility === "visible" && style.opacity !== "0";
  });
  const intentionalScroll = (element: HTMLElement) => {
    for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      if (["auto", "scroll"].includes(getComputedStyle(parent).overflowX) && parent.scrollWidth > parent.clientWidth) return true;
    }
    return false;
  };
  const labels = (element: HTMLElement) => (element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "").slice(0, 55);
  const rows = controls.map(control => ({ control, rect: control.getBoundingClientRect() }));
  for (const { control, rect } of rows) {
    if (control.matches("input,select,textarea")) {
      const field = control as HTMLInputElement;
      if (!field.labels?.length && !field.getAttribute("aria-label") && !field.getAttribute("aria-labelledby")) {
        problems.push("control sin etiqueta: " + (field.id || field.type || field.tagName));
      }
    }
    if (rect.width < 1 || rect.height < 1) problems.push("control sin superficie: " + labels(control));
    if ((rect.left < -1 || rect.right > documentWidth + 1) && !intentionalScroll(control)) {
      problems.push("control fuera del ancho: " + labels(control));
    }
  }
  for (const [index, a] of rows.entries()) {
    if (!a.control.matches("button,input,select,textarea")) continue;
    const overlap = rows.slice(index + 1).find(b => {
      if (!b.control.matches("button,input,select,textarea") || a.control.contains(b.control) || b.control.contains(a.control)) return false;
      // The shared password input reserves space for its overlaid toggle.
      if (a.control.parentElement === b.control.parentElement && a.control.parentElement?.matches(".password-field") &&
        [a.control, b.control].some(element => element.matches("button.eye"))) return false;
      return Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left) > 2 &&
        Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top) > 2;
    });
    if (overlap) problems.push("controles superpuestos: " + labels(a.control) + " / " + labels(overlap.control));
  }
  if (documentWidth < 600) {
    for (const actions of document.querySelectorAll(".urow .acts")) {
      const positions = Array.from(actions.querySelectorAll("button"), button => button.getBoundingClientRect());
      if (positions.some((rect, index) => index > 0 && Math.abs(rect.top - positions[index - 1].top) < 2 &&
        rect.left - positions[index - 1].right < 7)) problems.push("acciones de usuario sin separación");
    }
  }
  const sideName = document.querySelector<HTMLElement>(".side-name strong");
  if (sideName?.getClientRects().length && sideName.scrollWidth > sideName.clientWidth + 1) {
    problems.push("nombre de la cuenta recortado");
  }
  const compact = document.querySelector<HTMLElement>(".section-nav.compact");
  if (documentWidth < 600 && compact && compact.scrollWidth > compact.clientWidth + 1) {
    problems.push("secciones de ficha de entrenador fuera del ancho");
  }
  const style = getComputedStyle(document.documentElement);
  const luminance = (name: string) => {
    const value = style.getPropertyValue(name).trim();
    const hex = /^#[0-9a-f]{3}$/i.test(value) ? "#" + [...value.slice(1)].map(c => c + c).join("") : value;
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
    const [r, g, b] = [1, 3, 5].map(index => {
      const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    });
    return .2126 * r + .7152 * g + .0722 * b;
  };
  const surface = luminance("--surf");
  const contrast = ["--ink", "--mute"].map(name => {
    const ink = luminance(name);
    if (ink === null || surface === null) return null;
    return (Math.max(surface, ink) + .05) / (Math.min(surface, ink) + .05);
  });
  if (contrast.some(ratio => ratio === null || ratio < 4.5)) problems.push("contraste insuficiente de tokens de texto");
  return { controls: controls.length, contrast, problems: [...new Set(problems)] };
}
