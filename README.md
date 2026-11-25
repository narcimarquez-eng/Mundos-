# Mundos 3D · Creador de Escenarios

Editor y visor de **escenarios 3D** para cualquier tipo de juego: un circuito de rally, un mundo RPG, un nivel de plataformas, una isla, un desierto… La app solo genera y muestra **el escenario**: no hay personaje, misiones ni combate. Es un lienzo vacío al que se le pone relieve, suelo, agua, caminos y objetos, y que está preparado para recibir pueblos, zonas de combate, mazmorras y cualquier modelo `.glb`.

Viene de la parte de edición del [Creador de Mundos RPG](https://github.com/narcimarquez-eng/Creador-de-mundos-Rpg) y sigue conectado con él: el Creador de Pueblos, el Creador de Mazmorras y los modelos de enemigos, cabañas y piezas se usan desde aquí.

| Archivo | Qué es |
|---|---|
| `index.html` + `js/editor.js` | **Editor de escenarios**. |
| `visor.html` + `js/visor.js` | **Visor**: recorre el escenario con cámara libre, a pie o siguiendo un camino. |
| `js/escenario-core.js` | Núcleo sin interfaz (terreno, pinceles, caminos, tipos de elemento, plantillas, guardado). Funciona en el navegador y en Node: el juego puede cargarlo para leer el escenario (`alturaEn`, `muestrearCamino`…). |
| `js/escena-3d.js` | Dibujo 3D con three.js, compartido por editor y visor. Un dibujo por tipo de elemento (`registrarDibujo`). |
| `js/vegetacion.js` | Árboles con modelo `.glb`: instancias, niveles de detalle, impostores y viento. |
| `js/pradera.js`, `js/pradera-atlas.js` | Hierba, trigo, flores, hierba alta y bambú alrededor de la cámara (el atlas viene del Creador RPG). |
| `glb/arboles/`, `modelos-fuente/arboles/`, `tools/preparar-arboles.mjs` | Árboles preparados para el visor, sus originales y la herramienta que los prepara. |
| `js/almacen.js` | Guardado en el navegador (IndexedDB): escenarios y modelos importados. |
| `js/catalogo-rpg.js` | Lista de los 342 modelos `.glb` del Creador RPG (enemigos, cabañas, piezas, muelles, puentes, mazmorras). Se regenera con `npm run catalogo` (necesita el otro repositorio al lado). |
| `docs/FORMATO-ESCENARIO.md` | El archivo `.escenario.json` y cómo añadir tipos nuevos. |
| `test/` | Pruebas del núcleo: `npm test`. |

## Cómo usarlo

Abre `index.html` servido por web (GitHub Pages o `npx serve .`); usa módulos y three.js desde jsDelivr, así que no basta con abrirlo como archivo.

1. **✨ Nuevo** → elige una plantilla: Lienzo vacío, Mundo RPG, Circuito de rally, Plataformas, Archipiélago, Cordillera, Desierto o Volcán. Tamaño de 256 m a 8 km y tres niveles de detalle del terreno.
2. **Herramientas** (barra izquierda, teclas `1`–`6`):
   - 👆 **Ver**: gira (arrastrar), desplaza (botón derecho) y acerca (rueda). Toca un elemento para seleccionarlo y moverlo, girarlo o escalarlo con las flechas (`G` `R` `S`). `F` enfoca, `Ctrl+D` duplica, `Supr` borra.
   - ⛰ **Relieve**: subir, bajar, suavizar, aplanar, llevar a una altura fija o hacer rugoso, con radio y fuerza.
   - 🖌 **Pintar**: hierba, tierra, roca, arena, nieve, asfalto, barro, grava, musgo, ceniza, hielo, baldosa o «automático» (según altura, pendiente y bioma).
   - 🛣 **Caminos**: toca para poner puntos y sale una curva suave. Tierra, grava, asfalto (con líneas blancas), empedrado, arena, barro o nieve; ancho; circuito cerrado. «⛏ Ajustar terreno» allana el suelo bajo el camino con taludes suaves (ideal para pistas de rally). Arrastra un punto para moverlo, toca sobre el camino para insertar uno y botón derecho sobre un punto para quitarlo.
   - ➕ **Colocar**: formas básicas (caja, plataforma, rampa, cilindro, esfera, muro), naturaleza (árbol, roca, bosque, pedregal, lago), marcas de juego (inicio, meta, puntos de control, coleccionables, luces, carteles, puntos de vista), modelos GLB y RPG (pueblo, zona de combate, mazmorra, enemigo).
   - 🗑 **Borrar**.
3. **Panel derecho**: *Herramienta* (opciones de la herramienta), *Selección* (propiedades del elemento) y *Escenario* (hora, niebla, bioma, agua, generar terreno, tamaño, enlaces).
4. **Guardado**: automático en el navegador. **📁 Escenarios** para abrir, duplicar o borrar; **💾 Exportar** / **📂 Importar** un `.escenario.json` (con los modelos importados dentro si quieres). `Ctrl+Z` / `Ctrl+Y` deshacen y rehacen.
5. **▶ Visor** abre el escenario.

### Árboles con modelo 3D
Los árboles y bosques usan modelos `.glb` reales: **liquidámbar**, **pinsapo**, **pino piñonero** y **palmera datilera** (`glb/arboles/`). «Mezcla según el bioma» los combina solos (templado: liquidámbar, pinsapo y pino; tropical: palmera…), y siguen existiendo las especies sencillas dibujadas por código.

Todos los árboles de todos los bosques se dibujan por instancias, con tres niveles de detalle:

| Distancia (calidad media) | Qué se dibuja |
|---|---|
| hasta 45 m | el modelo completo, con sombras |
| 45–150 m | la versión media (~30–50 % de los triángulos) |
| 150 m – 3 km | un impostor: una tarjeta con la foto del árbol desde 8 ángulos, hecha al cargar |

Los que quedan fuera de la vista no se dibujan. Las copas se mueven con el viento y se iluminan como un volumen (normales de copa y algo de translucidez). En la calidad baja y alta del visor las distancias cambian (`DISTANCIAS` en `js/vegetacion.js`), y en ⚙ Ajustes se pueden desactivar los árboles con modelo para usar los sencillos.

**Añadir un árbol nuevo:** deja el `.glb` en `modelos-fuente/arboles/` (dos mallas: tronco opaco y copa con transparencia recortada, como los de Blender que ya hay), ejecuta `cd tools && npm install && node preparar-arboles.mjs` y añádelo a `ARBOLES_GLB` en `js/escenario-core.js`. La herramienta pasa las texturas a WebP de 1024 px, comprime la geometría y crea la versión media (12,6 MB de los cuatro originales → 3,8 MB).

### Hierba, trigo y flores
El suelo se cubre de matas de hierba, trigo, flores, hierba alta o bambú, dibujadas con los atlas del Creador RPG (`js/pradera-atlas.js`, texturas pintadas en un lienzo, sin archivos) y movidas por el viento.
- **Automática:** sobre los suelos de hierba, hierba seca y musgo crece hierba sola, con claros, praderas de flores y matorral alto. Su densidad se cambia en *🖌 Pintar → Hierba y flores* («Hierba automática en todo el escenario»; 0 la quita).
- **Pintada:** con el mismo pincel se pinta hierba, trigo, flores, hierba alta o bambú con su densidad, se vuelve a «Automático» o se pone «Sin vegetación». Mientras se pinta, el terreno se tiñe con lo que crece encima.
- No crece en caminos, lagos, agua, pendientes fuertes ni en la plaza de los pueblos.
- Se dibuja solo alrededor de la cámara (calidad media: matas detalladas hasta 28 m y sencillas hasta 75 m), en teselas de 16 m que se calculan una vez. Desde muy arriba no se dibuja. En el visor se puede desactivar en ⚙ Ajustes.

### Modelos GLB
**➕ Colocar → Modelo GLB → Elegir modelo**:
- **Importados**: cualquier `.glb` (del estudio de armaduras, del editor de enemigos, de Blender…). Se guardan en el navegador.
- **Biblioteca RPG**: los modelos del Creador RPG (enemigos, cabañas, piezas del pueblo, muelles, puentes, mazmorras).
- **Dirección web**: cualquier `.glb` publicado.

Se pueden ajustar a una altura en metros. Las animaciones del modelo (si tiene) se reproducen en el visor.

### Pueblos, zonas y mazmorras (conexión con el Creador RPG)
- **🏘 Pueblo**: en el escenario se ve una maqueta (casas, calles, plaza, muralla) hecha con su configuración. **🏗 Abrir en el Creador de Pueblos** lleva el pueblo al Creador de Pueblos; con **💾 Guardar y volver** el diseño vuelve al escenario. La configuración es la misma que usa el Creador de Mundos, así que el juego puede regenerar el pueblo idéntico.
- **⚔ Zona de combate**: área con tipo (caza, élite, jefe, PvP, segura, arena), niveles y una lista de enemigos (modelos de la biblioteca o importados, con cantidad y altura).
- **🕳 Mazmorra**: entrada en el terreno; el interior se diseña en el **Creador de Mazmorras** con el mismo ir y volver.
- **🐉 Enemigo** suelto.

La dirección del Creador RPG se cambia en *Escenario → Enlaces*. Por defecto es `https://narcimarquez-eng.github.io/Creador-de-mundos-Rpg/`. Para que la vuelta desde el Creador de Pueblos o de Mazmorras funcione, las dos apps tienen que estar en el mismo sitio (por ejemplo, ambos repositorios publicados con GitHub Pages del mismo usuario): se comunican por el almacenamiento del navegador.

## Visor
- 🛰 **Órbita**: girar alrededor, acercar y desplazar.
- 🕊 **Vuelo libre**: WASD o flechas, arrastrar para mirar, Q/E para bajar y subir, Shift rápido, la rueda cambia la velocidad.
- 🚶 **Paseo**: a pie a 1,7 m del suelo.
- 🎬 **Recorrido**: la cámara sigue un camino (a ras como un conductor, en persecución o como un dron) a la velocidad que elijas; Espacio pausa.
- ⚙ **Ajustes**: hora del día y ciclo automático, niebla, nombres, contorno de las áreas, calidad, campo de visión y **vistas guardadas** (puntos de vista, inicio, pueblos, zonas, mazmorras).
- 📷 captura de pantalla.

En el móvil hay joystick para moverse y botones para subir y bajar.

## Para el juego
- Todo está en metros. El terreno es un mapa de alturas centrado en el origen; `Escenario.alturaEn(esc, x, z)` da la altura en cualquier punto.
- Los caminos son curvas por puntos de control: `Escenario.muestrearCamino(camino, paso)` da la línea para colocar coches, IA o checkpoints.
- Las marcas de juego (inicio, meta, controles, coleccionables) son elementos con posición y giro: el juego decide qué hacer con ellas.
- Para un tipo nuevo de elemento (un portal, un spawn de vehículos…) basta con `Escenario.registrarTipo()` y, si se quiere ver en 3D, `registrarDibujo()` en `js/escena-3d.js`. Ver `docs/FORMATO-ESCENARIO.md`.
