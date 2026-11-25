// Visor de escenarios: muestra el escenario sin personaje ni misiones. Cámaras de órbita, vuelo, paseo y recorrido.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Escena3D } from './escena-3d.js';

const E = window.Escenario, A = window.Almacen;
const $ = id => document.getElementById(id);
const DEG = Math.PI / 180;

let esc = null, escena = null, modo = 'orbita';
const prefs = { pueblosReales: true, texturasSuelo: true, pradera: true, realistas: true, calidad: 'media', etiquetas: true, areas: false, fov: 60, vel: 22, camRec: 'persecucion', ciclo: false };
try { Object.assign(prefs, JSON.parse(localStorage.getItem('escenarios.visor') || '{}')); } catch (e) { /* nada */ }
const guardarPrefs = () => { try { localStorage.setItem('escenarios.visor', JSON.stringify(prefs)); } catch (e) { /* nada */ } };

// ---------------------------------------------------------------------------
// Three.js
// ---------------------------------------------------------------------------
const lienzo = $('lienzo');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, prefs.calidad === 'alta' ? 2 : 1.5));
renderer.shadowMap.enabled = prefs.calidad !== 'baja'; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
lienzo.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camara = new THREE.PerspectiveCamera(prefs.fov, 1, 0.3, 30000);
const orbita = new OrbitControls(camara, renderer.domElement);
orbita.enableDamping = true; orbita.maxPolarAngle = Math.PI * 0.495; orbita.screenSpacePanning = false;
function redimensionar() { const r = lienzo.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camara.aspect = r.width / Math.max(1, r.height); camara.updateProjectionMatrix(); }
new ResizeObserver(redimensionar).observe(lienzo);

function crearEscena() {
  if (escena) { scene.clear(); }
  escena = new Escena3D({
    scene, renderer, editor: false, calidad: prefs.calidad, arbolesRealistas: prefs.realistas, texturasSuelo: prefs.texturasSuelo, pueblosReales: prefs.pueblosReales,
    alAviso: t => setTimeout(() => aviso(t), 0), etiquetas: prefs.etiquetas, mostrarAreas: prefs.areas,
    cargarModeloLocal: id => A.cargarModelo(id),
    alCargar: n => { $('carga').hidden = !n; $('carga').textContent = '⏳ Cargando ' + n + ' modelo' + (n === 1 ? '' : 's') + '…'; }
  });
  escena.construir(esc);
  escena.setMostrarAreas(prefs.areas);
  escena.pradera.setVisible(prefs.pradera);
}

// ---------------------------------------------------------------------------
// Cámaras
// ---------------------------------------------------------------------------
const teclas = new Set();
const mirada = { yaw: 0, pitch: -0.15 };
const joy = { x: 0, y: 0, activo: false };
let subirBajar = 0;
let velVuelo = 30;
const rec = { muestras: null, d: 0, total: 0, camino: null };

