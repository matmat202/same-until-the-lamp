/* Where every mark sits on each step of the story. Pure: no DOM, so test/story.test.mjs
 * runs every layout at several plot sizes. Modelled on dish-greens/site/story.
 *
 * Four steps draw the a*b* colour plane (green left, red right, blue down, yellow up), one
 * step draws wavelength:
 *   "daylight": one dot per day at its daylight colour, painted in it (the pair is one dot)
 *   "bulb":     the same days under the bulb, a line from one square's colour to the other's
 *   "fan":      those 366 lines moved to start at the centre: their directions, in one fan
 *   "random":   2,000 metameric pairs nobody optimised, drawn the same way, the fan shaded
 *   "cross":    x = wavelength, how many of the pairs' curves cross in each 5 nm
 */
export const STEPS = { daylight: 'plane', bulb: 'plane', fan: 'plane', random: 'plane', cross: 'nm' };
export const AMAX = 48, BMAX = 32, RANDOM_SCALE = 4;

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
export const median = (xs) => { const s = [...xs].sort((a, b) => a - b), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
/* a split has no arrow: its direction on the a*b* plane, 0-180 degrees */
export const angle = (v) => (((Math.atan2(v[2], v[1]) * 180) / Math.PI) % 180 + 180) % 180;
export const near = (a, c, fan) => Math.min(Math.abs(a - c), 180 - Math.abs(a - c)) <= fan;
const sub = (p, q) => p.map((v, i) => v - q[i]);
export const DATE = (day) => new Date(Date.UTC(2024, 0, 1 + day)).toISOString().slice(5, 10);
const memo = new WeakMap();

/* -> the numbers the story quotes; build_story.py's `check` holds the same */
export function stats(D) {
  if (memo.has(D)) return memo.get(D);
  const R = D.days;
  const dv = R.map((d) => sub(d.lab_b[1], d.lab_b[0]));
  const ang = dv.map(angle), centre = median(ang);
  const ab = dv.map((v) => Math.hypot(v[1], v[2])), dL = dv.map((v) => Math.abs(v[0]));
  const hue = R.map((d) => (((Math.atan2(d.lab_d[0][2], d.lab_d[0][1]) * 180) / Math.PI) + 360) % 360);
  const bins = Array(12).fill(0); for (const h of hue) bins[Math.min(11, Math.floor(h / 30))]++;
  const nc = R.map((d) => d.cross.length), allx = R.flatMap((d) => d.cross);
  const rv = D.random, ra = rv.map(angle), rin = ra.map((a) => near(a, centre, D.fan));
  const rsz = rv.map((v) => Math.hypot(v[1], v[2]));
  const big = rv.map((_, i) => i).sort((a, b) => rsz[b] - rsz[a]).slice(0, Math.floor(rv.length / 10));
  const inBand = (lo, hi) => allx.filter((x) => x >= lo && x < hi).length;
  const S = {
    n: R.length, centre, lo: Math.min(...ang), hi: Math.max(...ang), width: Math.max(...ang) - Math.min(...ang),
    hue_bins_min: Math.min(...bins),
    ab_median: median(ab), dL_median: median(dL), dL_max: Math.max(...dL),
    redder: R.filter((d) => d.lab_b[d.red][1] > d.lab_b[1 - d.red][1]).length,
    cross_min: Math.min(...nc), cross_max: Math.max(...nc),
    cross3: nc.filter((c) => c === 3).length, cross4: nc.filter((c) => c === 4).length,
    band_blue: inBand(430, 480), band_green: inBand(505, 555), band_orange: inBand(580, 630), cross_n: allx.length,
    cross_hi: Math.max(...allx),
    n_random: rv.length, random_share: rin.filter(Boolean).length / rin.length, chance: (2 * D.fan) / 180,
    big_share: big.filter((i) => rin[i]).length / big.length,
    random_dL_median: median(rv.map((v) => Math.abs(v[0]))), random_ab_median: median(rsz),
    dv, ang, rin, allx,
  };
  S.band_mid = [[430, 480], [505, 555], [580, 630]].map(([lo, hi]) => median(allx.filter((x) => x >= lo && x < hi)));
  memo.set(D, S);
  return S;
}

/* -> {X, Y, L, R, T, B, xt: [[px, label]], yt: [[px, label]], marks}, in px of w x h.
 * marks: {kind: 'dot', cx, cy, r, fill} | {kind: 'line', x1, y1, x2, y2, stroke, cls}
 *      | {kind: 'bar', x, y, w, h} | {kind: 'poly', points, cls}; each may carry a tip */
export function layout(name, D, w, h) {
  if (!STEPS[name]) throw new Error(`unknown step ${name}`);
  const S = stats(D), R = D.days;
  const narrow = w < 420;
  const marks = [];
  if (STEPS[name] === 'nm') {
    const L = narrow ? 34 : 44, Rx = w - 8, T = 22, B = h - 22;
    const X = (nm) => L + ((nm - 380) / 350) * (Rx - L);
    const counts = Array(70).fill(0);
    for (const x of S.allx) counts[Math.min(69, Math.floor((x - 380) / 5))]++;
    const top = Math.max(...counts), Y = (c) => B - (c / top) * (B - T);
    counts.forEach((c, i) => {
      if (c) marks.push({ kind: 'bar', cls: 'bar', x: X(380 + 5 * i) + 0.5, y: Y(c), w: Math.max(1, X(385) - X(380) - 1), h: B - Y(c),
        tip: `${380 + 5 * i}-${385 + 5 * i} nm: ${c} of the ${S.n} pairs cross here` });
    });
    const xt = [400, 450, 500, 550, 600, 650, 700].filter((_, i) => !narrow || i % 2 === 0).map((v) => [X(v), `${v} nm`]);
    const yt = [0, 50, 100, 150, 200, 250, 300].filter((v) => v <= top).map((v) => [Y(v) + 4, String(v)]);
    return { kind: name, X, Y, L, R: Rx, T, B, xt, yt, marks };
  }
  // the colour plane, one unit of a* = one unit of b* on screen
  const T = 22, B = h - 22, L0 = narrow ? 8 : 30, R0 = w - 8;
  const k = Math.min((R0 - L0) / (2 * AMAX), (B - T) / (2 * BMAX));
  const cx = (L0 + R0) / 2, cy = (T + B) / 2;
  const X = (a) => cx + a * k, Y = (b) => cy - b * k;
  const L = X(-AMAX), Rx = X(AMAX);
  const r = Math.max(2, Math.min(4.5, k * 1.1));
  if (name === 'daylight') {
    R.forEach((d) => marks.push({ kind: 'dot', cx: X(d.lab_d[0][1]), cy: Y(d.lab_d[0][2]), r, fill: d.daylight[0],
      tip: `${DATE(d.day)}: ${d.daylight[0]} and ${d.daylight[1]} in daylight` }));
  } else if (name === 'bulb') {
    R.forEach((d) => {
      const [p, q] = d.lab_b;
      marks.push({ kind: 'line', cls: 'pair', x1: X(p[1]), y1: Y(p[2]), x2: X(q[1]), y2: Y(q[2]), stroke: '#8a857e', tip: `${DATE(d.day)}: ${d.bulb[0]} and ${d.bulb[1]} under the bulb` });
    });
    R.forEach((d) => d.lab_b.forEach((p, i) => marks.push({ kind: 'dot', cx: X(p[1]), cy: Y(p[2]), r: r * 0.8, fill: d.bulb[i] })));
  } else {
    const fanPoly = () => {
      const len = Math.hypot(AMAX, BMAX), pts = [];
      for (const s of [0, 180]) for (const e of [-D.fan, D.fan]) {
        const t = ((S.centre + s + e) * Math.PI) / 180;
        pts.push([X(Math.max(-AMAX, Math.min(AMAX, len * Math.cos(t)))), Y(Math.max(-BMAX, Math.min(BMAX, len * Math.sin(t))))]);
      }
      // centre, one side's two edges, centre, the other side's
      return [[X(0), Y(0)], pts[0], pts[1], [X(0), Y(0)], pts[2], pts[3]].map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');
    };
    if (name === 'random') marks.push({ kind: 'poly', cls: 'fan', points: fanPoly(), tip: `the ${2 * D.fan}° fan round the daily pairs' direction` });
    const vs = name === 'fan' ? S.dv : D.random, f = name === 'fan' ? 0.5 : 0.5 * RANDOM_SCALE;
    vs.forEach((v, i) => {
      const cls = name === 'fan' ? 'ray' : S.rin[i] ? 'ray rin' : 'ray rout';
      marks.push({ kind: 'line', cls, x1: X(-f * v[1]), y1: Y(-f * v[2]), x2: X(f * v[1]), y2: Y(f * v[2]), stroke: null,
        tip: name === 'fan' ? `${DATE(R[i].day)}: ${Math.round(S.ang[i])}°` : undefined });
    });
  }
  const tks = narrow ? [-40, 0, 40] : [-40, -20, 0, 20, 40];
  const xt = tks.map((a) => [X(a), a === 0 ? 'a* 0' : String(a)]);
  const yt = [-20, 0, 20].map((b) => [Y(b) + 4, b === 0 ? 'b* 0' : String(b)]);
  return { kind: name, X, Y, L, R: Rx, T, B, xt, yt, marks, cx: X(0), cy: Y(0) };
}
