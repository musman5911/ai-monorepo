// Parse a coordinate string into { lat, lon } decimal degrees.
// Accepts DMS ("33°49'45.3\"N 72°48'56.1\"E", with or without the symbol chars)
// or decimal ("33.82925, 72.81558" / "33.82925 72.81558"). Returns null if it
// cannot be parsed or the values fall outside valid lat/lon ranges.
export const parseCoordinates = (input) => {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;

  const isValid = (lat, lon) =>
    !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

  // 1) Decimal degrees: "lat, lon" or "lat lon" (optionally signed)
  const dec = s.match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (dec) {
    const lat = parseFloat(dec[1]);
    const lon = parseFloat(dec[2]);
    if (isValid(lat, lon)) return { lat, lon };
  }

  // 2) DMS: pairs of deg/min/sec/hemisphere, e.g. 33°49'45.3"N 72°48'56.1"E.
  //    Symbols (° ' ") are optional — spaces alone are accepted too. The
  //    trailing N/S/E/W letter disambiguates this from decimal form.
  const dmsRe = /(\d+(?:\.\d+)?)\s*[°º]?\s*(\d+(?:\.\d+)?)\s*['′]?\s*(\d+(?:\.\d+)?)\s*["″]?\s*([NSEW])/gi;
  const parts = [...s.matchAll(dmsRe)];
  if (parts.length >= 2) {
    const toDec = (p) => {
      let v = parseFloat(p[1]) + parseFloat(p[2]) / 60 + parseFloat(p[3]) / 3600;
      if (p[4].toUpperCase() === 'S' || p[4].toUpperCase() === 'W') v = -v;
      return v;
    };
    let lat = null, lon = null;
    for (const p of parts) {
      const h = p[4].toUpperCase();
      const d = toDec(p);
      if (h === 'N' || h === 'S') lat = d;
      else lon = d;
    }
    if (lat != null && lon != null && isValid(lat, lon)) return { lat, lon };
  }

  return null;
};