const AYUDAS = {
  orbita: 'Arrastra para girar · botón derecho o dos dedos para desplazar · rueda o pellizco para acercar',
  vuelo: 'WASD / flechas para moverte · arrastra para mirar · Q/E bajar y subir · Shift rápido · rueda: velocidad',
  paseo: 'WASD / flechas para andar · arrastra para mirar · Shift para correr',
  recorrido: 'La cámara recorre el camino elegido en ⚙ Ajustes · Espacio pausa · ← → velocidad'
};
const AYUDAS_TACTIL = {
  orbita: 'Un dedo gira · dos dedos acercan y desplazan',
  vuelo: 'Joystick para moverte · arrastra para mirar · ▲ ▼ subir y bajar',
  paseo: 'Joystick para andar · arrastra para mirar',
  recorrido: 'Velocidad y cámara en ⚙'
};
function usarModo(m) {
  if (m === 'recorrido' && !esc.caminos.some(c => c.puntos.length >= 2)) { aviso('Este escenario no tiene caminos para recorrer'); return; }
  const antes = modo; modo = m;
  document.querySelectorAll('#modos button').forEach(b => b.classList.toggle('activa', b.dataset.modo === m));
  orbita.enabled = m === 'orbita';
  const tactil = matchMedia('(pointer: coarse)').matches;
  $('joystick').hidden = !(tactil && (m === 'vuelo' || m === 'paseo'));
  $('botones-altura').hidden = !(tactil && m === 'vuelo');
  $('ayuda-modo').textContent = tactil ? AYUDAS_TACTIL[m] : AYUDAS[m];
  if (m === 'orbita' && antes !== 'orbita') {
    const dir = new THREE.Vector3(); camara.getWorldDirection(dir);
    const p = escena.rayoTerreno(new THREE.Ray(camara.position.clone(), dir), true);
    orbita.target.copy(p || camara.position.clone().addScaledVector(dir, 80));
    orbita.update();
  }
  if (m === 'vuelo' || m === 'paseo') {
    const dir = new THREE.Vector3(); camara.getWorldDirection(dir);
    mirada.yaw = Math.atan2(-dir.x, -dir.z); mirada.pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    if (m === 'paseo') { mirada.pitch = Math.max(-0.5, Math.min(0.4, mirada.pitch)); if (antes === 'orbita') camara.position.copy(orbita.target); }
  }
  if (m === 'recorrido') prepararRecorrido();
}
document.querySelectorAll('#modos button').forEach(b => b.addEventListener('click', () => usarModo(b.dataset.modo)));

function prepararRecorrido() {
  const c = E.buscarCamino(esc, $('sel-camino').value) || esc.caminos.find(k => k.puntos.length >= 2);
  if (!c) return;
  rec.camino = c; rec.muestras = E.muestrearCamino(c, 1); rec.total = rec.muestras[rec.muestras.length - 1].d; rec.d = 0; rec.pausa = false;
  rec.ras = E.rasante(esc, rec.muestras, 4, c.cerrado);
  rec.suave = null;
}
function puntoEnD(d) {
  const mu = rec.muestras, n = mu.length;
  if (rec.camino.cerrado) d = ((d % rec.total) + rec.total) % rec.total; else d = THREE.MathUtils.clamp(d, 0, rec.total);
  let a = 0, b = n - 1;
  while (b - a > 1) { const m = (a + b) >> 1; if (mu[m].d < d) a = m; else b = m; }
  const t = (d - mu[a].d) / Math.max(1e-6, mu[b].d - mu[a].d);
  const x = THREE.MathUtils.lerp(mu[a].x, mu[b].x, t), z = THREE.MathUtils.lerp(mu[a].z, mu[b].z, t);
  return new THREE.Vector3(x, Math.max(E.sueloEn(esc, x, z), THREE.MathUtils.lerp(rec.ras[a], rec.ras[b], t)), z);
}
function actualizarRecorrido(dt) {
  if (!rec.muestras) return;
  if (!rec.pausa) rec.d += prefs.vel * dt;
  if (!rec.camino.cerrado && rec.d > rec.total) rec.d = 0;
  const p = puntoEnD(rec.d), delante = puntoEnD(rec.d + 12);
  let pos, mirar;
  if (prefs.camRec === 'baja') { pos = p.clone().add(new THREE.Vector3(0, 1.4, 0)); mirar = delante.clone().add(new THREE.Vector3(0, 1.0, 0)); }
  else if (prefs.camRec === 'dron') { const atras = puntoEnD(rec.d - 30); pos = atras.clone().add(new THREE.Vector3(0, 45, 0)); mirar = puntoEnD(rec.d + 20); }
  else { const atras = puntoEnD(rec.d - 10); pos = atras.clone().add(new THREE.Vector3(0, 4.5, 0)); pos.y = Math.max(pos.y, E.sueloEn(esc, pos.x, pos.z) + 2); mirar = delante.clone().add(new THREE.Vector3(0, 1.5, 0)); }
  if (!rec.suave) rec.suave = { pos: pos.clone(), mirar: mirar.clone() };
  const k = 1 - Math.exp(-dt * 6);
  rec.suave.pos.lerp(pos, k); rec.suave.mirar.lerp(mirar, k);
  camara.position.copy(rec.suave.pos); camara.lookAt(rec.suave.mirar);
}

