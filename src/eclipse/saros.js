// Saros series numbers for total & hybrid solar eclipses, 2026–2050.
// Sourced from NASA's Five Millennium Catalog of Solar Eclipses (Espenak),
// decade tables at https://eclipse.gsfc.nasa.gov/SEdecade/ . Keyed by the
// UTC calendar date (YYYY-MM-DD) of greatest eclipse.
//
// A solar eclipse has no proper name; this Saros number (plus the date) is the
// standard catalogue identifier.

const SAROS = {
  '2026-08-12': 126,
  '2027-08-02': 136,
  '2028-07-22': 146,
  '2030-11-25': 133,
  '2031-11-14': 143, // hybrid
  '2033-03-30': 120,
  '2034-03-20': 130,
  '2035-09-02': 145,
  '2037-07-13': 127,
  '2038-12-26': 142,
  '2039-12-15': 152,
  '2041-04-30': 129,
  '2042-04-20': 139,
  '2043-04-09': 149,
  '2044-08-23': 126,
  '2045-08-12': 136,
  '2046-08-02': 146,
  '2048-12-05': 133,
  '2049-11-25': 143, // hybrid
  '2050-05-20': 148  // hybrid
}

// Eclipses NASA classifies as HYBRID (annular-total): total near mid-path,
// annular toward the path ends. astronomy-engine reports kind "total" for
// these because that is true at the instant of greatest eclipse.
const HYBRID = new Set(['2031-11-14', '2049-11-25', '2050-05-20'])

/** Saros series number for an eclipse peaking on `date`, or null if unknown. */
export function sarosFor(date) {
  return SAROS[date.toISOString().slice(0, 10)] ?? null
}

/** True if NASA classifies the eclipse peaking on `date` as hybrid. */
export function isHybrid(date) {
  return HYBRID.has(date.toISOString().slice(0, 10))
}
