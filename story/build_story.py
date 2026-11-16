#!/usr/bin/env python3
"""site/pairs.json -> site/story/story.json: every pair comes apart the same way.

    ../whiteboard-tutor/.venv/bin/python build_story.py    # BUILD_OUT=... writes elsewhere (publish.sh compares)

The page shows one pair a day. This asks what the 366 have in common once the bulb is on: in
which direction, on the a*b* plane, do the two colours move apart? Every colour comes from the
project's own colorimetry.py (imported, not copied), on the shipped curves in site/pairs.json:

  daylight Lab   lab(appearance(curve, "D65")), CIE 1931 2 deg observer
  bulb Lab       lab(appearance(curve, "A")): illuminant A, CAT02-adapted to D65, as the page shows
  direction      atan2(db*, da*) of the bulb difference, mod 180 (a split has no arrow)
  crossings      where the two reflectance curves cross, linearly interpolated between 5 nm samples

Found by looking, 2026-11-16, so the story calls it that and shows two checks:
  random     2,000 metameric pairs nobody optimised: a random smooth paint (10 knots, 0.15-0.8),
             plus and minus a random D65 "metameric black" (a curve D65 cannot see), scaled to stay
             within 0.03-0.95. Their directions, against chance (a 30 deg fan is 1/6 of 180 deg).
  adaptation the same fan with Bradford and with no adaptation (XYZ scaling) in place of CAT02.

test/story.test.mjs recomputes every number in `check` in JS from `days` and `random` (site/story/
layout.js stats()) and requires the two to agree; it also requires `days` to match pairs.json
hex for hex, its crossings re-found from pairs.json's curves, and its Lab within 8-bit rounding of
the hexes.
"""
import json, os
import numpy as np

import colorimetry as C

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("BUILD_OUT", os.path.join(HERE, "site", "story", "story.json"))
N_RANDOM, SEED, FAN = 2000, 20261116, 15
BRADFORD = np.array([[0.8951, 0.2664, -0.1614], [-0.7502, 1.7135, 0.0367], [0.0389, -0.0685, 1.0296]])


def bulb_lab(R, M=C.M02):
    """lab under A, von Kries-adapted to D65 in the cone space M (identity = XYZ scaling)."""
    ws, wd = M @ C.WHITE["A"], M @ C.WHITE["D65"]
    return C.lab(np.linalg.solve(M, (wd / ws) * (M @ C.xyz(R, "A"))))


def angle(v):
    return float(np.degrees(np.arctan2(v[2], v[1])) % 180)


def crossings(a, b, nm):
    """Sign changes of a - b. Runs of exact zeros (the curves are rounded to 3 places) are
    skipped: the crossing sits between the last sample before the run and the first after."""
    d = np.asarray(a) - np.asarray(b)
    nz = [i for i in range(len(d)) if d[i] != 0]
    out = []
    for i, j in zip(nz, nz[1:]):
        if d[i] * d[j] < 0:
            out.append(round(float(nm[i] + (nm[j] - nm[i]) * d[i] / (d[i] - d[j])), 1))
    return out


def near(a, c):
    return min(abs(a - c), 180 - abs(a - c)) <= FAN


