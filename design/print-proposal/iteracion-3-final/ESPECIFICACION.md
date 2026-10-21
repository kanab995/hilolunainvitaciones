# Base de impresión «Romántica elegante» — especificación para el generador

**Estado:** **aprobado oficialmente por el propietario** (2026-10-17) como diseño base del generador de invitaciones
imprimibles. Implementado en `lib/print/` y `server/print/` (D-47, `docs/ARCHITECTURE.md`). Pendiente solo la prueba física de
color en imprenta (dorado y marfil). Stripe y la venta (Etapa 3) siguen sin empezar.

Los ejemplos usan **datos de demostración** (Andrea & Fernando, `/i/demo-magnolia`); los conjuntos «largo» y «mínimo» de las
pruebas son inventados: no son clientes ni eventos reales.

**PDF definitivo para la imprenta** (hecho por el generador real, `npm run print:sample`): `design/print-proposal/etapa-2-generador/`
— `5x7.pdf` (sangrado), `5x7-marcas.pdf` (con marcas de corte), `a5.pdf`, `a5-marcas.pdf` y `prueba-impresa-carta.pdf` (QR y
legibilidad a tamaño real). Las presentaciones con sobre y los PDF del prototipo de las iteraciones de diseño se quedaron fuera del
repositorio (material de revisión).

## 1. Formato
| | |
|---|---|
| Tarjeta | 5×7" horizontal (177,8 × 127 mm), frente y reverso |
| Sangrado | 3 mm por lado (BleedBox); fondo marfil impreso hasta el sangrado |
| Zona segura | 5 mm; todo el texto queda dentro (el generador avisa si algo la invade) |
| Monograma para sobre | página aparte de 3×3", fondo transparente, para impresión sobre un sobre A7 |
| PDF | vectorial (0 imágenes), fuentes incrustadas como subconjunto, TrimBox y BleedBox, versión opcional con marcas de corte |
| Color | RGB. La imprenta convierte a CMYK: **pedir una prueba de color antes de vender** |

## 2. Tokens
| Token | Valor | Uso |
|---|---|---|
| `paper` | `#FBF8F1` | fondo |
| `ink` | `#3B352F` | fecha, sedes, rótulos de columna |
| `muted` | `#5F564C` | invitación, hora, ciudad, direcciones |
| `gold` | `#8E7244` | nombres, monogramas, rama, título del reverso, frase de cierre (contraste 4,4:1; antes `#9E8352`, 3,4:1) |
| `line` | `#A68C5E` | filetes del marco y separadores (antes `#B5A07A`, demasiado claro para una línea fina) |
| `qr` | `#24201C` | módulos del QR (contraste 15:1 sobre el papel) |

El dorado es un **color de tinta**, no dorado metálico ni foil.

## 3. Tipografía (todas OFL; registrar en `docs/ASSET_LICENSES.md` antes de incorporarlas al repo)
| Papel | Fuente | Cuerpo | Notas |
|---|---|---|---|
| Nombres | Pinyon Script | hasta 52 pt (ajuste a 330 pt de ancho) | «&» en Cormorant Garamond Light Italic al 62 % |
| «Junto a sus familias» | Pinyon Script | 17 pt | `muted` |
| Invitación | Cormorant Garamond Italic | 12 pt | |
| Fecha | Cormorant Garamond Medium, versalitas | 10,5 pt | espaciado 0,14 em, cifras de caja alta |
| Hora (frente) | Cormorant Garamond Medium, versalitas | 8,5 pt | con letra: «A LAS CINCO DE LA TARDE» |
| Sede (frente) | Cormorant Garamond Italic | 15,5 pt | |
| Ciudad | Cormorant Garamond Medium, versalitas | 8 pt | mínimo absoluto del arte |
| Cierre | Pinyon Script | 16 pt | con refuerzo de trazo 0,16 pt |
| Título reverso | Pinyon Script | 30 pt | con refuerzo de trazo 0,12 pt |
| Rótulos de columna | Cormorant Garamond Medium, versalitas | 8,2 pt | espaciado 0,16 em |
| Hora (columna) | Cormorant Garamond Regular | 10,5 pt | «a las siete de la noche» |
| Sede (columna) | Cormorant Garamond Italic | 13,5 pt (12 pt si no cabe en 2 líneas) | |
| Direcciones | Cormorant Garamond Regular | 9,2 pt | |

