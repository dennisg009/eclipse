// Ground point-of-view: stand at the observer's location and watch the Sun be
// occluded by the Moon. Blue daytime sky that darkens with eclipse magnitude, a
// silhouetted mountain horizon, the Sun and Moon at their true angular sizes,
// and a dramatic corona at totality. Matches the reference video's look.

import * as THREE from 'three'
import { altAzToThree } from './frames.js'
import { radialTexture, diskTexture, coronaTexture } from './textures.js'

const SKY_R = 100

export class GroundView {
  constructor() {
    this.group = new THREE.Group()
    this.group.visible = false
    this._build()
  }

  _build() {
    // Sky dome with a vertical gradient (zenith -> horizon), rendered inside.
    this.skyUniforms = {
      top: { value: new THREE.Color(0x2e6fb0) },
      bottom: { value: new THREE.Color(0xcfe3f2) },
      brightness: { value: 1.0 }
    }
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(SKY_R * 1.6, 32, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: this.skyUniforms,
        vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
        fragmentShader: `
          varying vec3 vP; uniform vec3 top; uniform vec3 bottom; uniform float brightness;
          void main(){
            float h = clamp(normalize(vP).y*0.5+0.5, 0.0, 1.0);
            vec3 c = mix(bottom, top, pow(h, 0.8));
            gl_FragColor = vec4(c*brightness, 1.0);
          }`
      })
    )
    this.group.add(this.sky)

    // Mountain horizon silhouette: a ring of jagged peaks.
    this.group.add(makeMountains())

    // Stars (revealed at totality)
    this.stars = makeStars(); this.stars.visible = false
    this.group.add(this.stars)

    const spr = (tex, color, ro, opts = {}) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial(Object.assign({
        map: tex, color, depthTest: false, depthWrite: false
      }, opts)))
      s.renderOrder = ro; this.group.add(s); return s
    }

    this.sunGlow = spr(radialTexture(), 0xfff2cc, 1, { transparent: true, blending: THREE.AdditiveBlending })
    this.sunDisk = spr(diskTexture(), 0xfff4d2, 2)
    this.corona = spr(coronaTexture(), 0xfdf8ef, 3, { transparent: true, blending: THREE.AdditiveBlending, opacity: 0 })
    this.moonDisk = spr(diskTexture(), 0x0a0a0e, 4)
  }

  update(view) {
    const dist = SKY_R
    const place = (sprite, alt, az, radiusDeg, mult = 1) => {
      const [dx, dy, dz] = altAzToThree(alt, az)
      sprite.position.set(dx * dist, dy * dist, dz * dist)
      sprite.scale.setScalar(2 * dist * Math.tan(radiusDeg * Math.PI / 180) * mult)
    }
    const mag = Math.max(0, Math.min(1, view.magnitude))
    const up = view.sun.alt > -1

    place(this.sunDisk, view.sun.alt, view.sun.az, view.sun.radiusDeg)
    place(this.sunGlow, view.sun.alt, view.sun.az, view.sun.radiusDeg, 7 * (1 - 0.9 * mag))
    place(this.moonDisk, view.moon.alt, view.moon.az, view.moon.radiusDeg, 1.005)
    place(this.corona, view.sun.alt, view.sun.az, view.sun.radiusDeg, 7)

    this.sunDisk.visible = up
    this.sunGlow.visible = up && mag < 0.999
    this.moonDisk.visible = up && mag > 0.02

    // Sky brightness: full daylight -> deep twilight at totality.
    const b = view.isTotal ? 0.05 : (up ? Math.max(0.08, Math.pow(1 - mag, 1.3)) : 0.06)
    this.skyUniforms.brightness.value = b
    this.skyUniforms.top.value.setHex(0x2e6fb0).lerp(new THREE.Color(0x241a2e), mag * 0.6)
    this.skyUniforms.bottom.value.setHex(0xcfe3f2).lerp(new THREE.Color(0x5a3a40), mag * 0.7)

    this.corona.material.opacity = view.isTotal ? 1 : 0
    this.stars.visible = view.isTotal
  }
}

function makeMountains() {
  // Two layered jagged rings near the horizon.
  const g = new THREE.Group()
  for (let layer = 0; layer < 2; layer++) {
    const R = SKY_R * (1.45 - layer * 0.06)
    const N = 160
    const pos = []
    const base = -2 - layer * 1.5
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2
      const seed = Math.sin(i * 1.7 + layer * 3) * 0.5 + Math.sin(i * 0.5) * 0.5
      const peak = base + Math.max(0, seed) * (6 + layer * 3)
      pos.push([Math.cos(a) * R, base, Math.sin(a) * R])
      pos.push([Math.cos(a) * R, peak, Math.sin(a) * R])
    }
    const verts = []
    for (let i = 0; i < N; i++) {
      const a0 = i * 2, b0 = i * 2 + 1, a1 = i * 2 + 2, b1 = i * 2 + 3
      verts.push(...pos[a0], ...pos[b0], ...pos[b1], ...pos[a0], ...pos[b1], ...pos[a1])
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    const col = layer === 0 ? 0x0b1018 : 0x141d2a
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }))
    mesh.renderOrder = 0
    g.add(mesh)
  }
  return g
}

function makeStars() {
  const N = 700
  const pos = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const th = Math.random() * Math.PI * 2
    const alt = Math.random() * Math.PI / 2
    const r = SKY_R * 1.3
    pos[i * 3] = r * Math.cos(alt) * Math.cos(th)
    pos[i * 3 + 1] = r * Math.sin(alt)
    pos[i * 3 + 2] = r * Math.cos(alt) * Math.sin(th)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.3, sizeAttenuation: false }))
}
