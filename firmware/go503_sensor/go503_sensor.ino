// =====================================================================
//  go503 - sensor para buses (ESP32 + módulo 4G con GPS)
//  Manda a POST {API_BASE}/api/telemetry:
//    - posición, velocidad y rumbo cada 5 s mientras el bus va en marcha
//    - datos del motor cada 60 s
//  Si no hay señal, guarda los mensajes en la flash y los manda al reconectar.
//  Lee el README.md de la carpeta firmware antes de usarlo.
// =====================================================================

#if __has_include("config.h")
#include "config.h"
#else
#error "Falta config.h: copia config_ejemplo.h como config.h y llena tus datos (ver README)"
#endif

// TinyGSM necesita saber el modelo ANTES de incluirlo
#if defined(MODEM_SIM7600)
#define TINY_GSM_MODEM_SIM7600
#elif defined(MODEM_A7670)
#define TINY_GSM_MODEM_A7672X
#else
#error "Elige MODEM_SIM7600 o MODEM_A7670 en config.h"
#endif
#define TINY_GSM_RX_BUFFER 1024
// #define TINY_GSM_DEBUG Serial   // descomenta para ver los comandos AT

#include <TinyGsmClient.h>
#include <ArduinoHttpClient.h>
#include <SSLClient.h>
#include <LittleFS.h>
#include <esp_task_wdt.h>
#include <sys/time.h>

#include "red.h"
#include "gps.h"
#include "cola.h"
#include "obd.h"
#include "sensores.h"

unsigned long ultimaMuestra = 0;     // última vez que se leyó el GPS
unsigned long ultimaPosicion = 0;    // última posición mandada
unsigned long ultimoMotor = 0;       // últimos datos del motor mandados
unsigned long ultimoMovimiento = 0;  // última vez que el bus iba en marcha
bool motorEncendido = true;          // se actualiza si hay OBD o sensor de ignición

double odometroKm = ODOMETRO_INICIAL_KM;
double ultimaLat = 0, ultimaLng = 0;
double kmSinGuardar = 0;

// ---------- Watchdog: reinicia el ESP32 si el programa se cuelga ----------
void iniciarWatchdog() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  esp_task_wdt_config_t c = { .timeout_ms = WATCHDOG_SEGUNDOS * 1000, .idle_core_mask = 0, .trigger_panic = true };
  if (esp_task_wdt_reconfigure(&c) != ESP_OK) esp_task_wdt_init(&c);
#else
  esp_task_wdt_init(WATCHDOG_SEGUNDOS, true);
#endif
  esp_task_wdt_add(nullptr);   // vigilar el loop principal
}

// ---------- Odómetro calculado con el GPS (se guarda en la flash cada 1 km) ----------
void cargarOdometro() {
  File f = LittleFS.open("/odometro.txt", FILE_READ);
  if (f) { odometroKm = f.readString().toDouble(); f.close(); }
}

void sumarDistancia(const LecturaGps& g, bool enMarcha) {
  // Solo se suma en marcha: parado, el GPS "baila" unos metros y sumaría de más
  if (enMarcha && ultimaLat != 0) {
    double km = distanciaM(ultimaLat, ultimaLng, g.lat, g.lng) / 1000.0;
    if (km < 1.0) {   // un salto de más de 1 km en 5 s es un error del GPS
      odometroKm += km;
      kmSinGuardar += km;
    }
  }
  ultimaLat = g.lat;
  ultimaLng = g.lng;
  if (kmSinGuardar >= 1.0) {
    File f = LittleFS.open("/odometro.txt", FILE_WRITE);
    if (f) { f.print(odometroKm, 3); f.close(); }
    kmSinGuardar = 0;
  }
}

// ---------- Armar el JSON ----------
// Agrega los datos del motor que haya según los sensores activados en config.h
void agregarMotor(String& j) {
  bool tieneDato = false;
#ifdef USAR_OBD_CAN
  motorEncendido = agregarObd(j);
  tieneDato = true;
#endif
#ifdef USAR_IGNICION_ADC
  motorEncendido = ignicionEncendida();
  tieneDato = true;
#endif
  if (tieneDato) j += motorEncendido ? ",\"ignition\":true" : ",\"ignition\":false";

#ifdef USAR_COMBUSTIBLE_ADC
  if (j.indexOf("\"fuel\"") < 0) j += ",\"fuel\":" + String(leerCombustible());
#endif
#ifdef USAR_DS18B20
  float c = leerTemperatura();
  if (!isnan(c) && j.indexOf("\"engineTemp\"") < 0) j += ",\"engineTemp\":" + String(c, 1);
#endif
#ifdef USAR_MPU6050
  j += ",\"hardBrakes\":" + String(frenazos);
  frenazos = 0;
#endif
  j += ",\"odometerKm\":" + String(odometroKm, 1);
}