**Refuerzo de trazo fino:** la caligrafía pequeña y el monograma del frente llevan un contorno del mismo color (modo de
texto relleno + trazo). Sin él, el 34 % de los trazos de la frase de cierre medía menos de 0,08 mm y podía romperse al imprimirse
en un color tramado; con él, 0,4 %.

## 4. Reglas de composición (las aplica el generador, no una persona)
- **Hora con letra** (`socialTime`): en punto, «y cuarto» y «y media» van con letra; «a la una»; mediodía = «del día»;
  13–18 h = «de la tarde»; 19–23 h = «de la noche»; otros minutos usan la cifra («a las 17:20 horas»).
- **Nombres:** una línea si caben a ≥ 38 pt; si no, dos líneas («Nombre» / «& Nombre») a ≤ 40 pt.
- **Pila del frente:** centrada en la composición aprobada. Si crece (nombres en dos líneas, sede en dos líneas), se apoya
  en el límite inferior y, si aún no cabe, se comprimen los **espacios**, nunca los cuerpos de letra.
- **Reverso:** 1, 2 o 3 columnas según los bloques presentes (ceremonia siempre; recepción y vestimenta opcionales). Las sedes
  se reparten en líneas parejas; los textos se alinean por arriba. Sin QR, el bloque se centra en la tarjeta. Si el reverso
  solo tendría la ceremonia y no hay QR, conviene ofrecer imprimir solo el frente.
- **QR (opcional):** corrección **M**, lado mínimo **1" (25,4 mm)**, módulo ≥ 0,75 mm (crece si la URL es larga), tinta `qr`,
  zona libre ≥ 4 módulos (hoy 7,3). Siempre acompañado del enlace escrito. M se eligió frente a Q con la simulación de
  impresión y cámara: con el mismo encuadre, menos módulos se leen mejor que más corrección. **Avisar al cliente de que el QR
  deja de funcionar cuando expire la invitación** (en la compra y en la vista previa; no se imprime en la tarjeta).
- **Monograma:** iniciales de los dos nombres; primera en Cormorant Garamond Regular, segunda en Italic, dentro de la luna
  creciente con la estrella de la marca.

## 5. Datos que necesita el generador
Nombres (2), iniciales (derivadas), fecha y zona horaria, ceremonia (nombre, dirección en 1–2 líneas, ciudad, hora), recepción
opcional (nombre, dirección, hora), código de vestimenta opcional (estilo, descripción, paleta de hasta 4 colores) y URL pública
(`getPublicInvitationUrl`). Todo sale del **snapshot publicado** del evento, nunca del borrador.

## 6. Verificación hecha (iteración 3 y `tests/print/`)
- Cajas, sangrado, fuentes, 0 imágenes; línea independiente más fina 0,4 pt; texto más pequeño 8 pt.
- Grosor real de los trazos dorados medido a 864 ppp.
- QR: 144 capturas simuladas (impresión a 600 ppp con ganancia de punto y papel; cámara con distancia, inclinación, giro,
  luz desigual, desenfoque, ruido y JPEG), leídas con jsQR y ZXing; 0 lecturas erróneas.
- Robustez con datos largos y mínimos.

**No sustituye a una prueba física:** `etapa-2-generador/prueba-impresa-carta.pdf` es la hoja para imprimir y escanear con
teléfonos reales.

## 7. Pendiente antes de construir el generador
1. Aprobación del arte final por el propietario.
2. Prueba física: hoja carta (QR y legibilidad) y, en una imprenta, prueba de color del dorado y del marfil.
3. Registrar Pinyon Script y Cormorant Garamond (archivos estáticos) en `docs/ASSET_LICENSES.md` y la decisión del generador
   en `docs/ARCHITECTURE.md` (D-47) antes de añadir `pdf-lib` y `@pdf-lib/fontkit` (ya aprobadas) y los TTF al repositorio.

El prototipo ya se portó a `lib/print/` y `server/print/` (TypeScript, con pruebas en `tests/print/`); su código suelto ya no se
conserva aquí.
