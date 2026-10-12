// Datos en memoria. Aquí se cambia después por la base de datos (Supabase).
// lat/lng son aproximadas: ajústalas a la ubicación real de cada parada.
// type: "autobus" o "microbus"
const routes = [
  { id: "101", name: "Ruta 101", type: "autobus", stops: [
    { id: "t-ori", name: "Terminal de Oriente", lat: 13.7126, lng: -89.1643 },
    { id: "centro", name: "Centro Histórico", lat: 13.6989, lng: -89.1914 },
    { id: "p-inf", name: "Parque Infantil", lat: 13.7030, lng: -89.2030 },
    { id: "metro", name: "Metrocentro", lat: 13.7059, lng: -89.2123 },
    { id: "z-rosa", name: "Zona Rosa", lat: 13.6935, lng: -89.2362 },
  ]},
  { id: "42", name: "Ruta 42", type: "autobus", stops: [
    { id: "mejicanos", name: "Mejicanos", lat: 13.7415, lng: -89.2145 },
    { id: "zacamil", name: "Zacamil", lat: 13.7290, lng: -89.2090 },
    { id: "ues", name: "Universidad de El Salvador", lat: 13.7188, lng: -89.2044 },
    { id: "escalon", name: "Colonia Escalón", lat: 13.7010, lng: -89.2380 },
    { id: "a-cusc", name: "Antiguo Cuscatlán", lat: 13.6740, lng: -89.2420 },
  ]},
  { id: "29", name: "Ruta 29", type: "microbus", stops: [
    { id: "soya", name: "Soyapango", lat: 13.7100, lng: -89.1530 },
    { id: "t-ori", name: "Terminal de Oriente", lat: 13.7126, lng: -89.1643 },
    { id: "centro", name: "Centro Histórico", lat: 13.6989, lng: -89.1914 },
    { id: "rosales", name: "Hospital Rosales", lat: 13.7045, lng: -89.2028 },
    { id: "merliot", name: "Merliot", lat: 13.6765, lng: -89.2630 },
  ]},
];

// geofence: en qué parada está cada bus ahora mismo (null si va entre paradas)
// trips: hora en que el bus pasó por cada parada en su vuelta actual
// alerts: avisos "tu bus está cerca" pendientes (src/alerts.js)
module.exports = { routes, lastPass: {}, segments: [], buses: {}, geofence: {}, trips: {}, alerts: new Map() };