def main():
    P = json.load(open(os.path.join(HERE, "site", "pairs.json")))
    nm = np.array(P["nm"], float)
    days = []
    for r in P["days"]:
        R = [np.array(c) for c in r["curves"]]
        dl = [C.lab(C.xyz(c, "D65")) for c in R]
        bl = [bulb_lab(c) for c in R]
        red = int(R[1][nm >= 620].mean() > R[0][nm >= 620].mean())
        days.append({"day": r["day"], "daylight": r["daylight"], "bulb": r["bulb"],
                     "lab_d": [[round(float(v), 2) for v in l] for l in dl],
                     "lab_b": [[round(float(v), 2) for v in l] for l in bl],
                     "cross": crossings(*R, nm), "red": red,
                     "long": [round(float(c[nm >= 620].mean()), 3) for c in R]})

    # metameric pairs nobody optimised
    Mx = np.array([C.xyz(C.BASIS[k], "D65") for k in range(C.K)]).T
    null = np.linalg.svd(Mx)[2][3:]
    rng = np.random.default_rng(SEED)
    pairs = []
    for _ in range(N_RANDOM):
        base = rng.uniform(0.15, 0.8, C.K)
        k = null.T @ rng.normal(size=null.shape[0])
        k *= np.minimum(base - 0.03, 0.95 - base).min() / np.abs(k).max()
        pairs.append((C.reflectance(base + k), C.reflectance(base - k)))

    def fan(M):
        shipped = [angle(bulb_lab(np.array(r["curves"][1]), M) - bulb_lab(np.array(r["curves"][0]), M)) for r in P["days"]]
        c = float(np.median(shipped))
        rand = [angle(bulb_lab(b, M) - bulb_lab(a, M)) for a, b in pairs]
        return {"centre": round(c, 1), "lo": round(min(shipped), 1), "hi": round(max(shipped), 1),
                "random_share": round(sum(near(a, c) for a in rand) / len(rand), 3)}

    random = []
    for a, b in pairs:
        v = bulb_lab(b) - bulb_lab(a)
        random.append([round(float(x), 2) for x in v])
    D = {"source": "the 366 shipped pairs of site/pairs.json, through the project's colorimetry.py "
                   "(CIE 1931 2 deg, D65 and illuminant A, CAT02); random metamers seeded " + str(SEED),
         "fan": FAN, "days": days, "random": random,
         "robust": {"CAT02": fan(C.M02), "Bradford": fan(BRADFORD), "none": fan(np.eye(3))}}

    # the numbers the story quotes, as layout.js stats() computes them
    dv = [np.array(d["lab_b"][1]) - np.array(d["lab_b"][0]) for d in days]
    ang = [angle(v) for v in dv]
    centre = float(np.median(ang))
    ab = [float(np.hypot(v[1], v[2])) for v in dv]
    dL = [abs(float(v[0])) for v in dv]
    hue = [float(np.degrees(np.arctan2(d["lab_d"][0][2], d["lab_d"][0][1])) % 360) for d in days]
    nc = [len(d["cross"]) for d in days]
    rv = [np.array(v) for v in random]
    ra = [angle(v) for v in rv]
    rin = [near(a, centre) for a in ra]
    rsz = [float(np.hypot(v[1], v[2])) for v in rv]
    big = sorted(range(len(rv)), key=lambda i: -rsz[i])[:len(rv) // 10]
    redder = sum((d["lab_b"][d["red"]][1] > d["lab_b"][1 - d["red"]][1]) for d in days)
    allx = [x for d in days for x in d["cross"]]
    D["check"] = {
        "n": len(days), "centre": centre, "lo": min(ang), "hi": max(ang), "width": max(ang) - min(ang),
        "hue_bins_min": int(min(np.histogram(hue, bins=12, range=(0, 360))[0])),
        "ab_median": float(np.median(ab)), "dL_median": float(np.median(dL)), "dL_max": max(dL),
        "redder": int(redder),
        "cross_min": min(nc), "cross_max": max(nc), "cross3": nc.count(3), "cross4": nc.count(4),
        "band_blue": sum(430 <= x < 480 for x in allx), "band_green": sum(505 <= x < 555 for x in allx),
        "band_orange": sum(580 <= x < 630 for x in allx), "cross_n": len(allx),
        "cross_hi": max(allx),
        "n_random": len(rv), "random_share": sum(rin) / len(rin), "chance": 2 * FAN / 180,
        "big_share": sum(rin[i] for i in big) / len(big),
        "random_dL_median": float(np.median([abs(v[0]) for v in rv])),
        "random_ab_median": float(np.median(rsz)),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(D, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print("  ".join(f"{k} {round(v, 3) if isinstance(v, float) else v}" for k, v in D["check"].items()))
    print("robust:", D["robust"])


if __name__ == "__main__":
    main()
