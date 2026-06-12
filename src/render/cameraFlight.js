// Smooth camera tweening between view presets. Eased position + target lerp.

import * as THREE from 'three'

export class CameraFlight {
  constructor(camera, controls) {
    this.camera = camera
    this.controls = controls
    this.active = false
    this.t = 0
    this.dur = 1
    this.fromPos = new THREE.Vector3()
    this.toPos = new THREE.Vector3()
    this.fromTarget = new THREE.Vector3()
    this.toTarget = new THREE.Vector3()
    this._onDone = null
  }

  flyTo(pos, target, dur = 1.2, onDone = null) {
    this.fromPos.copy(this.camera.position)
    this.toPos.copy(pos)
    this.fromTarget.copy(this.controls.target)
    this.toTarget.copy(target)
    this.t = 0
    this.dur = dur
    this.active = true
    this._onDone = onDone
  }

  /** Snap immediately (no animation). */
  snap(pos, target) {
    this.active = false
    this.camera.position.copy(pos)
    this.controls.target.copy(target)
    this.controls.update()
  }

  update(dt) {
    if (!this.active) return
    this.t = Math.min(1, this.t + dt / this.dur)
    const e = easeInOut(this.t)
    this.camera.position.lerpVectors(this.fromPos, this.toPos, e)
    this.controls.target.lerpVectors(this.fromTarget, this.toTarget, e)
    this.controls.update()
    if (this.t >= 1) {
      this.active = false
      if (this._onDone) { const f = this._onDone; this._onDone = null; f() }
    }
  }
}

function easeInOut(x) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
}
