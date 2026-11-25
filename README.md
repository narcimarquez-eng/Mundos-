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
| `glb/edificios/`, `modelos-fuente/edificios/`, `tools/preparar-edificios.mjs` | Edificios propios (la iglesia de Moguer): el original y la versión ligera (mallas unidas por material, texturas WebP). Salen los primeros en «Modelo .glb» del editor, ya con su altura real. |
| `glb/arboles/`, `modelos-fuente/arboles/`, `tools/preparar-arboles.mjs` | Árboles preparados para el visor, sus originales y la herramienta que los prepara. |
| `js/almacen.js` | Guardado en el navegador (IndexedDB): escenarios y modelos importados. |
| `js/catalogo-rpg.js` | Lista de los 342 modelos `.glb` del Creador RPG (enemigos, cabañas, piezas, muelles, puentes, mazmorras). Se regenera con `npm run catalogo` (necesita el otro repositorio al lado). |
| `docs/FORMATO-ESCENARIO.md` | El archivo `.escenario.json` y cómo añadir tipos nuevos. |
| `test/` | Pruebas del núcleo: `npm test`. |

## Cómo usarlo

Abre `index.html` servido por web (GitHub Pages o `npx serve .`); usa módulos y three.js desde jsDelivr, así que no basta con abrirlo como archivo.

El escenario de ejemplo (el circuito de rally) **atraviesa un pueblo andaluz**: la pista entra por una salida, rodea la fuente de la plaza y sale por la opuesta (dentro del pueblo se corre sobre sus calles empedradas y no hay barreras). En el centro, junto a la plaza y con la fachada mirando a ella, está la **Iglesia de Nuestra Señora de la Granada de Moguer** a escala real (torre de 48 m), para mirar el pueblo con perspectiva. Además trae **dos riachuelos** (uno desemboca en el lago grande), **tres lagos** de distinto tamaño, **puentes** sobre la pista (el muelle de Riotinto y el romano) y un vado, hierba, bosques y barreras.

1. **✨ Nuevo** → elige una plantilla: Lienzo vacío, Mundo RPG, Circuito de rally, Plataformas, Archipiélago, Cordillera, Desierto o Volcán. Tamaño de 256 m a 8 km y tres niveles de detalle del terreno.
2. **Herramientas** (barra izquierda, teclas `1`–`6`):
   - 👆 **Ver**: gira (arrastrar), desplaza (botón derecho) y acerca (rueda). Toca un elemento para seleccionarlo y moverlo, girarlo o escalarlo con las flechas (`G` `R` `S`). `F` enfoca, `Ctrl+D` duplica, `Supr` borra.
   - ⛰ **Relieve**: subir, bajar, suavizar, aplanar, llevar a una altura fija o hacer rugoso, con radio y fuerza.
   - 🖌 **Pintar**: hierba, tierra, roca, arena, nieve, asfalto, barro, grava, musgo, ceniza, hielo, baldosa o «automático» (según altura, pendiente y bioma).
   - 🛣 **Caminos**: toca para poner puntos y sale una curva suave. Tierra, grava, asfalto (con líneas blancas), empedrado, arena, barro o nieve; ancho; circuito cerrado. «⛏ Ajustar terreno» allana el suelo bajo el camino con taludes suaves (ideal para pistas de rally). Arrastra un punto para moverlo, toca sobre el camino para insertar uno y botón derecho sobre un punto para quitarlo.
     Cada camino tiene además **superficie por tramos** (p. ej. un tramo de asfalto o un charco de barro dentro de una pista de grava; el color cambia con una transición suave y las líneas blancas salen solas en el asfalto) y **vallas y barreras**: cinta de balizar, valla de madera, guardarraíl, muro de neumáticos, muro de hormigón, balas de paja, conos y vallas publicitarias, en un lado o en los dos, a la distancia del borde que quieras. Se añaden en todo el camino o con «📍 Marcar en el camino»: un toque donde empieza y otro donde acaba (si el primer toque cae fuera del camino, a un lado, solo se pone en ese lado). Siguen el desnivel del terreno y se dibujan por instancias.
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

