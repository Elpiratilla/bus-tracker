#pragma once
// =====================================================================
//  GPS del módulo 4G, leído con el comando AT+CGPSINFO (igual en SIM7600 y A7670).
//  Respuesta con fix:
//    +CGPSINFO: 1342.072000,N,08913.470000,W,121026,141600.0,650.2,17.5,274.5
//               latitud     N/S longitud    E/W fecha  hora UTC  alt  nudos rumbo
//  Sin fix llega vacía: +CGPSINFO: ,,,,,,,,
// =====================================================================

struct LecturaGps {
  double lat, lng;
  float kmh;       // velocidad sobre el suelo
  float rumbo;     // 0 = norte, 90 = este
};

void encenderGps() {
#if defined(MODEM_SIM7600)
  modem.sendAT(GF("+CGPS=1"));          // si ya estaba encendido responde ERROR: no pasa nada
#else
  modem.sendAT(GF("+CGNSSPWR=1"));
#endif
  modem.waitResponse(5000L);
  Serial.println(F("[GPS] Encendido (el primer fix puede tardar 1-2 min a cielo abierto)"));
}

// "1342.072000" + "N" -> 13.7012 (los últimos dígitos antes del punto son minutos)
double aGrados(const String& valor, const String& hemisferio) {
  double v = valor.toDouble();
  int grados = (int)(v / 100);
  double resultado = grados + (v - grados * 100) / 60.0;
  return (hemisferio == "S" || hemisferio == "W") ? -resultado : resultado;
}

// Pone en hora el reloj del ESP32 con la fecha y hora UTC del GPS.
// Así cada mensaje lleva su "ts" aunque se mande más tarde desde la cola.
void ponerHora(const String& fecha, const String& hora) {
  if (fecha.length() < 6 || hora.length() < 6) return;
  struct tm t = {};
  t.tm_mday = fecha.substring(0, 2).toInt();
  t.tm_mon  = fecha.substring(2, 4).toInt() - 1;
  t.tm_year = fecha.substring(4, 6).toInt() + 100;   // años desde 1900
  t.tm_hour = hora.substring(0, 2).toInt();
  t.tm_min  = hora.substring(2, 4).toInt();
  t.tm_sec  = hora.substring(4, 6).toInt();
  time_t gps = mktime(&t);   // en setup() pusimos la zona horaria en UTC
  if (llabs((long long)(gps - time(nullptr))) > 2) {
    struct timeval tv = { gps, 0 };
    settimeofday(&tv, nullptr);
  }
}

bool relojEnHora() { return time(nullptr) > 1700000000; }   // después de nov. 2023

// Hora actual en formato ISO para el campo "ts": 2026-10-12T08:16:00Z
String horaIso() {
  time_t ahora = time(nullptr);
  struct tm t;
  gmtime_r(&ahora, &t);
  char texto[24];
  strftime(texto, sizeof(texto), "%Y-%m-%dT%H:%M:%SZ", &t);
  return texto;
}

// Lee el GPS. Devuelve false si no hay fix (en ese caso NO se manda posición).
bool leerGps(LecturaGps& g) {
  String r;
  modem.sendAT(GF("+CGPSINFO"));
  if (modem.waitResponse(2000L, r) != 1) return false;

  int inicio = r.indexOf("+CGPSINFO:");
  if (inicio < 0) return false;
  int fin = r.indexOf('\n', inicio);
  String linea = r.substring(inicio + 10, fin < 0 ? r.length() : fin);
  linea.trim();

  // Separar los 9 campos por comas
  String campo[9];
  int n = 0, desde = 0;
  while (n < 9) {
    int coma = linea.indexOf(',', desde);
    campo[n++] = coma < 0 ? linea.substring(desde) : linea.substring(desde, coma);
    if (coma < 0) break;
    desde = coma + 1;
  }
  if (n < 9 || campo[0].length() == 0) return false;   // sin fix

  g.lat = aGrados(campo[0], campo[1]);
  g.lng = aGrados(campo[2], campo[3]);
  if (g.lat == 0 && g.lng == 0) return false;          // el servidor rechaza 0,0
  ponerHora(campo[4], campo[5]);
  g.kmh = campo[7].toFloat() * 1.852;                   // nudos -> km/h
  g.rumbo = campo[8].toFloat();
  return true;
}

// Distancia en metros entre dos puntos (fórmula de haversine, igual que src/geo.js)
double distanciaM(double lat1, double lng1, double lat2, double lng2) {
  const double R = 6371000, rad = PI / 180;
  double dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  double a = sin(dLat / 2) * sin(dLat / 2) +
             cos(lat1 * rad) * cos(lat2 * rad) * sin(dLng / 2) * sin(dLng / 2);
  return 2 * R * atan2(sqrt(a), sqrt(1 - a));
}
