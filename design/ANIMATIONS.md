# ANIMATIONS — Hilo Luna

> **Aviso.** Los mockups son imágenes estáticas: **no muestran ninguna animación**. Este documento **no inventa una dirección de movimiento**; fija (a) las animaciones que los mockups *implican* (estados y transiciones funcionales) y (b) unos límites estrictos para todo lo demás. Cualquier animación decorativa adicional requiere aprobación (regla 5 / 19).
>
> Procedencia: **[IMPL]** implícita en un mockup (estado o interacción visible) · **[INF]** convención de UI razonable derivada de tokens · **[?]** decisión abierta.

## 1. Principios

1. **Suave, cálido, discreto.** El carácter es editorial y romántico: movimiento lento y con easing suave, nunca rebotes, sacudidas ni efectos "SaaS".
2. **Funcional primero.** Animar para explicar cambio de estado (guardado, selección, apertura), no para decorar.
3. **Respeto absoluto de `prefers-reduced-motion`.** Con "reducir movimiento": sin desplazamientos ni escalas; solo cambios de opacidad instantáneos o ≤ 120 ms.
4. **Rendimiento en móvil de gama media.** Solo `opacity` y `transform`. Nada de animar `width/height/top/left`, sombras grandes ni `filter: blur` sobre imágenes grandes.
5. **CSS primero.** Transiciones y `@keyframes` con Tailwind/CSS; `IntersectionObserver` para revelado. **No se instala librería de animación** (Motion, GSAP…) sin registro de decisión (`ARCHITECTURE.md` D-13). Si el editor exige animación de reordenamiento compleja, evaluar entonces.
6. **Las animaciones de invitación pertenecen a la plantilla** (`--inv-*`, tokens de movimiento por tema); las del producto a `--lu-*`. No se comparten.
7. **Nada bloquea contenido**: la invitación es legible sin JS y sin animaciones.

## 2. Tokens de movimiento

```css
/* Producto */
--lu-ease-standard: cubic-bezier(0.22, 0.61, 0.36, 1);   /* [INF] salida suave */
--lu-ease-emphasized: cubic-bezier(0.16, 1, 0.3, 1);     /* [INF] entradas */
--lu-dur-instant: 90ms;
--lu-dur-fast: 150ms;      /* hover, foco, toggles */
--lu-dur-base: 240ms;      /* selección, paneles */
--lu-dur-slow: 420ms;      /* entradas de página, sheets */

/* Invitación (por defecto; la plantilla puede redefinir) */
--inv-ease: cubic-bezier(0.22, 0.61, 0.36, 1);
--inv-dur-reveal: 700ms;
--inv-dur-open: 900ms;
--inv-reveal-distance: 16px;
--inv-stagger: 90ms;
```

Los valores son **[INF]**: se calibrarán mirando el resultado, no contra el mockup.

## 3. Producto — marketing

| Elemento | Animación | Proc. | Especificación |
|---|---|---|---|
| Botón primario/secundario | Hover: leve elevación/oscurecimiento; flecha `→` se desplaza 2–3 px; `active`: pequeña compresión | [INF] | `--lu-dur-fast`; solo color/`transform` |
| `IconButton` (flecha circular) | Hover: relleno tenue + flecha 2 px | [INF] | `--lu-dur-fast` |
| `TemplateCard` / `CategoryCard` | Hover: elevación sutil (sombra `--lu-shadow-card` → algo mayor) + zoom de imagen ≤ 1.03 con recorte por radio | [INF] | `--lu-dur-base`; imagen con `transform: scale` |
| `Chip` filtro | Cambio de activo: fondo/color cruzado; **el grid no salta** (transición de opacidad de las tarjetas al filtrar) | [IMPL] estado activo visible en [02] | ≤ `--lu-dur-base` |
| Navbar | Enlace activo con subrayado tostado [02]; al hacer scroll: fondo pasa de transparente a `--lu-surface` | [IMPL]/[INF] | `--lu-dur-base` |
| Revelado al hacer scroll | Fade-up de secciones (opacity + `translateY(12px)`) | Aprobado para la Homepage | **Implementado** como `lu-reveal` (CSS `animation-timeline: view()`, sin JS; sin soporte no anima y no oculta nada) y `lu-enter` (carga del hero, `--lu-dur-slow` + `--lu-ease-emphasized`). Desactivados con `prefers-reduced-motion` |
| Cuenta regresiva del hero [01] (chip) | Actualización de cifra sin animación (o fundido corto) | [INF] | — |

## 4. Producto — editor

| Elemento | Animación | Proc. |
|---|---|---|
| `SectionRow` seleccionada | Cambio de fondo `--lu-selected` + aparición del borde izquierdo | [IMPL] (fila activa en [04]) — `--lu-dur-fast` |
| Ojo de visibilidad | Cambio de ícono (`Eye`↔`EyeOff`) y atenuado de la fila oculta (opacity .5) | [INF] |
| Reordenar (drag) | El elemento arrastrado se eleva (sombra) y los demás se desplazan con `transform`; soltar = asentado suave | [IMPL] (asas de arrastre en [04]) — `--lu-dur-base` |
| `SaveStatus` | "Guardando…" → check aparece con fundido; texto "hace unos segundos" sin animación | [IMPL] (check verde en [04]) |
| `Switch` | Desplazamiento del pulgar 150 ms | [IMPL] |
| `OptionCardGroup` | Borde `--lu-brown-600` aparece con transición de color | [IMPL] (selección en [04]) |
| Dropzone | Arrastrar encima: borde y fondo se intensifican | [INF] |
| Subida de imagen | Barra/indicador mínimo; miniatura aparece con fundido | [INF] **sin mockup** |
| `PreviewPane` | Al cambiar contenido, el iframe actualiza **sin parpadeo** (no recarga; `postMessage`). Cambio Móvil/Escritorio: ancho del marco con transición de `transform`/tamaño ≤ `--lu-dur-slow` | [IMPL] "Vista en tiempo real" |
| Paginador `‹ 1/10 ›` | Desplazamiento suave del iframe a la sección (`scroll-behavior: smooth`) | [IMPL]/[?] Q-20 |
| Sheets / diálogos | Fundido + leve subida | [INF] **sin mockup** |

