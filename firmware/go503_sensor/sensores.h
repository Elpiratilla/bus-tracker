#pragma once
// =====================================================================
//  Sensores para buses sin computadora (todos opcionales, ver config.h)
// =====================================================================

// Voltaje real en el cable, leyendo el pin ADC detrás del divisor de voltaje.
// Se promedian varias lecturas porque el ADC del ESP32 es ruidoso.
float leerVoltios(int pin, float divisor) {
  uint32_t suma = 0;
  for (int i = 0; i < 16; i++) suma += analogReadMilliVolts(pin);
  return suma / 16.0 / 1000.0 * divisor;
}

// ---------- Switch de encendido ----------
#ifdef USAR_IGNICION_ADC
bool ignicionEncendida() { return leerVoltios(IGNICION_PIN, IGNICION_DIVISOR) > IGNICION_ON_V; }
#endif

// ---------- Nivel de combustible (0-100 %) ----------
#ifdef USAR_COMBUSTIBLE_ADC
int leerCombustible() {
  float v = leerVoltios(COMBUSTIBLE_PIN, COMBUSTIBLE_DIVISOR);
  float pct = (v - COMBUSTIBLE_V_VACIO) / (COMBUSTIBLE_V_LLENO - COMBUSTIBLE_V_VACIO) * 100;
  return constrain((int)pct, 0, 100);   // funciona aunque el flotador vaya al revés
}
#endif

// ---------- Temperatura del motor con DS18B20 ----------
#ifdef USAR_DS18B20
#include <OneWire.h>
#include <DallasTemperature.h>
OneWire unCable(DS18B20_PIN);
DallasTemperature termometro(&unCable);

void iniciarTermometro() {
  termometro.begin();
  termometro.setWaitForConversion(false);   // no bloquear 750 ms esperando la medida
  termometro.requestTemperatures();
}

// Devuelve la medida anterior y pide una nueva para la próxima vez.
// NAN si el sensor está desconectado (-127) o recién encendido (85).
float leerTemperatura() {
  float c = termometro.getTempCByIndex(0);
  termometro.requestTemperatures();
  return (c == DEVICE_DISCONNECTED_C || c == 85.0) ? NAN : c;
}
#endif

// ---------- Frenazos con MPU6050 ----------
// Corre en una tarea aparte (como un segundo programa) que mide 50 veces por
// segundo, para no perderse un frenazo mientras el loop está mandando datos.
#ifdef USAR_MPU6050
#include <Wire.h>
#define MPU_DIRECCION 0x68
volatile uint16_t frenazos = 0;   // frenazos desde el último reporte

void escribirMpu(uint8_t registro, uint8_t valor) {
  Wire.beginTransmission(MPU_DIRECCION);
  Wire.write(registro);
  Wire.write(valor);
  Wire.endTransmission();
}

// Aceleración hacia el frente del bus, en g (negativa al frenar)
bool leerAceleracion(float& frente) {
  Wire.beginTransmission(MPU_DIRECCION);
  Wire.write(0x3B);   // primer registro de aceleración
  if (Wire.endTransmission(false) != 0 || Wire.requestFrom((uint8_t)MPU_DIRECCION, (uint8_t)4) != 4) return false;
  int16_t x = (Wire.read() << 8) | Wire.read();
  int16_t y = (Wire.read() << 8) | Wire.read();
  frente = (MPU_EJE_FRENTE == 0 ? x : y) / 8192.0 * MPU_SIGNO;   // ±4 g = 8192 por g
  return true;
}

void tareaAcelerometro(void*) {
  float base = 0;            // promedio lento: quita la inclinación del sensor y las cuestas
  bool hayBase = false;
  int seguidas = 0;
  unsigned long ultimo = 0;
  for (;;) {
    float a;
    if (leerAceleracion(a)) {
      if (!hayBase) { base = a; hayBase = true; }
      base += (a - base) * 0.001;   // tarda ~20 s en ajustarse: un frenazo casi no lo mueve
      // Frenazo = desaceleración fuerte por más de 0.1 s (5 lecturas), máximo uno cada 3 s
      if (base - a > FRENAZO_G) {
        if (++seguidas == 5 && millis() - ultimo > 3000) { frenazos++; ultimo = millis(); }
      } else {
        seguidas = 0;
      }
    }
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}

void iniciarAcelerometro() {
  Wire.begin(MPU_SDA_PIN, MPU_SCL_PIN);
  escribirMpu(0x6B, 0x00);   // despertar el sensor
  escribirMpu(0x1C, 0x08);   // rango ±4 g
  escribirMpu(0x1A, 0x04);   // filtro de ~20 Hz contra la vibración del motor
  xTaskCreate(tareaAcelerometro, "frenazos", 3072, nullptr, 1, nullptr);
}
#endif
