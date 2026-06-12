// Reconstruct the path of totality for a solar eclipse from first geometry:
// the Moon's umbral shadow axis is the line from the Sun's center through the
// Moon's center; where that line meets Earth's surface is the center of
// totality at that instant. Stepping time across the eclipse window traces the
// whole path. Width comes from the umbral cone geometry.
//
// Positions come from astronomy-engine (geocentric J2000, AU -> km). The hit
// point is converted to the Earth-fixed frame so it lines up with the globe.

import {
  Body, MakeTime, GeoVector, Rotation_EQJ_EQD, RotateVector, SiderealTime
} from 'astronomy-engine'
import { AU_KM } from '../physics/bodies.js'
import { RADIUS_KM } from '../physics/ephemeris.js'

const DEG = 180 / Math.PI
const R_EARTH = 6371.0 // km, spherical approximation for the shadow intersection
const R_SUN = RADIUS_KM.Sun
const R_MOON = RADIUS_KM.Moon

function geoKm(body, t) {
  const v = GeoVector(body, t, true) // EQJ, AU
  return { x: v.x * AU_KM, y: v.y * AU_KM, z: v.z * AU_KM }
}

function toEcef(v, t) {
  const eqd = RotateVector(Rotation_EQJ_EQD(t), { x: v.x, y: v.y, z: v.z, t })
  const g = SiderealTime(t) * (Math.PI / 12)
  const c = Math.cos(g), s = Math.sin(g)
  return { x: c * eqd.x + s * eqd.y, y: -s * eqd.x + c * eqd.y, z: eqd.z }
}

/** Umbral shadow-axis hit on Earth at time t, or null if the axis misses. */
export function shadowPoint(date) {
  const t = MakeTime(date)
  const S = geoKm(Body.Sun, t)
  const M = geoKm(Body.Moon, t)

  // Shadow travels from Sun through Moon, continuing away from the Sun.
  const dx = M.x - S.x, dy = M.y - S.y, dz = M.z - S.z
  const Lsm = Math.hypot(dx, dy, dz)
  const ux = dx / Lsm, uy = dy / Lsm, uz = dz / Lsm

  // Intersect ray M + t*u with sphere |p| = R_EARTH (Earth at origin).
  const b = M.x * ux + M.y * uy + M.z * uz
  const c = M.x * M.x + M.y * M.y + M.z * M.z - R_EARTH * R_EARTH
  const disc = b * b - c
  if (disc < 0) return null // axis misses Earth: no central eclipse here
  const tHit = -b - Math.sqrt(disc) // near-side intersection
  if (tHit <= 0) return null

  const H = { x: M.x + tHit * ux, y: M.y + tHit * uy, z: M.z + tHit * uz }
  const Hf = toEcef(H, t)
  const r = Math.hypot(Hf.x, Hf.y, Hf.z)
  const lat = Math.asin(Hf.z / r) * DEG
  const lon = Math.atan2(Hf.y, Hf.x) * DEG

  // Umbra cone geometry: vertex distance from Moon toward the shadow.
  const vertex = (R_MOON * Lsm) / (R_SUN - R_MOON)
  const umbraRadius = R_MOON * (vertex - tHit) / vertex // <0 => annular (antumbra)
  const total = umbraRadius > 0

  // Surface half-width, widened by the shadow's incidence angle (grazing =>
  // wider). cosIncidence = -(u·n) where n is the surface normal at the hit.
  const nx = H.x / R_EARTH, ny = H.y / R_EARTH, nz = H.z / R_EARTH
  const cosInc = Math.abs(ux * nx + uy * ny + uz * nz)
  const widthKm = (2 * Math.abs(umbraRadius)) / Math.max(0.15, cosInc)

  return { date: new Date(date), lat, lon, total, widthKm, sunAxisKm: Lsm }
}

/**
 * Trace the central path across the eclipse window by stepping time around the
 * global peak. Returns an array of points (chronological) where the umbral axis
 * actually strikes Earth.
 */
export function tracePath(peakDate, { halfWindowMin = 150, stepSec = 60 } = {}) {
  const points = []
  const start = peakDate.getTime() - halfWindowMin * 60 * 1000
  const end = peakDate.getTime() + halfWindowMin * 60 * 1000
  for (let ms = start; ms <= end; ms += stepSec * 1000) {
    const p = shadowPoint(new Date(ms))
    if (p) points.push(p)
  }
  return points
}
