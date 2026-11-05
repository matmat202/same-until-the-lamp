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
  const stage = $("stage"), sw = [$("s0"), $("s1")], state = $("state"), btn = $("toggle");
  $("date").textContent = date.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  let bulb = false, timer = null;
  function paint(which, grey) {
    stage.style.backgroundColor = grey;
    sw.forEach((el, i) => { el.style.backgroundColor = day[which][i]; });
  }
  function daylight() {
    clearTimeout(timer);
    stage.classList.remove("raw");
    paint("daylight", data.grey.daylight);
    btn.textContent = "Switch on the warm bulb";
    state.textContent = "Daylight: the two squares match.";
  }
  function lamp() {
    stage.classList.add("raw");
    paint("bulb_raw", data.grey.bulb_raw);
    state.textContent = "Bulb on: everything goes orange at first…";
    btn.textContent = "Back to daylight";
    timer = setTimeout(() => {
      stage.classList.remove("raw");
      paint("bulb", data.grey.bulb);
      state.textContent = "…then your eyes adjust, and the two squares are no longer the same colour.";
    }, 700);
  }
  btn.addEventListener("click", () => { bulb = !bulb; bulb ? lamp() : daylight(); });
  daylight();

  chart($("chart"), data.nm, day.curves, day.bulb);
  $("legend").textContent = "Solid line: the left square. Dashed: the right square. Each line is drawn in the colour its square takes under the bulb.";

  $("share").addEventListener("click", async () => {
    const url = location.origin + location.pathname + "?d=" + isoDate(date);
    const text = "These two squares are the same colour, until you switch on a lamp.";
    try {
      if (navigator.share) await navigator.share({ title: "Same Until the Lamp", text, url });
      else { await navigator.clipboard.writeText(url); state.textContent = "Link copied."; }
    } catch (e) { /* share sheet dismissed */ }
  });
}

main().catch(e => { document.getElementById("state").textContent = "Could not load today's pair: " + e.message; });
