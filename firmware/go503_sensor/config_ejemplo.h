#pragma once
// =====================================================================
//  Configuración del sensor go503
//  1. Copia este archivo y nómbralo config.h (en esta misma carpeta).
//  2. Llena tus datos en config.h.
//  config.h NO se sube a git porque lleva la clave de la API.
// =====================================================================

// ---------- Identidad del bus ----------
#define BUS_ID   "BUS-07"   // único por bus
#define ROUTE_ID "101"      // debe existir en el servidor (GET /api/routes)

// ---------- Servidor ----------
// Sin "/" al final. El ESP32 NO puede usar localhost: usa un túnel (ver README).
#define API_BASE    "https://tu-tunel.trycloudflare.com"
#define BUS_API_KEY "cambia-esta-clave"   // la misma BUS_API_KEY del .env del servidor

// Certificado raíz de tu dominio (formato PEM) para verificar el HTTPS.
// Si lo dejas comentado, la conexión va cifrada pero SIN verificar el servidor:
// sirve para pruebas, NO para producción. Cómo obtenerlo: ver README.
// #define API_CA_CERT \
//   "-----BEGIN CERTIFICATE-----\n" \
//   "....\n" \
//   "-----END CERTIFICATE-----\n"

// ---------- Módulo 4G ----------
// Deja UNA sola línea sin comentar
#define MODEM_SIM7600
// #define MODEM_A7670

// APN de tu operador. Si no lo sabes, prueba primero con "" (muchas redes LTE
// lo asignan solas). Para confirmarlo: en un celular con un chip del mismo
// operador, ve a Ajustes > Redes móviles > Nombres de punto de acceso (APN).
#define APN       ""
#define GPRS_USER ""
#define GPRS_PASS ""

#define MODEM_RX_PIN     16    // el ESP32 recibe aquí (va al TX del módulo)
#define MODEM_TX_PIN     17    // el ESP32 transmite aquí (va al RX del módulo)
#define MODEM_PWRKEY_PIN 4     // pin que enciende el módulo; -1 si tu módulo enciende solo
#define MODEM_BAUD       115200

// ---------- Cada cuánto se manda ----------
#define INTERVALO_GPS_MS         5000     // en marcha: posición cada 5 s
#define INTERVALO_PARADO_MS      30000    // detenido (semáforo, parada): cada 30 s
#define INTERVALO_MOTOR_MS       60000    // datos del motor cada 60 s
#define PARADO_LARGO_MS          300000   // detenido más de 5 min = estacionado
#define INTERVALO_ESTACIONADO_MS 600000   // estacionado o apagado: cada 10 min
#define VELOCIDAD_MINIMA_KMH     3.0      // menos que esto se manda como 0

// ---------- Cola sin señal ----------
#define COLA_MAX_BYTES 300000   // ~2000 mensajes (unas 3 h de recorrido sin señal)

// ---------- Odómetro (calculado con el GPS) ----------
#define ODOMETRO_INICIAL_KM 0   // pon lo que marca el tablero el día que lo instalas

// =====================================================================
//  Sensores opcionales: descomenta los que tenga ESTE bus
// =====================================================================

// --- Buses/microbuses modernos: OBD-II por CAN (transceptor SN65HVD230) ---
// #define USAR_OBD_CAN
#define CAN_TX_PIN 25
#define CAN_RX_PIN 26
#define CAN_KBPS   500          // casi siempre 500; algunos usan 250

// --- Buses diésel pesados: J1939 (pendiente, todavía no implementado) ---
// #define USAR_J1939

// --- Buses viejos sin computadora ---
// Voltaje del switch de encendido (divisor 100k / 10k, ver README)
// #define USAR_IGNICION_ADC
#define IGNICION_PIN      34
#define IGNICION_DIVISOR  11.0   // (100k + 10k) / 10k
#define IGNICION_ON_V     6.0    // más de 6 V = encendido (sirve para 12 y 24 V)

// Sensor de nivel del tanque (se mide el voltaje del cable del flotador)
// #define USAR_COMBUSTIBLE_ADC
#define COMBUSTIBLE_PIN     35
#define COMBUSTIBLE_DIVISOR 11.0
#define COMBUSTIBLE_V_VACIO 1.0   // mide con el tanque vacío y anótalo aquí
#define COMBUSTIBLE_V_LLENO 7.0   // mide con el tanque lleno y anótalo aquí

// Temperatura con DS18B20 pegado a la manguera del radiador
// #define USAR_DS18B20
#define DS18B20_PIN 27

// Frenazos con acelerómetro MPU6050 (I2C)
// #define USAR_MPU6050
#define MPU_SDA_PIN    21
#define MPU_SCL_PIN    22
#define MPU_EJE_FRENTE 0      // 0 = eje X apunta hacia el frente del bus, 1 = eje Y
#define MPU_SIGNO      1      // pon -1 si la flecha del eje apunta hacia atrás
#define FRENAZO_G      0.35   // desaceleración que cuenta como frenazo (en g)

// ---------- Watchdog ----------
#define WATCHDOG_SEGUNDOS 120   // si el programa se cuelga más que esto, se reinicia
