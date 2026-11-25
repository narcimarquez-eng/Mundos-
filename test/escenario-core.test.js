// Pruebas del núcleo de escenarios. Ejecutar con: node --test test/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const E = require('../js/escenario-core.js');

test('cada plantilla crea un escenario válido y determinista', () => {
  for (const id of Object.keys(E.PLANTILLAS)) {
    const a = E.crear({ plantilla: id, semilla: 123, res: 129 });
    const b = E.crear({ plantilla: id, semilla: 123, res: 129 });
    assert.strictEqual(a.format, E.FORMATO);
    assert.strictEqual(a.terreno.alturas.length, 129 * 129);
    assert.ok(a.terreno.alturas.every(Number.isFinite), id + ': alturas finitas');
    assert.deepStrictEqual(Array.from(a.terreno.alturas.slice(0, 500)), Array.from(b.terreno.alturas.slice(0, 500)), id + ': misma semilla, mismo terreno');
    assert.strictEqual(a.elementos.length, b.elementos.length, id + ': mismos elementos');
    for (const el of a.elementos) assert.ok(E.TIPOS[el.tipo], 'tipo conocido: ' + el.tipo);
  }
});

test('guardar y cargar conserva todo', () => {
  const a = E.crear({ plantilla: 'rpg', semilla: 9, res: 129 });
  a.terreno.materiales[77] = 5;
  const json = JSON.stringify(E.serializar(a));
  const { escenario: b } = E.deserializar(json);
  assert.deepStrictEqual(Array.from(b.terreno.alturas), Array.from(a.terreno.alturas));
  assert.strictEqual(b.terreno.materiales[77], 5);
  assert.deepStrictEqual(b.elementos, JSON.parse(JSON.stringify(a.elementos)));
  assert.deepStrictEqual(b.caminos, JSON.parse(JSON.stringify(a.caminos)));
  assert.ok(b.nextId >= a.nextId, 'los ids nuevos no chocan con los cargados');
});

test('deserializar rechaza archivos que no son escenarios', () => {
  assert.throws(() => E.deserializar({ format: 'rpg-world' }), /escenario/);
  assert.throws(() => E.deserializar({ format: E.FORMATO, version: 99, terreno: { tam: 64, res: 65 } }), /versión/);
});

test('alturaEn interpola entre los puntos de la rejilla', () => {
  const e = E.crearVacio({ tam: 100, res: 65 });
  const r = e.terreno.res;
  e.terreno.alturas[32 * r + 32] = 10; // centro
  assert.strictEqual(E.alturaEn(e, 0, 0), 10);
  const p = E.paso(e);
  assert.ok(Math.abs(E.alturaEn(e, p / 2, 0) - 5) < 1e-6);
});

test('pinceles: subir, bajar, aplanar, suavizar y pintar', () => {
  const e = E.crearVacio({ tam: 200, res: 129 });
  E.esculpir(e, { modo: 'subir', x: 0, z: 0, radio: 20, fuerza: 4 });
  assert.ok(Math.abs(E.alturaEn(e, 0, 0) - 4) < 0.05);
  assert.strictEqual(E.alturaEn(e, 50, 50), 0, 'fuera del radio no cambia');
  E.esculpir(e, { modo: 'bajar', x: 0, z: 0, radio: 20, fuerza: 1 });
  assert.ok(Math.abs(E.alturaEn(e, 0, 0) - 3) < 0.05);
  const antes = E.alturaEn(e, 0, 0);
  E.esculpir(e, { modo: 'suavizar', x: 0, z: 0, radio: 30, fuerza: 1 });
  assert.ok(E.alturaEn(e, 0, 0) < antes);
  E.esculpir(e, { modo: 'nivel', x: 0, z: 0, radio: 30, fuerza: 1, objetivo: 7 });
  assert.ok(Math.abs(E.alturaEn(e, 0, 0) - 7) < 1e-4);
  E.pintar(e, { x: 0, z: 0, radio: 10, material: 7 });
  const g = E.aRejilla(e, 0, 0);
  assert.strictEqual(e.terreno.materiales[Math.round(g.gj) * e.terreno.res + Math.round(g.gi)], 7);
});

