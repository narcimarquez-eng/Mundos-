# Formato `.escenario.json` (versión 1)

Lo produce el Creador de Escenarios (exportar, o el guardado del navegador) y lo leen el visor y los juegos.
Unidades en **metros**. Ejes como en three.js: `x` y `z` en el suelo, `y` hacia arriba. El terreno está centrado en el origen.

```jsonc
{
  "format": "escenario-3d",       // siempre así
  "version": 1,
  "id": "esc-…", "nombre": "Circuito del valle", "descripcion": "",
  "plantilla": "rally",           // de qué plantilla salió (informativo)
  "semilla": 4242,
  "nextId": 31,                   // contador para ids nuevos
  "creado": "…", "actualizado": "…",
  "terreno": { … },
  "ambiente": { "hora": 13, "niebla": 0.35, "nubes": 0.4, "cielo": "auto" },
  "caminos": [ /* Camino */ ],
  "elementos": [ /* Elemento */ ],
  "enlaces": { "rpgBase": "https://narcimarquez-eng.github.io/Creador-de-mundos-Rpg/" },
  "glbs": { "m1a2b3": { "nombre": "torre", "tam": 123456, "bytes": "…base64 (solo si se exporta con modelos)…" } }
}
```

## Terreno
| Campo | Descripción |
|---|---|
| `tam` | Lado del terreno en metros. Va de `-tam/2` a `tam/2` en `x` y en `z`. |
| `res` | Puntos por lado de la rejilla (65, 129, 257 o 513). Distancia entre puntos: `tam / (res − 1)`. |
| `alturas` | `Float32Array` de `res × res` en **base64** (little-endian). Índice `j·res + i`; el punto `(i, j)` está en `x = −tam/2 + i·paso`, `z = −tam/2 + j·paso`. |
| `materiales` | `Uint8Array` de `res × res` en base64: material pintado en cada punto (0 = automático). Ver la tabla. |
| `bioma` | `templado`, `desierto`, `tropical`, `nevado`, `volcanico` u `otono`: decide los materiales automáticos y el color del agua. |
| `gen` | Parámetros con los que se generó: `{ tipo, escala, altura, octavas, base, semilla }`. `tipo`: `plano`, `colinas`, `montanas`, `isla`, `archipielago`, `valle`, `dunas`, `mesetas`, `canon`, `crater`. |
| `agua` | `{ activa, nivel, color }`: plano de agua a esa altura (`color` null = el del bioma). |
| `bordes` | `cortado` (bloque) o `infinito` (en el visor el agua llega al horizonte y no se dibuja el borde). |

Materiales: 0 automático · 1 hierba · 2 hierba seca · 3 tierra · 4 roca · 5 arena · 6 nieve · 7 asfalto · 8 barro · 9 grava · 10 musgo · 11 ceniza · 12 hielo · 13 baldosa.

Altura en un punto cualquiera: interpolación bilineal (`Escenario.alturaEn`).

## Camino
```jsonc
{ "id": "c_1", "nombre": "Circuito", "tipo": "grava", "ancho": 11, "cerrado": true, "bordes": false,
  "puntos": [ { "x": -120, "z": 40 }, … ] }
```
Los puntos son de control: la línea real es una curva Catmull-Rom que pasa por ellos (`Escenario.muestrearCamino(c, paso)` → `[{ x, z, d }]`, `d` = metros desde el inicio). `cerrado` une el último con el primero (circuito). `tipo`: `tierra`, `grava`, `asfalto`, `piedra`, `arena`, `barro`, `nieve`. `bordes`: líneas blancas a los lados.

## Elemento
```jsonc
{ "id": "pue_3", "tipo": "pueblo", "nombre": "Valdris",
  "x": 120, "z": -340,     // posición en el suelo
  "y": 0,                  // metros por encima del terreno en (x, z)
  "rotY": 90,              // giro en grados; con 0 el elemento mira hacia +z
  "escala": 1,             // no se usa en las áreas (usan props.radio)
  "props": { … } }         // depende del tipo
```