### Texturas reales
- **Terreno:** cada material del suelo es una textura de ambientCG (CC0, `assets/terreno/atlas.jpg`): hierba, hierba seca, tierra, roca, arena, nieve, asfalto, barro, grava, musgo, ceniza, hielo y adoquín. Se mezclan suavemente donde cambia el material y se repiten cada 4 m, muestreadas a dos escalas para que no se note la repetición (`js/suelos.js`).
- **Caminos:** fotos de la biblioteca del Creador de Pueblos (`assets/texturas/suelo`): la grava es «tierra con grava», la tierra «tierra con piedras», el empedrado y el adoquín sus fotos; asfalto, arena, barro y nieve del atlas. Los bordes se funden con el terreno y los tramos de superficie se mezclan en 3 m.
- **Vallas y objetos:** las vallas de madera, el muro, las balas de paja, el seto y el muro de piedra usan esas fotos. Las formas básicas (caja, plataforma, rampa, cilindro, muro) tienen un campo **Textura** con el selector de la biblioteca (tejados, madera, suelo, piedra, agua…); el color tiñe la foto y la textura se repite cada 1,5 m sin estirarse.
- Mientras cargan las texturas se ven los colores planos de antes.
- Licencias: `docs/ASSETS-CREADOR-RPG.md` (copiado del Creador RPG).

### Riachuelos
En 🛣 Caminos, tipo **Riachuelo (agua)**: el agua corre del primer punto al último y nunca sube. «⛏ Excavar cauce» hunde el terreno a lo largo del río; donde atraviesa una loma corta más hondo pero con laderas anchas, como un valle. Donde cruza un camino queda un **vado** con el agua por encima. El agua (también la del mar y los lagos, `js/agua.js`) refleja el cielo según la hora, cambia de color con la hondura (clara y transparente en la orilla, oscura en el centro), tiene espuma en el filo de la orilla y dos capas de ondas que se mueven río abajo con brillos del sol. No crece hierba ni árboles en el cauce. Para el juego, `Escenario.caminoEn` devuelve `riachuelo` y `Escenario.nivelesRio` la altura del agua.

### Lagos y puentes
- **Lagos** (➕ Colocar → Naturaleza → Lago): al colocarlo se excava un vaso de **orilla irregular** (cambia «Semilla de la forma» y pulsa «⛏ Excavar lecho» para otra), con playa de arena y fondo de barro. El agua queda un poco por debajo de la orilla más baja y, donde el terreno baja por fuera, se levanta un reborde para que no se salga (salvo donde entra un riachuelo). Hay de cualquier tamaño, de charca a lago grande.
- **Puentes** (➕ Colocar → Puentes, o «🌉 Puentes en los cruces» en el panel de un camino o riachuelo): los tres puentes del Creador de Pueblos (**romano de dos arcos**, **medieval con torreón**, **de madera con arcos**) y los del puerto de Huelva: el **muelle de Riotinto (Odiel)** y el **muelle recto de hierro**. Al colocarlo sobre un camino se centra en él, se gira a lo largo y se estira al ancho de la calzada y al largo necesario para salvar el cauce; la base queda a la altura de las orillas. El camino **sube en rampa hasta su tablero** y no se dibuja debajo del puente. «↔ Alinear con el camino» lo vuelve a ajustar. Los cruces sin puente quedan como vado.

### Pueblos completos en el escenario
Los pueblos se ven **completos** (casas, calles, plaza, murallas, farolas, árboles…, con el mismo generador que el Creador de Pueblos) cuando la cámara está a menos de 900 m; más lejos, la maqueta. El pueblo sigue el terreno del escenario (`terrainBase` del generador). Se puede desactivar en *Escenario → Vista* (editor) y en ⚙ Ajustes (visor). El río interno del pueblo (`hasRiver`) no se dibuja dentro del escenario: para agua, usa un riachuelo.

**Calzadas y salidas:** cada salida del pueblo es una calle recta desde la plaza hasta el borde de su terreno. En el panel del pueblo:
- «🔗 Crear salidas» pone una salida donde llega cada camino y lleva el camino hasta ella (quita los puntos que quedaban dentro).
- «↪ Llevar caminos a las salidas» mantiene las salidas y lleva cada camino a la más cercana.
- En el Creador de Pueblos, abierto desde el escenario, el campo **Salidas hacia el mundo** se puede cambiar (0° este, 90° sur, 180° oeste, 270° norte): al «Guardar y volver», los caminos se llevan solos a las nuevas salidas. Dentro del pueblo, las calles se dibujan a mano con la paleta de edición del creador.

### Pueblo andaluz
El Creador de Pueblos tiene el estilo **Pueblo Andaluz** y el tipo de casas **«Pueblo andaluz: casas encaladas»** con cuatro modelos (`modelos-fuente/casas/`, preparados con `node tools/preparar-casas.mjs`): casa de una planta en dos versiones, casa rústica con buganvilla y casa de dos plantas con balcones. Cerca de la plaza hay más casas de dos plantas y hacia las afueras más rústicas. Para que no parezcan copiadas, cada casa cambia:
- el **color del encalado** (blanco, crudo, albero, ocre, azulado, rosado…): solo se tiñe la cal de las paredes, no las tejas, la madera ni las rejas;
- las **flores** (geranios rojos, rosas, blancos, morados, naranjas), la **buganvilla**, las **macetas** (de barro o azules) y la **forja**;
- la **fachada en espejo** (la puerta y las ventanas al otro lado), además del tamaño y el giro de siempre.

