// First-principles orbital mechanics for the orrery and the live computation
// log: planet positions by solving Kepler's equation from J2000 elements
// (Newton-Raphson), and the Moon from mean elements + the main analytic
// perturbations. No lookup tables — just the elements and the math.
//
// These drive the *visualisation* and the on-screen log. The accurate eclipse
// dates/times and ground POV come from astronomy-engine (see ephemeris.js):
// this module is the "show your work" layer.
//
// Planet elements: Standish (JPL) approximate elements, J2000 + linear rates
// per Julian century. Valid ~1800-2050, which covers the eclipses we show.

const DEG = Math.PI / 180

// [a(AU), e, I(deg), L(deg), ϖ(deg), Ω(deg)] and per-century rates.
const ELEMENTS = {
  Mercury: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593,
            0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  Venus:   [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255,
            0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418],
  Earth:   [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0,
            0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
  Mars:    [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891,
            0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  Jupiter: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909,
            -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  Saturn:  [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448,
            -0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  Uranus:  [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503,
            -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
  Neptune: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574,
            0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664],
  // Pluto — not a planet, but it looks great. From Standish's 3000BC–3000AD
  // element set (the 1800–2050 set above omits Pluto), with its quadratic
  // mean-longitude correction handled via EXTRA_B below.
  Pluto:   [39.48211675, 0.24882730, 17.14001206, 238.92903833, 224.06891629, 110.30393684,
            -0.00031596, 0.00005170, 0.00004818, 145.20780515, -0.04062942, -0.01183482]
}

// Quadratic correction (deg) added to the mean anomaly for the 3000BC–3000AD
// set. Only Pluto needs one here (the 8 planets use the linear 1800–2050 set).
const EXTRA_B = { Pluto: -0.01262724 }

export const PLANET_ORDER = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']

function julianCenturies(date) {
  const jd = date.getTime() / 86400000 + 2440587.5
  return (jd - 2451545.0) / 36525.0
}

function norm360(x) { return ((x % 360) + 360) % 360 }
function norm180(x) { let v = norm360(x); if (v > 180) v -= 360; return v }

/** Solve Kepler's equation E - e*sinE = M (radians) by Newton-Raphson. */
export function solveKepler(M, e) {
  let E = M + e * Math.sin(M)
  for (let i = 0; i < 8; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
    E -= dE
    if (Math.abs(dE) < 1e-9) break
  }
  return E
}

/**
 * Heliocentric ecliptic J2000 position (AU) for one planet, plus the Kepler
 * intermediates (M, E in degrees; r in AU) for the log.
 */
export function planetState(name, date) {
  const el = ELEMENTS[name]
  const T = julianCenturies(date)
  const a = el[0] + el[6] * T
  const e = el[1] + el[7] * T
  const I = (el[2] + el[8] * T) * DEG
  const L = el[3] + el[9] * T
  const wbar = el[4] + el[10] * T
  const Omega = el[5] + el[11] * T

  const b = EXTRA_B[name] ? EXTRA_B[name] * T * T : 0
  const Mdeg = norm180(L - wbar + b)
  const M = Mdeg * DEG
  const E = solveKepler(M, e)

  // position in the orbital plane
  const xp = a * (Math.cos(E) - e)
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E)
  const r = a * (1 - e * Math.cos(E))

  const w = (wbar - Omega) * DEG
  const om = Omega * DEG
  const cw = Math.cos(w), sw = Math.sin(w)
  const co = Math.cos(om), so = Math.sin(om)
  const ci = Math.cos(I), si = Math.sin(I)

  const x = (cw * co - sw * so * ci) * xp + (-sw * co - cw * so * ci) * yp
  const y = (cw * so + sw * co * ci) * xp + (-sw * so + cw * co * ci) * yp
  const z = (sw * si) * xp + (cw * si) * yp

  return { name, pos: [x, y, z], a, e, M: norm180(Mdeg), E: norm180(E / DEG), r }
}

/** All planets at once. */
export function planetStates(date) {
  return PLANET_ORDER.map((n) => planetState(n, date))
}

/**
 * Sample the full orbit ellipse (heliocentric ecliptic, AU) for a planet using
 * its elements at `date` — used to draw the orbit ring in the orrery.
 */
export function orbitPath(name, date, N = 180) {
  const el = ELEMENTS[name]
  const T = julianCenturies(date)
  const a = el[0] + el[6] * T
  const e = el[1] + el[7] * T
  const I = (el[2] + el[8] * T) * DEG
  const wbar = el[4] + el[10] * T
  const Omega = el[5] + el[11] * T
  const w = (wbar - Omega) * DEG
  const om = Omega * DEG
  const cw = Math.cos(w), sw = Math.sin(w)
  const co = Math.cos(om), so = Math.sin(om)
  const ci = Math.cos(I), si = Math.sin(I)
  const b = a * Math.sqrt(1 - e * e)
  const pts = []
  for (let i = 0; i <= N; i++) {
    const E = (i / N) * 2 * Math.PI
    const xp = a * (Math.cos(E) - e)
    const yp = b * Math.sin(E)
    pts.push([
      (cw * co - sw * so * ci) * xp + (-sw * co - cw * so * ci) * yp,
      (cw * so + sw * co * ci) * xp + (-sw * so + cw * co * ci) * yp,
      (sw * si) * xp + (cw * si) * yp
    ])
  }
  return pts
}

/**
 * Low-order Moon position (Meeus, abridged) — mean elements plus the dominant
 * perturbations the log names: evection, variation, annual equation. Returns
 * ecliptic longitude/latitude (deg), distance (km), and node longitude (deg).
 */
export function moonState(date) {
  const T = julianCenturies(date)
  const Lp = norm360(218.3164477 + 481267.88123421 * T)   // mean longitude
  const D = norm360(297.8501921 + 445267.1114034 * T)     // mean elongation
  const M = norm360(357.5291092 + 35999.0502909 * T)      // sun mean anomaly
  const Mp = norm360(134.9633964 + 477198.8675055 * T)    // moon mean anomaly
  const F = norm360(93.2720950 + 483202.0175233 * T)      // argument of latitude
  const Omega = norm360(125.0445479 - 1934.1362891 * T)   // ascending node

  const d = D * DEG, m = M * DEG, mp = Mp * DEG, f = F * DEG

  // longitude perturbations (deg)
  const dL = 6.288774 * Math.sin(mp)
    + 1.274027 * Math.sin(2 * d - mp)   // evection
    + 0.658314 * Math.sin(2 * d)        // variation
    + 0.213618 * Math.sin(2 * mp)
    - 0.185116 * Math.sin(m)            // annual equation
    - 0.114332 * Math.sin(2 * f)
  const lon = norm360(Lp + dL)

  // latitude (deg)
  const lat = 5.128122 * Math.sin(f)
    + 0.280602 * Math.sin(mp + f)
    + 0.277693 * Math.sin(f - mp)
    + 0.173237 * Math.sin(2 * d - f)

  // distance (km)
  const rKm = 385000.56
    - 20905.355 * Math.cos(mp)
    - 3699.111 * Math.cos(2 * d - mp)
    - 2955.968 * Math.cos(2 * d)
    - 569.925 * Math.cos(2 * mp)

  return { lon, lat, rKm, node: Omega, D, M, Mp, F, dL }
}

/** Sun's geocentric ecliptic longitude (deg), from Earth's heliocentric pos. */
export function sunLongitude(date) {
  const e = planetState('Earth', date).pos
  return norm360(Math.atan2(-e[1], -e[0]) / DEG)
}

/**
 * The eclipse-test snapshot the log shows: elongation, Sun-Moon angular
 * separation, and the ecliptic limit. This is the from-scratch geometry; the
 * authoritative dates come from astronomy-engine.
 */
export function eclipseTest(date) {
  const moon = moonState(date)
  const lamSun = sunLongitude(date)
  const elongation = norm360(moon.lon - lamSun)

  // angular separation Sun(lat~0) vs Moon(lat) on the sphere
  const dLam = (moon.lon - lamSun) * DEG
  const bM = moon.lat * DEG
  const cos = Math.cos(bM) * Math.cos(dLam)
  const sepDeg = Math.acos(Math.max(-1, Math.min(1, cos))) / DEG

  // limit ≈ Moon semidiameter + Sun semidiameter + (Moon - Sun) parallax
  const sMoon = Math.asin(1737.4 / moon.rKm) / DEG
  const sSun = 0.2666
  const parMoon = Math.asin(6378.14 / moon.rKm) / DEG
  const limit = sMoon + sSun + parMoon - 0.0024
  const near = Math.abs(norm180(elongation)) < 20 || Math.abs(norm180(elongation - 180)) < 20

  return { elongation, sepDeg, limit, isEclipse: sepDeg < limit, nearNewMoon: near, moon, lamSun }
}
