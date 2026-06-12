// The live "show your work" panel. Every frame it prints the actual Kepler /
// lunar / eclipse-test numbers computed in kepler.js — the same math the orrery
// is drawing. This is the centrepiece of the orrery view.

import { planetState, moonState, eclipseTest } from '../physics/kepler.js'

const v = (s) => `<b>${s}</b>` // highlighted value

export class ComputeLog {
  constructor(el) { this.el = el }

  update(date, found) {
    const earth = planetState('Earth', date)
    const moon = moonState(date)
    const et = eclipseTest(date)

    const eclipseLine = et.isEclipse
      ? `θ &lt; limit &nbsp;→&nbsp; <span class="hit">✓ ECLIPSE GEOMETRY</span>`
      : `θ ≥ limit &nbsp;→&nbsp; <span class="miss">✗ no eclipse this instant</span>`

    const status = found
      ? `<span class="hit">FOUND — eclipse date locked</span>`
      : `scanning…`

    this.el.innerHTML = `
      <div class="sec">
        <div class="h">1 · PLANET POSITIONS — KEPLER</div>
        <div class="ln dim">mean anomaly&nbsp; M = L − ϖ</div>
        <div class="ln dim">solve&nbsp; E − e·sin E = M</div>
        <div class="ln">Earth&nbsp; M&nbsp; ${v(earth.M.toFixed(3) + '°')}</div>
        <div class="ln">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; E&nbsp; ${v(earth.E.toFixed(3) + '°')}</div>
        <div class="ln">r = a(1−e·cos E) = ${v(earth.r.toFixed(5) + ' AU')}</div>
        <div class="note">Newton–Raphson, re-solved every frame for all 9 bodies (8 planets + Pluto)</div>
      </div>

      <div class="sec">
        <div class="h">2 · MOON — MEAN ELEMENTS + PERTURBATIONS</div>
        <div class="ln">λ☾ ${v(moon.lon.toFixed(2) + '°')} &nbsp;&nbsp; β☾ ${v((moon.lat >= 0 ? '+' : '') + moon.lat.toFixed(2) + '°')}</div>
        <div class="ln">r☾ ${v(Math.round(moon.rKm).toLocaleString() + ' km')}</div>
        <div class="ln">node Ω ${v(moon.node.toFixed(1) + '°')} &nbsp; regressing 19.34°/yr</div>
        <div class="note">+ evection 1.27°·sin(2D−M′) · variation 0.66°·sin 2D · annual eq. −0.19°·sin M …</div>
      </div>

      <div class="sec">
        <div class="h">3 · ECLIPSE TEST — ${found ? 'LOCKED' : 'SCANNING…'}</div>
        <div class="ln">elongation&nbsp; D = λ☾−λ☉ = ${v(et.elongation.toFixed(2) + '°')}</div>
        <div class="ln">separation&nbsp; θ = ${v(et.sepDeg.toFixed(3) + '°')}</div>
        <div class="ln">limit&nbsp; s☉+s☾+π☾ = ${v(et.limit.toFixed(2) + '°')}</div>
        <div class="ln">${eclipseLine}</div>
      </div>

      <div class="sec">
        <div class="h">4 · SEARCH — SCAN EACH NEW MOON</div>
        <div class="note">each new moon → umbral shadow axis vs Earth (astronomy-engine, VSOP87 precision)</div>
        <div class="ln dim">status: ${status}</div>
      </div>`
  }
}