test('caminos: muestreo y ajuste del terreno', () => {
  const e = E.crearVacio({ tam: 400, res: 129 });
  E.generarTerreno(e, { tipo: 'colinas', escala: 80, altura: 30, semilla: 4 });
  const c = E.crearCamino(e, { ancho: 8, puntos: [{ x: -150, z: 0 }, { x: 0, z: 40 }, { x: 150, z: 0 }] });
  const mu = E.muestrearCamino(c, 2);
  assert.ok(mu.length > 100);
  assert.deepStrictEqual([mu[0].x, mu[0].z], [-150, 0]);
  assert.deepStrictEqual([mu[mu.length - 1].x, mu[mu.length - 1].z], [150, 0]);
  for (let k = 1; k < mu.length; k++) assert.ok(mu[k].d >= mu[k - 1].d);
  // pendiente transversal casi nula tras ajustar
  E.ajustarTerrenoACamino(e, c);
  let peor = 0;
  for (let k = 5; k < mu.length - 5; k += 7) {
    const a = mu[k - 1], b = mu[k + 1];
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz);
    const nx = -dz / l, nz = dx / l;
    peor = Math.max(peor, Math.abs(E.alturaEn(e, mu[k].x + nx * 3, mu[k].z + nz * 3) - E.alturaEn(e, mu[k].x - nx * 3, mu[k].z - nz * 3)));
  }
  assert.ok(peor < 0.6, 'el camino queda llano de lado a lado (' + peor.toFixed(2) + ' m)');
  const cerr = E.crearCamino(e, { cerrado: true, puntos: [{ x: 0, z: 0 }, { x: 50, z: 0 }, { x: 50, z: 50 }] });
  const mc = E.muestrearCamino(cerr, 2);
  assert.deepStrictEqual([mc[mc.length - 1].x, mc[mc.length - 1].z], [0, 0], 'un circuito vuelve al inicio');
});

test('elementos: crear, duplicar, quitar y propiedades por defecto', () => {
  const e = E.crearVacio({ tam: 300, res: 65 });
  const p = E.crearElemento(e, 'pueblo', 10, 20, { nombre: 'Aldea' });
  assert.strictEqual(p.nombre, 'Aldea');
  assert.ok(p.props.cfg && p.props.cfg.seed, 'el pueblo trae configuración del Creador de Pueblos');
  assert.strictEqual(p.props.radio, E.radioPueblo(p.props.cfg.size));
  const z = E.crearElemento(e, 'zona', 0, 0);
  assert.deepStrictEqual(z.props.enemigos, []);
  z.props.enemigos.push({ modelo: 'rpg:x.glb' });
  assert.deepStrictEqual(E.TIPOS.zona.props.enemigos, [], 'las props por defecto no se comparten');
  const d = E.duplicarElemento(e, z.id);
  assert.notStrictEqual(d.id, z.id);
  assert.ok(E.quitar(e, z.id));
  assert.strictEqual(E.buscarElemento(e, z.id), null);
  assert.throws(() => E.crearElemento(e, 'no-existe', 0, 0));
});

test('registrarTipo amplía el catálogo', () => {
  E.registrarTipo({ id: 'prueba_portal', nombre: 'Portal', grupo: 'juego', props: { destino: '' }, campos: [{ k: 'destino', n: 'Destino', t: 'texto' }] });
  const e = E.crearVacio({ tam: 100, res: 65 });
  const el = E.crearElemento(e, 'prueba_portal', 1, 2, { destino: 'mazmorra' });
  assert.strictEqual(el.props.destino, 'mazmorra');
  delete E.TIPOS.prueba_portal;
});

test('remuestrear cambia la resolución conservando el relieve', () => {
  const e = E.crear({ plantilla: 'montanas', semilla: 5, res: 129, tam: 1024 });
  const h = E.alturaEn(e, 100, -60);
  E.remuestrear(e, 257);
  assert.strictEqual(e.terreno.alturas.length, 257 * 257);
  assert.ok(Math.abs(E.alturaEn(e, 100, -60) - h) < Math.max(2, Math.abs(h) * 0.05));
});

test('allanarArea deja el centro a la altura pedida', () => {
  const e = E.crear({ plantilla: 'montanas', semilla: 2, res: 129, tam: 2048 });
  E.allanarArea(e, 0, 0, 60, 25);
  assert.ok(Math.abs(E.alturaEn(e, 0, 0) - 25) < 1e-3);
  assert.ok(Math.abs(E.alturaEn(e, 40, 0) - 25) < 1e-3);
});