## 5. Producto — dashboard

| Elemento | Animación | Proc. |
|---|---|---|
| `StatCard` / `ShortcutCard` | Hover como `TemplateCard` | [INF] |
| Cifras de métricas | Conteo animado al entrar en vista **NO** por defecto (efecto "SaaS"); aparecen estáticas | Decisión: **no** |
| `DonutChart` | Dibujo del arco al montar, 500 ms, una vez; sin animación con `reduced-motion` | [INF]/[?] |
| `ActivityList` | Nueva actividad entra deslizándose desde arriba (si llega en vivo) | [INF] |
| `UserMenu`, `Select` | Apertura con fundido + `scale(.98)→1` | [INF] |

## 6. Invitación pública — lenguaje propio

> Todo lo siguiente es **[INF]**: parte de la necesidad funcional (botón "Abrir invitación", cuenta regresiva, música, secciones que aparecen al desplazarse). El **estilo** del movimiento debe validarse con el equipo de diseño antes de pulirlo (Q-12/Q-13). Cada plantilla puede sustituir estos comportamientos por los suyos mediante `theme.motion`.

| Momento | Comportamiento | Detalles |
|---|---|---|
| **Portada al cargar** | Arco y nombres aparecen con fundido + subida leve; decoración floral entra con desfase | `--inv-dur-reveal`; texto **visible sin JS** (la animación mejora, no oculta) |
| **"Abrir invitación"** | Gesto del usuario: (1) inicia la música si está configurada, (2) desplaza suavemente a la siguiente sección | Es el **gesto de usuario** exigido por autoplay móvil; la música solo arranca aquí (política de música). Transición ≤ `--inv-dur-open` |
| Indicador de scroll `⌄` | Flotación ligera de 4–6 px, en bucle lento | [IMPL] hay chevron en portada [04]/[06]; en bucle **solo mientras la portada está en pantalla** |
| **Revelado de secciones** | Fade-up una sola vez al 20–30 % de visibilidad; desfase `--inv-stagger` entre elementos hijos (título → texto → botón) | `IntersectionObserver`; sin animar imágenes grandes con `blur` |
| **Cuenta regresiva** | Tic cada segundo: cambio de cifra con fundido corto (sin volteo 3D). Sin animación con `reduced-motion` (solo actualización) | Isla cliente; referencia inicial = hora del servidor |
| **Decoración floral** | Parallax mínimo (≤ 8 px) o balanceo casi imperceptible | **Opcional**, off en `reduced-motion` y en dispositivos de baja potencia; no es requisito |
| **Galería** | Apertura de lightbox: fundido + escala .98→1; cierre inverso | Lightbox **sin mockup** |
| **Itinerario** | Línea se "dibuja" y los íconos aparecen en secuencia al entrar | [INF]; una sola vez |
| **Botones** | Hover (escritorio): oscurecimiento leve; `active`: compresión 0.98 | Móvil: solo `:active` |
| **Música** | Solo `library`/`upload`: control flotante con entrada suave tras "Abrir"; ícono play/pausa; barras tipo ecualizador animadas mientras suena (opcional). `external`: enlace simple, sin animación especial. Sin sonido antes de la interacción | Sin mockup en invitación |
| **RSVP enviado** | El formulario cede paso a un mensaje de éxito con fundido | Formulario **sin mockup** |

## 7. Reglas técnicas

- Un único `useReveal` (hook) o utilidad CSS + `IntersectionObserver` compartido; no un observer por elemento.
- Todas las animaciones definen su estado final por CSS; el estado "oculto" inicial se aplica con una clase que **solo** se añade cuando JS está activo (para no ocultar contenido si falla).
- `will-change` solo en elementos que animan de inmediato y se retira después.
- Sin animaciones que provoquen CLS: reservar espacio (aspect-ratio) para imágenes.
- Pruebas: con `prefers-reduced-motion: reduce`, la invitación debe ser plenamente usable y verse igual sin desplazamientos.
- Presupuesto: ninguna animación debe exceder 60 fps estables en un móvil de gama media; si lo hace, se elimina, no se optimiza.

## 8. Preguntas abiertas

1. ¿Existe una referencia de movimiento (video/Lottie/descripción) de quien produjo los mockups? Si no, se aprueba este documento como mínimo viable.
2. ¿La cuenta regresiva debe tener un tratamiento propio (volteo, deslizamiento) o cifras estáticas con fundido?
3. ¿Parallax/balanceo de flores: sí o no? (recomendado: no en la primera versión).
4. ¿Los conteos animados en el dashboard son deseables? (recomendado: no).
