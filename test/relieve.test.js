// Relieve llamativo: tipos de terreno (cañones, desfiladeros, mesas, acantilados, tepuis), pinceles y plantillas.
const test = require('node:test');
const assert = require('node:assert');
const E = require('../js/escenario-core.js');

// Fracción de la rejilla con paredes de más de ~63° (desnivel > 2 m por metro)
function paredes(esc) {
  const t = esc.terreno, r = t.res, h = t.alturas, p = E.paso(esc);
  let n = 0;
  for (let j = 0; j < r - 1; j++) for (let i = 0; i < r - 1; i++) {
    const k = j * r + i;
    if (Math.abs(h[k + 1] - h[k]) / p > 2 || Math.abs(h[k + r] - h[k]) / p > 2) n++;
  }
  return n / ((r - 1) * (r - 1));
}

test('los tipos nuevos dan paredes verticales y alturas válidas', () => {
  const casos = { canones: [600, 90], desfiladero: [700, 220], mesas: [600, 60], acantilados: [500, 60], tepuis: [1200, 300] };
  for (const [tipo, [escala, altura]] of Object.entries(casos)) {
    assert.ok(E.TIPOS_TERRENO.some(t => t[0] === tipo), tipo + ' en la lista');
    const esc = E.crearVacio({ tam: 2048, res: 513, semilla: 5 });
    E.generarTerreno(esc, { tipo, escala, altura, semilla: 5 });
    assert.ok(esc.terreno.alturas.every(Number.isFinite), tipo + ': alturas finitas');
    assert.ok(paredes(esc) > 0.01, tipo + ': paredes ' + paredes(esc));
  }
});

test('es determinista con la misma semilla', () => {
  const a = E.crearVacio({ tam: 1024, res: 257, semilla: 3 }), b = E.crearVacio({ tam: 1024, res: 257, semilla: 3 });
  E.generarTerreno(a, { tipo: 'canones', escala: 400, altura: 80, semilla: 3 });
  E.generarTerreno(b, { tipo: 'canones', escala: 400, altura: 80, semilla: 3 });
  assert.deepStrictEqual(Array.from(a.terreno.alturas), Array.from(b.terreno.alturas));
});

test('el fondo de los cañones no baja del suelo y la costa de acantilados tiene mar y tierra alta', () => {
  const c = E.crearVacio({ tam: 2048, res: 257, semilla: 9 });
  E.generarTerreno(c, { tipo: 'canones', escala: 600, altura: 100, semilla: 9 });
  assert.ok(E.rangoAlturas(c).min > 0);
  const a = E.crearVacio({ tam: 2048, res: 257, semilla: 9 });
  E.generarTerreno(a, { tipo: 'acantilados', escala: 500, altura: 60, semilla: 9 });
  const r = E.rangoAlturas(a);
  assert.ok(r.min < -3 && r.max > 30, JSON.stringify(r));
});

test('pincel acantilado: meseta con pared vertical en el borde', () => {
  const esc = E.crearVacio({ tam: 256, res: 257, semilla: 1 });   // 1 m entre puntos, suelo plano a 0
  for (let n = 0; n < 6; n++) E.esculpir(esc, { modo: 'meseta', x: 0, z: 0, radio: 30, fuerza: 1, objetivo: 0, alto: 20 });
  assert.ok(Math.abs(E.alturaEn(esc, 0, 0) - 20) < 0.5, 'centro a 20 m');
  assert.ok(Math.abs(E.alturaEn(esc, 20, 0) - 20) < 0.5, 'arriba plano hasta cerca del borde');
  assert.ok(E.alturaEn(esc, 31, 0) < 0.5, 'fuera, el suelo no cambia');
  assert.ok(E.alturaEn(esc, 27, 0) - E.alturaEn(esc, 30, 0) > 15, 'la pared cae más de 15 m en 3 m');
});

test('pincel cañón: fondo plano a la profundidad pedida; terrazas en escalones', () => {
  const esc = E.crearVacio({ tam: 256, res: 257, semilla: 1 });
  for (let n = 0; n < 6; n++) E.esculpir(esc, { modo: 'canon', x: 0, z: 0, radio: 40, fuerza: 1, objetivo: 0, alto: 25, repisas: 2 });
  assert.ok(Math.abs(E.alturaEn(esc, 0, 0) + 25) < 0.5, 'fondo a −25 m');
  assert.ok(Math.abs(E.alturaEn(esc, 8, 0) + 25) < 0.5, 'fondo plano');
  assert.ok(E.alturaEn(esc, 41, 0) > -0.5, 'fuera, nada');
  const t = E.crearVacio({ tam: 256, res: 257, semilla: 1 });
  const h = t.terreno.alturas, r = t.terreno.res;
  for (let j = 0; j < r; j++) for (let i = 0; i < r; i++) h[j * r + i] = i * 0.2;   // rampa del 20 %
  E.esculpir(t, { modo: 'terrazas', x: 0, z: 0, radio: 60, fuerza: 1, escalon: 5 });
  const a = E.alturaEn(t, -2, 0), b = E.alturaEn(t, 2, 0);
  assert.ok(Math.abs(a - b) < 0.3 || Math.abs(a - b) > 0.6, 'cerca del centro hay rellanos y saltos');
});