test('árboles con modelo: especies, archivos preparados y plantillas que los usan', () => {
  const fs = require('node:fs'), path = require('node:path');
  const ids = Object.keys(E.ARBOLES_GLB);
  assert.deepStrictEqual(ids.sort(), ['liquidambar', 'palmera_datilera', 'pino_pinonero', 'pinsapo']);
  const indice = JSON.parse(fs.readFileSync(path.join(__dirname, '../glb/arboles/indice.json'), 'utf8'));
  for (const id of ids) {
    const def = E.ARBOLES_GLB[id];
    assert.ok(fs.existsSync(path.join(__dirname, '..', def.archivo)), 'existe ' + def.archivo);
    assert.ok(E.ESPECIES.some(e => e[0] === id), id + ' se puede elegir');
    assert.ok(E.TIPOS.arbol.campos[0].op.some(e => e[0] === id), id + ' en el árbol suelto');
    assert.ok(def.sencillo && E.ESPECIES.some(e => e[0] === def.sencillo), id + ' tiene sustituto sencillo');
    const i = indice.find(x => x.id === id);
    assert.ok(i && i.tris.medio < i.tris.cerca, id + ': la versión media tiene menos triángulos');
    assert.ok(Math.abs(i.alto - def.alto) < 1, id + ': altura del catálogo parecida a la del modelo');
  }
  for (const lista of Object.values(E.MEZCLA_BIOMA)) for (const sp of lista) assert.ok(E.ESPECIES.some(e => e[0] === sp), 'mezcla con especie conocida: ' + sp);
  const rally = E.crear({ plantilla: 'rally', semilla: 3, res: 129 });
  assert.ok(rally.elementos.some(e => e.tipo === 'bosque' && (E.ARBOLES_GLB[e.props.especie] || e.props.especie === 'mixto')));
  assert.strictEqual(E.crearElemento(rally, 'arbol', 0, 0).props.especie, 'liquidambar');
});

test('vegetación: pintar, automática, codificación y guardado', () => {
  for (let t = 0; t < E.PRADERA.length; t++) for (const d of [0.02, 0.5, 1]) {
    const v = E.codVegetacion(t, d);
    assert.ok(v >= 1 && v <= 250);
    const r = E.decodVegetacion(v);
    assert.strictEqual(r.tipo, E.PRADERA[t][0]);
    assert.ok(Math.abs(r.d - Math.max(0.02, d)) < 0.021);
  }
  assert.strictEqual(E.decodVegetacion(0), null);
  assert.strictEqual(E.decodVegetacion(E.VEG_NADA).tipo, null);

  const e = E.crearVacio({ tam: 200, res: 129 }); // plano de hierba
  e.terreno.hierbaAuto = 0.8;
  let conHierba = 0;
  for (let k = 0; k < 200; k++) { const v = E.vegetacionEn(e, -90 + k * 0.9, 13); if (v) { conHierba++; assert.ok(['hierba', 'flores', 'hierbaAlta'].includes(v.tipo)); } }
  assert.ok(conHierba > 150, 'la hierba automática cubre el prado');
  e.terreno.hierbaAuto = 0;
  assert.strictEqual(E.vegetacionEn(e, 0, 0), null, 'sin hierba automática');
  E.pintarVegetacion(e, { x: 0, z: 0, radio: 10, tipo: 'trigo', densidad: 0.9 });
  assert.strictEqual(E.vegetacionEn(e, 0, 0).tipo, 'trigo');
  assert.ok(E.vegetacionEn(e, 0, 0).d > 0.8);
  e.terreno.hierbaAuto = 1;
  E.pintarVegetacion(e, { x: 50, z: 50, radio: 8, tipo: 'nada' });
  assert.strictEqual(E.vegetacionEn(e, 50, 50), null, 'borrado a mano gana a la automática');
  e.terreno.materiales.fill(4); // roca: sin hierba automática
  assert.strictEqual(E.vegetacionEn(e, -60, -60), null);
  const b = E.deserializar(JSON.stringify(E.serializar(e))).escenario;
  assert.deepStrictEqual(Array.from(b.terreno.vegetacion), Array.from(e.terreno.vegetacion));
  // archivos de antes, sin vegetación: se cargan con todo en automático
  const viejo = E.serializar(E.crearVacio({ tam: 100, res: 65 })); delete viejo.terreno.vegetacion; delete viejo.terreno.hierbaAuto;
  const c = E.deserializar(JSON.stringify(viejo)).escenario;
  assert.strictEqual(c.terreno.vegetacion.length, 65 * 65);
  assert.ok(c.terreno.hierbaAuto > 0);
});