function actualizarVuelo(dt) {
  const paseo = modo === 'paseo';
  const rapido = teclas.has('shift');
  const vel = paseo ? (rapido ? 12 : 5) : velVuelo * (rapido ? 3 : 1);
  let ax = 0, az = 0, ay = subirBajar;
  if (teclas.has('w') || teclas.has('arrowup')) az += 1;
  if (teclas.has('s') || teclas.has('arrowdown')) az -= 1;
  if (teclas.has('a') || teclas.has('arrowleft')) ax -= 1;
  if (teclas.has('d') || teclas.has('arrowright')) ax += 1;
  if (teclas.has('e') || teclas.has(' ')) ay += 1;
  if (teclas.has('q') || teclas.has('c')) ay -= 1;
  if (joy.activo) { ax += joy.x; az += -joy.y; }
  const fwd = new THREE.Vector3(-Math.sin(mirada.yaw), 0, -Math.cos(mirada.yaw));
  const der = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const mov = new THREE.Vector3();
  if (paseo) mov.addScaledVector(fwd, az).addScaledVector(der, ax);
  else { const f3 = new THREE.Vector3(); camara.getWorldDirection(f3); mov.addScaledVector(f3, az).addScaledVector(der, ax); mov.y += ay; }
  if (mov.lengthSq() > 1) mov.normalize();
  camara.position.addScaledVector(mov, vel * dt);
  const m = esc.terreno.tam / 2 * 1.4;
  camara.position.x = THREE.MathUtils.clamp(camara.position.x, -m, m); camara.position.z = THREE.MathUtils.clamp(camara.position.z, -m, m);
  const suelo = E.sueloEn(esc, camara.position.x, camara.position.z);
  if (paseo) {
    const objetivo = suelo + 1.7;
    camara.position.y += (objetivo - camara.position.y) * Math.min(1, dt * 12);
  } else camara.position.y = Math.max(camara.position.y, suelo + 1);
  camara.rotation.set(0, 0, 0, 'YXZ');
  camara.rotation.order = 'YXZ'; camara.rotation.y = mirada.yaw; camara.rotation.x = mirada.pitch;
}

// Mirar arrastrando (ratón o dedo fuera del joystick)
let arrastre = null;
renderer.domElement.addEventListener('pointerdown', e => { if (modo === 'vuelo' || modo === 'paseo') { arrastre = { id: e.pointerId, x: e.clientX, y: e.clientY }; renderer.domElement.setPointerCapture(e.pointerId); } });
renderer.domElement.addEventListener('pointermove', e => {
  if (!arrastre || e.pointerId !== arrastre.id) return;
  const s = e.pointerType === 'touch' ? 0.006 : 0.004;
  mirada.yaw -= (e.clientX - arrastre.x) * s; mirada.pitch -= (e.clientY - arrastre.y) * s;
  mirada.pitch = THREE.MathUtils.clamp(mirada.pitch, -1.5, 1.5);
  arrastre.x = e.clientX; arrastre.y = e.clientY;
});
const finArrastre = e => { if (arrastre && e.pointerId === arrastre.id) arrastre = null; };
renderer.domElement.addEventListener('pointerup', finArrastre);
renderer.domElement.addEventListener('pointercancel', finArrastre);
renderer.domElement.addEventListener('wheel', e => { if (modo === 'vuelo') { velVuelo = THREE.MathUtils.clamp(velVuelo * (e.deltaY > 0 ? 0.85 : 1.18), 2, 800); aviso('Velocidad de vuelo: ' + Math.round(velVuelo) + ' m/s'); } }, { passive: true });

// Joystick táctil
(function () {
  const base = $('joystick'), palanca = $('palanca');
  let id = null;
  const mover = e => {
    const r = base.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; }
    palanca.style.transform = `translate(${dx}px, ${dy}px)`;
    joy.x = dx / R; joy.y = dy / R; joy.activo = true;
  };
  base.addEventListener('pointerdown', e => { id = e.pointerId; base.setPointerCapture(id); mover(e); e.stopPropagation(); });
  base.addEventListener('pointermove', e => { if (e.pointerId === id) mover(e); });
  const fin = e => { if (e.pointerId !== id) return; id = null; joy.x = joy.y = 0; joy.activo = false; palanca.style.transform = ''; };
  base.addEventListener('pointerup', fin); base.addEventListener('pointercancel', fin);
  const sostener = (btn, v) => { btn.addEventListener('pointerdown', () => { subirBajar = v; }); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, () => { subirBajar = 0; }); };
  sostener($('btn-subir'), 1); sostener($('btn-bajar'), -1);
})();

