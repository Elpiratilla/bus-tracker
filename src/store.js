// Datos en memoria. Aquí se cambia después por la base de datos (Supabase).
// lat/lng son aproximadas: ajústalas a la ubicación real de cada parada.
const routes = [
  { id: "101", name: "Ruta 101", stops: [
    { id: "t-occ", name: "Terminal de Occidente", lat: 13.7058, lng: -89.2278 },
    { id: "sdm", name: "Plaza Salvador del Mundo", lat: 13.7010, lng: -89.2243 },
    { id: "centro", name: "Centro Histórico", lat: 13.6988, lng: -89.1912 },
    { id: "t-ori", name: "Terminal de Oriente", lat: 13.7049, lng: -89.1713 },
  ]},
  { id: "29", name: "Ruta 29", stops: [
    { id: "a1", name: "Mejicanos", lat: 13.7400, lng: -89.2147 },
    { id: "a2", name: "Universidad de El Salvador", lat: 13.7186, lng: -89.2044 },
    { id: "a3", name: "Metrocentro", lat: 13.7075, lng: -89.2113 },
    { id: "a4", name: "Plaza Mundo Soyapango", lat: 13.7032, lng: -89.1480 },
  ]},
  { id: "42", name: "Ruta 42", stops: [
    { id: "b1", name: "Santa Tecla", lat: 13.6769, lng: -89.2797 },
    { id: "b2", name: "Escalón", lat: 13.7016, lng: -89.2400 },
    { id: "b3", name: "Centro de Gobierno", lat: 13.7108, lng: -89.2036 },
  ]},
];

module.exports = { routes, lastPass: {}, segments: [], buses: {} };