test('plantillas de relieve: piden detalle alto si no se elige otro', () => {
  for (const id of ['gran_canon', 'costa_acantilados', 'desfiladeros', 'valle_mesas', 'tepuis']) {
    assert.ok(E.PLANTILLAS[id], id);
    assert.strictEqual(E.crear({ plantilla: id, semilla: 21, res: 129 }).terreno.res, 129, id + ': se respeta el detalle elegido');
    const esc = E.crear({ plantilla: id, semilla: 21 });
    assert.strictEqual(esc.terreno.res, 513, id + ' pide 513²');
    assert.ok(esc.elementos.length > 0, id + ' con elementos');
    assert.ok(paredes(esc) > 0.005, id + ' con paredes');
    const copia = E.deserializar(JSON.parse(JSON.stringify(E.serializar(esc)))).escenario || E.deserializar(E.serializar(esc));
    assert.ok(copia);
  }
});

test('rocas con foto real: materiales del suelo y roca de las paredes según el bioma o elegida', () => {
  for (const [pd, id] of Object.entries(E.MATERIAL_PIEDRA)) {
    const m = E.MATERIALES.find(x => x.id === id);
    assert.ok(m && m.piedra === pd, pd);
  }
  const esc = E.crearVacio({ tam: 1024, res: 257, semilla: 4, bioma: 'desierto' });
  E.generarTerreno(esc, { tipo: 'mesas', escala: 400, altura: 60, semilla: 4 });
  const r = E.rangoCache(esc);
  const paredes = modo => {
    esc.terreno.rocaPared = modo;
    const vistos = new Set();
    for (let j = 1; j < 256; j++) for (let i = 1; i < 256; i++) if (E.pendienteIdx(esc, i, j) > 0.85) vistos.add(E.materialEn(esc, i, j, r));
    return [...vistos];
  };
  assert.deepStrictEqual(paredes('auto'), [E.MATERIAL_PIEDRA.ocre], 'desierto: arenisca ocre');
  assert.deepStrictEqual(paredes('oscura'), [E.MATERIAL_PIEDRA.oscura]);
  assert.deepStrictEqual(paredes('roca'), [4], 'la roca genérica de antes');
  assert.deepStrictEqual(paredes('mezcla').sort(), [E.MATERIAL_PIEDRA.ocre, E.MATERIAL_PIEDRA.estratos].sort(), 'mezcla: las dos del bioma');
});

test('riscos del relieve: solo en las laderas altas y empinadas', () => {
  const base = () => { const e = E.crearVacio({ tam: 2048, res: 257, semilla: 8 }); return e; };
  const a = base(), b = base();
  E.generarTerreno(a, { tipo: 'montanas', escala: 700, altura: 300, semilla: 8 });
  E.generarTerreno(b, { tipo: 'montanas', escala: 700, altura: 300, semilla: 8, riscos: 1 });
  const r = E.rangoAlturas(a), span = r.max - r.min;
  let cambiados = 0, bajosCambiados = 0;
  for (let k = 0; k < a.terreno.alturas.length; k++) {
    const d = Math.abs(a.terreno.alturas[k] - b.terreno.alturas[k]);
    if (d > 0.5) { cambiados++; if (a.terreno.alturas[k] < r.min + span * 0.2) bajosCambiados++; }
  }
  assert.ok(cambiados > 500, 'hay riscos: ' + cambiados);
  assert.strictEqual(bajosCambiados, 0, 'los valles no cambian');
  const c = base(); E.generarTerreno(c, { tipo: 'montanas', escala: 700, altura: 300, semilla: 8, riscos: 1 });
  assert.deepStrictEqual(Array.from(c.terreno.alturas), Array.from(b.terreno.alturas), 'determinista');
});

test('elemento «Riscos (área)» y plantillas de montaña con riscos', () => {
  assert.ok(E.TIPOS.riscos && E.TIPOS.riscos.forma === 'area');
  for (const id of ['montanas', 'desfiladeros']) {
    const esc = E.crear({ plantilla: id, semilla: 6, res: 257 });
    assert.ok(esc.elementos.some(e => e.tipo === 'riscos'), id + ' trae riscos');
    assert.strictEqual(esc.terreno.rocaPared, 'mezcla');
    const { escenario } = E.deserializar(JSON.stringify(E.serializar(esc)));
    assert.strictEqual(escenario.terreno.rocaPared, 'mezcla', 'se guarda la roca de las paredes');
  }
});
