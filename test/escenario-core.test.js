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
