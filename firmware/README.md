# Firmware del sensor go503 (ESP32 + 4G + GPS)

Este es el programa que va dentro de la cajita instalada en cada bus. Lee el GPS del
módulo 4G y lo manda a la API de go503 (`POST /api/telemetry`). Si el bus tiene los
sensores, también manda los datos del motor para mantenimiento.

| Qué manda | Cada cuánto |
|---|---|
| Posición, velocidad y rumbo, con el bus en marcha | 5 s |
| Posición, con el bus detenido (semáforo, parada) | 30 s |
| Datos del motor | 60 s (si coincide con una posición, van en el mismo mensaje) |
| Todo, con el bus estacionado más de 5 min o apagado | 10 min |

Otras cosas que hace:

- **Sin fix de GPS no manda posición**, porque el servidor rechaza `0,0`. Los datos del motor sí se mandan.
- Una velocidad menor a 3 km/h se manda como `0`, y con el bus parado no se manda `heading`.
- **Cola sin señal**: en un túnel o en una zona sin cobertura, los mensajes se guardan en la
  flash del ESP32 (LittleFS) con su hora del GPS (`ts`). Al volver la señal se mandan en orden.
  Como están en la flash, no se pierden aunque se apague el bus. Caben unos 300 KB, como 3 horas de
  recorrido. Si se llena, se descarta la mitad más vieja.
- **Reconexión automática**: revisa la red cada 15 a 60 s. Si pasa 10 minutos sin red, reinicia el módulo 4G.
- **Watchdog**: si el programa se cuelga más de 120 s, el ESP32 se reinicia solo.
- **Odómetro por GPS**: suma los km recorridos y los guarda en la flash cada 1 km.

## Archivos

```
firmware/
├── README.md              ← este archivo
└── go503_sensor/          ← la carpeta del sketch (Arduino exige que se llame igual que el .ino)
    ├── go503_sensor.ino   ← programa principal: cada cuánto se mide y se manda
    ├── config_ejemplo.h   ← plantilla de configuración (cópiala como config.h)
    ├── red.h              ← módulo 4G, reconexión y envío HTTP(S)
    ├── gps.h              ← lectura del GPS con AT+CGPSINFO
    ├── cola.h             ← cola en la flash para cuando no hay señal
    ├── obd.h              ← OBD-II por CAN (buses modernos)
    └── sensores.h         ← encendido, combustible, DS18B20 y MPU6050 (buses viejos)
```

---

## 1. Lista de materiales (precios aproximados en USD, 2026)

Los precios son de tiendas en línea tipo AliExpress o Amazon. En tiendas locales pueden variar.

**Básico (todo bus): unos $60 a $90**

| Pieza | Precio | Nota |
|---|---|---|
| ESP32 DevKit V1 (38 pines) | $6–10 | |
| Módulo 4G con GPS **SIM7600** (SA o G) | $35–55 | El más probado. |
| …o módulo **A7670SA** con GNSS | $18–28 | Más barato. **Ojo:** algunas variantes no traen GPS (por ejemplo, la A7670G). Revisa que el anuncio diga GNSS/GPS. |
| Antena LTE + antena GPS activa (con cable) | $5–8 | La de GPS va hacia el cielo: en el tablero o bajo el techo de fibra. |
| Convertidor DC-DC automotriz 8–40 V → 5 V, 3 A | $5–10 | Tiene que aguantar 24 V. El módulo 4G consume picos de 2 A. |
| Portafusible + fusible de 2 A, diodo TVS SMBJ36A | $2–3 | Protegen contra los picos de voltaje del alternador. |
| Capacitor 1000 µF / 16 V (en la entrada de 5 V del módulo) | $0.50 | Aguanta los picos de consumo al transmitir. |
| Chip de datos (Claro, Tigo o Digicel) | según el plan | Ver el cálculo de datos más abajo. |
| Caja plástica IP65 + prensaestopas | $5 | |

