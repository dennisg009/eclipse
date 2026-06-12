// Sidebar controller: the upcoming-eclipse list, observer presets/inputs, and
// the info readout. Reports selections via callbacks.

import { regionLabel } from '../eclipse/predict.js'

const PRESETS = [
  { name: 'Custom', lat: null, lon: null },
  { name: 'Reykjavík, Iceland', lat: 64.15, lon: -21.94 },
  { name: 'Valencia, Spain', lat: 39.47, lon: -0.38 },
  { name: 'Luxor, Egypt', lat: 25.69, lon: 32.64 },
  { name: 'Sydney, Australia', lat: -33.87, lon: 151.21 },
  { name: 'Stonehenge, UK', lat: 51.18, lon: -1.83 },
  { name: 'New York, USA', lat: 40.71, lon: -74.01 }
]

export class Panel {
  constructor({ onSelectEclipse, onObserverChange }) {
    this.list = document.getElementById('eclipse-list')
    this.preset = document.getElementById('obs-preset')
    this.lat = document.getElementById('obs-lat')
    this.lon = document.getElementById('obs-lon')
    this.info = document.getElementById('info')
    this.onSelectEclipse = onSelectEclipse
    this.onObserverChange = onObserverChange
    this.eclipses = []
    this.selected = -1

    for (const p of PRESETS) {
      const opt = document.createElement('option')
      opt.textContent = p.name
      this.preset.appendChild(opt)
    }
    this.preset.addEventListener('change', () => {
      const p = PRESETS[this.preset.selectedIndex]
      if (p.lat != null) { this.lat.value = p.lat; this.lon.value = p.lon }
      this._emitObserver()
    })
    this.lat.addEventListener('change', () => { this.preset.selectedIndex = 0; this._emitObserver() })
    this.lon.addEventListener('change', () => { this.preset.selectedIndex = 0; this._emitObserver() })
  }

  _emitObserver() {
    const lat = parseFloat(this.lat.value)
    const lon = parseFloat(this.lon.value)
    if (Number.isFinite(lat) && Number.isFinite(lon)) this.onObserverChange(lat, lon)
  }

  observer() {
    return { lat: parseFloat(this.lat.value), lon: parseFloat(this.lon.value) }
  }

  setObserver(lat, lon) {
    this.lat.value = lat.toFixed(2)
    this.lon.value = lon.toFixed(2)
    this.preset.selectedIndex = 0
  }

  setEclipses(list) {
    this.eclipses = list
    this.list.innerHTML = ''
    list.forEach((e, i) => {
      const li = document.createElement('li')
      const dur = e.durationSec ? `${Math.floor(e.durationSec / 60)}m ${Math.round(e.durationSec % 60)}s` : '—'
      const saros = e.saros ? ` · Saros ${e.saros}` : ''
      const hybrid = e.hybrid ? ' · hybrid (total at peak)' : ''
      li.innerHTML = `<div class="date">${e.peak.toISOString().slice(0, 10)}${saros}</div>` +
        `<div class="meta">${regionLabel(e.lat, e.lon)} · max ${dur}${hybrid}</div>`
      li.addEventListener('click', () => this.select(i))
      this.list.appendChild(li)
    })
  }

  select(i) {
    this.markSelected(i)
    this.onSelectEclipse(this.eclipses[i], i)
  }

  // Highlight a row without firing the selection callback.
  markSelected(i) {
    this.selected = i
    Array.from(this.list.children).forEach((li, k) => li.classList.toggle('selected', k === i))
  }

  showInfo(html) {
    if (!html) { this.info.classList.add('hidden'); return }
    this.info.innerHTML = html
    this.info.classList.remove('hidden')
  }
}
