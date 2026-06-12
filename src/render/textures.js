// Small shared canvas textures.
import * as THREE from 'three'

let _radial = null
/** Soft additive radial glow sprite texture. */
export function radialTexture() {
  if (_radial) return _radial
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,236,200,0.85)')
  g.addColorStop(1, 'rgba(255,210,120,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  _radial = new THREE.CanvasTexture(c)
  return _radial
}

let _disk = null
/** Solid white disk (tint via material color). */
export function diskTexture() {
  if (_disk) return _disk
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(64, 64, 62, 0, Math.PI * 2); ctx.fill()
  _disk = new THREE.CanvasTexture(c)
  return _disk
}

/** Streaky corona texture for totality. */
export function coronaTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  const cx = 128, cy = 128
  const base = ctx.createRadialGradient(cx, cy, 28, cx, cy, 128)
  base.addColorStop(0, 'rgba(255,253,248,0.85)')
  base.addColorStop(0.25, 'rgba(252,246,236,0.35)')
  base.addColorStop(0.6, 'rgba(250,244,234,0.1)')
  base.addColorStop(1, 'rgba(250,244,234,0)')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 256, 256)
  // soft radial streamers
  for (let i = 0; i < 130; i++) {
    const a = (i / 130) * Math.PI * 2 + (i % 5) * 0.02
    const len = 45 + ((i * 37) % 70)
    ctx.strokeStyle = `rgba(255,253,248,${0.06 + (i % 4) * 0.04})`
    ctx.lineWidth = 0.5 + (i % 3) * 0.5
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * 32, cy + Math.sin(a) * 32)
    ctx.lineTo(cx + Math.cos(a) * (32 + len), cy + Math.sin(a) * (32 + len))
    ctx.stroke()
  }
  return new THREE.CanvasTexture(c)
}