> **Atajo:** hay placas que traen el ESP32 y el módulo juntos, como **LilyGO T-SIM7600** o
> **LilyGO T-A7670** ($45–60). Te ahorran el cableado entre ESP32 y módulo. Solo tienes que poner
> en `config.h` los pines que usa tu placa (vienen en su diagrama de pines).

**Opcional, bus moderno con OBD-II: unos $8**

| Pieza | Precio |
|---|---|
| Transceptor CAN **SN65HVD230** (3.3 V) | $3 |
| Cable con conector OBD-II macho | $4–6 |

**Opcional, bus viejo sin computadora: unos $10**

| Pieza | Precio |
|---|---|
| Resistencias 100 kΩ y 10 kΩ (dos divisores), zener de 3.3 V y capacitor de 100 nF | $1 |
| Sensor DS18B20 a prueba de agua + resistencia de 4.7 kΩ + abrazadera | $3 |
| Acelerómetro MPU6050 (GY-521) | $3 |

---

## 2. Cableado

### Alimentación (todos)

```
 Batería del bus (+12/24 V permanente)
        │
     [Fusible 2 A]
        │
        ├──[TVS SMBJ36A]── GND        (absorbe los picos del alternador)
        │
   ┌────┴─────────────┐
   │ DC-DC 8–40V→5V   │
   └────┬─────────────┘
        │ 5 V
        ├──────────── VIN del ESP32
        └──┬───────── 5V / VIN del módulo 4G
          [1000µF]
           │
 GND ──────┴─── GND del ESP32 ─── GND del módulo 4G   (¡todas las tierras juntas!)
```

Conéctalo al **+ permanente** de la batería y no al del switch. Así el sensor sigue reportando
con el bus apagado: sirve para saber dónde quedó estacionado, o si se lo llevan. Consume como
0.1 A (unos 2.4 Ah por día), poco para una batería de bus.

### ESP32 ↔ módulo 4G

```
 ESP32 DevKit             Módulo SIM7600 / A7670
 ────────────             ──────────────────────
 GPIO17 (TX2)  ────────►  RXD
 GPIO16 (RX2)  ◄────────  TXD
 GPIO4         ────────►  PWRKEY  (en placas sueltas, a través de un transistor NPN; ver nota)
 GND           ─────────  GND
```

**Nota sobre PWRKEY:** el módulo se enciende con un pulso en ese pin. El firmware manda un pulso
**alto** de 1 s, que es lo correcto para las placas que usan un transistor (como las LilyGO). Si
tu módulo enciende solo al darle corriente, pon `MODEM_PWRKEY_PIN -1`.

### OBD-II por CAN (buses modernos)

```
 ESP32           SN65HVD230                Conector OBD-II (macho)
 ─────           ──────────                ───────────────────────
 3V3   ───────►  3V3
 GND   ────────  GND  ────────────────────  pin 4 y 5 (tierra)
 GPIO25 ──────►  CTX (D)
 GPIO26 ◄──────  CRX (R)
                 CANH ────────────────────  pin 6
                 CANL ────────────────────  pin 14
                                            pin 16 (+12/24 V) → puede alimentar el DC-DC
```

> ⚠️ **Antes de conectarlo a un bus de verdad:**
> - Confirma con un escáner ELM327 barato que el bus usa **CAN 11 bits a 500 kbps** (ISO 15765-4),
>   que es lo más común. Si usa 250 kbps, cambia `CAN_KBPS`. **Una velocidad equivocada mete errores
>   en la red del vehículo**, así que no lo dejes conectado si ves `[OBD] No se pudo iniciar` o si nunca responde.
> - Muchos módulos SN65HVD230 traen una resistencia de 120 Ω soldada (marcada R2). El vehículo
>   ya trae las suyas, así que lo mejor es quitarla.
> - Los vehículos de antes de ~2008 pueden usar K-Line en vez de CAN. Esos no están soportados.