test('caminos: tramos de superficie, proyección, camino bajo un punto y barreras', () => {
  const e = E.crearVacio({ tam: 400, res: 65 });
  const c = E.crearCamino(e, { tipo: 'grava', ancho: 10, puntos: [{ x: -100, z: 0 }, { x: 100, z: 0 }] });
  assert.deepStrictEqual(c.tramos, []); assert.deepStrictEqual(c.barreras, []);
  const L = E.largoCamino(c);
  assert.ok(Math.abs(L - 200) < 0.5);
  c.tramos.push({ desde: 50, hasta: 120, tipo: 'asfalto' }, { desde: 100, hasta: 110, tipo: 'barro' });
  assert.strictEqual(E.superficieEn(c, 10), 'grava');
  assert.strictEqual(E.superficieEn(c, 60), 'asfalto');
  assert.strictEqual(E.superficieEn(c, 105), 'barro', 'el último tramo manda');
  const p = E.proyectarEnCamino(c, 20, 3);
  assert.ok(Math.abs(p.d - 120) < 0.5 && Math.abs(p.dist - 3) < 0.01);
  assert.strictEqual(E.proyectarEnCamino(c, 20, -3).lado, -p.lado, 'lados opuestos');
  assert.strictEqual(E.caminoEn(e, -40, 2).tipo, 'asfalto');
  assert.strictEqual(E.caminoEn(e, -40, 20), null, 'fuera del camino');
  // en un circuito un tramo puede pasar por la salida
  const cc = E.crearCamino(e, { cerrado: true, puntos: [{ x: 0, z: 0 }, { x: 60, z: 0 }, { x: 60, z: 60 }, { x: 0, z: 60 }] });
  const T = E.largoCamino(cc);
  cc.tramos.push({ desde: T - 10, hasta: 10, tipo: 'asfalto' });
  assert.strictEqual(E.superficieEn(cc, T - 5), 'asfalto');
  assert.strictEqual(E.superficieEn(cc, 5), 'asfalto');
  assert.strictEqual(E.superficieEn(cc, T / 2), 'tierra');
  // la plantilla de rally trae tramos y barreras válidos, y se conservan al guardar
  const r = E.crear({ plantilla: 'rally', semilla: 5, res: 129 });
  const pista = r.caminos[0];
  assert.ok(pista.tramos.length >= 1 && pista.barreras.length >= 4);
  for (const b of pista.barreras) assert.ok(E.TIPOS_BARRERA.some(t => t[0] === b.tipo) && E.LADOS.some(l => l[0] === b.lado));
  const r2 = E.deserializar(JSON.stringify(E.serializar(r))).escenario;
  assert.deepStrictEqual(r2.caminos[0].barreras, pista.barreras);
  // archivos de antes, sin tramos ni barreras
  const viejo = E.serializar(e); delete viejo.caminos[0].tramos; delete viejo.caminos[0].barreras;
  const v2 = E.deserializar(JSON.stringify(viejo)).escenario;
  assert.deepStrictEqual(v2.caminos[0].tramos, []); assert.deepStrictEqual(v2.caminos[0].barreras, []);
});

test('riachuelos: excavan el cauce y el agua nunca sube', () => {
  const e = E.crearVacio({ tam: 600, res: 129 });
  E.generarTerreno(e, { tipo: 'colinas', escala: 150, altura: 30, semilla: 9 });
  const pts = []; for (let k = 0; k <= 8; k++) pts.push({ x: -280 + k * 70, z: Math.sin(k) * 40 });
  const rio = E.crearCamino(e, { tipo: 'riachuelo', ancho: 5, puntos: pts });
  assert.ok(E.esRio(rio));
  const mu = E.muestrearCamino(rio, 3);
  const antes = mu.map(m => E.alturaEn(e, m.x, m.z));
  E.ajustarTerrenoACamino(e, rio);
  mu.forEach((m, k) => assert.ok(E.alturaEn(e, m.x, m.z) <= antes[k] + 1e-3, 'solo excava'));
  const niv = E.nivelesRio(e, rio, mu);
  for (let k = 1; k < niv.length; k++) assert.ok(niv[k] <= niv[k - 1] + 1e-4, 'el agua no sube');
  // el agua queda por encima del fondo
  let encima = 0; mu.forEach((m, k) => { if (niv[k] > E.alturaEn(e, m.x, m.z)) encima++; });
  assert.ok(encima > mu.length * 0.8);
  assert.ok(!E.TIPOS_CAMINO.slice(0, 8).some(t => t[0] === 'riachuelo'), 'el riachuelo va el último (no es superficie de camino)');
});