| Tipo | Forma | `props` |
|---|---|---|
| `caja` | punto | `ancho, alto, fondo, color` |
| `plataforma` | punto | `ancho, fondo, grosor, color, borde` (color de la cara de arriba) |
| `rampa` | punto | `ancho, alto, largo, color` (sube hacia +z) |
| `cilindro`, `esfera` | punto | `radio, (alto), color` |
| `muro` | punto | `largo, alto, grosor, color` (a lo largo de x) |
| `arbol` | punto | `especie` (roble, pino, abeto, palmera, abedul, seco, cactus), `alto` |
| `roca` | punto | `tam, color` |
| `bosque` | área | `radio, especie` (o `mixto` según el bioma), `densidad` (árboles cada 1000 m²), `altoMin, altoMax, rocas, semilla` |
| `rocas` | área | `radio, cantidad, tamMin, tamMax, color, semilla` |
| `lago` | área | `radio, nivel` (altura del agua sobre el suelo del centro), `color` |
| `inicio` | punto | `color`. Salida del jugador, mirando a `rotY`. |
| `meta` | punto | `ancho, alto`. Arco de meta. |
| `checkpoint` | punto | `orden, ancho, alto, color` |
| `moneda` | punto | `color, tam`. Coleccionable. |
| `luz` | punto | `color, intensidad, alcance` |
| `cartel` | punto | `texto, color` |
| `camara` | punto | `altura, inclinacion`. Punto de vista para el visor (dirección = `rotY`). |
| `glb` | punto | `modelo`, `alturaObjetivo` (0 = tamaño original), `sombras` |
| `enemigo` | punto | `modelo, alturaObjetivo, nivel` |
| `pueblo` | área | `radio, nivel, notas, cfg` — `cfg` es **la configuración del Creador de Pueblos** (la misma que `town.cfg` del Creador de Mundos: `style, terrainType, seed, size, houseDensity, …, rotation, exits, edits`). |
| `zona` | área | `radio, subtipo` (caza, elite, jefe, pvp, segura, arena), `nivelMin, nivelMax, semilla, enemigos: [{ modelo, cantidad, alto }]` |
| `mazmorra` | punto | `nivel, dungeon` — `dungeon` es la configuración del Creador de Mazmorras. |

### Modelos (`props.modelo`)
- `rpg:<ruta>`: archivo del Creador RPG, relativo a `enlaces.rpgBase` (p. ej. `rpg:glb/cabanas/cabana_5_redonda.glb`).
- `local:<id>`: modelo importado; sus datos están en el navegador y, si se exportó con modelos, en `glbs[id].bytes`.
- Una dirección `https://…` a un `.glb`.

Al dibujarlo se centra en `x`/`z`, se apoya en el suelo y, si `alturaObjetivo > 0`, se escala a esa altura.

## Añadir un tipo de elemento
```js
// En escenario-core.js (o en un script propio cargado después)
Escenario.registrarTipo({
  id: 'portal', nombre: 'Portal', icono: '🌀', grupo: 'juego', forma: 'punto',
  props: { destino: '', color: '#8e44ad' },
  campos: [{ k: 'destino', n: 'Destino', t: 'texto' }, { k: 'color', n: 'Color', t: 'color' }]
});
// En escena-3d.js: cómo se ve (devuelve un Object3D con la base en y = 0)
registrarDibujo('portal', (el, ctx) => { … });
```
Aparece solo en la paleta de **➕ Colocar** y en el panel de propiedades. Tipos de campo: `num`, `rango`, `color`, `bool`, `texto`, `sel` (con `op: [[valor, texto]]`), `glb` y `modelo`.

## Conexión con el Creador de Pueblos y el Creador de Mazmorras
El editor abre `<rpgBase>/creador-de-pueblos.html#mundo=<json>` con
`{ sessionId: "esc:<id del escenario>", townId, name, cfg, volver, claveRetorno: "escenarios.retornoPueblo" }`
(o `creador-de-mazmorras.html` con `dungeonId, dungeon` y `escenarios.retornoMazmorra`).
Al pulsar «Guardar y volver», el creador escribe `{ sessionId, townId, cfg }` (o `{ sessionId, dungeonId, dungeon }`) en
`localStorage[claveRetorno]` y vuelve a `volver` si es del mismo sitio. El editor lo aplica al arrancar.