**Buses diésel pesados (J1939):** usan el mismo transceptor, pero otro protocolo (CAN de 29
bits a 250 kbps, con mensajes que se escuchan en vez de preguntarse). Queda planeado con
`USAR_J1939` en `config.h`, pero todavía no está implementado.

### Buses viejos sin computadora

```
 Switch de encendido (IGN, 12/24 V)
        │
     [100 kΩ]
        │
        ├──────────────► GPIO34   (ADC)
        │        │   │
     [10 kΩ]  [zener  [100nF]
        │      3.3V]   │
 GND ───┴────────┴─────┘

 Cable del flotador del tanque ── mismo divisor ──► GPIO35

 DS18B20:   rojo → 3V3   negro → GND   amarillo → GPIO27  (+ 4.7 kΩ entre amarillo y 3V3)
 MPU6050:   VCC → 3V3    GND → GND     SDA → GPIO21       SCL → GPIO22
```

- **Divisor de voltaje:** 100 kΩ + 10 kΩ divide entre 11. Con 24 V llegan unos 2.2 V al ESP32,
  que aguanta hasta 3.3 V. El zener lo protege de los picos.
- **Combustible:** se mide el voltaje que ya tiene el cable del flotador, sin desconectar el
  medidor del tablero. Mide con el tanque casi vacío y luego lleno, y anota esos voltajes en
  `COMBUSTIBLE_V_VACIO` y `COMBUSTIBLE_V_LLENO`. Para ver los voltajes, activa el sensor y mira el
  monitor serie.
- **DS18B20:** va pegado con la abrazadera a la manguera de **salida** del radiador (la de arriba).
  Mide la temperatura de la manguera, no la del refrigerante, así que marca unos 5 a 10 °C menos.
  Sirve para ver tendencias y detectar sobrecalentamiento.
- **MPU6050:** atorníllalo plano a la carrocería, con el eje X (está dibujado en la placa) hacia
  el frente del bus. Si queda al revés, pon `MPU_SIGNO -1`. Cuenta los frenazos de más de 0.35 g y los manda como `hardBrakes`.

---

## 3. Configuración

1. En la carpeta `go503_sensor/`, copia `config_ejemplo.h` y nómbralo **`config.h`**.
2. Llena tus datos en `config.h`:
   - `BUS_ID`: un nombre único por bus, por ejemplo `"BUS-07"`.
   - `ROUTE_ID`: tiene que existir en el servidor. Revisa la lista en `GET /api/routes`.
   - `API_BASE` y `BUS_API_KEY`: la dirección del servidor y la misma clave del `.env` del servidor.
   - `MODEM_SIM7600` o `MODEM_A7670`: deja sin comentar solo el que tengas.
   - `APN`: prueba primero con `""`. Si no conecta, búscalo en un celular con un chip del mismo
     operador, en **Ajustes → Redes móviles → Nombres de punto de acceso**, o pregúntale al operador.
     Para datos en flotas conviene pedir un plan "IoT/M2M" a Claro, Tigo o Digicel.
   - Sensores: descomenta los `#define USAR_...` de los sensores que tenga **ese** bus.
     El mismo firmware sirve para buses modernos y viejos.

`config.h` está en el `.gitignore` para que la clave no se suba a git.

---

## 4. Instalar y flashear (Arduino IDE 2)

