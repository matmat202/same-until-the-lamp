// Same Until the Lamp: show today's precomputed metameric pair (pairs.json, built by build.py).
"use strict";

function dayIndex(d) {
  // 0-based day of the year in local time; Jan 1 = 0, Dec 31 = 364 or 365
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 1)) / 864e5);
}

function pickDate() {
  const m = /[?&]d=(\d{4})-(\d{2})-(\d{2})/.exec(location.search);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (!isNaN(d) && d.getMonth() === +m[2] - 1) return d;
  }
  return new Date();
}

function isoDate(d) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function chart(svg, nm, curves, colours) {
  const W = 600, H = 260, L = 70, R = 10, T = 14, B = 34;
  const x = v => L + (v - nm[0]) / (nm[nm.length - 1] - nm[0]) * (W - L - R);
  const y = v => T + (1 - v) * (H - T - B);
  let s = `<line class="axis" x1="${L}" y1="${y(0)}" x2="${W - R}" y2="${y(0)}"/>` +
          `<line class="axis" x1="${L}" y1="${y(1)}" x2="${W - R}" y2="${y(1)}"/>` +
          `<text class="lbl" x="${L - 6}" y="${y(1) + 4}" text-anchor="end">100%</text>` +
          `<text class="lbl" x="${L - 6}" y="${y(0) + 4}" text-anchor="end">0%</text>`;
  for (const w of [400, 500, 600, 700]) s += `<text class="lbl" x="${x(w)}" y="${H - 8}" text-anchor="middle">${w} nm</text>`;
  curves.forEach((c, i) => {
    const pts = c.map((v, j) => `${x(nm[j]).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    s += `<polyline fill="none" stroke="${colours[i]}" stroke-width="3" points="${pts}"${i ? ' stroke-dasharray="7 4"' : ""}/>`;
  });
  svg.innerHTML = s;
}

async function main() {
  const date = pickDate();
  const data = await (await fetch("pairs.json")).json();
  const day = data.days[Math.min(dayIndex(date), data.days.length - 1)];
  const $ = id => document.getElementById(id);
  const stage = $("stage"), sw = [$("s0"), $("s1")], state = $("state"), btn = $("toggle"), ledBtn = $("led");
  $("date").textContent = date.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // Yesterday's pair, and so on back; forward only as far as today, so tomorrow stays new.
  const shift = n => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
  const now = new Date(), isToday = isoDate(date) === isoDate(now);
  $("prev").href = "?d=" + isoDate(shift(-1));
  if (isoDate(date) < isoDate(now)) { $("next").href = "?d=" + isoDate(shift(1)); $("next").hidden = false; }
  $("today").hidden = isToday;
  if (!isToday) $("share").textContent = "Share this pair";

  // Two lamps: the old incandescent (CIE A) and a warm-white LED (CIE LED-B1), the bulb most homes have now.
  const LAMP_NAME = { bulb: "Bulb", led: "LED" };
  let on = null, timer = null;
  function paint(which, grey) {
    stage.style.backgroundColor = grey;
    sw.forEach((el, i) => { el.style.backgroundColor = day[which][i]; });
  }
  function daylight() {
    clearTimeout(timer);
    stage.classList.remove("raw");
    paint("daylight", data.grey.daylight);
    on = null;
    btn.textContent = "Switch on the warm bulb";
    ledBtn.textContent = "…or a warm LED";
    state.textContent = "Daylight: the two squares match.";
  }
  function lamp(which) {
    clearTimeout(timer);
    on = which;
    stage.classList.add("raw");
    paint(which + "_raw", data.grey[which + "_raw"]);
    state.textContent = `${LAMP_NAME[which]} on: everything goes orange at first…`;
    btn.textContent = which === "bulb" ? "Back to daylight" : "Switch on the warm bulb";
    ledBtn.textContent = which === "led" ? "Back to daylight" : "…or a warm LED";
    timer = setTimeout(() => {
      stage.classList.remove("raw");
      paint(which, data.grey[which]);
      state.textContent = "…then your eyes adjust, and the two squares are no longer the same colour.";
    }, 700);
  }
  btn.addEventListener("click", () => { on === "bulb" ? daylight() : lamp("bulb"); });
  ledBtn.addEventListener("click", () => { on === "led" ? daylight() : lamp("led"); });
  daylight();

  // How far apart, in the unit the pair was built in; the day's own numbers, checked against its curves by test.py.
  $("gap").textContent = `How far apart, in CIEDE2000 units (about 1 is the smallest difference most people can see side by side): ` +
    `${day.match.toFixed(1)} in daylight, ${Math.round(day.split)} under the bulb, ${Math.round(day.led_split)} under a warm LED.`;

  // Every split runs green against magenta, the axis a deuteranope barely sees (day.deutan, Machado 2009,
  // re-derived from the shown squares by test.py). Say so, and point to the past day that splits most for them.
  let best = null;
  for (let k = 0; k < 366; k++) {
    const t = shift(-k), e = data.days[Math.min(dayIndex(t), data.days.length - 1)];
    if (!best || e.deutan > best.e.deutan) best = { t, e };
  }
  const dn = Math.round(day.deutan);
  $("cvd").innerHTML = `Red-green colour-blind? With deuteranopia (simulated), this pair is ${dn} apart under the bulb` +
    (dn < 5 ? `, so it may still look like one colour to you.` : `.`) +
    (isoDate(best.t) === isoDate(date) ? ` No pair in the past year comes apart more for you.`
      : ` The pair from <a href="?d=${isoDate(best.t)}">${best.t.toLocaleDateString(undefined, { month: "long", day: "numeric" })}</a>` +
        ` comes apart most for you: ${Math.round(best.e.deutan)}.`);

  chart($("chart"), data.nm, day.curves, day.bulb);
  $("legend").textContent = "Solid line: the left square. Dashed: the right square. Each line is drawn in the colour its square takes under the bulb.";

  $("share").addEventListener("click", async () => {
    // The day's own stub (card.py): its link preview shows THIS pair, and it forwards ?d= to this page.
    const url = new URL(`day/${String(dayIndex(date)).padStart(3, "0")}.html?d=${isoDate(date)}`, location.href).href;
    const text = "These two squares are the same colour, until you switch on a lamp.";
    try {
      if (navigator.share) await navigator.share({ title: "Same Until the Lamp", text, url });
      else { await navigator.clipboard.writeText(url); state.textContent = "Link copied."; }
    } catch (e) { /* share sheet dismissed */ }
  });
}

main().catch(e => { document.getElementById("state").textContent = "Could not load today's pair: " + e.message; });
