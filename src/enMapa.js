// ¿Sale este bus en el mapa público (y en sus tiempos de llegada)?
// Lo usan GET /api/buses y el cálculo de ETA (src/eta.js).
const APAGADO_MS = 5 * 60 * 1000; // motor apagado más de esto = bus guardado (no por apagarlo un rato en la terminal)

function enMapa(bus, now = Date.now()) {
  if (!bus) return true;
  if (bus.enServicio === true) return true;   // el motorista dice que va en trayecto: manda él
  if (bus.enServicio === false) return false; // tocó "Terminar trayecto"
  // Sin app del motorista: lo decide el encendido que manda el sensor (si no lo manda, siempre sale)
  return !(bus.apagadoDesde && now - bus.apagadoDesde > APAGADO_MS);
}

module.exports = { enMapa, APAGADO_MS };
