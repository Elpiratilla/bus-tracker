# go503

Mapa en vivo de los buses de San Salvador (cuándo llega el bus a tu parada) y panel para dueños de flotas con un sensor ESP32 (GPS + 4G + datos del motor).

```bash
npm install
npm run dev        # servidor en http://localhost:3000
npm test
```

- `src/`: servidor Express. Guarda todo en Supabase.
- `public/html/`: las páginas. Se abren en la raíz (`/mapa.html`, `/legal.html`…).
- `public/css`, `public/js`, `public/img`, `public/fonts`: lo que usan las páginas.
- `app/`: la app Android del motorista (Capacitor). `firmware/`: el código del sensor.
- `supabase/migrations/`: el esquema de la base de datos.

## Legal

Los textos que ve el público están en [`public/html/legal.html`](public/html/legal.html) y se enlazan desde el pie de página como «Legal y privacidad». Reúne en una sola página:

1. Quiénes somos (aviso legal)
2. Términos de uso
3. Privacidad
4. Cookies y lo que se guarda en el navegador
5. Propiedad intelectual
6. Venta del sensor
7. Reportar un problema
8. Reclamos y contacto

El README no sustituye esa página: los usuarios no lo ven, y la ley pide que esta información esté a la vista en el sitio.

### Falta completar antes de publicar

Todo lo que falta aparece en `legal.html` marcado en amarillo (`<mark class="falta">`). Para encontrarlo:

```bash
grep -n 'class="falta"' public/html/legal.html
```

- [ ] Nombre legal o razón social del responsable, NIT, NRC (si aplica) y representante legal (si es una sociedad)
- [ ] Dirección para notificaciones, correo y WhatsApp de contacto
- [ ] Titular de los derechos sobre el nombre, el logo y el código
- [ ] Plazo para borrar solicitudes de venta sin compra (propuesta: 24 meses), y borrarlas de verdad en la tabla `leads`
- [ ] Plazo para responder reclamos (propuesta: 10 días hábiles)
- [ ] Revisar si hay que inscribirse como proveedor ante la Defensoría del Consumidor
- [ ] Que un abogado salvadoreño revise los textos antes de vender el primer sensor

### Cómo se cumple en el código

| Qué | Dónde |
| --- | --- |
| Enlace en el pie de todas las páginas públicas | `index.html`, `sensor.html`, `preguntas.html`, `legal.html` |
| Aviso de privacidad en el formulario de pedido | `index.html` (`.order__legal`) |
| Casilla obligatoria y sin marcar al crear una cuenta de empresa | `login.html` (`#c-acepto`) y `public/js/acceso.js` |
| Constancia de la aceptación (versión y fecha) | `acceso.js` la guarda en los datos del usuario de Supabase (`terminos_version`, `terminos_aceptados`) |
| Aviso de ubicación en la app del motorista | `motorista.html` |
| Plazos de borrado que promete la página | `src/db.js` (historial 7 días, vueltas 30 días) y `src/alerts.js` (avisos 3 horas) |

### Cuando algo cambie

La página tiene que decir lo que la app hace de verdad. Si agregas un formulario, un proveedor nuevo (por ejemplo analítica), cambias un plazo de borrado o empiezas a cobrar en línea:

1. Actualiza la sección que corresponde en `legal.html`.
2. Cambia la versión y la fecha en `legal.html` y `TERMINOS_VERSION` en `public/js/acceso.js`.
3. Si el cambio es importante, avisa a las empresas por correo con 15 días de anticipación, como prometen los términos (2.9).
4. Si agregas analítica o cookies que no son necesarias, primero hace falta un aviso que pida permiso.

Leyes que se citan: Ley para la Protección de Datos Personales (Decreto Legislativo n.º 144, 2024) y Ley de Protección al Consumidor (artículos 13-D, 21-A y 21-B sobre comercio electrónico).
