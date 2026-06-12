// Orrery — entry point.
//
// Identity (recreating the reference): a top-down orrery propagates the planets
// by solving Kepler's equation from J2000 elements, with a live "show your
// work" log; a new-moon scan finds the next total solar eclipse; then we cut to
// a ground POV to watch totality. astronomy-engine is the accuracy backstop for
// eclipse dates and the ground geometry; kepler.js is the visible computation.

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { SearchLocalSolarEclipse, Observer } from 'astronomy-engine'

import { groundView } from './physics/ephemeris.js'
import { altAzToThree } from './render/frames.js'
import { upcomingTotalEclipses, regionLabel } from './eclipse/predict.js'
import { whereIs } from './geo/where.js'
import { tracePath, shadowPoint } from './eclipse/path.js'

import { Orrery } from './render/orrery.js'
import { EarthView } from './render/earthView.js'
import { GroundView } from './render/groundView.js'
import { CameraFlight } from './render/cameraFlight.js'
import { Timeline } from './ui/timeline.js'
import { Panel } from './ui/panel.js'
import { ComputeLog } from './ui/computeLog.js'
import { PlanetCard } from './ui/planetCard.js'
import { planetState } from './physics/kepler.js'

// ---------- canvases ----------
const sceneCanvas = document.getElementById('scene')
const orreryCanvas = document.getElementById('orrery')

