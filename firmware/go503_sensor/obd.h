#pragma once
// =====================================================================
//  OBD-II por CAN (ISO 15765-4, IDs de 11 bits) con el TWAI interno del ESP32
//  y un transceptor SN65HVD230.
//  Se pregunta al ID 0x7DF ("a quien responda") y la computadora del motor
//  contesta desde 0x7E8 a 0x7EF.
// =====================================================================
#ifdef USAR_OBD_CAN
#include "driver/twai.h"

bool obdListo = false;

void iniciarObd() {
  twai_general_config_t g = TWAI_GENERAL_CONFIG_DEFAULT((gpio_num_t)CAN_TX_PIN, (gpio_num_t)CAN_RX_PIN, TWAI_MODE_NORMAL);
  g.rx_queue_len = 32;
#if CAN_KBPS == 250
  twai_timing_config_t t = TWAI_TIMING_CONFIG_250KBITS();
#else
  twai_timing_config_t t = TWAI_TIMING_CONFIG_500KBITS();
#endif
  // Filtro: solo dejar pasar respuestas de diagnóstico 0x7E8-0x7EF
  twai_filter_config_t f = { .acceptance_code = 0x7E8u << 21,
                             .acceptance_mask = (0x007u << 21) | 0x1FFFFF,
                             .single_filter = true };
  obdListo = twai_driver_install(&g, &t, &f) == ESP_OK && twai_start() == ESP_OK;
  Serial.println(obdListo ? F("[OBD] CAN listo") : F("[OBD] No se pudo iniciar el CAN"));
}

// Si hubo muchos errores en el bus, el controlador se apaga solo ("bus-off"): lo recuperamos
void revisarCan() {
  twai_status_info_t s;
  if (twai_get_status_info(&s) != ESP_OK) return;
  if (s.state == TWAI_STATE_BUS_OFF) twai_initiate_recovery();
  else if (s.state == TWAI_STATE_STOPPED) twai_start();
}

// Hace una pregunta OBD (modo + PID; pid = -1 si el modo no lleva PID) y arma la
// respuesta completa, aunque venga partida en varias tramas.
// Devuelve cuántos bytes quedaron en "resp" (resp[0] = modo + 0x40) o -1 si nadie respondió.
int preguntarObd(uint8_t modo, int pid, uint8_t* resp, int maxLen) {
  twai_message_t m = {};
  m.identifier = 0x7DF;
  m.data_length_code = 8;
  m.data[0] = pid >= 0 ? 2 : 1;   // cuántos bytes útiles lleva la pregunta
  m.data[1] = modo;
  if (pid >= 0) m.data[2] = pid;

  twai_message_t r;
  while (twai_receive(&r, 0) == ESP_OK) {}   // tirar respuestas viejas
  if (twai_transmit(&m, pdMS_TO_TICKS(50)) != ESP_OK) return -1;

  unsigned long limite = millis() + 250;
  uint32_t ecu = 0;           // la computadora que nos está contestando
  int total = 0, largo = 0;
  while (millis() < limite) {
    if (twai_receive(&r, pdMS_TO_TICKS(20)) != ESP_OK) continue;
    if (ecu && r.identifier != ecu) continue;
    uint8_t tipo = r.data[0] >> 4;

    if (tipo == 0) {          // respuesta completa en una sola trama
      int n = min((int)(r.data[0] & 0x0F), min(7, maxLen));
      if (n < 1 || r.data[1] != modo + 0x40) continue;   // otra ECU o respuesta negativa
      if (pid >= 0 && r.data[2] != pid) continue;
      memcpy(resp, &r.data[1], n);
      return n;
    }
    if (tipo == 1) {          // primera trama de una respuesta larga
      if (r.data[2] != modo + 0x40) continue;
      ecu = r.identifier;
      total = min(((r.data[0] & 0x0F) << 8) | r.data[1], maxLen);
      largo = min(6, total);
      memcpy(resp, &r.data[2], largo);
      twai_message_t control = {};   // "mándame el resto, sin pausas"
      control.identifier = ecu - 8;
      control.data_length_code = 8;
      control.data[0] = 0x30;
      twai_transmit(&control, pdMS_TO_TICKS(50));
      limite = millis() + 500;
    } else if (tipo == 2 && ecu) {   // tramas siguientes, 7 bytes cada una
      int n = min(7, total - largo);
      memcpy(resp + largo, &r.data[1], n);
      largo += n;
      if (largo >= total) return largo;
    }
  }
  return -1;
}

// Lee un PID del modo 01 y devuelve sus bytes de datos (A, B...), o false si no respondió
bool leerPid(uint8_t pid, uint8_t* datos) {
  uint8_t resp[8];
  int n = preguntarObd(0x01, pid, resp, sizeof(resp));
  if (n < 3) return false;
  memcpy(datos, &resp[2], n - 2);
  return true;
}

// Los 2 bytes de un código de falla -> texto tipo "P0217"
String textoDtc(uint8_t a, uint8_t b) {
  const char sistema[] = "PCBU";
  char t[6];
  snprintf(t, sizeof(t), "%c%d%X%X%X", sistema[a >> 6], (a >> 4) & 3, a & 0x0F, b >> 4, b & 0x0F);
  return t;
}

// Agrega al JSON los datos del motor que tenga la computadora.
// Devuelve true si la computadora respondió (o sea, el motor está encendido).
bool agregarObd(String& j) {
  if (!obdListo) return false;
  revisarCan();
  uint8_t d[8];
  if (!leerPid(0x0C, d)) return false;   // si no responde las RPM, está apagado

  j += ",\"rpm\":" + String(((d[0] << 8) | d[1]) / 4);
  if (leerPid(0x05, d)) j += ",\"engineTemp\":" + String(d[0] - 40);
  if (leerPid(0x2F, d)) j += ",\"fuel\":" + String(d[0] * 100 / 255);
  if (leerPid(0x0D, d)) j += ",\"obdSpeed\":" + String(d[0]);

  // Modo 03: códigos de falla guardados. Siempre se manda la lista (aunque esté
  // vacía) para que el servidor borre los que ya se repararon.
  uint8_t resp[64];
  int n = preguntarObd(0x03, -1, resp, sizeof(resp));
  if (n >= 2) {
    j += ",\"dtc\":[";
    bool primero = true;
    for (int i = 2; i + 1 < n; i += 2) {   // resp[1] = cuántos códigos hay
      if (!resp[i] && !resp[i + 1]) continue;
      j += (primero ? "\"" : ",\"") + textoDtc(resp[i], resp[i + 1]) + "\"";
      primero = false;
    }
    j += "]";
  }
  return true;
}

#endif
