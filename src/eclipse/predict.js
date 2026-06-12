// Find upcoming *total* solar eclipses and summarise each one.
//
// All accuracy comes straight from astronomy-engine's eclipse search. We only
// filter to total events and attach a human-friendly summary (peak location
// name is left to the UI; here we compute peak time, sub-point, and the central
// duration at the point of greatest eclipse).

import {
  SearchGlobalSolarEclipse, NextGlobalSolarEclipse, SearchLocalSolarEclipse,
  Observer
} from 'astronomy-engine'
import { sarosFor, isHybrid } from './saros.js'

/**
 * @param {Date} startDate
 * @param {number} count  how many total eclipses to return
 * @returns {Array<{peak:Date, lat:number, lon:number, kind:string,
 *                   obscuration:number, durationSec:number|null}>}
 */
export function upcomingTotalEclipses(startDate, count = 15) {
  const out = []
  let ev = SearchGlobalSolarEclipse(startDate)
  let guard = 0
  while (out.length < count && guard < 400) {
    guard++
    if (ev.kind === 'total') {
      out.push(summarise(ev))
    }
    ev = NextGlobalSolarEclipse(ev.peak)
  }
  return out
}

function summarise(ev) {
  const peak = ev.peak.date
  let durationSec = null
  // Central duration at the greatest-eclipse point.
  if (Number.isFinite(ev.latitude) && Number.isFinite(ev.longitude)) {
    try {
      const observer = new Observer(ev.latitude, ev.longitude, 0)
      // Start the local search a little before the global peak.
      const local = SearchLocalSolarEclipse(new Date(peak.getTime() - 3 * 3600 * 1000), observer)
      if (local.kind === 'total' && local.total_begin && local.total_end) {
        durationSec = (local.total_end.time.date - local.total_begin.time.date) / 1000
      }
    } catch (_) { /* leave null */ }
  }
  return {
    peak,
    lat: ev.latitude,
    lon: ev.longitude,
    kind: ev.kind,
    obscuration: ev.obscuration,
    durationSec,
    saros: sarosFor(peak),
    hybrid: isHybrid(peak)
  }
}

/** Coarse human label for a sub-point (hemisphere + ocean/region hint). */
export function regionLabel(lat, lon) {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(1)}°${ns}, ${Math.abs(lon).toFixed(1)}°${ew}`
}