test('pueblos: salidas creadas desde los caminos y caminos llevados a las salidas', () => {
  const e = E.crearVacio({ tam: 1200, res: 65 });
  const p = E.crearElemento(e, 'pueblo', 0, 0, { cfg: Object.assign(E.cfgPuebloPorDefecto(3, 3), { rotation: 30, exits: [] }) });
  const h = E.mitadTerrenoPueblo(p.props.cfg);
  const c = E.crearCamino(e, { puntos: [{ x: 0, z: 0 }, { x: 60, z: 10 }, { x: 400, z: 50 }] });
  assert.strictEqual(E.conectarCaminosPueblo(e, p), 1);
  assert.strictEqual(p.props.cfg.exits.length, 1);
  const s = E.puntoSalidaPueblo(p, p.props.cfg.exits[0].angle);
  assert.deepStrictEqual(c.puntos[0], { x: Math.round(s.x * 10) / 10, z: Math.round(s.z * 10) / 10 }, 'el camino empieza en la salida');
  assert.ok(Math.hypot(s.x, s.z) >= h - 0.5, 'la salida está en el borde del terreno del pueblo');
  assert.strictEqual(c.puntos.length, 2, 'los puntos de dentro del pueblo se quitan');
  // el creador cambia la salida: el camino se lleva a la nueva
  p.props.cfg.exits = [{ angle: 90, gate: null, to: '' }];
  c.puntos.unshift({ x: 0, z: 0 });
  E.conectarCaminosPueblo(e, p, { desdeSalidas: true });
  const s2 = E.puntoSalidaPueblo(p, 90);
  assert.ok(Math.hypot(c.puntos[0].x - s2.x, c.puntos[0].z - s2.z) < 0.2);
  assert.strictEqual(p.props.cfg.exits[0].roadId, c.id);
  // la plantilla de rally trae pueblo conectado y riachuelo
  const r = E.crear({ plantilla: 'rally', semilla: 4242, res: 129 });
  const pr = r.elementos.find(x => x.tipo === 'pueblo');
  assert.ok(pr && pr.props.cfg.exits.length >= 1);
  assert.ok(r.caminos.some(x => x.tipo === 'riachuelo'));
});

test('lagos y puentes: vaso con agua contenida, cruces y puentes alineados con el camino', () => {
  const e = E.crearVacio({ tam: 800, res: 129 });
  E.generarTerreno(e, { tipo: 'colinas', escala: 200, altura: 20, semilla: 3 });
  const lago = E.crearElemento(e, 'lago', -200, -200, { radio: 40, forma: 7 });
  E.excavarLago(e, lago);
  const W = E.alturaEn(e, lago.x, lago.z) + lago.props.nivel;
  assert.ok(lago.props.nivel > 0.5, 'el centro queda bajo el agua');
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; assert.ok(E.alturaEn(e, lago.x + Math.cos(a) * 40 * 1.25, lago.z + Math.sin(a) * 40 * 1.25) >= W - 0.05, 'el agua no se sale del vaso'); }
  const rio = E.crearCamino(e, { tipo: 'riachuelo', ancho: 5, puntos: [{ x: 100, z: -300 }, { x: 100, z: 300 }] });
  E.ajustarTerrenoACamino(e, rio);
  const c = E.crearCamino(e, { tipo: 'grava', ancho: 9, puntos: [{ x: -100, z: 50 }, { x: 300, z: 50 }] });
  const cr = E.crucesCaminoRio(e);
  assert.strictEqual(cr.length, 1);
  assert.ok(Math.abs(cr[0].x - 100) < 1 && Math.abs(cr[0].z - 50) < 1);
  const ps = E.ponerPuentes(e, { modelos: ['riotinto'] });
  assert.strictEqual(ps.length, 1);
  const pu = ps[0];
  assert.strictEqual(pu.props.modelo, 'riotinto');
  assert.strictEqual(pu.props.camino, c.id);
  assert.ok(Math.abs(Math.abs(pu.rotY) % 180) < 1, 'a lo largo del camino (eje x)');
  assert.ok(pu.props.ancho >= c.ancho && pu.props.largo >= E.PUENTES.riotinto.vano);
  assert.strictEqual(E.ponerPuentes(e).length, 0, 'no repite puentes');
  const tramos = E.puentesDeCamino(e, c);
  assert.strictEqual(tramos.length, 1);
  assert.ok(tramos[0].d0 < 200 && tramos[0].d1 > 200, 'el puente cubre el cruce');
});