String armarMensaje(const LecturaGps* g, bool conMotor) {
  String j = "{\"busId\":\"" BUS_ID "\",\"routeId\":\"" ROUTE_ID "\"";
  if (g) {
    bool enMarcha = g->kmh >= VELOCIDAD_MINIMA_KMH;
    j += ",\"lat\":" + String(g->lat, 6) + ",\"lng\":" + String(g->lng, 6);
    j += ",\"speed\":" + (enMarcha ? String(g->kmh, 1) : String("0"));
    if (enMarcha) j += ",\"heading\":" + String((int)g->rumbo);   // parado, el rumbo es basura
  }
  if (relojEnHora()) j += ",\"ts\":\"" + horaIso() + "\"";
  if (conMotor) agregarMotor(j);
  return j + "}";
}

// ---------- Mandar o guardar ----------
void despachar(const String& json) {
  Serial.printf("[MSG] %s\n", json.c_str());
  // Si ya hay cola, el mensaje nuevo va al final para respetar el orden
  if (colaPendiente() || enviarJson(json) == ENVIO_ERROR) agregarACola(json);
}

// ¿Cada cuánto mandar estando detenido? Poco tiempo = semáforo o parada; mucho = estacionado
bool estacionado() {
  unsigned long quieto = millis() - ultimoMovimiento;
  if (quieto < 60000) return false;   // se movió hace poco: está trabajando
  return !motorEncendido || quieto > PARADO_LARGO_MS;
}

void muestrear() {
  LecturaGps g;
  bool fix = leerGps(g);
  bool enMarcha = fix && g.kmh >= VELOCIDAD_MINIMA_KMH;
  if (enMarcha) ultimoMovimiento = millis();
  if (fix) sumarDistancia(g, enMarcha);
  else Serial.println(F("[GPS] Sin fix: no se manda posición"));

  unsigned long intervaloParado = estacionado() ? INTERVALO_ESTACIONADO_MS : INTERVALO_PARADO_MS;
  unsigned long intervaloMotor = estacionado() ? INTERVALO_ESTACIONADO_MS : INTERVALO_MOTOR_MS;
  bool tocaPosicion = fix && (enMarcha || millis() - ultimaPosicion >= intervaloParado);
  bool tocaMotor = millis() - ultimoMotor >= intervaloMotor;
  if (!tocaPosicion && !tocaMotor) return;

  // Si coinciden, van en el mismo mensaje (una petición menos = menos datos)
  despachar(armarMensaje(tocaPosicion ? &g : nullptr, tocaMotor));
  if (tocaPosicion) ultimaPosicion = millis();
  if (tocaMotor) ultimoMotor = millis();
}

// ---------- Programa ----------
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println(F("\n=== go503 sensor " BUS_ID " / ruta " ROUTE_ID " ==="));
  iniciarWatchdog();

  setenv("TZ", "UTC0", 1);   // el reloj interno trabaja en UTC (la hora del GPS)
  tzset();

  iniciarCola();
  cargarOdometro();
#ifdef USAR_OBD_CAN
  iniciarObd();
#endif
#ifdef USAR_DS18B20
  iniciarTermometro();
#endif
#ifdef USAR_MPU6050
  iniciarAcelerometro();
#endif

  leerApiBase();
  iniciarModem();
  encenderGps();
  ultimoMotor = millis() - INTERVALO_MOTOR_MS;   // mandar datos del motor de una vez
}

void loop() {
  alimentarWatchdog();
  mantenerRed(encenderGps);

  if (millis() - ultimaMuestra >= INTERVALO_GPS_MS) {
    ultimaMuestra = millis();
    muestrear();
  }

  // Pocos mensajes de la cola por vuelta, para no atrasar la lectura del GPS
  if (enLinea && colaPendiente()) enviarCola(3);
  delay(50);
}
