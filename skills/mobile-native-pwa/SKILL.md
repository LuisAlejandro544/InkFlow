---
name: mobile-native-pwa
description: Directrices maestras de diseño y experiencia de usuario móvil nativa para Progressive Web Apps (PWAs). Erradica los defectos visuales de navegador de escritorio, impone ergonomía de pulgar, respeto estricto de safe-areas (notches e indicadores de barra inferior), micro-interacciones táctiles instantáneas y objetivos táctiles mínimos de 44-48px.
triggers: ["PWA", "mobile UX", "native feel", "touch target", "viewport", "safe-area", "gestures", "bottom sheet", "thumb zone"]
---

# 📱 Skill: Mobile-Native PWA Design & UX Guidelines

Esta skill convierte a la IA en un **Diseñador e Ingeniero de Producto Móvil Senior** especializado en aplicaciones web progresivas (PWAs) que se sienten 100% indistinguibles de una aplicación nativa de Android (Jetpack Compose / Material 3) o iOS.

---

## 🎯 Objetivo de la Skill
Erradicar cualquier rastro o indicio visual de que la aplicación corre dentro de un navegador móvil (evitar barras de scroll innecesarias, zooms accidentales al tocar inputs, retrasos táctiles de 300ms, botones inalcanzables en las esquinas superiores o elementos tapados por la barra de gestos del sistema operativo).

---

## 📐 1. Erradicación de Defectos de Navegador Web

### A. Viewport dinámico (Adios al bug de 100vh)
- **Regla:** NUNCA utilizar `height: 100vh` en contenedores de pantalla móvil. `100vh` no descuenta la barra de navegación del navegador al expandirse o colapsar, provocando saltos bruscos.
- **Solución Obligatoria:** Usar unidades dinámicas modernas:
  ```css
  height: 100dvh; /* Dynamic Viewport Height */
  min-height: 100dvh;
  ```

### B. Eliminación de Flashes y Selecciones Táctiles Accidentales
- **Regla:** Ningún botón o elemento interactivo debe mostrar el recuadro gris/azul predeterminado de WebKit, ni permitir que un usuario seleccione texto mientras dibuja o toca botones:
  ```css
  * {
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
  }
  button, .interactive, canvas {
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
  }
  ```

### C. Prevención de Zoom en Campos de Texto (iOS / Chrome Mobile)
- **Regla:** Si un `<input>`, `<select>` o `<textarea>` tiene `font-size` menor a `16px`, iOS Safari y navegadores basados en WebKit hacen zoom automático destructivo a la pantalla al recibir foco.
- **Solución Obligatoria:** Tamaño mínimo de fuente `16px` (o clase Tailwind `text-base` / `text-sm sm:text-base` asegurando `text-[16px]` en móviles).

### D. Bloqueo de Rebote de Scroll (Rubber-Banding)
- **Regla:** Evitar que arrastrar la pantalla hacia abajo desplace toda la página en blanco:
  ```css
  body, html {
    overscroll-behavior-y: none;
    overflow: hidden;
  }
  ```

---

## 🛡️ 2. Respeto Estricto de Safe Areas (Muescas y Barra de Gestos)

Los teléfonos modernos tienen esquinas redondeadas, muescas superiores (*notch* / *Dynamic Island*) y la barra de navegación gestual inferior de Android / iOS.

- **Padding Superior (Header / TopBar):**
  ```css
  padding-top: max(12px, env(safe-area-inset-top));
  ```
- **Padding Inferior (BottomBar / Modales):**
  ```css
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  ```
- **Etiquetas Meta en HTML:**
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  ```

---

## 👆 3. Ergonomía Táctil y Zona del Pulgar (Thumb Zone)

### A. Dimensión Mínima de Toque (Touch Targets)
- **Regla Inquebrantable:** Todo control interactivo (botones, iconos, selectores, items de lista) debe tener una superficie táctil mínima de **44×44px** (iOS HIG) a **48×48px** (Material 3).
- Aunque el icono visual mida 20px, su contenedor o `padding` debe asegurar al menos 44-48px de área de click.

### B. Distribución Espacial en Pantalla
1. **Zona de Toque Fácil (Tercio Inferior):**
   - Herramientas frecuentes, botón de deshacer/rehacer, cambio de capa, selector de color y botón principal de acción deben ubicarse en la parte inferior o flotante accesible con el pulgar.
2. **Zona Difícil / Destructiva (Tercio Superior):**
   - Ajustes generales, exportación final, borrar todo el lienzo o cerrar proyecto deben ubicarse arriba para evitar toques accidentales mientras se dibuja.
3. **Modales Nativos: Preferir Bottom Sheets:**
   - En lugar de modales pequeños flotando en el centro de la pantalla como en una PC, en móvil se deben utilizar **Hojas Inferiores Deslizables (*Bottom Sheets*)** ancladas al fondo de la pantalla.

---

## ⚡ 4. Micro-Interacciones y Respuesta Háptica Visual

Una web parece "lenta" o "acartonada" cuando los botones no reaccionan al instante:
- **Respuesta Inmediata al Tacto (`active`):**
  ```html
  <button class="transition-transform duration-100 active:scale-95 active:brightness-90 active:opacity-90">
  ```
- **Respuesta Háptica por Software:**
  Para acciones críticas o confirmaciones de guardado/estampado, disparar vibración corta nativa:
  ```typescript
  if ('vibrate' in navigator) {
    navigator.vibrate(12); // Pulso sutil de 12ms
  }
  ```

---

## 📦 5. Checklist de Verificación de UI Móvil Nativa

Antes de dar por completado cualquier componente móvil:
- [ ] ¿El botón o target tiene al menos 44×44px de área táctil?
- [ ] ¿Está protegido con `env(safe-area-inset-bottom)` para que no lo tape la barra de gestos de Android?
- [ ] ¿Tiene micro-interacción al presionarlo (`active:scale-95`)?
- [ ] ¿Las fuentes y textos caben sin truncarse en pantallas estrechas (360px a 390px)?
- [ ] ¿El scroll interno de listas tiene `-webkit-overflow-scrolling: touch` y scrollbar oculta?