window.addEventListener('keydown', e => {
  if (e.target.matches('input, select, textarea')) return;
  const k = e.key.toLowerCase();
  teclas.add(k);
  if (['1', '2', '3', '4'].includes(k)) usarModo(['orbita', 'vuelo', 'paseo', 'recorrido'][+k - 1]);
  if (k === 'p') captura();
  if (modo === 'recorrido') {
    if (k === ' ') { rec.pausa = !rec.pausa; e.preventDefault(); }
    if (k === 'arrowright') cambiarVel(prefs.vel + 4);
    if (k === 'arrowleft') cambiarVel(prefs.vel - 4);
  }
  if (k === ' ' && modo !== 'orbita') e.preventDefault();
});
window.addEventListener('keyup', e => teclas.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => teclas.clear());

// ---------------------------------------------------------------------------
// Bucle
// ---------------------------------------------------------------------------
let tPrev = performance.now(), tFoco = 0;
function bucle(t) {
  const dt = Math.min(0.05, (t - tPrev) / 1000); tPrev = t;
  if (esc && escena) {
    if (modo === 'orbita') orbita.update();
    else if (modo === 'recorrido') actualizarRecorrido(dt);
    else actualizarVuelo(dt);
    if (prefs.ciclo) { esc.ambiente.hora = (esc.ambiente.hora + dt * 0.25) % 24; escena.setHora(esc.ambiente.hora); $('inp-hora').value = esc.ambiente.hora; $('val-hora').textContent = fmtHora(esc.ambiente.hora); }
    escena.actualizar(dt, camara);
    tFoco += dt;
    if (tFoco > 0.25) {
      tFoco = 0;
      const foco = modo === 'orbita' ? orbita.target : camara.position;
      const alto = Math.max(0, camara.position.y - E.sueloEn(esc, camara.position.x, camara.position.z));
      escena.setFoco(foco.x, foco.z, THREE.MathUtils.clamp((modo === 'orbita' ? camara.position.distanceTo(orbita.target) : alto * 2 + 60) * 0.9, 50, 700));
    }
    renderer.render(scene, camara);
  }
  requestAnimationFrame(bucle);
}
requestAnimationFrame(bucle);

