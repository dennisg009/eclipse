// Thin, accurate wrapper over astronomy-engine (VSOP87 + NOVAS-grade models).
//
// This is the "ground truth" layer. kepler.js is the visible first-principles
// computation; everything that must match the real world (Earth/Moon geometry,
// sub-solar/sub-lunar points, ground POV, eclipse timing) is sourced here.

import {
  Body, MakeTime, GeoVector, Equator, Horizon, Observer,
  Rotation_EQJ_EQD, RotateVector, SiderealTime
} from 'astronomy-engine'
import { AU_KM } from './bodies.js'

const DEG = 180 / Math.PI
const RAD = Math.PI / 180

// Physical radii (km) for angular-size computations.
export const RADIUS_KM = { Sun: 696000, Moon: 1737.4, Earth: 6371.0 }

/** Greenwich apparent sidereal time, in radians. */
function gastRad(t) {
  return SiderealTime(t) * (Math.PI / 12)
}

/** Rotate a geocentric J2000 (EQJ) vector into the Earth-fixed (ECEF) frame
 *  so it can be drawn against a static globe whose texture doesn't spin. */
function eqjToEcef(vec, t) {
  const eqd = RotateVector(Rotation_EQJ_EQD(t), vec)
  const g = gastRad(t)
  const c = Math.cos(g), s = Math.sin(g)
  return {
    x: c * eqd.x + s * eqd.y,
    y: -s * eqd.x + c * eqd.y,
    z: eqd.z
  }
}

/** Geographic point (lat/lon, degrees) directly beneath a geocentric body. */
function subPoint(ecef) {
  const r = Math.hypot(ecef.x, ecef.y, ecef.z)
  return {
    lat: Math.asin(ecef.z / r) * DEG,
    lon: Math.atan2(ecef.y, ecef.x) * DEG
  }
}

/**
 * Geometry needed by the Earth view: geocentric Sun & Moon in the Earth-fixed
 * frame (unit direction + distance in km), their sub-points (lat/lon), and
 * angular radii (degrees). Earth-fixed so the drawn totality path and the cast
 * shadow share one coordinate system.
 */
export function earthGeometry(date) {
  const t = MakeTime(date)
  const sunEqj = GeoVector(Body.Sun, t, true)
  const moonEqj = GeoVector(Body.Moon, t, true)
  const sunEcef = eqjToEcef(sunEqj, t)
  const moonEcef = eqjToEcef(moonEqj, t)

  const sunDistKm = Math.hypot(sunEqj.x, sunEqj.y, sunEqj.z) * AU_KM
  const moonDistKm = Math.hypot(moonEqj.x, moonEqj.y, moonEqj.z) * AU_KM

  return {
    gast: gastRad(t),
    sun: {
      ecef: sunEcef,
      sub: subPoint(sunEcef),
      distKm: sunDistKm,
      angRadiusDeg: Math.asin(RADIUS_KM.Sun / sunDistKm) * DEG
    },
    moon: {
      ecef: moonEcef,
      sub: subPoint(moonEcef),
      distKm: moonDistKm,
      angRadiusDeg: Math.asin(RADIUS_KM.Moon / moonDistKm) * DEG
    }
  }
}

/**
 * Ground point-of-view of the Sun and Moon for an observer at lat/lon (deg).
 * Returns alt/az (deg), angular radii (deg), angular separation (deg) and the
 * eclipse magnitude (fraction of the Sun's *diameter* covered). magnitude >= 1
 * => total (if the Moon's disk fully covers the Sun's).
 */
export function groundView(date, latDeg, lonDeg, elevM = 0) {
  const t = MakeTime(date)
  const observer = new Observer(latDeg, lonDeg, elevM)

  // Apparent (of-date) topocentric equatorial coords, then horizontal.
  const sunEq = Equator(Body.Sun, t, observer, true, true)
  const moonEq = Equator(Body.Moon, t, observer, true, true)
  const sunHor = Horizon(t, observer, sunEq.ra, sunEq.dec, 'normal')
  const moonHor = Horizon(t, observer, moonEq.ra, moonEq.dec, 'normal')

  const sunRad = Math.asin(RADIUS_KM.Sun / (sunEq.dist * AU_KM)) * DEG
  const moonRad = Math.asin(RADIUS_KM.Moon / (moonEq.dist * AU_KM)) * DEG

  const sep = angularSeparation(sunHor.altitude, sunHor.azimuth, moonHor.altitude, moonHor.azimuth)

  // Magnitude = covered fraction of the Sun's diameter along the line of centers.
  let magnitude = 0
  if (sep < sunRad + moonRad) {
    magnitude = (sunRad + moonRad - sep) / (2 * sunRad)
  }
  magnitude = Math.max(0, Math.min(magnitude, (sunRad + moonRad) / (2 * sunRad)))

  return {
    sun: { alt: sunHor.altitude, az: sunHor.azimuth, radiusDeg: sunRad },
    moon: { alt: moonHor.altitude, az: moonHor.azimuth, radiusDeg: moonRad },
    separationDeg: sep,
    magnitude,
    isTotal: sep < moonRad - sunRad && sunHor.altitude > 0,
    sunUp: sunHor.altitude > -sunRad
  }
}

/** Angular separation (deg) between two horizontal coordinates. */
function angularSeparation(alt1, az1, alt2, az2) {
  const a1 = alt1 * RAD, a2 = alt2 * RAD
  const dAz = (az1 - az2) * RAD
  const c = Math.sin(a1) * Math.sin(a2) + Math.cos(a1) * Math.cos(a2) * Math.cos(dAz)
  return Math.acos(Math.max(-1, Math.min(1, c))) * DEG
}

/** lat/lon (deg) -> unit vector on a unit sphere in the Earth-fixed frame.
 *  Matches eqjToEcef so paths and cast shadows align. */
export function latLonToVec(latDeg, lonDeg) {
  const lat = latDeg * RAD, lon = lonDeg * RAD
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]
}
