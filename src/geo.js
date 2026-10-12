// Distancia en metros entre dos puntos {lat, lng} (fórmula de Haversine)
function distanceM(a, b) {
  const R = 6371000; // radio de la Tierra en metros
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Parada más cercana de la ruta y a cuántos metros está
function nearestStop(route, point) {
  let best = null;
  for (const stop of route.stops) {
    const d = distanceM(stop, point);
    if (!best || d < best.distance) best = { stop, distance: d };
  }
  return best;
}

module.exports = { distanceM, nearestStop };