// ---------------------------------------------------------------------------
// Ajustes
// ---------------------------------------------------------------------------
const fmtHora = v => { const h = Math.floor(v), m = Math.round((v - h) * 60) % 60; return h + ':' + String(m).padStart(2, '0'); };
$('btn-ajustes').addEventListener('click', () => { $('ajustes').hidden = !$('ajustes').hidden; });
$('inp-hora').addEventListener('input', e => { esc.ambiente.hora = +e.target.value; escena.setHora(esc.ambiente.hora); $('val-hora').textContent = fmtHora(esc.ambiente.hora); });
$('inp-nubes').addEventListener('input', e => { esc.ambiente.nubes = +e.target.value; escena.setNubes(esc.ambiente.nubes); $('val-nubes').textContent = Math.round(esc.ambiente.nubes * 100) + '%'; });
$('chk-ciclo').addEventListener('change', e => { prefs.ciclo = e.target.checked; guardarPrefs(); });
$('inp-niebla').addEventListener('input', e => { esc.ambiente.niebla = +e.target.value; escena.setNiebla(esc.ambiente.niebla); $('val-niebla').textContent = Math.round(esc.ambiente.niebla * 100) + '%'; });
$('chk-etiquetas').addEventListener('change', e => { prefs.etiquetas = e.target.checked; guardarPrefs(); escena.o.etiquetas = prefs.etiquetas; escena.reconstruirElementos(); });
$('chk-areas').addEventListener('change', e => { prefs.areas = e.target.checked; guardarPrefs(); escena.o.mostrarAreas = prefs.areas; escena.reconstruirElementos(); escena.setMostrarAreas(prefs.areas); });
$('chk-pueblos').addEventListener('change', e => { prefs.pueblosReales = e.target.checked; guardarPrefs(); escena.setPueblosReales(prefs.pueblosReales); });
$('chk-texsuelo').addEventListener('change', e => { prefs.texturasSuelo = e.target.checked; guardarPrefs(); location.reload(); });
$('chk-pradera').addEventListener('change', e => { prefs.pradera = e.target.checked; guardarPrefs(); escena.pradera.setVisible(prefs.pradera); });
$('chk-realistas').addEventListener('change', e => { prefs.realistas = e.target.checked; guardarPrefs(); escena.o.arbolesRealistas = prefs.realistas; escena.reconstruirElementos(); });
$('sel-calidad').addEventListener('change', e => { prefs.calidad = e.target.value; guardarPrefs(); location.reload(); });
$('inp-fov').addEventListener('input', e => { prefs.fov = +e.target.value; camara.fov = prefs.fov; camara.updateProjectionMatrix(); $('val-fov').textContent = prefs.fov + '°'; guardarPrefs(); });
function cambiarVel(v) { prefs.vel = THREE.MathUtils.clamp(v, 2, 80); $('inp-vel').value = prefs.vel; $('val-vel').textContent = prefs.vel + ' m/s (' + Math.round(prefs.vel * 3.6) + ' km/h)'; guardarPrefs(); }
$('inp-vel').addEventListener('input', e => cambiarVel(+e.target.value));
$('sel-camara-rec').addEventListener('change', e => { prefs.camRec = e.target.value; rec.suave = null; guardarPrefs(); });
$('sel-camino').addEventListener('change', () => { if (modo === 'recorrido') prepararRecorrido(); else usarModo('recorrido'); });

function rellenarAjustes() {
  $('inp-hora').value = esc.ambiente.hora; $('val-hora').textContent = fmtHora(esc.ambiente.hora);
  const nb = esc.ambiente.nubes == null ? 0.4 : esc.ambiente.nubes; $('inp-nubes').value = nb; $('val-nubes').textContent = Math.round(nb * 100) + '%';
  $('inp-niebla').value = esc.ambiente.niebla; $('val-niebla').textContent = Math.round(esc.ambiente.niebla * 100) + '%';
  $('chk-ciclo').checked = prefs.ciclo; $('chk-realistas').checked = prefs.realistas; $('chk-pradera').checked = prefs.pradera; $('chk-texsuelo').checked = prefs.texturasSuelo; $('chk-pueblos').checked = prefs.pueblosReales; $('chk-etiquetas').checked = prefs.etiquetas; $('chk-areas').checked = prefs.areas;
  $('sel-calidad').value = prefs.calidad; $('inp-fov').value = prefs.fov; $('val-fov').textContent = prefs.fov + '°';
  $('sel-camara-rec').value = prefs.camRec; cambiarVel(prefs.vel);
  const caminos = esc.caminos.filter(c => c.puntos.length >= 2);
  $('sel-camino').innerHTML = caminos.length ? caminos.map(c => `<option value="${c.id}">${c.nombre.replace(/</g, '&lt;')}</option>`).join('') : '<option value="">(sin caminos)</option>';
  // Vistas: puntos de vista, inicio, pueblos, zonas, mazmorras
  const l = $('lista-vistas'); l.innerHTML = '';
  const vistas = esc.elementos.filter(e => ['camara', 'inicio', 'meta', 'pueblo', 'zona', 'mazmorra'].includes(e.tipo));
  if (!vistas.length) l.innerHTML = '<div class="vacio">Añade «Punto de vista» en el editor para guardar encuadres.</div>';
  for (const v of vistas) {
    const d = document.createElement('div'); d.className = 'item';
    d.innerHTML = `<span>${(E.TIPOS[v.tipo] || {}).icono || '•'}</span><span class="t"></span>`;
    d.querySelector('.t').textContent = v.nombre;
    const b = document.createElement('button'); b.textContent = 'Ir'; b.addEventListener('click', () => irA(v)); d.append(b);
    l.append(d);
  }
}
function irA(el) {
  const suelo = E.alturaEn(esc, el.x, el.z) + (el.y || 0);
  if (el.tipo === 'camara') {
    const a = (el.rotY || 0) * DEG, inc = el.props.inclinacion * DEG;
    usarModo('vuelo');
    camara.position.set(el.x, suelo + el.props.altura, el.z);
    // rotY 0 mira hacia +z (igual que en el editor)
    mirada.yaw = Math.atan2(-Math.sin(a), -Math.cos(a)); mirada.pitch = inc;
    return;
  }
  if (el.tipo === 'inicio') {
    usarModo('paseo');
    camara.position.set(el.x, suelo + 1.7, el.z);
    const a = (el.rotY || 0) * DEG; mirada.yaw = Math.atan2(-Math.sin(a), -Math.cos(a)); mirada.pitch = -0.05;
    return;
  }
  usarModo('orbita');
  const r = Math.max(30, E.radioElemento(el));
  orbita.target.set(el.x, suelo, el.z);
  camara.position.set(el.x + r * 1.2, suelo + r * 0.9, el.z + r * 1.2);
  orbita.update();
}