1. Instala [Arduino IDE 2](https://www.arduino.cc/en/software).
2. Ve a **Arduino IDE → Settings** (en Windows, **File → Preferences**). En *Additional boards manager URLs* pega:
   ```
   https://espressif.github.io/arduino-esp32/package_esp32_index.json
   ```
3. En **Boards Manager**, busca e instala **esp32 by Espressif Systems**.
4. En **Library Manager**, instala:
   - **TinyGSM** (de Volodymyr Shymanskyy), versión **0.12.0** o mayor
   - **ArduinoHttpClient** (de Arduino)
   - **GovoroxSSLClient** (hace el HTTPS)
   - Solo si usas el DS18B20: **OneWire** y **DallasTemperature**
5. Abre `firmware/go503_sensor/go503_sensor.ino`. Todas las pestañas se abren solas.
6. En **Tools**, elige:
   - Board: **ESP32 Dev Module** (o tu placa LilyGO)
   - Partition Scheme: **Default 4MB with spiffs**. LittleFS usa esa partición para la cola.
   - Port: el puerto USB del ESP32. En Mac, si no aparece, instala el driver CP210x o CH340, según el chip USB de tu placa.
7. Dale a **Upload** (la flecha →). Si se queda en `Connecting....____`, mantén presionado el
   botón **BOOT** del ESP32 hasta que empiece a subir.
8. Abre el **Serial Monitor** a **115200** baudios. Deberías ver algo así:

```
=== go503 sensor BUS-07 / ruta 101 ===
[API] https://abc-123.trycloudflare.com:443/api/telemetry
[4G] Iniciando módulo...
[GPS] Encendido (el primer fix puede tardar 1-2 min a cielo abierto)
[4G] Conectando datos (APN "")...
[4G] En línea. IP 10.45.3.2, señal 21/31
[GPS] Sin fix: no se manda posición
[MSG] {"busId":"BUS-07","routeId":"101","lat":13.701200,"lng":-89.224500,"speed":32.4,"heading":274,"ts":"2026-10-12T08:16:00Z","odometerKm":184520.3}
[API] 201 {"ok":true,"position":{"atStop":null,"nearestStop":"s3","distanceM":180,"entered":false}}
```

La respuesta `position` del servidor te dice la parada más cercana y a cuántos metros está. Cuando
`entered` sale `true`, el servidor registró que el bus llegó a una parada.

**Si algo falla:** descomenta `#define TINY_GSM_DEBUG Serial` en el `.ino` para ver todos los
comandos AT que se cruzan con el módulo.

---

## 5. Probar con tu servidor local (túnel)

El ESP32 está en la red celular y **no puede llegar a `http://localhost:3000`**, que solo existe
dentro de tu computadora. Para probar, abre un **túnel**: es un programa que le da a tu
servidor local una dirección pública temporal en internet.

**Opción A, cloudflared (gratis, sin cuenta):**
```bash
brew install cloudflared
```
```bash
cloudflared tunnel --url http://localhost:3000
```
Te imprime una dirección tipo `https://palabras-raras.trycloudflare.com`. Ponla en `API_BASE`.

**Opción B, ngrok (pide una cuenta gratis):**
```bash
ngrok http 3000
```
Copia la dirección `https://....ngrok-free.app` en `API_BASE`.

Ten en cuenta:
- Con el túnel gratis, la dirección **cambia cada vez** que lo abres. Tienes que actualizar `config.h` y volver a flashear.
- Pon una `BUS_API_KEY` en el `.env` del servidor. Mientras el túnel esté abierto, cualquiera con
  la dirección puede mandar datos.
- Si todavía no tienes el hardware, prueba el servidor con `npm run simulate`, que manda lo mismo que este firmware.

### En producción: HTTPS con certificado verificado

En producción, el servidor tiene que estar en **HTTPS** con tu propio dominio. Si no, la clave de la API viaja
en texto plano por la red del operador. Además hay que **verificar el certificado** con
`API_CA_CERT` en `config.h`. Sin eso, la conexión va cifrada pero alguien podría hacerse pasar por tu servidor.

- Si tu dominio usa **Let's Encrypt** (lo más común), usa su certificado raíz **ISRG Root X1**,
  que vale hasta 2035. Lo descargas de https://letsencrypt.org/certs/isrgrootx1.pem.
- Para ver qué certificado raíz usa cualquier dominio:
  ```bash
  openssl s_client -showcerts -connect tu-dominio.com:443 </dev/null
  ```
  El último bloque `-----BEGIN CERTIFICATE-----` es el de más arriba en la cadena.
- Pega el PEM en `config.h`, cada línea entre comillas y terminada en `\n"`, como muestra el ejemplo.

---

## 6. ¿Cuántos datos gasta? (léelo antes de comprar planes)

Cálculo para un bus que trabaja 14 h al día, 70 % del tiempo en marcha:

| | Mensajes al mes | KB por mensaje | Total al mes |
|---|---|---|---|
| Con este firmware y la API actual | ~230,000 | ~0.8–1 | **~180–230 MB** |

Cada mensaje gasta casi 1 KB, aunque el JSON solo mide ~150 bytes, porque los encabezados HTTP
de ida y vuelta y los paquetes TCP pesan más que el dato. El firmware ya hace lo posible por
ahorrar: mantiene abierta la conexión HTTPS (el saludo TLS, ~5 KB, se hace una sola vez), junta
el motor y la posición en un solo mensaje y manda menos cuando el bus está parado.

**Con la API actual, la meta de 30–50 MB al mes no se alcanza.** Mandar una posición cada 5 s por
HTTP cuesta eso. Hay tres caminos, y todos requieren cambiar el backend:

1. **Que el servidor mantenga viva la conexión** (cambio de una línea, poco riesgo). Node cierra las conexiones
   inactivas a los **5 s**, justo el intervalo del sensor. Entonces a veces habría que repetir el saludo HTTPS
   (~5 KB) en cada mensaje, y el consumo podría **duplicarse**. Se arregla con
   `server.keepAliveTimeout = 65000` en `src/server.js`. Detrás de un túnel o de un proxy (Cloudflare,
   nginx), quien manda es el tiempo de espera del proxy.
2. **Mandar en lotes** con un endpoint nuevo `POST /api/telemetry/batch` que reciba un arreglo.
   El sensor junta 6 posiciones (cada una con su `ts` de 5 s) y las manda cada 30 s. La detección
   de paradas sigue funcionando igual porque usa el `ts` de cada punto. Se llega a **~60–80 MB/mes**.
   La desventaja es que el mapa se actualiza cada 30 s en vez de cada 5.
3. **MQTT** en vez de HTTP: una conexión siempre abierta con mensajes de ~200 bytes en total. Se
   llega a **~40–50 MB/mes** sin perder los 5 s, pero hay que montar un broker (por ejemplo, Mosquitto) en el servidor.

Este firmware no cambia el backend. Están propuestos en la sección siguiente.

---

## 7. Cambios propuestos al backend (NO aplicados)

- **`src/server.js`:** `keepAliveTimeout` de 65 s para no repetir el saludo HTTPS (ver arriba).
- **`public/app.js`:** el ícono del bus gira según la dirección entre puntos (`bearing`). Si
  el bus manda `heading`, conviene usarlo directamente, porque es más preciso en curvas y en esquinas.
- **`src/eta.js`:** cuando la última posición tiene más de 1 min (`LIVE_MS`), el avance se
  estima por tiempo. Con `speed` real se puede saber si el bus está detenido (`speed: 0`, en un
  tráfico o una parada larga) y no adelantarlo en el mapa.
- **Endpoint por lotes o MQTT**, para bajar el consumo de datos (sección 6).
- **J1939** para buses diésel pesados: pendiente en el firmware.

---

## Limitaciones conocidas

- El firmware **no se ha compilado ni probado en hardware todavía**. Los nombres de funciones de
  las librerías se revisaron contra su código en GitHub (TinyGSM 0.12.0, GovoroxSSLClient 1.3.2),
  pero la primera compilación puede pedir algún ajuste menor.
- El GPS se lee con `AT+CGPSINFO`. En el SIM7600 es un comando estándar. En el A7670 depende de
  la variante y de su versión de firmware: si no da fix, prueba el comando a mano con
  `TINY_GSM_DEBUG` activado.
- Mientras el sensor manda un mensaje con mala señal (hasta 15 s de espera), no lee el GPS. Si
  eso pasa seguido, se puede perder alguna posición de 5 s.
