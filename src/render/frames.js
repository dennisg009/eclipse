// Coordinate-frame helpers mapping astronomy/physics frames into Three.js.
// Three.js is Y-up, right-handed.

/**
 * Earth-fixed (ECEF: x@0°/0°, y@0°/90°E, z@north pole) -> Three.js.
 * Orientation-preserving rotation so the drawn path and the cast shadow agree.
 */
export function ecefToThree({ x, y, z }) {
  return [x, z, -y]
}

/** Horizontal coords (altitude/azimuth, deg) -> a unit direction in Three.js,
 *  with East=+X, Up=+Y, North=-Z. */
export function altAzToThree(altDeg, azDeg) {
  const alt = altDeg * Math.PI / 180
  const az = azDeg * Math.PI / 180
  const ca = Math.cos(alt)
  return [Math.sin(az) * ca, Math.sin(alt), -Math.cos(az) * ca]
}
