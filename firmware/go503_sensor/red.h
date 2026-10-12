#pragma once
// =====================================================================
//  Red 4G: encender el módulo, conectarse y mandar el JSON a la API.
//  La conexión con el servidor se deja abierta (keep-alive) para no repetir
//  el saludo HTTPS en cada mensaje: eso es lo que más datos gasta.
// =====================================================================

#define SerialAT Serial2

TinyGsm modem(SerialAT);
TinyGsmClient tcp(modem, 0);   // conexión TCP que abre el módulo 4G
SSLClient tls(&tcp);           // HTTPS: el cifrado lo hace el ESP32 sobre esa conexión
HttpClient* http = nullptr;

String apiHost, apiRuta;
uint16_t apiPuerto = 443;
bool enLinea = false;          // ¿hay datos móviles?
int erroresSeguidos = 0;       // envíos fallidos por red, uno tras otro

enum Resultado { ENVIO_OK, ENVIO_RECHAZADO, ENVIO_ERROR };

void alimentarWatchdog() { esp_task_wdt_reset(); }

// Separa API_BASE ("https://host:puerto/prefijo") en sus partes
void leerApiBase() {
  String url = API_BASE;
  bool https = url.startsWith("https://");
  url.replace("https://", "");
  url.replace("http://", "");

  int barra = url.indexOf('/');
  String prefijo = barra >= 0 ? url.substring(barra) : "";
  if (barra >= 0) url = url.substring(0, barra);

  apiPuerto = https ? 443 : 80;
  int dosPuntos = url.indexOf(':');
  if (dosPuntos >= 0) {
    apiPuerto = url.substring(dosPuntos + 1).toInt();
    url = url.substring(0, dosPuntos);
  }
  apiHost = url;
  apiRuta = prefijo + "/api/telemetry";

  // HTTP plano va directo por el TCP del módulo; HTTPS pasa antes por SSLClient
  Client* cliente = &tcp;
  if (https) {
#ifdef API_CA_CERT
    tls.setCACert(API_CA_CERT);
#else
    tls.setInsecure();
    Serial.println(F("[API] OJO: HTTPS sin verificar certificado (solo para pruebas)"));
#endif
    tls.setHandshakeTimeout(30);   // en segundos
    cliente = &tls;
  }
  http = new HttpClient(*cliente, apiHost.c_str(), apiPuerto);
  http->connectionKeepAlive();
  http->setHttpResponseTimeout(15000);
  Serial.printf("[API] %s://%s:%u%s\n", https ? "https" : "http", apiHost.c_str(), apiPuerto, apiRuta.c_str());
}

// Enciende el módulo con un pulso en PWRKEY (solo si no estaba encendido ya:
// si el ESP32 se reinició, el módulo pudo quedar prendido y otro pulso lo apagaría)
void encenderModem() {
  SerialAT.begin(MODEM_BAUD, SERIAL_8N1, MODEM_RX_PIN, MODEM_TX_PIN);
  if (modem.testAT(2000)) return;

  if (MODEM_PWRKEY_PIN >= 0) {
    Serial.println(F("[4G] Encendiendo módulo..."));
    pinMode(MODEM_PWRKEY_PIN, OUTPUT);
    digitalWrite(MODEM_PWRKEY_PIN, LOW);
    delay(100);
    digitalWrite(MODEM_PWRKEY_PIN, HIGH);
    delay(1000);
    digitalWrite(MODEM_PWRKEY_PIN, LOW);
  }
  for (int i = 0; i < 20 && !modem.testAT(1000); i++) alimentarWatchdog();
}

void iniciarModem() {
  encenderModem();
  Serial.println(F("[4G] Iniciando módulo..."));
  if (!modem.init()) {
    Serial.println(F("[4G] No respondió, reiniciándolo..."));
    modem.restart();
  }
  Serial.printf("[4G] Módulo: %s\n", modem.getModemInfo().c_str());
}

// Intenta tener datos móviles. No se queda esperando señal: si no hay,
// regresa false y el programa sigue midiendo GPS y guardando en la cola.
bool conectarRed() {
  alimentarWatchdog();
  if (!modem.isNetworkConnected()) {
    Serial.printf("[4G] Sin red (señal %d/31)\n", modem.getSignalQuality());
    return false;
  }
  if (modem.isGprsConnected()) return true;

  Serial.printf("[4G] Conectando datos (APN \"%s\")...\n", APN);
  if (!modem.gprsConnect(APN, GPRS_USER, GPRS_PASS)) {
    Serial.println(F("[4G] Falló la conexión de datos"));
    return false;
  }
  Serial.printf("[4G] En línea. IP %s, señal %d/31\n", modem.getLocalIP().c_str(), modem.getSignalQuality());
  return true;
}

// Revisa la conexión de vez en cuando y reconecta si se cayó.
// Si pasa mucho tiempo sin red, reinicia el módulo (a veces se queda trabado).
void mantenerRed(void (*despuesDeReiniciar)()) {
  static unsigned long ultimaRevision = 0, sinRedDesde = 0;
  const unsigned long cada = enLinea && erroresSeguidos < 3 ? 60000 : 15000;
  if (ultimaRevision && millis() - ultimaRevision < cada) return;
  ultimaRevision = millis();

  bool antes = enLinea;
  enLinea = conectarRed();
  if (enLinea) {
    erroresSeguidos = 0;
    sinRedDesde = 0;
    return;
  }
  if (antes) http->stop();   // la conexión vieja ya no sirve
  if (!sinRedDesde) sinRedDesde = millis();

  if (millis() - sinRedDesde > 10UL * 60 * 1000) {
    Serial.println(F("[4G] 10 min sin red: reiniciando el módulo"));
    modem.restart();
    despuesDeReiniciar();   // p. ej. volver a encender el GPS
    sinRedDesde = millis();
  }
}

// Manda un JSON a la API y dice qué pasó:
//   ENVIO_OK         el servidor lo guardó (2xx)
//   ENVIO_RECHAZADO  el servidor dijo que el mensaje está malo (400): no tiene caso reintentarlo
//   ENVIO_ERROR      no hubo red, timeout, clave mala o servidor caído: reintentar después
Resultado enviarJson(const String& json) {
  alimentarWatchdog();
  if (!enLinea) return ENVIO_ERROR;

  http->beginRequest();
  if (http->post(apiRuta.c_str()) != 0) {
    Serial.println(F("[API] No se pudo conectar al servidor"));
    http->stop();
    erroresSeguidos++;
    return ENVIO_ERROR;
  }
  http->sendHeader("Content-Type", "application/json");
  http->sendHeader("x-api-key", BUS_API_KEY);
  http->sendHeader("Content-Length", (int)json.length());
  http->beginBody();
  http->print(json);
  http->endRequest();

  int estado = http->responseStatusCode();
  if (estado < 0) {   // timeout o se cortó la conexión
    Serial.printf("[API] Sin respuesta (error %d)\n", estado);
    http->stop();
    erroresSeguidos++;
    return ENVIO_ERROR;
  }
  String respuesta = http->responseBody();   // hay que leerla completa para reusar la conexión
  erroresSeguidos = 0;
  Serial.printf("[API] %d %s\n", estado, respuesta.c_str());

  if (estado >= 200 && estado < 300) return ENVIO_OK;
  if (estado == 400) return ENVIO_RECHAZADO;
  if (estado == 401) Serial.println(F("[API] Clave inválida: revisa BUS_API_KEY en config.h"));
  return ENVIO_ERROR;
}
