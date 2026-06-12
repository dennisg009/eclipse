// Earth view: a globe (Earth-fixed, so its texture doesn't spin), the Moon at
// its scaled geocentric position, a Sun-direction light producing the day/night
// terminator, the drawn path of totality, and the umbral shadow spot moving
// across the surface at the real times.

import * as THREE from 'three'
import { earthGeometry, latLonToVec } from '../physics/ephemeris.js'
import { ecefToThree } from './frames.js'

const EARTH_R = 1
const MOON_SCENE_DIST = 6 // compressed (real ~60 Earth radii)

export class EarthView {
  constructor() {
    this.group = new THREE.Group()
    this.group.visible = false
    this._build()
  }

  _build() {
    // Globe
    const tex = makeEarthTexture()
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1.0, metalness: 0.0 })
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 64, 48), mat)
    this.group.add(this.earth)

    // Try to upgrade to a real equirectangular texture if one is bundled.
    new THREE.TextureLoader().load(
      `${import.meta.env.BASE_URL}textures/earth.jpg`,
      (t) => { t.colorSpace = THREE.SRGBColorSpace; mat.map = t; mat.needsUpdate = true },
      undefined,
      () => {} // no file: keep the procedural texture
    )

    // Lighting: a directional Sun + dim ambient so the night side isn't black.
    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.6)
    this.group.add(this.sunLight)
    this.group.add(new THREE.AmbientLight(0x2a3a55, 0.5))

    // Moon
    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 32, 24),
      new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 1 })
    )
    this.group.add(this.moon)

    // Path of totality
    this.pathLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xffb648, linewidth: 2 })
    )
    this.pathLine.frustumCulled = false
    this.group.add(this.pathLine)

    // Umbra spot (where totality is right now)
    this.umbra = new THREE.Mesh(
      new THREE.CircleGeometry(0.04, 32),
      // DoubleSide: placeOnSurface aims the circle's +Z at the globe's center,
      // so the front face points inward and FrontSide would be culled.
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.78, side: THREE.DoubleSide })
    )
    this.umbra.visible = false
    this.group.add(this.umbra)

    // Markers
    this.subSolar = makeMarker(0xffd24a)
    this.observer = makeMarker(0x6ea8ff)
    this.observer.visible = false
    this.group.add(this.subSolar)
    this.group.add(this.observer)
  }

  /** Draw the path of totality from traced points. */
  setPath(points) {
    const verts = []
    for (const p of points) {
      const v = latLonToVec(p.lat, p.lon)
      const [x, y, z] = ecefToThree({ x: v[0], y: v[1], z: v[2] })
      verts.push(x * 1.01, y * 1.01, z * 1.01)
    }
    const g = this.pathLine.geometry
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    g.computeBoundingSphere()
  }

  setObserver(lat, lon) {
    if (lat == null) { this.observer.visible = false; return }
    placeOnSurface(this.observer, lat, lon, 1.015)
    this.observer.visible = true
  }

  /** Update for the current time; `shadow` is the current shadowPoint() or null. */
  update(date, shadow) {
    const geo = earthGeometry(date)

    // Sun light direction = toward the sub-solar point.
    const s = ecefToThree(geo.sun.ecef)
    const sl = new THREE.Vector3(s[0], s[1], s[2]).normalize()
    this.sunLight.position.copy(sl.clone().multiplyScalar(10))
    this.sunLight.target.position.set(0, 0, 0)
    this.sunLight.target.updateMatrixWorld()

    placeOnSurface(this.subSolar, geo.sun.sub.lat, geo.sun.sub.lon, 1.015)

    // Moon at scaled geocentric direction.
    const m = ecefToThree(geo.moon.ecef)
    const md = new THREE.Vector3(m[0], m[1], m[2]).normalize().multiplyScalar(MOON_SCENE_DIST)
    this.moon.position.copy(md)

    // Umbra spot
    if (shadow && shadow.total) {
      placeOnSurface(this.umbra, shadow.lat, shadow.lon, 1.005)
      const rel = Math.max(0.012, Math.min(0.12, shadow.widthKm / 12742)) // vs Earth diameter
      this.umbra.scale.setScalar(rel / 0.04)
      this.umbra.visible = true
    } else {
      this.umbra.visible = false
    }
  }
}

function placeOnSurface(obj, lat, lon, r) {
  const v = latLonToVec(lat, lon)
  const [x, y, z] = ecefToThree({ x: v[0], y: v[1], z: v[2] })
  obj.position.set(x * r, y * r, z * r)
  obj.lookAt(0, 0, 0)
}

function makeMarker(color) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 16, 12),
    new THREE.MeshBasicMaterial({ color })
  )
  return m
}

// Procedural fallback Earth texture: ocean base, latitude shading, graticule,
// emphasised equator & prime meridian. Clear coordinates even without a photo.
function makeEarthTexture() {
  const w = 2048, h = 1024
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')

  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#0a2a55')
  grad.addColorStop(0.5, '#103e74')
  grad.addColorStop(1, '#0a2a55')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // graticule every 30°
  ctx.strokeStyle = 'rgba(150,190,240,0.22)'
  ctx.lineWidth = 1
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * w
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
  }
  for (let lat = -90; lat <= 90; lat += 30) {
    const y = ((90 - lat) / 180) * h
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }
  // emphasised equator & prime meridian
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke()

  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
