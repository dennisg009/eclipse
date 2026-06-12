// Offline reverse geocoding: which country is a lat/lon in — or, if it's at
// sea, which land is nearest. Uses the Natural Earth 110m countries dataset
// (public domain) bundled in public/data/, decoded with topojson-client.
//
// whereIs() is synchronous-with-cache: it returns null until the dataset has
// lazy-loaded (first call kicks that off), then resolved labels thereafter.
// Callers re-render every frame, so the label simply appears once ready.

let features = null
let loading = null
const cache = new Map()

export function whereIs(lat, lon) {
  const key = lat.toFixed(1) + ',' + lon.toFixed(1)
  if (cache.has(key)) return cache.get(key)
  if (!features) { ensureLoaded(); return null }
  const res = locate(lat, lon)
  cache.set(key, res)
  return res
}

function ensureLoaded() {
  if (loading) return
  loading = (async () => {
    const [{ feature }, topo] = await Promise.all([
      import('topojson-client'),
      fetch(import.meta.env.BASE_URL + 'data/countries-110m.json').then((r) => r.json())
    ])
    features = feature(topo, topo.objects.countries).features
  })().catch(() => { loading = null }) // allow retry on transient failure
}

function locate(lat, lon) {
  let nearest = null
  let nearestKm = Infinity
  for (const f of features) {
    const name = f.properties.name
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    for (const rings of polys) {
      if (pointInRings(lon, lat, rings)) {
        return { name, inside: true, label: name }
      }
      // track nearest land vertex for the at-sea fallback
      for (const ring of rings) {
        for (const [vlon, vlat] of ring) {
          const d = haversineKm(lat, lon, vlat, vlon)
          if (d < nearestKm) { nearestKm = d; nearest = name }
        }
      }
    }
  }
  return {
    name: nearest,
    inside: false,
    km: Math.round(nearestKm),
    label: `at sea · ${Math.round(nearestKm)} km from ${nearest}`
  }
}

// Even-odd ray casting across all rings (outer + holes) of one polygon.
function pointInRings(x, y, rings) {
  let inside = false
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j]
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside
      }
    }
  }
  return inside
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
