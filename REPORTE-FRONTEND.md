# Reporte del front end de go503

> Revisión del 2026-10-18, hecha por Claude con el skill ui-ux-pro-max.
> Se revisaron las 7 páginas en computadora (1280 px) y teléfono (390 px), con capturas,
> lectura del código y mediciones automáticas (tamaño de letra, contraste, tamaño de botones).
> El panel se revisó entrando con la cuenta de prueba (admin@go503.test).

## Nota general: **7.1 / 10**

El sitio ya tenía una identidad propia (añil y maíz, el rótulo de la ruta, la línea de paradas,
el bus dibujado) y detalles muy cuidados: modo oscuro, inglés, movimiento reducido, estados vacíos
que dicen qué hacer. Lo que le baja la nota no es el gusto, son **fallas de uso**: en el teléfono
desaparece el menú, varios botones miden menos de 44 px (el mínimo para un dedo), el panel tiene
choques de diseño y cada página arma su propio estilo en vez de compartir uno.

| Página | Nota | En una línea |
|---|---|---|
| Portada (`index.html`) | 7.5 | El tablero en vivo es lo mejor del sitio; en el teléfono no hay menú. |
| Mapa (`mapa.html`) | 7.0 | Funciona bien, pero "Sin estimado" grita más que el nombre de la parada. |
| Entrar (`login.html`) | 8.0 | Limpio y claro; botones y enlaces chiquitos. |
| Panel de empresas (`panel.html`) | 6.5 | Útil, pero con choques visuales y la barra lateral se corta. |
| App del motorista (`motorista.html`) | 6.0 | Funciona, pero se ve sin terminar: sin logo ni marca. |
| El sensor (`sensor.html`) | 8.0 | La mejor página interna: el bus dibujado explica todo. |
| Preguntas (`preguntas.html`) | 7.0 | Ordenada; media pantalla vacía en computadora. |
| Sistema (CSS compartido) | 6.5 | Colores buenos, pero repetidos en 4 archivos y el modo oscuro escrito 3 veces. |

## Por categoría (reglas del skill, de la más importante a la menos)

| # | Categoría | Nota | Qué se encontró |
|---|---|---|---|
| 1 | Accesibilidad | 7 | Buen foco visible, `aria-live`, `aria-pressed`, textos alternativos. Fallan: números de "Así sabemos…" con contraste 3.1:1 (pide 4.5), filtros del mapa "Autobús/Microbús" 3.6:1, etiquetas de minutos del mapa a 11 px. |
| 2 | Toque e interacción | 5.5 | **38 botones bajo 44 px** en el teléfono: sentidos del tablero (29 px de alto), rutas 101/42/29 (29 px), filtros del mapa (29 px), "Ver" de la contraseña (24 px), enlaces del login (18 px), piezas del sensor (33 px). |
| 3 | Rendimiento | 8 | Sin librerías pesadas, imágenes SVG, fuentes con `display=swap`. Leaflet solo donde hay mapa. |
| 4 | Estilo | 7 | Identidad clara. Pero mezcla tarjetas con sombra grande, píldoras redondas y bordes finos sin una regla; se siente "app de startup" más que "de aquí". |
| 5 | Diseño y adaptación | 6 | **En el teléfono el menú desaparece** (`.top__links a { display:none }` bajo 640 px): no hay forma de llegar al mapa, al sensor o a preguntas salvo por el pie. En el panel el fondo de la barra lateral se corta en páginas largas (Reportes). El pie parte "Mapa en / vivo" en dos renglones. |
| 6 | Letra y color | 7.5 | Buena pareja (Young Serif + Figtree), base de 16 px, colores con nombre. Pero Young Serif en números grandes ("Sin estimado", 79.1) se lee lento, y los colores se repiten a mano en cada archivo. |
| 7 | Movimiento | 8.5 | Muy bien pensado: el bus avanza, el rótulo frena, nada se mueve en bucle sin razón, respeta "reducir movimiento". |
| 8 | Formularios | 7 | Etiquetas visibles, errores junto al campo, trampa para bots. El pedido pide 7 campos de golpe (solo 2 son obligatorios). |
| 9 | Navegación | 6 | Falta menú en teléfono (portada, sensor, preguntas). El menú del panel en teléfono es una tira que se sale de la pantalla sin aviso. |
| 10 | Datos y gráficas | 6.5 | El mapa de calor de Reportes muestra 24 columnas casi vacías y una raya suelta a la derecha; los números van sin unidad. |

## Detalle por página

### Portada — 7.5
- ✅ El titular "¿Ya viene la 101?" con el rótulo es memorable y es la pregunta real del usuario.
- ✅ El tablero en vivo responde la pregunta en la misma pantalla.
- ❌ Teléfono: sin menú (solo "English", el interruptor de tema y "Entrar al panel", que se parte en dos renglones).
- ❌ Botones del tablero de 29 px de alto.
- ❌ "¿Tienes buses?" es un muro de 6 puntos con el mismo peso; el ejemplo del panel queda chico al lado.
- ❌ Números 1-2-3 de "Así sabemos…" con contraste bajo.

### Mapa — 7.0
- ✅ Lista de paradas clara, campanita por parada, buscador que sí filtra.
- ❌ Cuando no hay bus, "Sin estimado" sale en letra gigante: el estado vacío pesa más que la información.
- ❌ Filtros y rutas de 29-33 px; minutos sobre el mapa a 11 px.