Con el trazado **«casas adosadas»** salen calles de casas en hilera. En el estilo andaluz la plaza es de **adoquín de granito** con cintas de piedra clara (sin mosaico) y no hay puestos de mercado (`cfg.puestos` los fuerza en cualquier estilo). El pueblo del escenario de ejemplo es andaluz, grande (tamaño 5) y con todos los solares ocupados.

Un modelo `.glb` con `props.huella: [ancho, fondo]` (m) dentro de un pueblo le reserva ese solar: el pueblo no pone allí casas, calles, árboles ni farolas (se rehace solo si el modelo se mueve). Así está la iglesia del ejemplo.

`Escenario.atravesarPueblo(esc, pueblo, camino)` hace que un camino cruce un pueblo: le pone dos salidas (`cfg.exits`) donde el camino entra y sale de su terreno y desvía el trazado por la plaza. Dentro del terreno del pueblo la cinta del camino no se dibuja (se usan las calles del pueblo).

### Creador de Pueblos incluido
`creador-de-pueblos.html` y lo que necesita (`js/village-core.js`, `casas-glb.js`, `casa-madera.js`, `arboles.js`, `pueblo-edits.js`, `character.js`, `three-puente.js`, `puestos-datos.js`, `texturas-lib.js`, `glb/pueblo/`, los puentes de `glb/`, `assets/` y `enemigos-editor/`) son una copia de [Creador-de-mundos-Rpg](https://github.com/narcimarquez-eng/Creador-de-mundos-Rpg). «🏗 Abrir en el Creador de Pueblos» abre esta copia, así que la vuelta con el diseño funciona siempre, publiques donde publiques. Si cambia allí, hay que volver a copiar esos archivos.

### Hierba, trigo y flores
El suelo se cubre de matas de hierba, trigo, flores, hierba alta o bambú, dibujadas con los atlas del Creador RPG (`js/pradera-atlas.js`, texturas pintadas en un lienzo, sin archivos) y movidas por el viento.
- **Automática:** sobre los suelos de hierba, hierba seca y musgo crece hierba sola, con claros, praderas de flores y matorral alto. Su densidad se cambia en *🖌 Pintar → Hierba y flores* («Hierba automática en todo el escenario»; 0 la quita).
- **Pintada:** con el mismo pincel se pinta hierba, trigo, flores, hierba alta o bambú con su densidad, se vuelve a «Automático» o se pone «Sin vegetación». Mientras se pinta, el terreno se tiñe con lo que crece encima.
- No crece en caminos, lagos, agua, pendientes fuertes ni en la plaza de los pueblos.
- Se dibuja solo alrededor de la cámara (calidad media: matas detalladas hasta 45 m y sencillas hasta 140 m; baja 26/85 m; alta 65/210 m), en teselas de 16 m que se calculan una vez. Desde muy arriba no se dibuja. En el visor se puede desactivar en ⚙ Ajustes.

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

La dirección del Creador RPG se cambia en *Escenario → Enlaces*. Por defecto es `https://narcimarquez-eng.github.io/Creador-de-mundos-Rpg/`; de ahí salen la biblioteca de modelos y el Creador de Mazmorras. El Creador de Pueblos viene incluido (ver arriba). Para que la vuelta desde el Creador de Mazmorras funcione, las dos apps tienen que estar en el mismo sitio (por ejemplo, ambos repositorios en GitHub Pages del mismo usuario).

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
- `Escenario.caminoEn(esc, x, z)` dice qué camino pisa un punto, a qué distancia del inicio y con qué superficie (`grava`, `asfalto`, `barro`…): sirve para el agarre, el polvo y el sonido de las ruedas. `Escenario.superficieEn(camino, d)` y `Escenario.proyectarEnCamino(camino, x, z)` hacen lo mismo a partir del camino.
- Las marcas de juego (inicio, meta, controles, coleccionables) son elementos con posición y giro: el juego decide qué hacer con ellas.
- Para un tipo nuevo de elemento (un portal, un spawn de vehículos…) basta con `Escenario.registrarTipo()` y, si se quiere ver en 3D, `registrarDibujo()` en `js/escena-3d.js`. Ver `docs/FORMATO-ESCENARIO.md`.
