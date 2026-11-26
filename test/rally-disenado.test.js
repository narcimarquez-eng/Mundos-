// Circuitos de rally diseñados (js/rally-disenado.js): el trazado cierra, y lo que importa para jugar está bien puesto.
const test = require('node:test');
const assert = require('node:assert');
const E = require('../js/rally-disenado.js');

test('trazarRuta: una vuelta por vértices cierra y respeta los radios', () => {
  const r = E.trazarRuta({ vertices: [{ x: -200, z: -200, r: 40 }, { x: 200, z: -200, r: 40 }, { x: 200, z: 200, r: 40 }, { x: -200, z: 200, r: 40 }], transicion: 0 });
  // un cuadrado de 400 m con esquinas de 40 m de radio: 4·(400 − 80) + 2π·40
  assert.ok(Math.abs(r.largo - (4 * 320 + 2 * Math.PI * 40)) < 6, 'largo ' + r.largo);
  assert.ok(r.error < 2, 'cierre ' + r.error);
  const c = { puntos: r.puntos, cerrado: true }, mu = E.muestrearCamino(c, 2);
  const k = E.curvaturas(mu, true, 12);
  const rmin = Math.min(...Array.from(k).map(v => 1 / Math.max(1e-9, Math.abs(v))));
  assert.ok(rmin > 30 && rmin < 50, 'radio mínimo ' + rmin);
  // con transiciones, la curvatura cambia poco a poco
  const r2 = E.trazarRuta({ vertices: [{ x: -200, z: -200, r: 40 }, { x: 200, z: -200, r: 40 }, { x: 200, z: 200, r: 40 }, { x: -200, z: 200, r: 40 }], transicion: 30 });
  assert.ok(r2.error < 4, 'cierre con transiciones ' + r2.error);
});

for (const id of Object.keys(E.CIRCUITOS)) {
  test('circuito diseñado ' + id + ': jugable', () => {
    const esc = E.crear({ plantilla: id });
    const c = esc.caminos.find(x => !E.esRio(x) && x.cerrado);
    assert.ok(c, 'tiene circuito cerrado');
    const mu = E.muestrearCamino(c, 4), total = mu[mu.length - 1].d;
    assert.ok(total > 2800 && total < 5000, 'largo ' + total);
    // salida, meta y 5 controles en orden a lo largo de la vuelta
    assert.ok(esc.elementos.some(e => e.tipo === 'inicio') && esc.elementos.some(e => e.tipo === 'meta'));
    const cps = esc.elementos.filter(e => e.tipo === 'checkpoint').sort((a, b) => a.props.orden - b.props.orden);
    assert.strictEqual(cps.length, 5);
    const dCp = cps.map(e => E.proyectarEnCamino(c, e.x, e.z, mu).d);
    for (let k = 1; k < dCp.length; k++) assert.ok(dCp[k] > dCp[k - 1], 'controles en orden: ' + dCp.map(Math.round));
    // la carretera no va por debajo del agua (salvo en los vados, que son de poca hondura)
    for (const m of mu) {
      const y = E.alturaCalzadaEn(esc, m.x, m.z).y, agua = E.aguaEn(esc, m.x, m.z);
      if (agua > y) assert.ok(agua - y < 0.55, `agua de ${(agua - y).toFixed(2)} m en d=${Math.round(m.d)}`);
    }
    // los puentes, con el tablero a la altura de la carretera que llega (sin rampas de salto)
    for (const b of E.puentesDeCamino(esc, c)) {
      for (const o of [-6, 6]) {
        const p = E.puntoEnD(mu, (o < 0 ? b.d0 : b.d1) + o, true);
        const y = E.alturaEn(esc, p.x, p.z);
        assert.ok(Math.abs(y - b.alto) < 1.2, `puente en d=${Math.round(b.d0)}: tablero ${b.alto.toFixed(1)}, carretera ${y.toFixed(1)}`);
      }
    }
    // los pueblos no pisan la carretera
    for (const pu of esc.elementos.filter(e => e.tipo === 'pueblo')) {
      assert.ok(!mu.some(m => E.dentroTerrenoPueblo(pu, m.x, m.z)), 'el pueblo ' + pu.nombre + ' no toca la pista');
    }
    // los árboles sueltos y las rocas no están en la calzada
    for (const el of esc.elementos.filter(e => e.tipo === 'arbol')) assert.ok(E.distanciaACamino(c, el.x, el.z, mu) > c.ancho / 2 + 2, 'árbol fuera de la pista');
  });
}
