# Dirección de diseño de go503

> Escrito por Claude el 2026-10-14, a pedido de Mateo ("tú decides la dirección").
> No es una dirección inventada desde cero: describe la identidad que el sitio ya tenía en el código
> (colores, letras, rótulo de ruta, el bus dibujado) para que se mantenga en los cambios que vengan.
> Aviso honesto: una dirección escrita por un agente tiende al gusto por defecto de la IA.
> Si algo de aquí no te representa, cámbialo: este archivo es tuyo.

## Identidad

- **Qué es:** app comunitaria de San Salvador para saber cuándo llega el bus, y un sensor con panel para dueños de flotas.
- **Para quién:** la gente que espera en la parada (con el teléfono, a veces con poca señal) y los dueños de buses y cooperativas.
- **Personalidad:** de aquí, directa y con humor de parada de bus. Habla como la gente ("¿Ya viene la 101?", "motorista", "unidad"), no como una empresa de tecnología.
- **Lo que no es:** un clon de apps de tecnología de afuera, ni un tablero oscuro "tech".

## Paleta (en `public/css/base.css`)

| Color | Valor | Para qué |
|---|---|---|
| Añil | `#1B2559` | La marca. Fondos de sección y botones principales. |
| Noche | `#0E1438` | Fondos oscuros y texto sobre maíz. |
| Maíz | `#F2B22E` | El acento: la unidad, lo próximo, el botón de pedir. Solo en el momento clave. |
| Torogoz | `#0FA39C` | En línea y tramo recorrido. |
| Alerta | `#D9434E` | Fallas y vencidos. Nada más. |
| Papel | `#F5F2EA` | Fondo claro: pared encalada, cálido. `--papel-2` (`#EDE8DB`) para bandas y pestañas. |

Por qué: añil y maíz son colores de El Salvador (el tinte de añil, la milpa); el torogoz es el ave nacional.

## Tipografía (cambió el 2026-10-18)

- **Big Shoulders Display** (solo grosor 800) para títulos, números de ruta y minutos: condensada como los letreros de destino del bus. Títulos grandes en MAYÚSCULAS.
- **Atkinson Hyperlegible Next** para el texto: hecha para leerse con poca vista; sirve con sol en la parada.
- **Atkinson Hyperlegible Mono** para códigos, claves y datos en tablas.
- En CSS: `--display`, `--sans`, `--mono` (`--serif` quedó como nombre viejo de `--display`).

## Rediseño 2026-10-18: "rótulo y parada"

Pedido por Mateo con libertad creativa (reporte en `REPORTE-FRONTEND.md`).

- **Superficies planas con borde**: tarjetas importantes con borde de 2 px (`--line-fuerte`) y sombra dura de color (`8px 8px 0` maíz o torogoz), nunca sombras difusas.
- **Botones-placa**: esquinas de 6 px y un borde de abajo (`--edge`) que desaparece al tocar: el botón se hunde como el timbre de bajada.
- **Letreros de noche**: el tablero, el lado del login, el panel lateral y el motorista usan fondo noche con puntos de luz (radial-gradient de 7 px), como letrero de destino.
- **La franja** (`.franja`): maíz grueso + torogoz fino, como la pintada en los buses. Separa la portada, abre "¿Tienes buses?" y va en la orilla del login y arriba del motorista.
- **Etiqueta** (`.kicker`): mayúsculas pequeñas con un pedacito de franja, encima de los títulos de sección.
- **Mínimo 44 px** para todo lo que se toca.

## Motivo de identidad

- El **rótulo de ruta** (`.fascia`): número en maíz sobre noche con filete amarillo, como el que va pintado en el bus.
- La **línea de paradas**: un recorrido con puntos, el bus avanzando. Se repite en el tablero, en "Así sabemos dónde va tu bus" y en el pie de página.

## Diales

Dial: ENERGY 2 / RHYTHM 2 / MOTION 2

- **ENERGY 2:** la portada saluda con la pregunta y el tablero en vivo; el resto es calmado.
- **RHYTHM 2:** secciones con fondos y composiciones distintas (tablero, recorrido, lista con vista del panel, formulario), sin romper el orden.
- **MOTION 2:** el movimiento cuenta algo que pasa de verdad (el bus avanza, el rótulo "frena", el punto en vivo late cuando llega una señal). Nada se mueve en bucle sin razón.

## Reglas de contenido

- Todo dato sale del código o del firmware (`firmware/README.md`, `src/`). Si es un cálculo, se dice que es un cálculo.
- Lo que es de ejemplo (la vista del panel en la portada) lleva la palabra "Ejemplo" visible.
- Cada texto nuevo en español necesita su traducción en `public/js/idioma.js`.