const renderer = new THREE.WebGLRenderer({ canvas: sceneCanvas, antialias: true, logarithmicDepthBuffer: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)

const scene = new THREE.Scene()
// Ground view defaults to a telephoto FOV: the Sun/Moon are drawn at their
// true ~0.5° angular size, so a wide lens renders them honest-but-tiny. 5°
// (~500mm equivalent — how real eclipse photos are shot) fills the frame with
// the corona; the zoom buttons / wheel adjust it from 2° to 30°.
const SYSTEM_FOV = 55, GROUND_FOV = 5
const GROUND_FOV_MIN = 2, GROUND_FOV_MAX = 30
const camera = new THREE.PerspectiveCamera(SYSTEM_FOV, innerWidth / innerHeight, 0.001, 8000)
const controls = new OrbitControls(camera, sceneCanvas)
controls.enableDamping = true
controls.dampingFactor = 0.08
const flight = new CameraFlight(camera, controls)

const orrery = new Orrery(orreryCanvas)
const earthView = new EarthView()
const ground = new GroundView()
scene.add(earthView.group, ground.group)

const computeLog = new ComputeLog(document.getElementById('log'))
const planetCard = new PlanetCard(document.getElementById('planet-card'))

// ---------- state ----------
let currentDate = new Date()
let playing = false
let speedDays = 30
let activeView = 'orrery'
let selectedEclipse = null
let observer = { lat: 64.15, lon: -21.94 }
let found = false
let scan = null    // { fromMs, toMs, t, eclipse }
let replay = null  // { peakMs, t }

// ---------- UI ----------
const timeline = new Timeline({
  onPlayToggle: (on) => { playing = on },
  onSpeed: (d) => { speedDays = d },
  onNextEclipse: () => jumpToNextEclipse()
})
timeline.setSpeedIndex(6); speedDays = 30

const panel = new Panel({
  onSelectEclipse: (e) => scanToEclipse(e),
  onObserverChange: (lat, lon) => {
    observer = { lat, lon }
    if (activeView === 'ground') { syncGroundToLocalEclipse(); aimGroundCamera() }
  }
})

document.querySelectorAll('#view-tabs .tab').forEach((b) =>
  b.addEventListener('click', () => setView(b.dataset.view)))
document.getElementById('replay').addEventListener('click', startReplay)
document.getElementById('back-system').addEventListener('click', () => setView('orrery'))

// Planet details popup follows the orrery's click-to-focus.
orrery.onFocus = (name) => {
  if (name === 'Sun') planetCard.showSun(planetState('Earth', currentDate).r)
  else if (name) planetCard.show(name, planetState(name, currentDate))
  else planetCard.hide()
}
// Closing the card with ✕ also releases the camera follow — otherwise the
// view keeps tracking the planet with no visible way to stop.
planetCard.onClose = () => { orrery.focus = null }

// Zoom buttons: scale the orrery, dolly the camera in the earth view, or
// change the telephoto focal length (FOV) in the ground view.
const zoomStep = (f) => {
  if (activeView === 'orrery') {
    orrery.zoomBy(f)
  } else if (activeView === 'earth') {
    const off = camera.position.clone().sub(controls.target).multiplyScalar(1 / f)
    off.setLength(Math.min(controls.maxDistance, Math.max(controls.minDistance, off.length())))
    camera.position.copy(controls.target).add(off)
    controls.update()
  } else if (activeView === 'ground') {
    camera.fov = Math.min(GROUND_FOV_MAX, Math.max(GROUND_FOV_MIN, camera.fov / f))
    camera.updateProjectionMatrix()
  }
}
document.getElementById('zoom-in').addEventListener('click', () => zoomStep(1.4))
document.getElementById('zoom-out').addEventListener('click', () => zoomStep(1 / 1.4))
// scroll-to-zoom in the ground view (OrbitControls' dolly is pinned there)
sceneCanvas.addEventListener('wheel', (e) => {
  if (activeView !== 'ground') return
  e.preventDefault()
  zoomStep(Math.exp(-e.deltaY * 0.002))
}, { passive: false })

const statusEl = document.getElementById('status')

// ---------- eclipse data ----------
const eclipses = upcomingTotalEclipses(new Date(), 15)
panel.setEclipses(eclipses)
document.getElementById('ph-badge').textContent = String(eclipses.length)

// ---------- mobile: panels collapse behind a floating bottom-left handle ----------
// The handle controls whichever panel matters in the current view: the eclipse
// sidebar normally, the eclipse-info card in Ground POV. Each remembers its
// own collapsed state.
const sidebarEl = document.getElementById('sidebar')
const infoEl = document.getElementById('info')
const panelHandle = document.getElementById('panel-handle')
const phBadge = document.getElementById('ph-badge')
const phoneMQ = window.matchMedia('(max-width: 720px)')
const mobCollapsed = { sidebar: false, info: false }

function mobKey() { return activeView === 'ground' ? 'info' : 'sidebar' }

function syncMobilePanels() {
  sidebarEl.classList.toggle('collapsed', mobCollapsed.sidebar)
  infoEl.classList.toggle('collapsed', mobCollapsed.info)
  phBadge.classList.toggle('hidden', activeView === 'ground') // count is list-specific
  const collapsed = mobCollapsed[mobKey()]
  panelHandle.classList.toggle('open', !collapsed)
  panelHandle.setAttribute('aria-expanded', String(!collapsed))
  panelHandle.querySelector('.ph-icon').textContent = collapsed ? '◐' : '✕'
}

function setPanelCollapsed(collapsed) {
  mobCollapsed[mobKey()] = collapsed
  syncMobilePanels()
}
panelHandle.addEventListener('click', () => setPanelCollapsed(!mobCollapsed[mobKey()]))
// tapping the scene dismisses the open panel on phones
for (const c of [orreryCanvas, sceneCanvas]) {
  c.addEventListener('pointerdown', () => {
    if (phoneMQ.matches && !mobCollapsed[mobKey()]) setPanelCollapsed(true)
  })
}
// phones start with the visualization, not the panels; restore on wide screens
if (phoneMQ.matches) { mobCollapsed.sidebar = true; mobCollapsed.info = true }
syncMobilePanels()
phoneMQ.addEventListener('change', (e) => {
  mobCollapsed.sidebar = e.matches
  mobCollapsed.info = e.matches
  syncMobilePanels()
})

// ---------- views ----------
function setView(view) {
  activeView = view
  document.querySelectorAll('#view-tabs .tab').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === view))

  const is3D = view !== 'orrery'
  sceneCanvas.classList.toggle('hidden', !is3D)
  orreryCanvas.classList.toggle('hidden', is3D)
  earthView.group.visible = view === 'earth'
  ground.group.visible = view === 'ground'
  document.getElementById('log').classList.toggle('hidden', view !== 'orrery')
  document.getElementById('sidebar').classList.toggle('hidden', view === 'ground')
  document.getElementById('ground-controls').classList.toggle('hidden', view !== 'ground')
  document.getElementById('info').classList.toggle('hidden', view === 'orrery')
  // zoom buttons work in every view now (ground view: telephoto FOV)
  // On phones, arriving in Ground POV starts with the info card tucked away
  // so totality is front and center; the handle opens it on demand. Outside
  // Ground POV the handle controls the sidebar, so un-collapse the card —
  // otherwise it would be stranded invisible in the Earth view.
  if (phoneMQ.matches) mobCollapsed.info = (view === 'ground')
  syncMobilePanels()
  if (view !== 'orrery') planetCard.hide()
  else if (orrery.focus) planetCard.show(orrery.focus, planetState(orrery.focus, currentDate))

  if (view === 'earth') {
    controls.enablePan = false
    if (camera.fov !== SYSTEM_FOV) { camera.fov = SYSTEM_FOV; camera.updateProjectionMatrix() }
    controls.minDistance = 1.4; controls.maxDistance = 30
    controls.maxPolarAngle = Math.PI // undo the ground view's horizon clamp
    flight.snap(new THREE.Vector3(2.6, 1.4, 2.6), new THREE.Vector3(0, 0, 0))
  } else if (view === 'ground') {
    controls.enablePan = false
    camera.fov = GROUND_FOV; camera.updateProjectionMatrix()
    playing = false; timeline.setPlaying(false)
    timeline.setSpeedIndex(0); speedDays = 1 / 1440 // 1 min/s — watchable if Play is pressed
    syncGroundToLocalEclipse()
    aimGroundCamera()
  }
  refresh()
}

