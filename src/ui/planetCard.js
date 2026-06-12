// Planet info popup: shown when a planet is clicked in the orrery. Mixes live
// values from the Kepler engine (current distance, semi-major axis, and the
// orbital period via Kepler's third law P² = a³) with standard physical facts
// (rotation period, radius). The "photo" is a small procedurally-drawn
// portrait — no image downloads.

import { BODY_META } from '../physics/bodies.js'

// Sidereal rotation periods (the precise sense of "length of day").
const ROTATION = {
  Mercury: '58.6 days',
  Venus: '243 days · retrograde',
  Earth: '23.93 hours',
  Mars: '24.6 hours',
  Jupiter: '9.9 hours',
  Saturn: '10.7 hours',
  Uranus: '17.2 hours · retrograde',
  Neptune: '16.1 hours',
  Pluto: '6.4 days'
}

const portraitCache = {}

export class PlanetCard {
  constructor(el) {
    this.el = el
    this.name = null
    this._liveEl = null
  }

  /** @param state result of planetState(name, date): { a, e, r } */
  show(name, state) {
    this.name = name
    const meta = BODY_META[name]
    const P = Math.pow(state.a, 1.5) // years — Kepler's third law
    const period = P < 1 ? (P * 365.25).toFixed(1) + ' days' : P.toFixed(1) + ' years'
    const kind = name === 'Pluto' ? 'dwarf planet' : 'planet'
    this.el.innerHTML = `
      <button class="close" title="close">✕</button>
      <div class="head">
        <img src="${portrait(name, meta.color)}" width="64" height="64" alt="" />
        <div>
          <div class="eyebrow">${kind}</div>
          <h3>${name.toUpperCase()}</h3>
        </div>
      </div>
      <div class="kv"><span>distance from Sun</span><b class="live">${state.r.toFixed(3)} AU</b></div>
      <div class="kv"><span>semi-major axis</span><b>${state.a.toFixed(2)} AU</b></div>
      <div class="kv"><span>orbital period</span><b>${period}</b></div>
      <div class="kv"><span>rotation period</span><b>${ROTATION[name]}</b></div>
      <div class="kv"><span>radius</span><b>${meta.radiusKm.toLocaleString()} km</b></div>
      <div class="foot">period computed from Kepler's third law: P = a³ᐟ² = ${state.a.toFixed(2)}³ᐟ² = ${P.toFixed(2)} yr</div>`
    this.el.classList.remove('hidden')
    this._liveEl = this.el.querySelector('.live')
    this.el.querySelector('.close').addEventListener('click', () => this.hide())
  }

  /** Sun card. `rEarthAu` = current Earth–Sun distance from the Kepler engine. */
  showSun(rEarthAu) {
    this.name = 'Sun'
    this.el.innerHTML = `
      <button class="close" title="close">✕</button>
      <div class="head">
        <img src="${portrait('Sun', BODY_META.Sun.color)}" width="64" height="64" alt="" />
        <div>
          <div class="eyebrow">G2V main-sequence star</div>
          <h3>SUN</h3>
        </div>
      </div>
      <div class="kv"><span>distance from Earth</span><b class="live">${rEarthAu.toFixed(3)} AU</b></div>
      <div class="kv"><span>radius</span><b>${BODY_META.Sun.radiusKm.toLocaleString()} km</b></div>
      <div class="kv"><span>rotation period</span><b>~25 days · equator</b></div>
      <div class="kv"><span>surface temp</span><b>5,772 K</b></div>
      <div class="kv"><span>age</span><b>~4.6 billion yr</b></div>
      <div class="foot">holds 99.86% of the solar system's mass · Earth's mean distance defines the AU: 149,597,870.7 km</div>`
    this.el.classList.remove('hidden')
    this._liveEl = this.el.querySelector('.live')
    this.el.querySelector('.close').addEventListener('click', () => this.hide())
  }

  /** Refresh the live distance readout as time plays. */
  updateLive(state) {
    if (this._liveEl && state) this._liveEl.textContent = state.r.toFixed(3) + ' AU'
  }

  hide() {
    this.el.classList.add('hidden')
    this.name = null
    this._liveEl = null
  }
}

/** Small shaded-sphere portrait as a data URL (cached per planet). */
function portrait(name, color) {
  if (portraitCache[name]) return portraitCache[name]
  const S = 96, c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')
  const cx = S / 2, cy = S / 2, r = 36

  if (name === 'Sun') {
    // glow halo + white-hot core, no terminator shading
    const halo = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, S / 2)
    halo.addColorStop(0, 'rgba(255,210,90,0.9)')
    halo.addColorStop(0.6, 'rgba(255,160,60,0.35)')
    halo.addColorStop(1, 'rgba(255,150,60,0)')
    ctx.fillStyle = halo
    ctx.fillRect(0, 0, S, S)
    const core = ctx.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, r * 0.78)
    core.addColorStop(0, '#fffdf2')
    core.addColorStop(0.55, '#ffe08a')
    core.addColorStop(1, '#f5a623')
    ctx.fillStyle = core
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2); ctx.fill()
    portraitCache[name] = c.toDataURL()
    return portraitCache[name]
  }

  const base = hex(color)
  const grad = ctx.createRadialGradient(cx - 14, cy - 14, 4, cx, cy, r * 1.5)
  grad.addColorStop(0, shade(base, 0.55))
  grad.addColorStop(0.5, rgb(base))
  grad.addColorStop(1, shade(base, -0.65))

  // sphere (clip so bands stay inside)
  ctx.save()
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip()
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, S, S)
  if (name === 'Jupiter' || name === 'Saturn') {
    ctx.fillStyle = 'rgba(0,0,0,0.16)'
    for (const [y, h] of [[-14, 5], [-2, 7], [12, 5], [24, 4]]) ctx.fillRect(0, cy + y, S, h)
  }
  if (name === 'Earth') {
    ctx.fillStyle = 'rgba(60,140,80,0.75)'
    for (const [x, y, rr] of [[-12, -8, 10], [10, 6, 8], [2, 18, 6], [16, -14, 5]]) {
      ctx.beginPath(); ctx.arc(cx + x, cy + y, rr, 0, 7); ctx.fill()
    }
  }
  ctx.restore()

  if (name === 'Saturn') {
    ctx.strokeStyle = 'rgba(205,187,136,0.85)'
    ctx.lineWidth = 4.5
    ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.55, r * 0.42, -0.32, 0, Math.PI * 2); ctx.stroke()
  }

  portraitCache[name] = c.toDataURL()
  return portraitCache[name]
}

function hex(color) { return [(color >> 16) & 255, (color >> 8) & 255, color & 255] }
function rgb([r, g, b]) { return `rgb(${r},${g},${b})` }
function shade([r, g, b], f) {
  const t = f > 0 ? 255 : 0, a = Math.abs(f)
  return `rgb(${Math.round(r + (t - r) * a)},${Math.round(g + (t - g) * a)},${Math.round(b + (t - b) * a)})`
}
