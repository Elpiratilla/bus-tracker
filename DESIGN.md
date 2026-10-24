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

## Paleta (en `public/css/base.css` para las pantallas de app y en `estilos/sitio.css` para las páginas públicas)

| Color | Valor | Para qué |
|---|---|---|
| Añil | `#1B2559` | La marca. Fondos de sección y botones principales. |
| Noche | `#0E1438` | Fondos oscuros y texto sobre maíz. |
| Maíz | `#F2B22E` | El acento: la unidad, lo próximo, el botón de pedir. Solo en el momento clave. |
| Torogoz | `#0FA39C` | En línea y tramo recorrido. |
| Alerta | `#D9434E` | Fallas y vencidos. Nada más. |
| Papel | `#F2F0EA` | Fondo claro: pared encalada, cálido sin llegar a crema (se ajustó el 2026-10-24). `--papel-2` (`#E4E1D8`) para bandas y pestañas. |

Por qué: añil y maíz son colores de El Salvador (el tinte de añil, la milpa); el torogoz es el ave nacional.

## Tipografía (cambió el 2026-10-18)

- **Big Shoulders Display** (solo grosor 800) para títulos, números de ruta y minutos: condensada como los letreros de destino del bus. Títulos grandes en MAYÚSCULAS.
- **Atkinson Hyperlegible Next** para el texto: hecha para leerse con poca vista; sirve con sol en la parada.
- **Atkinson Hyperlegible Mono** para códigos, claves y datos en tablas.
- En CSS: `--display`, `--sans`, `--mono` (`--serif` quedó como nombre viejo de `--display`).
- Las letras están en `public/fonts/` y se declaran en `public/css/fonts.css` (licencia SIL OFL). No se piden a Google.

## Rediseño 2026-10-24: "cartel de parada" (páginas públicas)

Pedido por Mateo ("todo, agrégale animaciones, Tailwind"). Se hizo con la skill design-taste-frontend
(dirección "Loud and flat", semilla 1202628298). Aplica a portada, sensor, preguntas y legal.

- **La idea:** el rótulo pintado de los buses de aquí (el número en maíz sobre noche, el letrero de destino, el boleto) se vuelve el cartel de la página: letras de rótulo enormes y campos planos de color que se tocan sin línea entre ellos.
- **Tailwind v4** solo en las páginas públicas: el código está en `estilos/sitio.css` (colores, letras y las piezas como el tablero y el boleto) y en las clases del HTML. Se compila con `npm run css` a `public/css/sitio.css`, que se sube ya compilado (Render y la app no compilan nada). El CI revisa que esté al día.
- **Cinco tamaños de letra:** cartel (el titular), título de sección, frase, texto (18 px) y pequeño (15 px). Nada más.
- **Esquinas rectas, sin sombras, sin degradados, sin líneas finas, sin etiquetas pequeñas encima de los títulos** (la vieja `.kicker` y la franja se quitaron). Lo que separa es el espacio o un cambio de fondo.
- **Un solo par de márgenes** (16 a 32 px) y una rejilla de 12 columnas (`.rejilla`) en todas las secciones.
- **Fotos reales** de buses y calles de El Salvador, de Wikimedia Commons y Flickr, en `public/img/fotos/` con su licencia en `credits.json` y el crédito en el pie de cada página. Ninguna se presenta como un bus o un cliente de go503.
- **Lo que se puede tocar:** el tablero en vivo (escoger ruta y parada), el bus del sensor (cada pieza), la flota como tablero de terminal (ejemplo) y el formulario como boleto.
- **Movimiento:** el titular sube línea por línea al abrir; cada sección llega por partes al bajar (una sola vez); las filas de la flota voltean como letrero de paletas; las cifras del sensor ruedan; el nombre del pie sube. Solo una foto por página se abre como cortina y se mueve con la página, y solo una va girada. Todo respeta "reducir movimiento" y sin JavaScript la página queda completa.
- **Maíz solo en el momento clave:** el número de ruta, los minutos, la acción principal ("Pedir el sensor"), el boleto y la fila abierta de la flota. El pie y las cifras del sensor van en torogoz.
- **Fotos livianas:** cada foto tiene su versión de 800 px (`-800.jpg`) y la grande queda en 1400 px como máximo; las páginas las piden con `srcset`. Ninguna foto se repite en la misma página.
- **Teclado:** todas las páginas tienen "Saltar al contenido". El anillo de foco es `--foco`: torogoz oscuro (#0A6F6A) sobre papel, torogoz sobre noche y añil, noche sobre maíz y torogoz.

## Rediseño 2026-10-18: "rótulo y parada" (sigue en las pantallas de app)

Pedido por Mateo con libertad creativa. Hoy aplica al panel, el login, el mapa y el motorista.

- **Más minimalista (pedido de Mateo, 2026-10-18):** sin sombras duras de color, sin texturas de puntos y bordes de 1 px (`--line-fuerte` es un beige un poco más oscuro que `--line`). Solo lo que flota (menús, diálogos, la barra del mapa) lleva una sombra suave.
- **Botones planos:** esquinas de 6 px; al tocar se hunden 1 px (el timbre de bajada, en pequeño).
- **Letreros de noche** solo donde hay datos en vivo (tablero, motorista) y en la barra del panel.
- **Mínimo 44 px** para todo lo que se toca.
- **Tablas en el teléfono:** se vuelven tarjetas (`cards()` en `panel.js`): cada celda muestra el nombre de su columna.
- **Acciones poco usadas** van en un menú "Más" (`moreMenu()` en `panel.js`); borrar va al final, separado y en rojo.
- **Modo oscuro** en todas las páginas, también en el panel y el login.

## Motivo de identidad

- El **rótulo de ruta** (`.fascia`): número en maíz sobre noche con filete amarillo, como el que va pintado en el bus.
- La **línea de paradas**: un recorrido con puntos, el bus avanzando. Se repite en el tablero de la portada, en el mapa y en el motorista.

## Diales

Dial: ENERGY 2 / RHYTHM 2 / MOTION 2

- **ENERGY 2:** la portada saluda con la pregunta y el tablero en vivo; el resto es calmado.
- **RHYTHM 2:** secciones con fondos y composiciones distintas (tablero, recorrido, lista con vista del panel, formulario), sin romper el orden.
- **MOTION 2:** el movimiento cuenta algo que pasa de verdad (el bus avanza, el rótulo "frena", el punto en vivo late cuando llega una señal). Nada se mueve en bucle sin razón.

## Reglas de contenido

- Todo dato sale del código o del firmware (`firmware/README.md`, `src/`). Si es un cálculo, se dice que es un cálculo.
- Lo que es de ejemplo (la vista del panel en la portada) lleva la palabra "Ejemplo" visible.
- Cada texto nuevo en español necesita su traducción en `public/js/idioma.js`.