// ---------------------------------------------------------------------------
// Captura, abrir, editar
// ---------------------------------------------------------------------------
function captura() {
  renderer.render(scene, camara);
  renderer.domElement.toBlob(b => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(b);
    a.download = (esc.nombre || 'escenario').replace(/\s+/g, '-').toLowerCase() + '-' + Date.now() + '.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}
$('btn-captura').addEventListener('click', captura);
$('btn-editar').addEventListener('click', () => { location.href = 'index.html' + (esc ? '?id=' + encodeURIComponent(esc.id) : ''); });
$('btn-abrir').addEventListener('click', () => $('fichero').click());
$('fichero').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const { escenario, modelos } = E.deserializar(await f.text());
    for (const [id, b64] of Object.entries(modelos)) await A.guardarModelo(id, (escenario.glbs[id] || {}).nombre || id, E.base64ABytes(b64).buffer);
    mostrar(escenario);
  } catch (err) { alert('No se pudo abrir: ' + err.message); }
});

let toastT = 0;
function aviso(txt) {
  let t = $('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = txt; t.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { t.style.opacity = 0; }, 2200);
}

function mostrar(nuevo) {
  esc = nuevo;
  document.title = esc.nombre + ' · Visor';
  $('titulo').textContent = esc.nombre;
  crearEscena();
  rellenarAjustes();
  // Encuadre inicial: punto de vista, inicio o vista general
  const tam = esc.terreno.tam, r = E.rangoAlturas(esc);
  camara.far = Math.max(8000, tam * 10); camara.updateProjectionMatrix();
  orbita.maxDistance = tam * 3;
  orbita.target.set(0, Math.max(r.min, esc.terreno.agua.activa ? esc.terreno.agua.nivel : r.min), 0);
  camara.position.set(tam * 0.5, Math.max(tam * 0.35, r.max + 60), tam * 0.6);
  orbita.update();
  usarModo('orbita');
  const vista = esc.elementos.find(e => e.tipo === 'camara');
  if (vista) irA(vista);
}

(async function arrancar() {
  redimensionar();
  const id = new URLSearchParams(location.search).get('id') || localStorage.getItem('escenarios.actual');
  let datos = null;
  try { if (id) datos = await A.cargarEscenario(id); } catch (e) { console.error(e); }
  if (!datos) { try { const l = await A.listar(); if (l[0]) datos = await A.cargarEscenario(l[0].id); } catch (e) { /* nada */ } }
  if (datos) mostrar(E.deserializar(datos).escenario);
  else { mostrar(E.crear({ plantilla: 'rally', semilla: 4242, nombre: 'Circuito de ejemplo' })); aviso('No hay escenarios guardados: se muestra uno de ejemplo'); }
})();

// Acceso para depurar desde la consola
window.__visor = { get esc() { return esc; }, get escena() { return escena; }, camara, orbita, usarModo, mirada, THREE };