function scanToEclipse(e) {
  // Race the clock from "now" to the eclipse — the new-moon scan, dramatised.
  scan = { fromMs: currentDate.getTime(), toMs: e.peak.getTime(), t: 0, eclipse: e }
  playing = false; timeline.setPlaying(false)
  setView('orrery')
  if (phoneMQ.matches) setPanelCollapsed(true) // get the sheet out of the way
  statusEl.textContent = 'scanning new moons…'
}

function finalizeSelect(e) {
  selectedEclipse = e
  found = true
  earthView.setPath(tracePath(e.peak))
  observer = { lat: e.lat, lon: e.lon }
  panel.setObserver(e.lat, e.lon)
  panel.markSelected(eclipses.indexOf(e))
  currentDate = new Date(e.peak)
  statusEl.textContent = `✓ eclipse ${e.peak.toISOString().slice(0, 10)}`
  // cut to the ground POV payoff
  setView('ground')
}

function jumpToNextEclipse() {
  const next = eclipses.find((e) => e.peak > currentDate) || eclipses[0]
  scanToEclipse(next)
}

function syncGroundToLocalEclipse() {
  if (!selectedEclipse) return
  try {
    const obs = new Observer(observer.lat, observer.lon, 0)
    const local = SearchLocalSolarEclipse(new Date(selectedEclipse.peak.getTime() - 3 * 3600e3), obs)
    if (local && local.peak) currentDate = local.peak.time.date
  } catch (_) { /* keep */ }
}

function aimGroundCamera() {
  const v = groundView(currentDate, observer.lat, observer.lon)
  const [dx, dy, dz] = altAzToThree(Math.max(v.sun.alt, 3), v.sun.az)
  const D = 50
  controls.minDistance = D; controls.maxDistance = D; controls.maxPolarAngle = Math.PI * 0.95
  camera.position.set(0, 0, 0)
  controls.target.set(dx * D, dy * D, dz * D)
  controls.update()
}

function startReplay() {
  if (!selectedEclipse) return
  syncGroundToLocalEclipse()
  replay = { peakMs: currentDate.getTime(), t: 0 }
  playing = false; timeline.setPlaying(false)
}

// ---------- per-frame ----------
function refresh() {
  timeline.setClock(currentDate)

  if (activeView === 'orrery') {
    orrery.draw(currentDate)
    computeLog.update(currentDate, found)
    if (planetCard.name) {
      // The Sun card's live row is the Earth–Sun distance.
      const src = planetCard.name === 'Sun' ? 'Earth' : planetCard.name
      planetCard.updateLive(planetState(src, currentDate))
    }
  } else if (activeView === 'earth') {
    const s = selectedEclipse ? shadowPoint(currentDate) : null
    earthView.setObserver(observer.lat, observer.lon)
    earthView.update(currentDate, s)
    showEarthInfo(s)
  } else if (activeView === 'ground') {
    const view = groundView(currentDate, observer.lat, observer.lon)
    ground.update(view)
    showGroundInfo(view)
  }
}

