// Top-down orrery on a 2D canvas: the Sun glowing at center, each planet's
// Kepler orbit drawn as an ellipse, planets as labelled dots. Positions come
// from kepler.js (Newton-Raphson solution of Kepler's equation), so the orrery
// is literally drawing the propagated orbits.
//
// Interactive: drag to rotate (yaw + tilt — orbits are projected in full 3D, so
// tilting reveals Pluto's 17° inclination), scroll to zoom, click a planet to
// focus/follow it, Esc (or clicking the Sun) to reset.

import { PLANET_ORDER, planetStates, orbitPath, moonState } from '../physics/kepler.js'
import { BODY_META } from '../physics/bodies.js'

const DIST_POW = 0.5        // sqrt distance compression so all planets fit
const ORBIT = 'rgba(150,170,220,0.16)'
const DEFAULT_ELEV = Math.asin(0.82) // ~55° — the original gentle 3/4 view

export class Orrery {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    // view state
    this.yaw = 0
    this.elev = DEFAULT_ELEV   // 90° = top-down, ~0° = edge-on
    this.zoom = 1
    this.focus = null          // planet name being followed, or null = Sun
    this.onFocus = null        // callback(name|null) when focus changes by click/reset
    this._hits = []            // screen positions for click hit-testing
    this._orbitCache = null
    this._orbitCacheDay = null
    // Recent ecliptic positions per planet (AU) — drawn as a fading blue
    // motion trail behind each planet while time plays.
    this.trails = Object.fromEntries(PLANET_ORDER.map((n) => [n, []]))
    this._lastMs = null
    this._bindInput()
    this.resize()
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    this.canvas.width = innerWidth * dpr
    this.canvas.height = innerHeight * dpr
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.w = innerWidth
    this.h = innerHeight
  }

  resetView() {
    this.yaw = 0
    this.elev = DEFAULT_ELEV
    this.zoom = 1
    this.focus = null
    // Always notify: the Sun card can be open while focus is already null.
    this.onFocus?.(null)
  }

  /** Multiply zoom by f (used by the +/− buttons; same clamp as the wheel). */
  zoomBy(f) {
    this.zoom = Math.min(600, Math.max(0.4, this.zoom * f))
  }

  _bindInput() {
    const c = this.canvas
    let dragging = false, moved = 0, lastX = 0, lastY = 0

    c.addEventListener('pointerdown', (e) => {
      dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY
      c.setPointerCapture(e.pointerId)
    })
    c.addEventListener('pointermove', (e) => {
      if (!dragging) return
      const dx = e.clientX - lastX, dy = e.clientY - lastY
      lastX = e.clientX; lastY = e.clientY
      moved += Math.abs(dx) + Math.abs(dy)
      this.yaw += dx * 0.005
      this.elev = Math.min(Math.PI / 2 - 0.01, Math.max(0.05, this.elev - dy * 0.005))
    })
    c.addEventListener('pointerup', (e) => {
      dragging = false
      if (moved < 6) this._click(e.clientX, e.clientY) // a tap, not a drag
    })
    c.addEventListener('wheel', (e) => {
      e.preventDefault()
      this.zoom = Math.min(600, Math.max(0.4, this.zoom * Math.exp(-e.deltaY * 0.0015)))
    }, { passive: false })
    c.addEventListener('dblclick', () => this.resetView())
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !c.classList.contains('hidden')) this.resetView()
    })
  }

  _click(x, y) {
    let best = null, bestD = 20 // px hit radius
    for (const h of this._hits) {
      const d = Math.hypot(h.sx - x, h.sy - y)
      if (d < bestD) { bestD = d; best = h.name }
    }
    // Clicking the Sun re-centers the view but still opens its card.
    if (best === 'Sun') { this.focus = null; this.onFocus?.('Sun') }
    else if (best) { this.focus = best; this.onFocus?.(best) }
  }

  _scaleK() {
    // Fit Pluto's orbit (aphelion ~49 AU) into ~45% of the smaller side at
    // zoom 1, so its eccentric, inclined ring stays fully on screen.
    const fit = Math.min(this.w, this.h) * 0.45
    return (fit / Math.pow(50, DIST_POW)) * this.zoom
  }

  /** Ecliptic [x,y,z] (AU) -> screen-relative [sx, sy] via yaw rotation,
   *  radial sqrt compression, then elevation projection (full 3D). */
  _project(p, k) {
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw)
    let x = p[0] * cy - p[1] * sy
    let y = p[0] * sy + p[1] * cy
    let z = p[2]
    const r = Math.hypot(x, y, z)
    if (r > 1e-9) {
      const f = Math.pow(r, DIST_POW) / r * k
      x *= f; y *= f; z *= f
    }
    const se = Math.sin(this.elev), ce = Math.cos(this.elev)
    return [x, -(y * se + z * ce)] // north up
  }

  draw(date) {
    const ctx = this.ctx
    const { w, h } = this
    const k = this._scaleK()
    const states = planetStates(date)

    // Record motion trails (ecliptic AU, so they re-project under any view).
    const ms = date.getTime()
    if (this._lastMs !== null) {
      const dDays = (ms - this._lastMs) / 86400000
      if (Math.abs(dDays) > 40) {
        // discontinuous jump (eclipse scan, list selection) — restart trails
        for (const n of PLANET_ORDER) this.trails[n].length = 0
      } else if (Math.abs(dDays) > 1e-6) {
        for (const s of states) {
          const tr = this.trails[s.name]
          const last = tr[tr.length - 1]
          if (last) {
            // if the per-frame step is too coarse to read as a line (inner
            // planets at extreme speeds), restart that planet's trail
            const a1 = Math.atan2(last[1], last[0]), a2 = Math.atan2(s.pos[1], s.pos[0])
            let da = Math.abs(a2 - a1)
            if (da > Math.PI) da = 2 * Math.PI - da
            if (da > 0.5) tr.length = 0
          }
          tr.push(s.pos.slice())
          if (tr.length > 220) tr.shift()
        }
      }
    }
    this._lastMs = ms

    // Center: Sun by default; bias left so the log panel doesn't cover it.
    // When following a planet, put that planet at the center instead.
    let cx = w * 0.42, cy = h * 0.52
    if (this.focus) {
      const fs = states.find((s) => s.name === this.focus)
      if (fs) {
        const [fx, fy] = this._project(fs.pos, k)
        cx -= fx; cy -= fy
      }
    }

    // background
    const bg = ctx.createRadialGradient(w * 0.42, h * 0.52, 0, w * 0.42, h * 0.52, Math.max(w, h) * 0.7)
    bg.addColorStop(0, '#0c1226')
    bg.addColorStop(1, '#05060c')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // orbits (cache the sampled ellipses; their elements drift only slowly)
    const day = Math.floor(date.getTime() / 86400000 / 30) // refresh ~monthly
    if (this._orbitCacheDay !== day) {
      this._orbitCache = PLANET_ORDER.map((n) => orbitPath(n, date, 160))
      this._orbitCacheDay = day
    }
    ctx.lineWidth = 1
    this._orbitCache.forEach((pts, i) => {
      ctx.strokeStyle = PLANET_ORDER[i] === 'Earth' ? 'rgba(120,170,255,0.35)' : ORBIT
      ctx.beginPath()
      pts.forEach((p, j) => {
        const [sx, sy] = this._project(p, k)
        j === 0 ? ctx.moveTo(cx + sx, cy + sy) : ctx.lineTo(cx + sx, cy + sy)
      })
      ctx.stroke()
    })

    // Fading blue motion trails behind each planet (newest segment brightest).
    ctx.lineWidth = 1.6
    for (const name of PLANET_ORDER) {
      const tr = this.trails[name]
      if (tr.length < 2) continue
      let [px, py] = this._project(tr[0], k)
      for (let i = 1; i < tr.length; i++) {
        const [qx, qy] = this._project(tr[i], k)
        ctx.strokeStyle = `rgba(110,168,255,${((i / tr.length) ** 2 * 0.55).toFixed(3)})`
        ctx.beginPath()
        ctx.moveTo(cx + px, cy + py)
        ctx.lineTo(cx + qx, cy + qy)
        ctx.stroke()
        px = qx; py = qy
      }
    }

    this._hits = []

    // Sun glow + disk
    const [sunX, sunY] = [cx, cy] // Sun is the ecliptic origin
    const glowR = 60 * Math.min(Math.max(this.zoom, 0.6), 2.5)
    const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, glowR)
    glow.addColorStop(0, 'rgba(255,224,150,0.95)')
    glow.addColorStop(0.3, 'rgba(255,180,80,0.5)')
    glow.addColorStop(1, 'rgba(255,150,60,0)')
    ctx.fillStyle = glow
    ctx.beginPath(); ctx.arc(sunX, sunY, glowR, 0, 7); ctx.fill()
    const sunR = 6 * Math.min(Math.sqrt(this.zoom), 4)
    ctx.fillStyle = '#ffe08a'
    ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, 7); ctx.fill()
    this._hits.push({ name: 'Sun', sx: sunX, sy: sunY })

    // planets
    ctx.font = '11px ui-monospace, Menlo, monospace'
    ctx.textBaseline = 'middle'
    const dotBoost = Math.min(2.5, Math.log2(Math.max(this.zoom, 1)) * 0.6)
    let earthScreen = null
    for (const s of states) {
      const [px, py] = this._project(s.pos, k)
      const sx = cx + px, sy = cy + py
      const meta = BODY_META[s.name]
      const col = '#' + (meta.color).toString(16).padStart(6, '0')
      const rDot = (s.name === 'Earth' ? 3.2 : 2.4) + dotBoost
      ctx.fillStyle = col
      ctx.beginPath(); ctx.arc(sx, sy, rDot, 0, 7); ctx.fill()
      if (s.name === this.focus) { // focus ring
        ctx.strokeStyle = 'rgba(229,138,156,0.8)'
        ctx.beginPath(); ctx.arc(sx, sy, rDot + 4, 0, 7); ctx.stroke()
      }
      ctx.fillStyle = 'rgba(210,220,240,0.75)'
      ctx.fillText(s.name.toUpperCase(), sx + rDot + 4, sy)
      this._hits.push({ name: s.name, sx, sy })
      if (s.name === 'Earth') earthScreen = [sx, sy]
    }

    // Moon near Earth: exaggerated offset (grows gently with zoom) at its true
    // ecliptic longitude, with a faint orbit ring once there's room for it.
    if (earthScreen) {
      const [ex, ey] = earthScreen
      const m = moonState(date)
      const off = Math.min(80, 6 + 2 * this.zoom)
      const ang = m.lon * Math.PI / 180
      // project the moon's direction like any other ecliptic vector
      const cyaw = Math.cos(this.yaw), syaw = Math.sin(this.yaw)
      const mx0 = Math.cos(ang), my0 = Math.sin(ang)
      const mx = mx0 * cyaw - my0 * syaw
      const my = mx0 * syaw + my0 * cyaw
      const se = Math.sin(this.elev)
      const px = ex + mx * off, py = ey - my * off * se
      if (off > 16) { // orbit ring once it reads as an orbit
        ctx.strokeStyle = 'rgba(190,200,220,0.18)'
        ctx.beginPath(); ctx.ellipse(ex, ey, off, off * se, 0, 0, 7); ctx.stroke()
      }
      ctx.fillStyle = '#cfcfcf'
      ctx.beginPath(); ctx.arc(px, py, 1.8 + dotBoost * 0.5, 0, 7); ctx.fill()
      if (off > 24) {
        ctx.fillStyle = 'rgba(190,200,220,0.6)'
        ctx.fillText('MOON', px + 5, py)
      }
    }
  }
}
