/* The scrolling story: each <section class="step"> names a layout in data-step; as the
 * reader scrolls into a step, the chart redraws in that layout. Numbers in the prose are
 * not typed in: a <b data-fact="..."> is computed here from story.json, and
 * test/story.test.mjs checks each against the `check` block build_story.py computed in
 * python. Modelled on dish-greens/site/story. */
import { layout, stats, STEPS, RANDOM_SCALE } from './layout.js';

const pct = (v) => `${Math.round(v * 100)}%`;
const deg = (v) => `${Math.round(v)}°`;

/* Unknown names throw: a typo must not render as blank */
export function fact(D, f) {
  const S = stats(D), rb = D.robust;
  switch (f) {
    case 'n': case 'redder': case 'cross3': case 'cross4': case 'n_random': return S[f].toLocaleString('en-US');
    case 'width': return deg(S.width);
    case 'fan': return deg(2 * D.fan);
    case 'ab_median': case 'dL_median': return (Math.round(S[f] * 10) / 10).toFixed(1);
    case 'random_share': case 'chance': case 'big_share': return pct(S[f]);
    case 'times_chance': return `${(S.random_share / S.chance).toFixed(1)} times`;
    case 'band1': case 'band2': case 'band3': return `${Math.round(S.band_mid[+f.slice(-1) - 1])} nm`;
    case 'random_scale': return `${RANDOM_SCALE} times`;
    case 'brad_width': return deg(rb.Bradford.hi - rb.Bradford.lo);
    case 'none_width': return deg(rb.none.hi - rb.none.lo);
    case 'brad_share': return pct(rb.Bradford.random_share);
    case 'none_share': return pct(rb.none.random_share);
    default: throw new Error(`unknown fact ${f}`);
  }
}

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); return e; };

async function main() {
  const D = await (await fetch('story.json')).json();
  for (const e of document.querySelectorAll('[data-fact]')) e.textContent = fact(D, e.dataset.fact);
  const steps = [...document.querySelectorAll('.step')];
  for (const s of steps) if (!STEPS[s.dataset.step]) throw new Error(`unknown step ${s.dataset.step}`);
  const plot = document.getElementById('plot');
  const svg = el('svg', { id: 'chart' });
  const gAxis = el('g', { class: 'axis' }), gS = el('g'), gLab = el('g', { class: 'labels' });
  svg.append(gAxis, gS, gLab);
  plot.append(svg);
  const tick = (g, x, y, text, cls = 'tick') => { const t = el('text', { x, y, class: cls }); t.textContent = text; g.append(t); };
  const grid = (x1, y1, x2, y2, cls = 'grid') => gAxis.append(el('line', { x1, x2, y1, y2, class: cls }));

  let shown = -1;
  const draw = (i) => {
    const name = steps[i].dataset.step;
    const box = plot.getBoundingClientRect(), W = box.width, H = box.height;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const L = layout(name, D, W, H);
    const narrow = W < 420;
    gAxis.replaceChildren(); gLab.replaceChildren();
    if (STEPS[name] === 'plane') {
      for (const [x, label] of L.xt) { grid(x, L.T, x, L.B); tick(gAxis, x + 2, L.B + 15, label); }
      for (const [y, label] of L.yt) { grid(L.L, y - 4, L.R, y - 4); tick(gAxis, L.L + 2, y - 7, label); }
      grid(L.L, L.cy, L.R, L.cy, 'grid axisline'); grid(L.cx, L.T, L.cx, L.B, 'grid axisline');
      tick(gLab, L.L + 2, L.cy + 15, 'green', 'tick lab'); tick(gLab, L.R - 2, L.cy + 15, 'red', 'tick lab end');
      tick(gLab, L.cx + 4, L.T + 12, 'yellow', 'tick lab'); tick(gLab, L.cx + 4, L.B - 6, 'blue', 'tick lab');
    } else {
      for (const [x, label] of L.xt) { grid(x, L.T, x, L.B); tick(gAxis, x + 2, L.B + 15, label); }
      for (const [y, label] of L.yt) tick(gAxis, L.L - 5, y, label, 'tick end');
      grid(L.L, L.B, L.R, L.B, 'grid axisline');
    }
    const cap = {
      daylight: narrow ? 'each day’s pair, in daylight' : 'each day’s pair in daylight, painted in its colour (the two squares are one dot)',
      bulb: narrow ? 'under the bulb: square to square' : 'under the bulb: a line from one square’s colour to the other’s',
      fan: narrow ? 'the same 366 lines, from the centre' : 'the same 366 lines, moved to start at the centre',
      random: narrow ? `2,000 unoptimised pairs, ×${RANDOM_SCALE}` : `2,000 metameric pairs nobody optimised, drawn ${RANDOM_SCALE}× larger; shaded, the daily pairs’ fan`,
      cross: narrow ? 'where the curves cross, per 5 nm' : 'where each pair’s two reflectance curves cross, counted per 5 nm',
    }[name];
    tick(gAxis, 4, L.T - 9, cap, 'tick cat');
    gS.replaceChildren();
    for (const m of L.marks) {
      const e = m.kind === 'dot' ? el('circle', { cx: m.cx, cy: m.cy, r: m.r, fill: m.fill, class: 'dot' })
        : m.kind === 'line' ? el('line', { x1: m.x1, y1: m.y1, x2: m.x2, y2: m.y2, stroke: m.stroke, class: m.cls })
        : m.kind === 'poly' ? el('polygon', { points: m.points, class: m.cls })
        : el('rect', { x: m.x, y: m.y, width: Math.max(0, m.w), height: Math.max(0, m.h), class: m.cls });
      if (m.tip) { e.append(el('title')); e.firstChild.textContent = m.tip; }
      gS.append(e);
    }
    document.body.dataset.step = i;
    window.__story = { step: i, name, shown: L.marks.length };
  };

  const pick = () => {
    const line = innerHeight * 0.5;
    let i = 0;
    for (let k = 0; k < steps.length; k++) if (steps[k].getBoundingClientRect().top < line) i = k;
    if (i !== shown) { shown = i; draw(i); }
  };
  addEventListener('scroll', pick, { passive: true });
  addEventListener('resize', () => { shown = -1; pick(); });
  pick();
}

if (typeof document !== 'undefined') main().catch((e) => {
  document.body.classList.add('failed');
  document.getElementById('err').textContent = String(e.message || e);
  console.error(e);
});
