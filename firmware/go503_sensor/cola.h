#pragma once
// =====================================================================
//  Cola para cuando no hay señal (zonas sin cobertura, túneles).
//  Los mensajes se guardan en la flash (LittleFS), uno por línea, con su "ts".
//  Así no se pierden aunque se apague el bus o se reinicie el ESP32.
//
//  /cola.txt  los mensajes pendientes (se van agregando al final)
//  /cola.pos  hasta qué byte de cola.txt ya se mandó
//  Cuando se manda todo, se borran los dos archivos.
// =====================================================================

#define COLA_ARCHIVO "/cola.txt"
#define COLA_POSICION "/cola.pos"

size_t colaEnviado = 0;   // bytes de cola.txt que ya llegaron al servidor

void guardarPosicionCola() {
  File f = LittleFS.open(COLA_POSICION, FILE_WRITE);
  if (f) { f.print(colaEnviado); f.close(); }
}

void iniciarCola() {
  // true = si la partición no tiene formato, la formatea (solo pasa la primera vez)
  if (!LittleFS.begin(true)) Serial.println(F("[COLA] No se pudo montar LittleFS"));
  File f = LittleFS.open(COLA_POSICION, FILE_READ);
  if (f) { colaEnviado = f.readString().toInt(); f.close(); }
}

size_t tamanoCola() {
  File f = LittleFS.open(COLA_ARCHIVO, FILE_READ);
  size_t n = f ? f.size() : 0;
  if (f) f.close();
  return n;
}

bool colaPendiente() { return tamanoCola() > colaEnviado; }

void vaciarCola() {
  LittleFS.remove(COLA_ARCHIVO);
  LittleFS.remove(COLA_POSICION);
  colaEnviado = 0;
}

// Si la cola se llenó, se queda solo con la mitad más nueva (lo más viejo sirve menos)
void recortarCola(size_t tamano) {
  File viejo = LittleFS.open(COLA_ARCHIVO, FILE_READ);
  if (!viejo) return;
  viejo.seek(max(colaEnviado, tamano / 2));
  if (viejo.position() > colaEnviado) viejo.readStringUntil('\n');   // saltar la línea partida
  File nuevo = LittleFS.open("/cola.tmp", FILE_WRITE);
  uint8_t buf[256];
  while (viejo.available()) nuevo.write(buf, viejo.read(buf, sizeof(buf)));
  viejo.close();
  nuevo.close();
  vaciarCola();
  LittleFS.rename("/cola.tmp", COLA_ARCHIVO);
  Serial.println(F("[COLA] Llena: se descartaron los mensajes más viejos"));
}

void agregarACola(const String& json) {
  size_t tamano = tamanoCola();
  if (tamano > COLA_MAX_BYTES) recortarCola(tamano);
  File f = LittleFS.open(COLA_ARCHIVO, FILE_APPEND);
  if (!f) return;
  f.println(json);
  f.close();
  Serial.printf("[COLA] Guardado sin señal (%u bytes pendientes)\n", tamanoCola() - colaEnviado);
}

// Manda hasta "maximo" mensajes de la cola, del más viejo al más nuevo.
// Se detiene en el primer error de red para no perder el orden.
void enviarCola(int maximo) {
  File f = LittleFS.open(COLA_ARCHIVO, FILE_READ);
  if (!f) return;
  f.seek(colaEnviado);
  int enviados = 0;
  while (f.available() && enviados < maximo) {
    String linea = f.readStringUntil('\n');
    linea.trim();
    if (linea.length() && enviarJson(linea) == ENVIO_ERROR) break;   // reintentar después
    colaEnviado = f.position();   // OK o rechazado (400): ya no se vuelve a mandar
    enviados++;
  }
  bool terminado = colaEnviado >= f.size();   // ojo: no usar f.available(), el último pudo fallar
  f.close();

  if (terminado) {
    vaciarCola();
    Serial.println(F("[COLA] Todo enviado"));
  } else if (enviados) {
    guardarPosicionCola();
  }
}
