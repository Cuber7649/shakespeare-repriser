// WCAG contrast maths shared by the quote-card test and the CSS contrast gate.
// Colours may be #rgb/#rrggbb strings or [r, g, b] arrays; alpha is handled by
// blend() before a ratio is taken.

export function srgb(c) {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function parseColor(value) {
  const s = String(value || '').trim();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (m) {
    const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(s);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
  return null;
}

// Composite a possibly translucent foreground over an opaque background.
export function blend(fg, bg) {
  const a = fg[3];
  if (a >= 1) return [fg[0], fg[1], fg[2], 1];
  return [
    Math.round(fg[0] * a + bg[0] * (1 - a)),
    Math.round(fg[1] * a + bg[1] * (1 - a)),
    Math.round(fg[2] * a + bg[2] * (1 - a)),
    1,
  ];
}

export function lumOf(color) {
  const c = Array.isArray(color) ? color : parseColor(color);
  if (!c) throw new Error(`unparseable colour: ${color}`);
  return 0.2126 * srgb(c[0]) + 0.7152 * srgb(c[1]) + 0.0722 * srgb(c[2]);
}

export function contrastRatio(a, b) {
  const [l1, l2] = [lumOf(a), lumOf(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