function showEarthInfo(s) {
  if (!selectedEclipse) { document.getElementById('info').classList.add('hidden'); return }
  const e = selectedEclipse
  const dur = e.durationSec ? `${Math.floor(e.durationSec / 60)}m ${Math.round(e.durationSec % 60)}s` : '—'
  const place = whereIs(e.lat, e.lon)
  setInfo('Total solar eclipse', e.peak.toISOString().slice(0, 16).replace('T', ' ') + ' UTC', [
    ['greatest at', regionLabel(e.lat, e.lon)],
    ['region', place ? place.label : '…'],
    ['max totality', dur],
    ['Saros series', e.saros ? '#' + e.saros : '—'],
    ['path width', s && s.total ? Math.round(s.widthKm) + ' km' : '—'],
    ['shadow now', s && s.total ? regionLabel(s.lat, s.lon) : 'off Earth']
  ], 'Orange line = path of totality · dark spot = umbra now · yellow dot = sub-solar point (Sun overhead) · blue dot = your observer.')
}

function showGroundInfo(view) {
  const e = selectedEclipse
  const pct = (Math.min(1, Math.max(0, view.magnitude)) * 100).toFixed(0)
  let phase = 'no eclipse in progress'
  if (view.isTotal) phase = 'TOTALITY'
  else if (view.magnitude > 0.001) phase = `partial · ${pct}%`
  else if (!view.sunUp) phase = 'sun below horizon'
  const place = whereIs(observer.lat, observer.lon)
  setInfo(e ? 'Total solar eclipse' : 'Ground POV',
    currentDate.toISOString().slice(0, 16).replace('T', ' ') + ' UTC', [
    ['location', regionLabel(observer.lat, observer.lon)],
    ['region', place ? place.label : '…'],
    ['sun altitude', view.sun.alt.toFixed(1) + '°'],
    ['separation', view.separationDeg.toFixed(2) + '°'],
    ['phase', phase],
    ...(e && e.saros ? [['Saros series', '#' + e.saros]] : [])
  ], 'Found by scanning each new moon and testing Sun–Moon–Earth shadow geometry (astronomy-engine, VSOP87). Saros numbers from NASA’s eclipse catalog.')
}

function setInfo(title, sub, rows, foot) {
  const el = document.getElementById('info')
  el.classList.remove('hidden')
  el.innerHTML = `<div class="eyebrow">next solar eclipse</div><h3>${title}</h3>` +
    `<div class="muted">${sub}</div>` +
    `<div class="grid">${rows.map(([k, v]) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`).join('')}</div>` +
    `<div class="foot">${foot}</div>`
}

// ---------- loop ----------
let last = performance.now()
const SCAN_DUR = 1.8, REPLAY_DUR = 16
const ease = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2

function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now

  if (scan) {
    scan.t = Math.min(1, scan.t + dt / SCAN_DUR)
    currentDate = new Date(scan.fromMs + (scan.toMs - scan.fromMs) * ease(scan.t))
    if (scan.t >= 1) { const e = scan.eclipse; scan = null; finalizeSelect(e) }
  } else if (replay) {
    replay.t = Math.min(1, replay.t + dt / REPLAY_DUR)
    // map u->minutes with a center-lingering curve so totality lasts on screen
    const u = replay.t, s = Math.sign(2 * u - 1) * Math.pow(Math.abs(2 * u - 1), 2)
    currentDate = new Date(replay.peakMs + s * 85 * 60000)
    if (replay.t >= 1) replay = null
  } else if (playing) {
    currentDate = new Date(currentDate.getTime() + speedDays * 86400000 * dt)
    if (activeView === 'orrery' && found) { found = false; statusEl.textContent = 'propagating orbits…' }
  }

  // Keep the eclipse centred during the cinematic; leave manual look-around otherwise.
  if (activeView === 'ground' && (replay || playing)) aimGroundCamera()

  flight.update(dt)
  controls.update()
  refresh()
  if (activeView !== 'orrery') renderer.render(scene, camera)
  requestAnimationFrame(loop)
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
  orrery.resize()
})

setView('orrery')
requestAnimationFrame(loop)

// Debug/testing handle (harmless in production).
window.__eclipse = { orrery, get date() { return currentDate } }
