const { STORE_RADIUS_M } = require('../config/constants');

const STORE_LAT = parseFloat(process.env.STORE_LAT);
const STORE_LNG = parseFloat(process.env.STORE_LNG);

// Haversine formula — returns distance in meters
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function isInStore(lat, lng) {
  if (!STORE_LAT || !STORE_LNG) throw new Error('STORE_LAT/STORE_LNG not configured');
  const dist = distanceMeters(STORE_LAT, STORE_LNG, lat, lng);
  return { valid: dist <= STORE_RADIUS_M, distanceM: Math.round(dist) };
}

module.exports = { isInStore, distanceMeters };