### Entrar — 8.0
- ✅ Pestañas Entrar/Crear cuenta, contraseña con "Ver", enlace al motorista.
- ❌ "Ver" (24 px), "Volver al inicio" (25 px) y los enlaces de abajo (18 px) son difíciles de tocar.
- ❌ En computadora, la mitad izquierda es casi toda vacía.

### Panel de empresas — 6.5
- ✅ Cada vista responde a una tarea; estados vacíos útiles; alertas en la campanita.
- ❌ "Registrar unidad" choca con la campanita (se montan).
- ❌ El fondo oscuro de la barra lateral no llega hasta abajo en páginas largas (Reportes): se ve cortada a los 800 px en capturas e impresiones.
- ❌ El ícono de Mantenimiento parece un rombo, no una llave.
- ❌ En Unidades, "Eliminar" tiene el mismo estilo que "Editar": una acción que borra no se distingue.
- ❌ En Mantenimiento, "Sin datos recientes" ocupa 3 renglones.
- ❌ En teléfono, el menú es una tira horizontal que corta "Mantenimie…".

### App del motorista — 6.0
- ✅ Botón grande, campos claros.
- ❌ Sin logo, sin marca; en computadora queda una columna flotando arriba.

### El sensor — 8.0
- ✅ El bus dibujado con puntos para tocar es la mejor explicación del producto.
- ❌ Botones de piezas de 33 px; el cierre "¿Lo quieres…?" queda suelto.

### Preguntas — 7.0
- ✅ Acordeón accesible con animación.
- ❌ En computadora la columna izquierda es un título y mucho blanco.

## Rediseño hecho el mismo día

Dirección nueva: **"rótulo y parada"** (detalle en `DESIGN.md`). Se mantuvieron los colores de la
marca y todo lo que el código usa (ids, clases, textos traducidos); cambió cómo se ve y se arreglaron
las fallas de arriba.

| Qué | Antes | Después |
|---|---|---|
| Letra de títulos | Young Serif (serif redonda) | **Big Shoulders Display** 800: condensada, como los letreros de destino del bus |
| Letra de texto | Figtree | **Atkinson Hyperlegible Next**: hecha para leerse bien con poca vista (o con sol en la parada) |
| Datos y claves | sistema | **Atkinson Hyperlegible Mono** (códigos, claves, horas en el mapa de calor) |
| Fondo | gris azulado de oficina `#F3F5FB` | papel cálido de pared encalada `#F5F2EA` |
| Tarjetas | sombras grandes difusas | borde de 2 px y sombra dura de color (maíz o torogoz), como placa pintada |
| Botones | píldoras | placas con borde de abajo que se hunden al tocar (el timbre de bajada) |
| Motivo nuevo | — | la **franja maíz + torogoz** de los buses pintados: cierra la portada, abre "¿Tienes buses?", borde del login y del motorista |
| Tablero en vivo | tarjeta añil | letrero de destino: fondo noche con puntos de luz, número maíz con brillo |

Fallas arregladas:
- **Menú en el teléfono** (portada, sensor, preguntas): botón "Menú" que abre una hoja con todos los enlaces, idioma y tema; se cierra con Escape o al tocar un enlace.
- **Botones de 44 px**: tablero (sentidos y rutas), mapa (barra, filtros, rutas, campanas, favorita, zoom), login (pestañas, "Ver", enlaces), panel (acciones, cerrar, idioma), sensor (piezas y puntos del bus).
- **Contraste**: números de "Así sabemos…" con verde oscuro; error del formulario con rojo oscuro (`--alerta-texto`); textos suaves más oscuros (6.3:1).
- **Mapa**: "Sin estimado" ya no sale gigante (es un estado, no una cifra); en la lista de paradas se ve más suave para que resalten las que sí tienen hora. Minutos sobre el mapa a 12.5 px.
- **Panel**: ícono de llave de verdad en Mantenimiento; "Eliminar" en rojo (no igual a "Editar"); fondo de la barra lateral hasta abajo; en el teléfono el menú va en su propia fila con desvanecido que avisa que hay más; título con espacio para la campana.
- **Preguntas**: la columna izquierda es un letrero que acompaña al bajar (ya no media pantalla vacía).
- **Pie**: banda oscura; los enlaces ya no se parten en dos renglones.

### Notas después del rediseño

| Página | Antes | Después |
|---|---|---|
| Portada | 7.5 | 8.8 |
| Mapa | 7.0 | 8.3 |
| Entrar | 8.0 | 8.7 |
| Panel | 6.5 | 8.0 |
| Motorista | 6.0 | 7.8 |
| El sensor | 8.0 | 8.8 |
| Preguntas | 7.0 | 8.4 |
| **General** | **7.1** | **8.4** |

Medido otra vez en el teléfono: 0 textos bajo 12 px (salvo los créditos del mapa, que exige Leaflet),
0 problemas de contraste en textos propios, y los únicos toques bajo 44 px que quedan son enlaces dentro
de un párrafo (permitido) y el campo trampa para bots, que está fuera de la pantalla.

Lo que no se tocó y queda pendiente:
- El panel no tiene modo oscuro (nunca lo tuvo).
- El formulario de pedido sigue pidiendo 7 campos de golpe (solo 2 obligatorios); se podría partir en dos pasos.
- El mapa de calor de Reportes sigue mostrando todas las horas aunque estén vacías.
- La app Android usa una copia de la página del motorista: correr `npm run web` dentro de `app/` para pasarle el diseño nuevo.
