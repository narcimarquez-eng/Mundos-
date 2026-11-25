// Editor de escenarios: terreno, pintura, caminos y elementos sobre un lienzo 3D.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { Escena3D } from './escena-3d.js';

const E = window.Escenario, A = window.Almacen, CAT = window.CatalogoRPG || [];
const $ = id => document.getElementById(id);
const DEG = Math.PI / 180;
const CLAVE_ACTUAL = 'escenarios.actual';
const RET_PUEBLO = 'escenarios.retornoPueblo', RET_MAZMORRA = 'escenarios.retornoMazmorra';

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------
let esc = null;
let herramienta = 'ver';
let pestana = 'herramienta';
let sel = null;                 // id de elemento o camino seleccionado
let caminoActivo = null;        // id del camino que se edita con la herramienta Caminos
const pincel = { modo: 'subir', radio: 25, fuerza: 0.6, material: 1, objetivo: 0, capa: 'suelo', veg: 'hierba', densidad: 0.7 };
const colocar = { tipo: 'arbol', props: {} };
const nuevoCamino = { tipo: 'tierra', ancho: 6, bordes: false };
const nuevaBarrera = { tipo: 'cinta', lado: 'ambos', separacion: 2, tramo: 'asfalto' };
let marcar = null; // { que: 'tramo'|'barrera', d0, lado } mientras se marcan dos puntos del camino
let modoTransform = 'translate';
const deshacer = [], rehacer = [];

// ---------------------------------------------------------------------------
// Three.js
// ---------------------------------------------------------------------------
const lienzo = $('lienzo');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
lienzo.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camara = new THREE.PerspectiveCamera(55, 1, 0.5, 30000);
const orbita = new OrbitControls(camara, renderer.domElement);
orbita.enableDamping = true; orbita.dampingFactor = 0.12; orbita.maxPolarAngle = Math.PI * 0.495; orbita.screenSpacePanning = false;
const tc = new TransformControls(camara, renderer.domElement);
scene.add(tc.getHelper());

let pendientesCarga = 0;
const escena = new Escena3D({
  scene, renderer, editor: true, calidad: 'media',
  cargarModeloLocal: id => A.cargarModelo(id),
  alCargar: n => { pendientesCarga = n; const s = $('est-carga'); s.hidden = !n; s.textContent = '⏳ Cargando ' + n + ' modelo' + (n === 1 ? '' : 's'); },
  alCambiar: () => { if (sel) marcarSeleccion(); },
  alAviso: t => setTimeout(() => aviso(t), 0),
  pueblosReales: (() => { try { return localStorage.getItem('escenarios.pueblosReales') !== '0'; } catch (e) { return true; } })()
});

// Cursor del pincel (aro sobre el terreno)
const cursor = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffd690', depthTest: false, transparent: true }));
cursor.renderOrder = 20; cursor.visible = false; scene.add(cursor);
function dibujarCursor(p, r) {
  const n = 64, pts = [];
  for (let k = 0; k <= n; k++) { const a = k / n * Math.PI * 2, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; pts.push(x, E.sueloEn(esc, x, z) + 0.4, z); }
  cursor.geometry.dispose(); cursor.geometry = new THREE.BufferGeometry(); cursor.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  cursor.visible = true;
}
// Caja de la selección
const cajaSel = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color('#ffd690'));
cajaSel.visible = false; scene.add(cajaSel);
// Puntos de control del camino activo
const gAsas = new THREE.Group(); scene.add(gAsas);

function redimensionar() {
  const r = lienzo.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camara.aspect = r.width / Math.max(1, r.height); camara.updateProjectionMatrix();
}
new ResizeObserver(redimensionar).observe(lienzo);

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------
let toastT = 0;
function aviso(txt) {
  let t = $('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = txt; t.style.opacity = 1;
  clearTimeout(toastT); toastT = setTimeout(() => { t.style.opacity = 0; }, 2600);
}

// ---------------------------------------------------------------------------
// Cargar, guardar, deshacer
// ---------------------------------------------------------------------------
let guardarT = 0;
function programarGuardado() {
  clearTimeout(guardarT);
  $('est-msg').textContent = '● sin guardar';
  guardarT = setTimeout(guardarYa, 900);
}
async function guardarYa() {
  clearTimeout(guardarT);
  if (!esc) return;
  try {
    await A.guardarEscenario(E.serializar(esc));
    localStorage.setItem(CLAVE_ACTUAL, esc.id);
    $('est-msg').textContent = '✓ guardado';
  } catch (e) { console.error(e); $('est-msg').textContent = '⚠ no se pudo guardar'; aviso('No se pudo guardar: ' + e.message); }
}
function instantanea() {
  const t = esc.terreno;
  const resto = Object.assign({}, esc, { terreno: Object.assign({}, t, { alturas: null, materiales: null }) });
  resto.terreno.vegetacion = null;
  return { json: JSON.stringify(resto), alturas: t.alturas.slice(), materiales: t.materiales.slice(), vegetacion: t.vegetacion.slice() };
}
function restaurar(s) {
  const o = JSON.parse(s.json);
  o.terreno.alturas = s.alturas.slice(); o.terreno.materiales = s.materiales.slice(); o.terreno.vegetacion = s.vegetacion.slice();
  esc = o;
  tc.detach();
  if (sel && !E.buscarElemento(esc, sel) && !E.buscarCamino(esc, sel)) sel = null;
  if (caminoActivo && !E.buscarCamino(esc, caminoActivo)) caminoActivo = null;
  escena.construir(esc);
  if (sel) seleccionar(sel);
  refrescarTodo();
  programarGuardado();
}
function puntoDeshacer() {
  deshacer.push(instantanea());
  if (deshacer.length > 40) deshacer.shift();
  rehacer.length = 0;
  actualizarBotonesDeshacer();
}
function hacerDeshacer() { if (!deshacer.length) return; rehacer.push(instantanea()); restaurar(deshacer.pop()); actualizarBotonesDeshacer(); }
function hacerRehacer() { if (!rehacer.length) return; deshacer.push(instantanea()); restaurar(rehacer.pop()); actualizarBotonesDeshacer(); }
function actualizarBotonesDeshacer() { $('btn-deshacer').disabled = !deshacer.length; $('btn-rehacer').disabled = !rehacer.length; }

function abrirEscenario(nuevo, encuadrar) {
  esc = nuevo;
  deshacer.length = 0; rehacer.length = 0; actualizarBotonesDeshacer();
  sel = null; caminoActivo = null; tc.detach();
  escena.construir(esc);
  if (encuadrar !== false) encuadre();
  refrescarTodo();
  localStorage.setItem(CLAVE_ACTUAL, esc.id);
  history.replaceState(null, '', '?id=' + encodeURIComponent(esc.id));
}
function encuadre() {
  const tam = esc.terreno.tam, r = E.rangoAlturas(esc);
  orbita.target.set(0, Math.max(0, (r.min + r.max) / 2 * 0.3), 0);
  camara.position.set(tam * 0.55, Math.max(tam * 0.45, r.max + 50), tam * 0.65);
  camara.far = Math.max(8000, tam * 8); camara.updateProjectionMatrix();
  orbita.maxDistance = tam * 3;
  orbita.update();
}
function enfocar(x, z, dist) {
  const y = E.sueloEn(esc, x, z);
  const dir = camara.position.clone().sub(orbita.target).normalize();
  orbita.target.set(x, y, z);
  camara.position.copy(orbita.target).addScaledVector(dir, dist || 60);
  orbita.update();
}

// ---------------------------------------------------------------------------
// Selección
// ---------------------------------------------------------------------------
function seleccionar(id) {
  sel = id;
  tc.detach();
  const el = id && E.buscarElemento(esc, id);
  if (el && herramienta === 'ver') {
    const def = E.TIPOS[el.tipo] || {};
    const g = escena.objetos.get(el.id);
    if (g) { tc.attach(g); ajustarTransform(def); }
  }
  if (id && E.buscarCamino(esc, id)) { caminoActivo = id; if (herramienta !== 'caminos') usarHerramienta('caminos'); }
  marcarSeleccion();
  $('modos-transform').hidden = !(el && herramienta === 'ver');
  if (id && pestana !== 'seleccion' && el) mostrarPestana('seleccion');
  else renderPanel();
}
function ajustarTransform(def) {
  const area = def.forma === 'area';
  let modo = modoTransform;
  if (area && modo === 'scale') modo = 'translate';
  tc.setMode(modo);
  tc.showX = tc.showZ = modo !== 'rotate';
  tc.showY = true;
  tc.setSpace(modo === 'translate' ? 'world' : 'local');
  document.querySelectorAll('#modos-transform button').forEach(b => { b.classList.toggle('activa', b.dataset.m === modo); b.disabled = area && b.dataset.m !== 'translate'; });
}
function marcarSeleccion() {
  const el = sel && E.buscarElemento(esc, sel);
  const g = el && escena.objetos.get(el.id);
  if (g) { cajaSel.box.setFromObject(g); cajaSel.visible = !cajaSel.box.isEmpty(); if (!cajaSel.visible || (E.TIPOS[el.tipo] || {}).forma === 'area') cajaSel.visible = false; }
  else cajaSel.visible = false;
  dibujarAsas();
}
tc.addEventListener('dragging-changed', e => {
  orbita.enabled = !e.value;
  if (e.value) puntoDeshacer();
  else {
    const el = sel && E.buscarElemento(esc, sel);
    if (el) { escena.actualizarElemento(el); const g = escena.objetos.get(el.id); tc.attach(g); marcarSeleccion(); renderPanel(); programarGuardado(); }
  }
});
tc.addEventListener('objectChange', () => {
  const el = sel && E.buscarElemento(esc, sel);
  const g = tc.object;
  if (!el || !g) return;
  if (tc.mode === 'translate') {
    el.x = E.clamp(g.position.x, -esc.terreno.tam / 2, esc.terreno.tam / 2);
    el.z = E.clamp(g.position.z, -esc.terreno.tam / 2, esc.terreno.tam / 2);
    const suelo = E.alturaEn(esc, el.x, el.z);
    if (tc.axis && tc.axis.includes('Y')) el.y = Math.round((g.position.y - suelo) * 100) / 100;
    g.position.set(el.x, suelo + (el.y || 0), el.z);
  } else if (tc.mode === 'rotate') {
    el.rotY = Math.round(g.rotation.y / DEG * 10) / 10;
  } else if (tc.mode === 'scale') {
    const s = [g.scale.x, g.scale.y, g.scale.z].reduce((a, b) => Math.abs(b - el.escala) > Math.abs(a - el.escala) ? b : a, el.escala);
    el.escala = Math.max(0.01, Math.round(s * 100) / 100);
    g.scale.setScalar(el.escala);
  }
  if (el.tipo === 'arbol') escena.colocar(el, g); // los árboles con modelo se mueven con la vegetación
  if (g.userData.aro) { g.userData.aro.visible = false; }
  marcarSeleccion();
  actualizarCamposPosicion();
});
document.querySelectorAll('#modos-transform button').forEach(b => b.addEventListener('click', () => { modoTransform = b.dataset.m; const el = sel && E.buscarElemento(esc, sel); if (el) ajustarTransform(E.TIPOS[el.tipo] || {}); }));

// ---------------------------------------------------------------------------
// Herramientas y entrada en el lienzo
// ---------------------------------------------------------------------------
function usarHerramienta(h) {
  herramienta = h;
  document.querySelectorAll('#herramientas button').forEach(b => b.classList.toggle('activa', b.dataset.h === h));
  const ver = h === 'ver';
  orbita.mouseButtons = { LEFT: ver ? THREE.MOUSE.ROTATE : null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: ver ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE };
  orbita.touches = { ONE: ver ? THREE.TOUCH.ROTATE : null, TWO: ver ? THREE.TOUCH.DOLLY_PAN : THREE.TOUCH.DOLLY_ROTATE };
  cursor.visible = false;
  if (h !== 'caminos') caminoActivo = null;
  marcar = null;
  if (h !== 'ver') { tc.detach(); $('modos-transform').hidden = true; }
  else if (sel) seleccionar(sel);
  dibujarAsas();
  verVegetacion();
  mostrarPestana('herramienta');
}
document.querySelectorAll('#herramientas button').forEach(b => b.addEventListener('click', () => usarHerramienta(b.dataset.h)));

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function rayoDesde(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camara);
  return raycaster;
}
function puntoTerreno(ev, conAgua) { return escena.rayoTerreno(rayoDesde(ev).ray, conAgua); }
function aPantalla(x, y, z) {
  const v = new THREE.Vector3(x, y, z).project(camara), r = renderer.domElement.getBoundingClientRect();
  return { x: (v.x + 1) / 2 * r.width + r.left, y: (1 - v.y) / 2 * r.height + r.top, detras: v.z > 1 };
}

const punteros = new Map();
let trazo = null;     // pincel en marcha: { ultimo, region }
let pulsado = null;   // { x, y, boton, t, ev }
let arrastreAsa = null;

renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
renderer.domElement.addEventListener('pointerdown', ev => {
  punteros.set(ev.pointerId, ev);
  if (punteros.size > 1) { terminarTrazo(); pulsado = null; arrastreAsa = null; return; }
  pulsado = { x: ev.clientX, y: ev.clientY, boton: ev.button, t: performance.now() };
  if (tc.dragging || (tc.axis && herramienta === 'ver')) { pulsado = null; return; }
  if (ev.button !== 0) return;
  if (herramienta === 'esculpir' || herramienta === 'pintar') {
    const p = puntoTerreno(ev);
    if (!p) return;
    puntoDeshacer();
    trazo = { punto: p, region: null, objetivo: pincel.modo === 'aplanar' ? E.alturaEn(esc, p.x, p.z) : pincel.objetivo };
    renderer.domElement.setPointerCapture(ev.pointerId);
  } else if (herramienta === 'caminos') {
    const asa = asaCerca(ev);
    if (asa) { puntoDeshacer(); arrastreAsa = asa; renderer.domElement.setPointerCapture(ev.pointerId); }
  }
});
renderer.domElement.addEventListener('pointermove', ev => {
  if (punteros.has(ev.pointerId)) punteros.set(ev.pointerId, ev);
  const p = puntoTerreno(ev, true);
  $('est-pos').textContent = p ? `x ${p.x.toFixed(1)}  z ${p.z.toFixed(1)}  ·  altura ${E.alturaEn(esc, p.x, p.z).toFixed(1)} m` : '—';
  if (herramienta === 'esculpir' || herramienta === 'pintar') { if (p) dibujarCursor(p, pincel.radio); else cursor.visible = false; }
  else if (herramienta === 'colocar') {
    const def = E.TIPOS[colocar.tipo];
    if (p && def && def.forma === 'area') dibujarCursor(p, colocar.props.radio || def.radioDefecto || def.props.radio || 20); else cursor.visible = false;
  }
  if (trazo && p) trazo.punto = p;
  if (arrastreAsa && p) {
    const c = E.buscarCamino(esc, arrastreAsa.camino);
    if (c) { c.puntos[arrastreAsa.i] = { x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10 }; escena.construirCaminos(); dibujarAsas(); }
  }
});
function finPuntero(ev) {
  const estaba = punteros.has(ev.pointerId);
  punteros.delete(ev.pointerId);
  if (trazo) terminarTrazo();
  if (arrastreAsa) { arrastreAsa = null; terminarEdicionCamino(); return; }
  if (!estaba || !pulsado) return;
  const mov = Math.hypot(ev.clientX - pulsado.x, ev.clientY - pulsado.y);
  const boton = pulsado.boton; pulsado = null;
  if (mov > 6 || ev.type === 'pointercancel') return;
  clic(ev, boton);
}
renderer.domElement.addEventListener('pointerup', finPuntero);
renderer.domElement.addEventListener('pointercancel', finPuntero);
renderer.domElement.addEventListener('pointerleave', () => { if (!trazo) cursor.visible = false; });
renderer.domElement.addEventListener('dblclick', () => { if (herramienta === 'caminos' && caminoActivo) { caminoActivo = null; dibujarAsas(); renderPanel(); aviso('Camino terminado'); } });

function aplicarPincel(dt) {
  if (!trazo || !trazo.punto) return;
  const p = trazo.punto;
  let reg;
  if (herramienta === 'esculpir') {
    const escalaF = pincel.modo === 'subir' || pincel.modo === 'bajar' || pincel.modo === 'ruido' ? pincel.fuerza * Math.max(4, pincel.radio * 0.35) * dt * 2.5 : Math.min(1, pincel.fuerza * dt * 6);
    reg = E.esculpir(esc, { modo: pincel.modo, x: p.x, z: p.z, radio: pincel.radio, fuerza: escalaF, objetivo: trazo.objetivo, semilla: 7 });
    escena.actualizarTerreno(reg);
  } else if (pincel.capa === 'vegetacion') {
    reg = E.pintarVegetacion(esc, { x: p.x, z: p.z, radio: pincel.radio, tipo: pincel.veg, densidad: pincel.densidad });
    escena.actualizarTerreno(reg, true);
  } else {
    reg = E.pintar(esc, { x: p.x, z: p.z, radio: pincel.radio, material: pincel.material });
    escena.actualizarTerreno(reg, true);
  }
  trazo.region = unirRegiones(trazo.region, reg);
  dibujarCursor(p, pincel.radio);
}
function unirRegiones(a, b) { if (!a) return Object.assign({}, b); return { i0: Math.min(a.i0, b.i0), i1: Math.max(a.i1, b.i1), j0: Math.min(a.j0, b.j0), j1: Math.max(a.j1, b.j1) }; }
function terminarTrazo() {
  if (!trazo) return;
  const reg = trazo.region; trazo = null;
  if (!reg) return;
  if (herramienta === 'esculpir') {
    escena.actualizarTerreno(); // recalcula el rango de alturas y los colores automáticos
    if (esc.terreno.agua.activa) escena.construirAgua();
    tocarZona(reg);
  }
  programarGuardado();
}
// Tras cambiar el terreno en una región, recoloca lo que queda encima
function tocarZona(reg) {
  const p = E.paso(esc), m = esc.terreno.tam / 2;
  const x0 = -m + reg.i0 * p, x1 = -m + reg.i1 * p, z0 = -m + reg.j0 * p, z1 = -m + reg.j1 * p;
  escena.construirCaminos();
  for (const el of esc.elementos) {
    const r = E.radioElemento(el);
    if (el.x + r < x0 || el.x - r > x1 || el.z + r < z0 || el.z - r > z1) continue;
    escena.actualizarElemento(el);
  }
  if (sel) { const g = escena.objetos.get(sel); if (g && herramienta === 'ver') tc.attach(g); }
  marcarSeleccion();
}

function clic(ev, boton) {
  const p = puntoTerreno(ev, true);
  if (herramienta === 'ver') {
    const hit = escena.rayoElemento(rayoDesde(ev));
    if (hit) return seleccionar(hit.id);
    const cam = raycaster.intersectObjects(escena.gCaminos.children, false)[0];
    if (cam) return seleccionar(cam.object.userData.caminoId);
    const area = p && areaEn(p.x, p.z);
    return seleccionar(area ? area.id : null);
  }
  if (herramienta === 'borrar') {
    const hit = escena.rayoElemento(rayoDesde(ev));
    const cam = !hit && raycaster.intersectObjects(escena.gCaminos.children, false)[0];
    const area = !hit && !cam && p && areaEn(p.x, p.z, ['bosque', 'rocas', 'lago']);
    const id = hit ? hit.id : cam ? cam.object.userData.caminoId : area ? area.id : null;
    if (!id) return;
    puntoDeshacer();
    borrar(id);
    return;
  }
  if (herramienta === 'colocar') {
    if (!p) return;
    const def = E.TIPOS[colocar.tipo];
    if ((colocar.tipo === 'glb' || colocar.tipo === 'enemigo') && !colocar.props.modelo) { elegirModelo(colocar.tipo === 'enemigo' ? 'enemigos' : null).then(r => { if (r) { colocar.props.modelo = r; renderPanel(); } }); return; }
    puntoDeshacer();
    const el = E.crearElemento(esc, colocar.tipo, Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10, E.copiaProfunda(colocar.props));
    if (esc.terreno.agua.activa && E.alturaEn(esc, p.x, p.z) < esc.terreno.agua.nivel && def.forma !== 'area') el.y = Math.round((esc.terreno.agua.nivel - E.alturaEn(esc, p.x, p.z)) * 10) / 10;
    if (el.tipo === 'pueblo') { const reg = E.prepararPueblo(esc, el); escena.actualizarTerreno(); tocarZona(reg); }
    if (el.tipo === 'lago') excavarLago(el, false);
    escena.actualizarElemento(el);
    sel = el.id; marcarSeleccion();
    programarGuardado();
    renderPanel();
    return;
  }
  if (herramienta === 'caminos') {
    if (marcar && boton === 0) return clicMarcar(p);
    const asa = asaCerca(ev);
    if (asa && boton === 2) { // clic derecho en un punto: quitarlo
      const c = E.buscarCamino(esc, asa.camino);
      puntoDeshacer(); c.puntos.splice(asa.i, 1);
      if (c.puntos.length === 0) { E.quitar(esc, c.id); caminoActivo = null; }
      terminarEdicionCamino(); return;
    }
    if (boton !== 0 || !p) return;
    if (asa) return;
    // ¿Clic sobre un camino que no es el activo? → activarlo
    const cam = raycaster.intersectObjects(escena.gCaminos.children, false)[0];
    if (cam && cam.object.userData.caminoId !== caminoActivo) { caminoActivo = cam.object.userData.caminoId; sel = caminoActivo; dibujarAsas(); renderPanel(); return; }
    puntoDeshacer();
    let c = caminoActivo && E.buscarCamino(esc, caminoActivo);
    if (!c) { c = E.crearCamino(esc, { tipo: nuevoCamino.tipo, ancho: nuevoCamino.ancho, bordes: nuevoCamino.bordes }); caminoActivo = c.id; sel = c.id; }
    const pt = { x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10 };
    // Si el clic cae sobre el propio camino, se inserta un punto en ese tramo
    const tramo = cam ? tramoCercano(c, pt) : -1;
    if (tramo >= 0) c.puntos.splice(tramo + 1, 0, pt); else c.puntos.push(pt);
    terminarEdicionCamino();
  }
}
// Área (bosque, zona, pueblo…) que contiene el punto: la más pequeña. Los árboles de un bosque no se tocan uno a uno.
function areaEn(x, z, tipos) {
  let mejor = null;
  for (const el of esc.elementos) {
    const def = E.TIPOS[el.tipo];
    if (!def || def.forma !== 'area' || (tipos && !tipos.includes(el.tipo))) continue;
    const r = el.props.radio || 0;
    if (Math.hypot(el.x - x, el.z - z) <= r && (!mejor || r < mejor.props.radio)) mejor = el;
  }
  return mejor;
}
function tramoCercano(c, p) {
  let best = -1, bd = Infinity;
  const n = c.puntos.length, segs = c.cerrado ? n : n - 1;
  for (let k = 0; k < segs; k++) {
    const a = c.puntos[k], b = c.puntos[(k + 1) % n];
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
    const t = E.clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / l2, 0, 1);
    const d = Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
    if (d < bd) { bd = d; best = k; }
  }
  return bd < c.ancho * 3 ? best : -1;
}
function terminarEdicionCamino() { escena.construirCaminos(); dibujarAsas(); renderPanel(); programarGuardado(); }
function dibujarAsas() {
  for (const o of gAsas.children.slice()) { gAsas.remove(o); o.geometry.dispose(); }
  const c = herramienta === 'caminos' && caminoActivo && E.buscarCamino(esc, caminoActivo);
  if (!c) return;
  const tam = Math.max(1.2, c.ancho * 0.28);
  c.puntos.forEach((p, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(tam, 14, 10), new THREE.MeshBasicMaterial({ color: i === 0 ? '#3fb67a' : i === c.puntos.length - 1 ? '#e0a43a' : '#ffffff', depthTest: false, transparent: true, opacity: 0.9 }));
    m.position.set(p.x, E.sueloEn(esc, p.x, p.z) + tam, p.z); m.renderOrder = 30;
    gAsas.add(m);
  });
}
function asaCerca(ev) {
  const c = caminoActivo && E.buscarCamino(esc, caminoActivo);
  if (!c) return null;
  let best = null, bd = 18;
  c.puntos.forEach((p, i) => { const s = aPantalla(p.x, E.sueloEn(esc, p.x, p.z) + 1, p.z); if (s.detras) return; const d = Math.hypot(s.x - ev.clientX, s.y - ev.clientY); if (d < bd) { bd = d; best = { camino: c.id, i }; } });
  return best;
}

function borrar(id) {
  const el = E.buscarElemento(esc, id);
  E.quitar(esc, id);
  if (el) escena.quitarElemento(id); else escena.construirCaminos();
  if (sel === id) seleccionar(null);
  if (caminoActivo === id) { caminoActivo = null; dibujarAsas(); }
  programarGuardado();
  renderPanel();
  aviso('Borrado');
}
function excavarLago(el, conDeshacer) {
  if (conDeshacer) puntoDeshacer();
  const suelo = E.alturaEn(esc, el.x, el.z);
  const reg = E.allanarArea(esc, el.x, el.z, el.props.radio * 0.85, suelo + (el.props.nivel || 0) - 2.5, el.props.radio * 0.3).region;
  // la posición del agua queda relativa al nuevo suelo del centro
  el.props.nivel = Math.round((suelo + (el.props.nivel || 0) - E.alturaEn(esc, el.x, el.z)) * 10) / 10;
  escena.actualizarTerreno(); tocarZona(reg);
  programarGuardado();
}

// ---------------------------------------------------------------------------
// Bucle
// ---------------------------------------------------------------------------
let tPrev = performance.now(), tFoco = 0;
function bucle(t) {
  const dt = Math.min(0.05, (t - tPrev) / 1000); tPrev = t;
  if (esc) {
    // Si el objeto de la selección se ha reconstruido, el control de mover pasa al nuevo
    if (tc.object && !tc.object.parent) { const g = sel && escena.objetos.get(sel); if (g && herramienta === 'ver') tc.attach(g); else tc.detach(); }
    aplicarPincel(dt);
    orbita.update();
    escena.actualizar(dt, camara);
    tFoco += dt;
    if (tFoco > 0.4) {
      tFoco = 0;
      const dist = camara.position.distanceTo(orbita.target);
      escena.setFoco(orbita.target.x, orbita.target.z, E.clamp(dist * 0.9, 60, 900));
    }
    renderer.render(scene, camara);
  }
  requestAnimationFrame(bucle);
}
requestAnimationFrame(bucle);

// ---------------------------------------------------------------------------
// Panel lateral
// ---------------------------------------------------------------------------
const cuerpo = $('panel-cuerpo');
function mostrarPestana(p) {
  pestana = p;
  document.querySelectorAll('#pestanas button').forEach(b => b.classList.toggle('activa', b.dataset.p === p));
  renderPanel();
}
document.querySelectorAll('#pestanas button').forEach(b => b.addEventListener('click', () => { mostrarPestana(b.dataset.p); abrirPanelMovil(); }));
function refrescarTodo() { $('inp-nombre').value = esc.nombre; document.title = esc.nombre + ' · Creador de Escenarios'; marcarSeleccion(); renderPanel(); }
function renderPanel() {
  if (!esc) return;
  cuerpo.innerHTML = '';
  if (pestana === 'herramienta') panelHerramienta();
  else if (pestana === 'seleccion') panelSeleccion();
  else panelEscenario();
}

// Pequeñas fábricas de controles
function h(tag, attrs, ...hijos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
    else if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of hijos.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
const titulo = t => h('h3', null, t);
const ayuda = html => h('p', { class: 'ayuda', html });
function botones(...bs) { return h('div', { class: 'botones' }, bs); }
function boton(txt, fn, cls, title) { return h('button', { class: cls, title, on: { click: fn } }, txt); }
function deslizador(n, valor, min, max, pasoV, fn, fmt) {
  const val = h('span', { class: 'val' }, fmt ? fmt(valor) : valor);
  const inp = h('input', { type: 'range', min, max, step: pasoV, value: valor });
  inp.addEventListener('input', () => { const v = parseFloat(inp.value); val.textContent = fmt ? fmt(v) : v; fn(v, false); });
  inp.addEventListener('change', () => fn(parseFloat(inp.value), true));
  return h('div', { class: 'campo' }, h('label', null, n), val, inp);
}
function numero(n, valor, min, max, pasoV, fn) {
  const inp = h('input', { type: 'number', min, max, step: pasoV || 'any', value: valor });
  inp.addEventListener('change', () => { let v = parseFloat(inp.value); if (isNaN(v)) return; if (min != null) v = Math.max(min, v); if (max != null) v = Math.min(max, v); inp.value = v; fn(v); });
  return h('div', { class: 'campo' }, h('label', null, n), inp);
}
function selector(n, valor, opciones, fn) {
  const s = h('select', null, opciones.map(([v, t]) => h('option', { value: v, selected: String(v) === String(valor) }, t)));
  s.addEventListener('change', () => fn(s.value));
  return h('div', { class: 'campo' }, h('label', null, n), s);
}
function casilla(n, valor, fn) {
  const c = h('input', { type: 'checkbox', checked: !!valor });
  c.addEventListener('change', () => fn(c.checked));
  return h('div', { class: 'campo' }, h('label', null, n), c);
}
function texto(n, valor, fn, area) {
  const i = h(area ? 'textarea' : 'input', area ? { rows: 3 } : { type: 'text', value: valor || '' });
  if (area) i.value = valor || '';
  i.addEventListener('change', () => fn(i.value));
  return h('div', { class: 'campo' }, h('label', null, n), i);
}
function color(n, valor, fn) {
  const c = h('input', { type: 'color', value: valor || '#888888' });
  c.addEventListener('input', () => fn(c.value, false));
  c.addEventListener('change', () => fn(c.value, true));
  return h('div', { class: 'campo' }, h('label', null, n), c);
}
function segmentado(opciones, valor, fn) {
  return h('div', { class: 'seg' }, opciones.map(([v, t, title]) => h('button', { class: v === valor ? 'activa' : '', title, on: { click: () => fn(v) } }, t)));
}

// --- Pestaña Herramienta ---
function panelHerramienta() {
  const f = {
    ver: panelVer, esculpir: panelEsculpir, pintar: panelPintar, caminos: panelCaminos, colocar: panelColocar,
    borrar: () => cuerpo.append(titulo('🗑 Borrar'), ayuda('Toca un elemento o un camino para quitarlo. <kbd>Ctrl+Z</kbd> deshace.'))
  }[herramienta];
  f();
}
function panelVer() {
  cuerpo.append(titulo('👆 Ver y seleccionar'),
    ayuda('<b>Ratón:</b> arrastra para girar, botón derecho para desplazar, rueda para acercar. <b>Táctil:</b> un dedo gira, dos dedos acercan y desplazan.'),
    ayuda('Toca un elemento para seleccionarlo y moverlo con las flechas. <kbd>G</kbd> mover · <kbd>R</kbd> girar · <kbd>S</kbd> escalar · <kbd>F</kbd> enfocar · <kbd>Ctrl+D</kbd> duplicar · <kbd>Supr</kbd> borrar.'));
  listaElementos();
}
function listaElementos() {
  cuerpo.append(titulo('Contenido (' + esc.elementos.length + ' elementos, ' + esc.caminos.length + ' caminos)'));
  const lista = h('div', { class: 'lista' });
  const todos = esc.elementos.map(e => ({ id: e.id, ico: (E.TIPOS[e.tipo] || {}).icono || '•', n: e.nombre, s: (E.TIPOS[e.tipo] || {}).nombre || e.tipo }))
    .concat(esc.caminos.map(c => ({ id: c.id, ico: '🛣', n: c.nombre, s: 'Camino · ' + c.puntos.length + ' puntos' })));
  if (!todos.length) lista.append(h('div', { class: 'vacio' }, 'Lienzo vacío. Usa ➕ Colocar o 🛣 Caminos.'));
  for (const t of todos.slice(0, 400)) {
    lista.append(h('div', { class: 'item' + (t.id === sel ? ' sel' : '') }, h('span', null, t.ico), h('span', { class: 't' }, t.n, h('small', null, t.s)),
      boton('◎', () => { const el = E.buscarElemento(esc, t.id); if (el) { enfocar(el.x, el.z, Math.max(40, E.radioElemento(el) * 3)); seleccionar(el.id); } else { const c = E.buscarCamino(esc, t.id); if (c && c.puntos[0]) enfocar(c.puntos[0].x, c.puntos[0].z, 80); seleccionar(t.id); } }, '', 'Ir')));
  }
  cuerpo.append(lista);
}
function panelEsculpir() {
  cuerpo.append(titulo('⛰ Esculpir el relieve'),
    segmentado([['subir', '⬆ Subir'], ['bajar', '⬇ Bajar'], ['suavizar', '〰 Suavizar'], ['aplanar', '▭ Aplanar', 'Aplana a la altura donde empiezas'], ['nivel', '📏 A nivel', 'Lleva el terreno a una altura fija'], ['ruido', '✳ Rugoso']],
      pincel.modo, v => { pincel.modo = v; renderPanel(); }),
    deslizador('Radio', pincel.radio, 2, Math.max(60, Math.round(esc.terreno.tam / 6)), 1, v => { pincel.radio = v; }, v => v + ' m'),
    deslizador('Fuerza', pincel.fuerza, 0.05, 1, 0.05, v => { pincel.fuerza = v; }, v => Math.round(v * 100) + '%'));
  if (pincel.modo === 'nivel') cuerpo.append(numero('Altura objetivo (m)', pincel.objetivo, -500, 2000, 0.5, v => { pincel.objetivo = v; }));
  cuerpo.append(ayuda('Mantén pulsado y arrastra sobre el terreno. Botón derecho (o dos dedos) gira la vista.'));
}
function panelPintar() {
  cuerpo.append(titulo('🖌 Pintar'),
    segmentado([['suelo', '🟫 Suelo'], ['vegetacion', '🌾 Hierba y flores']], pincel.capa, v => { pincel.capa = v; verVegetacion(); renderPanel(); }));
  if (pincel.capa === 'vegetacion') return panelPintarVegetacion();
  cuerpo.append(
    h('div', { class: 'mat' }, E.MATERIALES.map(m => h('button', { class: m.id === pincel.material ? 'activa' : '', on: { click: () => { pincel.material = m.id; renderPanel(); } } },
      h('i', { style: m.id === 0 ? 'background: linear-gradient(135deg,#5b8a39,#d9c58d 50%,#7c7873)' : 'background:' + m.color }), m.nombre))),
    deslizador('Radio', pincel.radio, 1, Math.max(60, Math.round(esc.terreno.tam / 6)), 1, v => { pincel.radio = v; }, v => v + ' m'),
    ayuda('«Automático» devuelve el suelo a su color según altura, pendiente y bioma.'),
    botones(boton('Todo a automático', () => { if (!confirm('¿Borrar toda la pintura del suelo?')) return; puntoDeshacer(); esc.terreno.materiales.fill(0); escena.actualizarTerreno(null, true); programarGuardado(); })));
}
const COLOR_VEG_UI = { hierba: '#8fe04a', trigo: '#f0c43a', flores: '#ef5fae', hierbaAlta: '#2f8f3a', bambu: '#b6ef6a', auto: 'linear-gradient(135deg,#8fe04a,#ef5fae)', nada: 'repeating-linear-gradient(45deg,#555 0 4px,#333 4px 8px)' };
function panelPintarVegetacion() {
  const ops = E.PRADERA.concat([['auto', 'Automático'], ['nada', 'Sin vegetación']]);
  cuerpo.append(
    h('div', { class: 'mat' }, ops.map(([id, n]) => h('button', { class: id === pincel.veg ? 'activa' : '', on: { click: () => { pincel.veg = id; renderPanel(); } } },
      h('i', { style: 'background:' + COLOR_VEG_UI[id] }), n))),
    deslizador('Radio', pincel.radio, 1, Math.max(60, Math.round(esc.terreno.tam / 6)), 1, v => { pincel.radio = v; }, v => v + ' m'));
  if (!['auto', 'nada'].includes(pincel.veg)) cuerpo.append(deslizador('Densidad', pincel.densidad, 0.05, 1, 0.05, v => { pincel.densidad = v; }, v => Math.round(v * 100) + '%'));
  cuerpo.append(
    ayuda('Mientras pintas, el terreno se tiñe con lo que crece encima. Las matas se ven al acercar la cámara (a menos de ~75 m); en el visor, a pie o en recorrido.'),
    ayuda('«Automático» deja que crezca hierba sola sobre los suelos de hierba, hierba seca y musgo, con claros, praderas de flores y matorral alto. «Sin vegetación» la quita.'),
    deslizador('Hierba automática en todo el escenario', esc.terreno.hierbaAuto || 0, 0, 1, 0.05, (v, fin) => { esc.terreno.hierbaAuto = v; if (fin) { escena.actualizarTerreno(null, true); programarGuardado(); } }, v => v ? Math.round(v * 100) + '%' : 'sin hierba'),
    botones(boton('Borrar lo pintado', () => { if (!confirm('¿Quitar toda la vegetación pintada (vuelve a la automática)?')) return; puntoDeshacer(); esc.terreno.vegetacion.fill(0); escena.actualizarTerreno(null, true); programarGuardado(); })));
}
function verVegetacion() {
  if (!esc) return;
  const v = herramienta === 'pintar' && pincel.capa === 'vegetacion';
  if (escena.verVegetacion !== v) { escena.verVegetacion = v; escena.actualizarTerreno(null, true); }
}
function panelCaminos() {
  const c = caminoActivo && E.buscarCamino(esc, caminoActivo);
  cuerpo.append(titulo('🛣 Caminos, carreteras y pistas'));
  if (!c) {
    cuerpo.append(ayuda('Toca el terreno para empezar un camino nuevo y sigue tocando para añadir puntos. Doble clic o «Terminar» lo cierra.'),
      selector('Tipo', nuevoCamino.tipo, E.TIPOS_CAMINO.map(t => [t[0], t[1]]), v => { nuevoCamino.tipo = v; nuevoCamino.bordes = v === 'asfalto'; if (v === 'riachuelo') { nuevoCamino.ancho = 4; renderPanel(); } }),
      numero('Ancho (m)', nuevoCamino.ancho, 1, 60, 0.5, v => { nuevoCamino.ancho = v; }));
  } else {
    cuerpo.append(
      texto('Nombre', c.nombre, v => { c.nombre = v; programarGuardado(); }),
      selector('Tipo', c.tipo, E.TIPOS_CAMINO.map(t => [t[0], t[1]]), v => { puntoDeshacer(); c.tipo = v; terminarEdicionCamino(); }),
      deslizador('Ancho', c.ancho, 1, 60, 0.5, (v, fin) => { c.ancho = v; if (fin) { terminarEdicionCamino(); } else escena.construirCaminos(); }, v => v + ' m'),
      casilla('Circuito cerrado', c.cerrado, v => { puntoDeshacer(); c.cerrado = v; terminarEdicionCamino(); }),
      casilla('Líneas en los bordes', c.bordes, v => { c.bordes = v; terminarEdicionCamino(); }),
      E.esRio(c) ? ayuda('El agua corre del primer punto (verde) al último y nunca sube: «Excavar cauce» hunde el terreno a lo largo del río. Donde cruza un camino queda un vado.') : null,
      ayuda(c.puntos.length + ' puntos · ' + Math.round((E.muestrearCamino(c, 3).slice(-1)[0] || { d: 0 }).d) + ' m. Toca para añadir al final, toca sobre el camino para insertar, arrastra un punto para moverlo y botón derecho sobre un punto para quitarlo.'),
      botones(
        boton(E.esRio(c) ? '⛏ Excavar cauce' : '⛏ Ajustar terreno', () => { puntoDeshacer(); const reg = E.ajustarTerrenoACamino(esc, c); if (reg) { escena.actualizarTerreno(); tocarZona(reg); } programarGuardado(); aviso('Terreno allanado bajo el camino'); }, '', 'Allana el terreno a lo ancho del camino y suaviza los taludes'),
        boton('🖌 Pintar suelo', () => { puntoDeshacer(); const reg = E.ajustarTerrenoACamino(esc, c, { pintar: true, margen: 0.01 }); if (reg) { escena.actualizarTerreno(); tocarZona(reg); } programarGuardado(); }, '', 'Pinta el material del camino en el suelo')),
      botones(
        boton('↩ Quitar último', () => { puntoDeshacer(); c.puntos.pop(); terminarEdicionCamino(); }),
        boton('⇄ Invertir', () => { puntoDeshacer(); c.puntos.reverse(); terminarEdicionCamino(); }),
        boton('✓ Terminar', () => { caminoActivo = null; sel = null; dibujarAsas(); renderPanel(); }, 'primario')),
      botones(boton('🗑 Borrar camino', () => { puntoDeshacer(); borrar(c.id); }, 'peligro')));
    if (!E.esRio(c)) { panelTramos(c); panelBarreras(c); }
  }
  if (esc.caminos.length) {
    cuerpo.append(titulo('Caminos del escenario'));
    const l = h('div', { class: 'lista' });
    for (const k of esc.caminos) l.append(h('div', { class: 'item' + (k.id === caminoActivo ? ' sel' : '') }, h('span', { class: 't' }, k.nombre, h('small', null, (E.TIPOS_CAMINO.find(t => t[0] === k.tipo) || [0, k.tipo])[1] + ' · ' + k.ancho + ' m' + (k.cerrado ? ' · circuito' : ''))),
      boton('Editar', () => { caminoActivo = k.id; sel = k.id; if (k.puntos[0]) enfocar(k.puntos[0].x, k.puntos[0].z, 120); dibujarAsas(); renderPanel(); })));
    cuerpo.append(l);
  }
}
// Fila de números pequeña para las listas de tramos y barreras
function numMini(valor, title, fn, ancho) {
  const i = h('input', { type: 'number', value: Math.round(valor * 10) / 10, step: 1, title, style: 'width:' + (ancho || 64) + 'px' });
  i.addEventListener('change', () => { const v = parseFloat(i.value); if (!isNaN(v)) fn(v); });
  return i;
}
function selMini(valor, ops, fn) {
  const s2 = h('select', { style: 'flex:1;min-width:0' }, ops.map(([v, t]) => h('option', { value: v, selected: v === valor }, t)));
  s2.addEventListener('change', () => fn(s2.value));
  return s2;
}
function panelTramos(c) {
  const total = Math.round(E.largoCamino(c));
  cuerpo.append(titulo('Superficie por tramos'), ayuda('Partes del camino con otra superficie (el juego la lee para el agarre). Distancias en metros desde el inicio (punto verde); en un circuito un tramo puede pasar por la salida. Largo: ' + total + ' m.'));
  const l = h('div', { class: 'lista' });
  if (!(c.tramos || []).length) l.append(h('div', { class: 'vacio' }, 'Todo el camino es ' + ((E.TIPOS_CAMINO.find(t => t[0] === c.tipo) || [0, c.tipo])[1]).toLowerCase() + '.'));
  (c.tramos || []).forEach((t, i) => l.append(h('div', { class: 'item' },
    selMini(t.tipo, E.TIPOS_CAMINO.filter(x => x[0] !== 'riachuelo').map(x => [x[0], x[1]]), v => { puntoDeshacer(); t.tipo = v; terminarEdicionCamino(); }),
    numMini(t.desde, 'Desde (m)', v => { puntoDeshacer(); t.desde = E.clamp(v, 0, total); terminarEdicionCamino(); }),
    numMini(t.hasta, 'Hasta (m)', v => { puntoDeshacer(); t.hasta = E.clamp(v, 0, total); terminarEdicionCamino(); }),
    boton('✕', () => { puntoDeshacer(); c.tramos.splice(i, 1); terminarEdicionCamino(); }))));
  cuerpo.append(l,
    selector('Superficie del tramo nuevo', nuevaBarrera.tramo, E.TIPOS_CAMINO.filter(t => t[0] !== 'riachuelo').map(t => [t[0], t[1]]), v => { nuevaBarrera.tramo = v; }),
    botones(boton(marcar && marcar.que === 'tramo' ? (marcar.d0 == null ? '👆 Toca el inicio…' : '👆 Toca el final…') : '📍 Marcar en el camino', () => { marcar = marcar && marcar.que === 'tramo' ? null : { que: 'tramo', d0: null }; renderPanel(); }, marcar && marcar.que === 'tramo' ? 'activa' : 'primario', 'Toca el camino en el inicio y en el final del tramo'),
      boton('➕ Tramo central', () => { puntoDeshacer(); c.tramos = c.tramos || []; c.tramos.push({ desde: Math.round(total / 3), hasta: Math.round(total * 2 / 3), tipo: nuevaBarrera.tramo }); terminarEdicionCamino(); })));
}
function panelBarreras(c) {
  const total = Math.round(E.largoCamino(c));
  cuerpo.append(titulo('Vallas y barreras'));
  const l = h('div', { class: 'lista' });
  if (!(c.barreras || []).length) l.append(h('div', { class: 'vacio' }, 'Sin barreras.'));
  (c.barreras || []).forEach((b, i) => {
    l.append(h('div', { class: 'item', style: 'flex-wrap:wrap' },
      selMini(b.tipo, E.TIPOS_BARRERA.map(x => [x[0], x[1]]), v => { puntoDeshacer(); b.tipo = v; terminarEdicionCamino(); }),
      selMini(b.lado, E.LADOS, v => { puntoDeshacer(); b.lado = v; terminarEdicionCamino(); }),
      boton('✕', () => { puntoDeshacer(); c.barreras.splice(i, 1); terminarEdicionCamino(); }),
      h('small', { style: 'width:100%;display:flex;gap:6px;align-items:center;color:var(--tenue)' }, 'de',
        numMini(b.desde, 'Desde (m)', v => { puntoDeshacer(); b.desde = E.clamp(v, 0, total); terminarEdicionCamino(); }, 58), 'a',
        numMini(b.hasta, 'Hasta (m)', v => { puntoDeshacer(); b.hasta = E.clamp(v, 0, total); terminarEdicionCamino(); }, 58), 'm · a',
        numMini(b.separacion == null ? 1 : b.separacion, 'Separación del borde (m)', v => { puntoDeshacer(); b.separacion = E.clamp(v, 0, 50); terminarEdicionCamino(); }, 48), 'm del borde')));
  });
  cuerpo.append(l,
    selector('Tipo', nuevaBarrera.tipo, E.TIPOS_BARRERA.map(t => [t[0], t[1]]), v => { nuevaBarrera.tipo = v; }),
    selector('Lado', nuevaBarrera.lado, E.LADOS, v => { nuevaBarrera.lado = v; }),
    numero('Separación del borde (m)', nuevaBarrera.separacion, 0, 50, 0.5, v => { nuevaBarrera.separacion = v; }),
    botones(
      boton(marcar && marcar.que === 'barrera' ? (marcar.d0 == null ? '👆 Toca el inicio…' : '👆 Toca el final…') : '📍 Marcar en el camino', () => { marcar = marcar && marcar.que === 'barrera' ? null : { que: 'barrera', d0: null }; renderPanel(); }, marcar && marcar.que === 'barrera' ? 'activa' : 'primario', 'Toca el camino donde empieza y donde acaba. Si tocas fuera del camino, a un lado, se pone solo en ese lado.'),
      boton('➕ En todo el camino', () => { puntoDeshacer(); c.barreras = c.barreras || []; c.barreras.push({ tipo: nuevaBarrera.tipo, lado: nuevaBarrera.lado, desde: 0, hasta: total, separacion: nuevaBarrera.separacion }); terminarEdicionCamino(); })));
}
// Clic con «Marcar en el camino»: primer toque = inicio, segundo = final
function clicMarcar(p) {
  const c = caminoActivo && E.buscarCamino(esc, caminoActivo);
  if (!c || !p) return;
  const pr = E.proyectarEnCamino(c, p.x, p.z);
  if (!pr || pr.dist > c.ancho / 2 + 25) { aviso('Toca sobre el camino o muy cerca'); return; }
  if (marcar.d0 == null) {
    marcar.d0 = pr.d;
    marcar.lado = pr.dist > c.ancho / 2 ? (pr.lado > 0 ? 'izq' : 'der') : null;
    aviso('Inicio a ' + Math.round(pr.d) + ' m. Ahora toca el final.');
    renderPanel(); return;
  }
  let d0 = marcar.d0, d1 = pr.d;
  if (!c.cerrado && d1 < d0) [d0, d1] = [d1, d0];
  puntoDeshacer();
  if (marcar.que === 'tramo') { c.tramos = c.tramos || []; c.tramos.push({ desde: Math.round(d0), hasta: Math.round(d1), tipo: nuevaBarrera.tramo }); }
  else { c.barreras = c.barreras || []; c.barreras.push({ tipo: nuevaBarrera.tipo, lado: marcar.lado || nuevaBarrera.lado, desde: Math.round(d0), hasta: Math.round(d1), separacion: nuevaBarrera.separacion }); }
  aviso((marcar.que === 'tramo' ? 'Tramo' : 'Barrera') + ' de ' + Math.round(d0) + ' a ' + Math.round(d1) + ' m');
  marcar = null;
  terminarEdicionCamino();
}
function panelColocar() {
  cuerpo.append(titulo('➕ Colocar'));
  for (const g of E.GRUPOS) {
    const tipos = Object.values(E.TIPOS).filter(t => t.grupo === g.id);
    if (!tipos.length) continue;
    cuerpo.append(h('h3', null, g.nombre), h('div', { class: 'paleta' }, tipos.map(t => h('button', { class: t.id === colocar.tipo ? 'activa' : '', on: { click: () => { if (colocar.tipo !== t.id) colocar.props = {}; colocar.tipo = t.id; renderPanel(); } } },
      h('span', { class: 'ico' }, t.icono), t.nombre))));
  }
  const def = E.TIPOS[colocar.tipo];
  cuerpo.append(titulo('Al colocar: ' + def.nombre));
  if (colocar.tipo === 'glb' || colocar.tipo === 'enemigo') {
    cuerpo.append(ayuda('Modelo: <b>' + (colocar.props.modelo ? nombreModelo(colocar.props.modelo) : 'ninguno') + '</b>'),
      botones(boton('🧊 Elegir modelo…', async () => { const r = await elegirModelo(colocar.tipo === 'enemigo' ? 'enemigos' : null); if (r) { colocar.props.modelo = r; renderPanel(); } }, 'primario')));
  }
  for (const c of def.campos.filter(c => !['glb', 'modelo', 'texto'].includes(c.t) && !c.k.startsWith('cfg.') && c.k !== 'nivel' && c.k !== 'semilla')) {
    const v = E.leerRuta(colocar.props, c.k) ?? E.leerRuta(def.props, c.k);
    cuerpo.append(controlCampo(c, v, nv => E.escribirRuta(colocar.props, c.k, nv)));
  }
  cuerpo.append(ayuda('Toca el terreno para colocar. Seguirás colocando hasta que cambies de herramienta.'));
  if (def.grupo === 'rpg') cuerpo.append(ayuda('Los pueblos se diseñan en el <b>Creador de Pueblos</b> y las mazmorras en el <b>Creador de Mazmorras</b> (botón en Selección). Aquí se ven como maqueta.'));
}
function controlCampo(c, v, fn) {
  switch (c.t) {
    case 'num': return numero(c.n, v, c.min, c.max, c.paso, fn);
    case 'rango': return deslizador(c.n, v, c.min, c.max, c.paso, (nv, fin) => { if (fin) fn(nv); });
    case 'color': return color(c.n, v, (nv, fin) => { if (fin) fn(nv); });
    case 'bool': return casilla(c.n, v, fn);
    case 'sel': return selector(c.n, v, c.op, fn);
    case 'texto': return texto(c.n, v, fn, c.k === 'notas');
    case 'textura': {
      const cont = h('div', { class: 'campo ancho' });
      if (window.TexturasLib) {
        window.TexturasLib.selector(cont, { etiqueta: c.n, valor: v || null, alCambiar: nv => fn(nv || '') });
        cont.append(boton('Sin textura', () => fn('')));
      } else cont.append(h('label', null, c.n + ': ' + (v || '—')));
      return cont;
    }
    case 'glb': case 'modelo': return h('div', { class: 'campo ancho' }, h('label', null, c.n + ': ' + (v ? nombreModelo(v) : '—')),
      boton('🧊 Elegir modelo…', async () => { const r = await elegirModelo(c.grupo || null); if (r) fn(r); }));
    default: return texto(c.n, v, fn);
  }
}

// --- Pestaña Selección ---
let camposPos = null;
function panelSeleccion() {
  const el = sel && E.buscarElemento(esc, sel);
  if (!el) {
    const c = sel && E.buscarCamino(esc, sel);
    if (c) { cuerpo.append(ayuda('Camino seleccionado: se edita con la herramienta 🛣 Caminos.'), botones(boton('Editar camino', () => usarHerramienta('caminos'), 'primario'))); return; }
    cuerpo.append(h('div', { class: 'vacio' }, 'Nada seleccionado. Con 👆 Ver, toca un elemento.'));
    return;
  }
  const def = E.TIPOS[el.tipo] || { campos: [], nombre: el.tipo };
  const area = def.forma === 'area';
  const rehacerEl = () => { escena.actualizarElemento(el); if (herramienta === 'ver') { const g = escena.objetos.get(el.id); if (g) tc.attach(g); } marcarSeleccion(); programarGuardado(); };
  cuerpo.append(titulo(def.icono + ' ' + def.nombre), texto('Nombre', el.nombre, v => { el.nombre = v; rehacerEl(); renderPanel(); }));
  // Posición
  const px = numero('X', +el.x.toFixed(2), null, null, 0.5, v => { puntoDeshacer(); el.x = v; rehacerEl(); });
  const pz = numero('Z', +el.z.toFixed(2), null, null, 0.5, v => { puntoDeshacer(); el.z = v; rehacerEl(); });
  const py = numero(area ? 'Altura extra' : 'Sobre el suelo (m)', el.y || 0, -500, 2000, 0.1, v => { puntoDeshacer(); el.y = v; rehacerEl(); });
  camposPos = { px, pz, py };
  cuerpo.append(titulo('Posición'), px, pz, py);
  if (!area) {
    cuerpo.append(deslizador('Giro', el.rotY || 0, -180, 180, 1, (v, fin) => { el.rotY = v; escena.colocar(el); marcarSeleccion(); if (fin) programarGuardado(); }, v => v + '°'),
      numero('Escala', el.escala || 1, 0.01, 1000, 0.05, v => { puntoDeshacer(); el.escala = v; escena.colocar(el); marcarSeleccion(); programarGuardado(); }));
  }
  cuerpo.append(titulo('Propiedades'));
  for (const c of def.campos) {
    cuerpo.append(controlCampo(c, E.leerRuta(el.props, c.k), nv => {
      puntoDeshacer();
      E.escribirRuta(el.props, c.k, nv);
      if (el.tipo === 'pueblo' && c.k === 'cfg.size') el.props.radio = E.radioPueblo(nv);
      rehacerEl(); renderPanel();
    }));
  }
  // Acciones por tipo
  if (el.tipo === 'pueblo') {
    cuerpo.append(titulo('Diseño del pueblo'),
      ayuda('Aquí se ve una maqueta. El pueblo completo (casas, calles, río, murallas, ediciones a mano) se diseña en el Creador de Pueblos y queda guardado en este escenario.'),
      botones(boton('🏗 Abrir en el Creador de Pueblos', () => abrirCreadorPueblos(el), 'primario')),
      botones(boton('⛏ Allanar terreno aquí', () => { puntoDeshacer(); const reg = E.prepararPueblo(esc, el); escena.actualizarTerreno(); tocarZona(reg); programarGuardado(); })),
      titulo('Salidas hacia los caminos'),
      ayuda((el.props.cfg.exits || []).length ? 'Salidas: ' + el.props.cfg.exits.map(x => Math.round(x.angle) + '° → ' + (x.to || '')).join(' · ') + '. Se cambian en el Creador de Pueblos («Salidas hacia el mundo»): al volver, los caminos se llevan solos a ellas.' : 'Sin salidas. Haz llegar un camino al pueblo y pulsa «Crear salidas».'),
      botones(
        boton('🔗 Crear salidas', () => { puntoDeshacer(); const n = E.conectarCaminosPueblo(esc, el); escena.construirCaminos(); rehacerEl(); renderPanel(); aviso(n ? n + ' camino(s) unidos: salida donde llega cada uno' : 'Ningún camino llega a este pueblo'); }, '', 'Pone una salida del pueblo donde llega cada camino y lleva el camino hasta ella'),
        boton('↪ Llevar caminos a las salidas', () => { puntoDeshacer(); const n = E.conectarCaminosPueblo(esc, el, { desdeSalidas: true }); escena.construirCaminos(); programarGuardado(); aviso(n ? n + ' camino(s) llevados a sus salidas' : 'Ningún camino llega a este pueblo'); }, '', 'Mantiene las salidas del pueblo y lleva cada camino a la más cercana')),
      numero('Radio (m)', el.props.radio, 20, 1000, 1, v => { puntoDeshacer(); el.props.radio = v; rehacerEl(); }));
  }
  if (el.tipo === 'mazmorra') {
    cuerpo.append(titulo('Interior'), ayuda('La entrada se coloca aquí; el interior (salas, jefe, élites, trampas) se diseña en el Creador de Mazmorras.'),
      botones(boton('🕳 Abrir en el Creador de Mazmorras', () => abrirCreadorMazmorras(el), 'primario')));
  }
  if (el.tipo === 'zona') panelEnemigosZona(el, rehacerEl);
  if (el.tipo === 'lago') cuerpo.append(botones(boton('⛏ Excavar lecho', () => excavarLago(el, true))));
  if (el.tipo === 'camara') cuerpo.append(botones(boton('👁 Ver desde aquí', () => {
    const y = E.alturaEn(esc, el.x, el.z) + (el.y || 0) + el.props.altura, a = (el.rotY || 0) * DEG, inc = el.props.inclinacion * DEG;
    camara.position.set(el.x, y, el.z);
    orbita.target.set(el.x + Math.sin(a) * Math.cos(inc) * 20, y + Math.sin(inc) * 20, el.z + Math.cos(a) * Math.cos(inc) * 20); orbita.update();
  }), boton('📍 Poner aquí la vista actual', () => {
    puntoDeshacer();
    el.x = camara.position.x; el.z = camara.position.z;
    el.props.altura = Math.round((camara.position.y - E.alturaEn(esc, el.x, el.z)) * 10) / 10; el.y = 0;
    const d = orbita.target.clone().sub(camara.position).normalize();
    el.rotY = Math.round(Math.atan2(d.x, d.z) / DEG); el.props.inclinacion = Math.round(Math.asin(d.y) / DEG);
    rehacerEl(); renderPanel();
  })));
  cuerpo.append(titulo('Acciones'), botones(
    boton('◎ Enfocar', () => enfocar(el.x, el.z, Math.max(40, E.radioElemento(el) * 3))),
    boton('⧉ Duplicar', () => duplicarSel()),
    boton('⬇ Al suelo', () => { puntoDeshacer(); el.y = 0; rehacerEl(); renderPanel(); }),
    boton('🗑 Borrar', () => { puntoDeshacer(); borrar(el.id); }, 'peligro')));
  cuerpo.append(ayuda('Id: <code>' + el.id + '</code>'));
}
function actualizarCamposPosicion() {
  const el = sel && E.buscarElemento(esc, sel);
  if (!el || !camposPos || pestana !== 'seleccion') return;
  camposPos.px.querySelector('input').value = el.x.toFixed(2);
  camposPos.pz.querySelector('input').value = el.z.toFixed(2);
  camposPos.py.querySelector('input').value = (el.y || 0).toFixed(2);
}
function panelEnemigosZona(el, rehacerEl) {
  el.props.enemigos = el.props.enemigos || [];
  cuerpo.append(titulo('Enemigos de la zona'));
  const l = h('div', { class: 'lista' });
  if (!el.props.enemigos.length) l.append(h('div', { class: 'vacio' }, 'Sin enemigos. Añade modelos de la biblioteca RPG o importados.'));
  el.props.enemigos.forEach((en, i) => {
    const cant = h('input', { type: 'number', min: 1, max: 20, value: en.cantidad || 1, style: 'width:56px', title: 'Cantidad' });
    cant.addEventListener('change', () => { puntoDeshacer(); en.cantidad = E.clamp(parseInt(cant.value, 10) || 1, 1, 20); rehacerEl(); });
    const alto = h('input', { type: 'number', min: 0.3, max: 60, step: 0.1, value: en.alto || 2.4, style: 'width:60px', title: 'Altura (m)' });
    alto.addEventListener('change', () => { puntoDeshacer(); en.alto = parseFloat(alto.value) || 2.4; rehacerEl(); });
    l.append(h('div', { class: 'item' }, h('span', { class: 't' }, nombreModelo(en.modelo)), cant, alto, boton('✕', () => { puntoDeshacer(); el.props.enemigos.splice(i, 1); rehacerEl(); renderPanel(); })));
  });
  cuerpo.append(l, botones(boton('➕ Añadir enemigo…', async () => {
    const r = await elegirModelo('enemigos');
    if (!r) return;
    puntoDeshacer(); el.props.enemigos.push({ modelo: r, cantidad: 3, alto: 2.4 }); rehacerEl(); renderPanel();
  })), ayuda('Cantidad y altura (m) de cada uno. Se muestran como mucho 40 por zona.'));
}
function duplicarSel() {
  const el = sel && E.buscarElemento(esc, sel);
  if (!el) return;
  puntoDeshacer();
  const n = E.duplicarElemento(esc, el.id);
  escena.actualizarElemento(n); seleccionar(n.id); programarGuardado();
}

// --- Pestaña Escenario ---
function opcionesTam(actual) {
  const op = [[256, '256 m'], [512, '512 m'], [1024, '1 km'], [1536, '1,5 km'], [2048, '2 km'], [4096, '4 km'], [8192, '8 km'], [16384, '16 km']];
  if (!op.some(o => o[0] === actual)) op.push([actual, actual + ' m']);
  return op;
}
function panelEscenario() {
  const t = esc.terreno, g = t.gen;
  cuerpo.append(titulo('Escenario'),
    texto('Nombre', esc.nombre, v => { esc.nombre = v || 'Escenario'; refrescarTodo(); programarGuardado(); }),
    texto('Descripción', esc.descripcion, v => { esc.descripcion = v; programarGuardado(); }, true),
    ayuda('Plantilla de origen: ' + ((E.PLANTILLAS[esc.plantilla] || {}).nombre || esc.plantilla) + ' · ' + t.tam + ' m × ' + t.tam + ' m · rejilla ' + t.res + '² (' + E.paso(esc).toFixed(1) + ' m entre puntos)'));

  cuerpo.append(titulo('Ambiente'),
    deslizador('Hora del día', esc.ambiente.hora, 0, 24, 0.25, (v, fin) => { esc.ambiente.hora = v; escena.setHora(v); if (fin) programarGuardado(); }, v => { const hh = Math.floor(v), mm = Math.round((v - hh) * 60); return hh + ':' + String(mm).padStart(2, '0'); }),
    deslizador('Nubes', esc.ambiente.nubes == null ? 0.4 : esc.ambiente.nubes, 0, 1, 0.01, (v, fin) => { esc.ambiente.nubes = v; escena.setNubes(v); if (fin) programarGuardado(); }, v => Math.round(v * 100) + '%'),
    deslizador('Niebla', esc.ambiente.niebla, 0, 1, 0.01, (v, fin) => { esc.ambiente.niebla = v; escena.setNiebla(v); if (fin) programarGuardado(); }, v => Math.round(v * 100) + '%'),
    selector('Bioma (colores automáticos)', t.bioma, Object.entries(E.BIOMAS).map(([k, b]) => [k, b.nombre]), v => { puntoDeshacer(); t.bioma = v; escena.actualizarTerreno(null, true); escena.construirAgua(); escena.reconstruirElementos(); programarGuardado(); }),
    selector('Bordes en el visor', t.bordes, [['cortado', 'Bloque (se ve el borde)'], ['infinito', 'Mar o niebla hasta el horizonte']], v => { t.bordes = v; programarGuardado(); }));

  cuerpo.append(titulo('Agua'),
    casilla('Agua (mar / nivel general)', t.agua.activa, v => { puntoDeshacer(); t.agua.activa = v; escena.construirAgua(); escena.actualizarTerreno(null, true); escena.construirCaminos(); programarGuardado(); }));
  if (t.agua.activa) {
    const r = E.rangoAlturas(esc);
    cuerpo.append(deslizador('Nivel del agua', t.agua.nivel, Math.floor(r.min - 5), Math.ceil(r.max + 5), 0.5, (v, fin) => { t.agua.nivel = v; if (escena.agua) escena.agua.position.y = v; if (fin) { escena.actualizarTerreno(null, true); escena.construirCaminos(); programarGuardado(); } }, v => v + ' m'),
      color('Color', t.agua.color || (E.BIOMAS[t.bioma] || E.BIOMAS.templado).agua, (v, fin) => { t.agua.color = v; if (escena.agua) escena.agua.material.color.set(v); if (fin) programarGuardado(); }));
  }

  cuerpo.append(titulo('Generar terreno'),
    ayuda('Vuelve a crear el relieve con estos parámetros. <b>Sustituye lo esculpido</b> (se puede deshacer).'),
    selector('Forma', g.tipo, E.TIPOS_TERRENO, v => { g.tipo = v; }),
    numero('Tamaño de los accidentes (m)', g.escala, 10, 20000, 10, v => { g.escala = v; }),
    numero('Altura (m)', g.altura, 0, 3000, 1, v => { g.altura = v; }),
    numero('Detalle (octavas)', g.octavas, 1, 8, 1, v => { g.octavas = v; }),
    numero('Desplazamiento vertical (m)', g.base || 0, -1000, 1000, 1, v => { g.base = v; }),
    numero('Semilla', g.semilla, 1, 99999, 1, v => { g.semilla = v; }),
    botones(boton('🎲 Semilla', () => { g.semilla = Math.floor(Math.random() * 99999) + 1; renderPanel(); }),
      boton('⛰ Generar', () => { puntoDeshacer(); E.generarTerreno(esc); escena.actualizarTerreno(); escena.construirAgua(); escena.construirCaminos(); escena.reconstruirElementos(); programarGuardado(); }, 'primario')));

  cuerpo.append(titulo('Tamaño y detalle'),
    selector('Tamaño del terreno', t.tam, opcionesTam(t.tam), v => {
      v = +v; if (v === t.tam) return;
      if (!confirm('Cambiar el tamaño recorta o amplía el terreno alrededor del centro (lo de fuera se rellena estirando el borde). ¿Seguir?')) return renderPanel();
      puntoDeshacer(); E.remuestrear(esc, t.res, v); escena.construir(esc); encuadre(); renderPanel(); programarGuardado();
    }),
    selector('Detalle de la rejilla', t.res, [[65, 'Muy bajo (65²)'], [129, 'Bajo (129²)'], [257, 'Medio (257²)'], [513, 'Alto (513²)']], v => {
      v = +v; if (v === t.res) return; puntoDeshacer(); E.remuestrear(esc, v, t.tam); escena.construir(esc); renderPanel(); programarGuardado();
    }));

  cuerpo.append(titulo('Vista'),
    casilla('Pueblos completos (cerca de la cámara)', escena.o.pueblosReales !== false, v => { escena.setPueblosReales(v); try { localStorage.setItem('escenarios.pueblosReales', v ? '1' : '0'); } catch (e) { /* nada */ } }));
  cuerpo.append(titulo('Enlaces con el Creador RPG'),
    ayuda('Dirección donde está publicado <b>Creador-de-mundos-Rpg</b>: de ahí salen los modelos de la biblioteca y se abren el Creador de Pueblos y el de Mazmorras.'),
    texto('Dirección', esc.enlaces.rpgBase, v => { esc.enlaces.rpgBase = v.trim() || E.RPG_BASE; escena.modelos.clear(); escena.reconstruirElementos(); programarGuardado(); }));
  try {
    if (new URL(esc.enlaces.rpgBase, location.href).origin !== location.origin) {
      cuerpo.append(h('div', { class: 'aviso' }, 'Esta app y el Creador RPG están en sitios distintos: los modelos se cargan igual, pero al guardar en el Creador de Pueblos o de Mazmorras no se podrá volver aquí con los cambios. Publica ambos repositorios en GitHub Pages del mismo usuario para que funcione la vuelta.'));
    }
  } catch (e) { /* dirección no válida */ }

  cuerpo.append(titulo('Modelos importados'));
  const lm = h('div', { class: 'lista' }, h('div', { class: 'vacio' }, '…'));
  cuerpo.append(lm);
  A.listarModelos().then(ms => {
    lm.innerHTML = '';
    if (!ms.length) lm.append(h('div', { class: 'vacio' }, 'Ninguno. Se importan desde ➕ Colocar → Modelo GLB.'));
    for (const m of ms) {
      const usos = esc.elementos.filter(e => e.props && e.props.modelo === 'local:' + m.id).length;
      lm.append(h('div', { class: 'item' }, h('span', { class: 't' }, m.nombre, h('small', null, (m.tam / 1048576).toFixed(1) + ' MB · ' + usos + ' usos aquí')),
        boton('✕', async () => { if (!confirm('¿Borrar «' + m.nombre + '» del navegador? Los elementos que lo usan mostrarán un aviso.')) return; await A.borrarModelo(m.id); renderPanel(); })));
    }
  });
}

// ---------------------------------------------------------------------------
// Selector de modelos
// ---------------------------------------------------------------------------
function nombreModelo(ruta) {
  if (!ruta) return '—';
  if (ruta.startsWith('local:')) return (esc.glbs[ruta.slice(6)] || {}).nombre || 'Modelo importado';
  if (ruta.startsWith('rpg:')) { const m = CAT.find(c => c.ruta === ruta.slice(4)); return m ? m.nombre : ruta.slice(4).split('/').pop(); }
  return ruta.split('/').pop();
}
let resolverModelo = null;
function elegirModelo(grupo) {
  const dlg = $('dlg-modelo');
  const grupos = [['', 'Todos']].concat([...new Set(CAT.map(c => c.grupo))].map(g => [g, g[0].toUpperCase() + g.slice(1)]));
  $('mod-grupo').innerHTML = grupos.map(([v, t]) => `<option value="${v}" ${v === (grupo || '') ? 'selected' : ''}>${t}</option>`).join('');
  $('mod-buscar').value = '';
  pintarListaRpg(); pintarListaLocales();
  pestanaModelo(grupo ? 'rpg' : 'locales');
  dlg.showModal();
  return new Promise(ok => { resolverModelo = ok; });
}
function terminarModelo(r) { const f = resolverModelo; resolverModelo = null; $('dlg-modelo').close(); if (f) f(r); }
$('dlg-modelo').addEventListener('close', () => { if (resolverModelo) { const f = resolverModelo; resolverModelo = null; f(null); } });
function pestanaModelo(t) {
  document.querySelectorAll('#mod-tabs button').forEach(b => b.classList.toggle('activa', b.dataset.t === t));
  for (const k of ['locales', 'rpg', 'url']) $('mod-' + k).hidden = k !== t;
}
document.querySelectorAll('#mod-tabs button').forEach(b => b.addEventListener('click', () => pestanaModelo(b.dataset.t)));
function pintarListaRpg() {
  const q = $('mod-buscar').value.trim().toLowerCase(), g = $('mod-grupo').value;
  const l = $('mod-lista-rpg'); l.innerHTML = '';
  const res = CAT.filter(c => (!g || c.grupo === g) && (!q || (c.nombre + ' ' + c.ruta).toLowerCase().includes(q))).slice(0, 200);
  if (!res.length) l.append(h('div', { class: 'vacio' }, 'Sin resultados'));
  for (const c of res) l.append(h('div', { class: 'item' }, h('span', { class: 't' }, c.nombre, h('small', null, (c.sub ? c.sub + ' · ' : '') + c.grupo)), boton('Usar', () => terminarModelo('rpg:' + c.ruta), 'primario')));
}
$('mod-buscar').addEventListener('input', pintarListaRpg);
$('mod-grupo').addEventListener('change', pintarListaRpg);
async function pintarListaLocales() {
  const l = $('mod-lista-locales'); l.innerHTML = '';
  const ms = await A.listarModelos();
  if (!ms.length) l.append(h('div', { class: 'vacio' }, 'Aún no has importado modelos.'));
  for (const m of ms) l.append(h('div', { class: 'item' }, h('span', { class: 't' }, m.nombre, h('small', null, (m.tam / 1048576).toFixed(1) + ' MB')), boton('Usar', () => { esc.glbs[m.id] = { nombre: m.nombre, tam: m.tam }; terminarModelo('local:' + m.id); }, 'primario')));
}
$('mod-importar').addEventListener('click', () => $('fichero-glb').click());
$('fichero-glb').addEventListener('change', async e => {
  const fs = Array.from(e.target.files || []); e.target.value = '';
  for (const f of fs) {
    const bytes = await f.arrayBuffer();
    const id = 'm' + E.hashTexto(f.name + ':' + f.size + ':' + new Uint8Array(bytes.slice(0, 4096)).join(',')).toString(36);
    await A.guardarModelo(id, f.name.replace(/\.glb$/i, ''), bytes);
  }
  if (fs.length) aviso(fs.length + ' modelo(s) importado(s)');
  pintarListaLocales();
});
$('mod-url-ok').addEventListener('click', () => { const u = $('mod-url-inp').value.trim(); if (u) terminarModelo(u); });

// ---------------------------------------------------------------------------
// Conexión con el Creador de Pueblos y el Creador de Mazmorras (Creador-de-mundos-Rpg)
// ---------------------------------------------------------------------------
function baseRpg() { return (esc.enlaces.rpgBase || E.RPG_BASE).replace(/\/?$/, '/'); }
function volverAqui() { return location.origin + location.pathname + '?id=' + encodeURIComponent(esc.id); }
async function abrirCreadorPueblos(el) {
  await guardarYa();
  if (!(el.props.cfg.exits || []).length && E.conectarCaminosPueblo(esc, el)) { escena.construirCaminos(); await guardarYa(); }
  const payload = { sessionId: 'esc:' + esc.id, townId: el.id, name: el.nombre, cfg: el.props.cfg, volver: volverAqui(), claveRetorno: RET_PUEBLO, salidasEditables: true };
  // El Creador de Pueblos viene incluido en esta app (copia de Creador-de-mundos-Rpg): mismo sitio, la vuelta siempre funciona
  location.href = 'creador-de-pueblos.html#mundo=' + encodeURIComponent(JSON.stringify(payload));
}
async function abrirCreadorMazmorras(el) {
  await guardarYa();
  const d = Object.assign({ id: el.id, name: el.nombre }, el.props.dungeon || {});
  const payload = { sessionId: 'esc:' + esc.id, dungeonId: el.id, dungeon: d, volver: volverAqui(), claveRetorno: RET_MAZMORRA };
  location.href = baseRpg() + 'creador-de-mazmorras.html#mundo=' + encodeURIComponent(JSON.stringify(payload));
}
function leerRetornos() {
  const r = [];
  for (const k of [RET_PUEBLO, RET_MAZMORRA]) {
    let v = null;
    try { v = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { v = null; }
    if (v && typeof v.sessionId === 'string' && v.sessionId.startsWith('esc:')) r.push({ k, v });
  }
  return r;
}
function aplicarRetornos() {
  for (const { k, v } of leerRetornos()) {
    if (v.sessionId !== 'esc:' + esc.id) continue;
    localStorage.removeItem(k);
    if (k === RET_PUEBLO) {
      const el = E.buscarElemento(esc, v.townId);
      if (el && v.cfg) {
        puntoDeshacer();
        el.props.cfg = Object.assign({}, el.props.cfg, v.cfg);
        el.props.radio = Math.max(el.props.radio || 0, E.radioPueblo(el.props.cfg.size));
        if (E.conectarCaminosPueblo(esc, el, { desdeSalidas: true })) escena.construirCaminos();
        escena.actualizarElemento(el); seleccionar(el.id); enfocar(el.x, el.z, el.props.radio * 2.2);
        aviso('Diseño de «' + el.nombre + '» actualizado');
      }
    } else {
      const el = E.buscarElemento(esc, v.dungeonId);
      if (el && v.dungeon) {
        puntoDeshacer();
        el.props.dungeon = v.dungeon;
        if (v.dungeon.nivel) el.props.nivel = v.dungeon.nivel;
        escena.actualizarElemento(el); seleccionar(el.id); enfocar(el.x, el.z, 50);
        aviso('Mazmorra «' + el.nombre + '» actualizada');
      }
    }
    programarGuardado();
  }
}

// ---------------------------------------------------------------------------
// Barra superior: nuevo, escenarios, exportar, importar, visor
// ---------------------------------------------------------------------------
$('inp-nombre').addEventListener('change', e => { esc.nombre = e.target.value.trim() || 'Escenario'; refrescarTodo(); programarGuardado(); });
$('btn-deshacer').addEventListener('click', hacerDeshacer);
$('btn-rehacer').addEventListener('click', hacerRehacer);
$('btn-visor').addEventListener('click', async () => { await guardarYa(); location.href = 'visor.html?id=' + encodeURIComponent(esc.id); });

let plantillaElegida = 'vacio';
$('btn-nuevo').addEventListener('click', () => {
  const cont = $('plantillas'); cont.innerHTML = '';
  for (const p of Object.values(E.PLANTILLAS)) {
    cont.append(h('button', { type: 'button', class: p.id === plantillaElegida ? 'activa' : '', on: { click: () => { plantillaElegida = p.id; cont.querySelectorAll('button').forEach(b => b.classList.remove('activa')); cont.querySelector('[data-p="' + p.id + '"]').classList.add('activa'); } }, 'data-p': p.id },
      h('span', { class: 'ico' }, p.icono), h('b', null, p.nombre), h('span', null, p.desc)));
  }
  $('dlg-nuevo').showModal();
});
$('nv-crear').addEventListener('click', async ev => {
  ev.preventDefault();
  await guardarYa();
  const tam = parseInt($('nv-tam').value, 10) || undefined, res = parseInt($('nv-res').value, 10), semilla = parseInt($('nv-semilla').value, 10) || undefined;
  const nuevo = E.crear({ plantilla: plantillaElegida, nombre: $('nv-nombre').value.trim() || undefined, tam, res, semilla });
  $('dlg-nuevo').close();
  abrirEscenario(nuevo);
  await guardarYa();
  aviso('Escenario creado');
});

$('btn-sesiones').addEventListener('click', async () => {
  await guardarYa();
  const l = $('lista-sesiones'); l.innerHTML = '';
  const lista = await A.listar();
  if (!lista.length) l.append(h('div', { class: 'vacio' }, 'No hay escenarios guardados.'));
  for (const s of lista) {
    const f = new Date(s.actualizado);
    l.append(h('div', { class: 'item' + (s.id === esc.id ? ' sel' : '') },
      h('span', { class: 't' }, s.nombre, h('small', null, ((E.PLANTILLAS[s.plantilla] || {}).icono || '') + ' ' + (s.tam || '?') + ' m · ' + (s.elementos || 0) + ' elementos · ' + f.toLocaleString())),
      boton('Abrir', async () => { const d = await A.cargarEscenario(s.id); if (!d) return aviso('No se encontró'); abrirEscenario(E.deserializar(d).escenario); $('dlg-sesiones').close(); }, 'primario'),
      boton('⧉', async () => { const d = await A.cargarEscenario(s.id); const o = E.deserializar(d).escenario; o.id = 'esc-' + Date.now().toString(36); o.nombre += ' (copia)'; await A.guardarEscenario(E.serializar(o)); $('btn-sesiones').click(); }, '', 'Duplicar'),
      boton('✕', async () => {
        if (!confirm('¿Borrar «' + s.nombre + '»? No se puede deshacer.')) return;
        await A.borrarEscenario(s.id);
        if (s.id === esc.id) { const resto = (await A.listar())[0]; abrirEscenario(resto ? E.deserializar(await A.cargarEscenario(resto.id)).escenario : E.crear({ plantilla: 'vacio' })); }
        $('btn-sesiones').click();
      }, 'peligro', 'Borrar')));
  }
  if (!$('dlg-sesiones').open) $('dlg-sesiones').showModal();
});

$('btn-exportar').addEventListener('click', async () => {
  await guardarYa();
  const usados = [...new Set(esc.elementos.flatMap(e => [e.props && e.props.modelo].concat((e.props && e.props.enemigos || []).map(x => x.modelo))).filter(m => m && m.startsWith('local:')).map(m => m.slice(6)))];
  let modelos = null;
  if (usados.length && confirm('El escenario usa ' + usados.length + ' modelo(s) importado(s). ¿Incluirlos dentro del archivo? (Aceptar = archivo completo, más grande; Cancelar = solo referencias)')) {
    modelos = {};
    for (const id of usados) { const b = await A.cargarModelo(id); if (b) { modelos[id] = E.bytesABase64(new Uint8Array(b)); esc.glbs[id] = esc.glbs[id] || { nombre: id, tam: b.byteLength }; } }
  }
  const datos = E.serializar(esc, { modelos });
  const blob = new Blob([JSON.stringify(datos)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (esc.nombre || 'escenario').replace(/[^\w\-áéíóúñü ]+/gi, '').trim().replace(/\s+/g, '-').toLowerCase() + '.escenario.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
$('btn-importar').addEventListener('click', () => $('fichero-escenario').click());
$('ses-importar').addEventListener('click', () => { $('dlg-sesiones').close(); $('fichero-escenario').click(); });
$('ses-exportar').addEventListener('click', () => { $('dlg-sesiones').close(); $('btn-exportar').click(); });
$('fichero-escenario').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const { escenario, modelos } = E.deserializar(await f.text());
    for (const [id, b64] of Object.entries(modelos)) await A.guardarModelo(id, (escenario.glbs[id] || {}).nombre || id, E.base64ABytes(b64).buffer);
    const existe = (await A.listar()).some(s => s.id === escenario.id);
    if (existe && !confirm('Ya tienes un escenario con este identificador. ¿Sustituirlo? (Cancelar = importar como copia)')) escenario.id = 'esc-' + Date.now().toString(36);
    await guardarYa();
    abrirEscenario(escenario);
    await guardarYa();
    aviso('Importado «' + escenario.nombre + '»');
  } catch (err) { console.error(err); alert('No se pudo importar: ' + err.message); }
});

// Panel plegable en el móvil
function abrirPanelMovil() { $('panel').classList.remove('plegado'); document.body.classList.add('panel-abierto'); }
$('panel-asa').addEventListener('click', () => { const p = $('panel'); p.classList.toggle('plegado'); document.body.classList.toggle('panel-abierto', !p.classList.contains('plegado')); });
if (matchMedia('(max-width: 760px)').matches) { $('panel').classList.add('plegado'); }

// ---------------------------------------------------------------------------
// Teclado
// ---------------------------------------------------------------------------
window.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select') || document.querySelector('dialog[open]')) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? hacerRehacer() : hacerDeshacer(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); hacerRehacer(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'd') { e.preventDefault(); duplicarSel(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); guardarYa(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const hs = ['ver', 'esculpir', 'pintar', 'caminos', 'colocar', 'borrar'];
  if (k >= '1' && k <= '6') return usarHerramienta(hs[+k - 1]);
  if (k === 'escape') { if (caminoActivo) { caminoActivo = null; dibujarAsas(); renderPanel(); } else seleccionar(null); return; }
  if (k === 'delete' || k === 'backspace') { if (sel) { puntoDeshacer(); borrar(sel); } return; }
  if (k === 'f') { const el = sel && E.buscarElemento(esc, sel); if (el) enfocar(el.x, el.z, Math.max(40, E.radioElemento(el) * 3)); return; }
  if (k === 'enter' && caminoActivo) { caminoActivo = null; dibujarAsas(); renderPanel(); return; }
  const m = { g: 'translate', r: 'rotate', s: 'scale' }[k];
  if (m && herramienta === 'ver') { modoTransform = m; const el = sel && E.buscarElemento(esc, sel); if (el) ajustarTransform(E.TIPOS[el.tipo] || {}); }
});
window.addEventListener('beforeunload', () => { if (esc) { clearTimeout(guardarT); A.guardarEscenario(E.serializar(esc)); } });

// ---------------------------------------------------------------------------
// Arranque: ?id=… → escenario guardado; si no, el último abierto; si no, uno de ejemplo
// ---------------------------------------------------------------------------
(async function arrancar() {
  redimensionar();
  usarHerramienta('ver');
  let id = new URLSearchParams(location.search).get('id');
  const ret = leerRetornos()[0];
  if (ret) id = ret.v.sessionId.slice(4);
  if (!id) id = localStorage.getItem(CLAVE_ACTUAL);
  let datos = null;
  try { if (id) datos = await A.cargarEscenario(id); } catch (e) { console.error(e); }
  if (!datos) { const l = await A.listar().catch(() => []); if (l[0]) datos = await A.cargarEscenario(l[0].id); }
  if (datos) {
    try { abrirEscenario(E.deserializar(datos).escenario); } catch (e) { console.error(e); datos = null; }
  }
  if (!datos) { abrirEscenario(E.crear({ plantilla: 'rally', semilla: 4242, nombre: 'Circuito de ejemplo' })); await guardarYa(); aviso('Escenario de ejemplo creado. ✨ Nuevo para empezar otro.'); }
  aplicarRetornos();
})();

// Acceso para depurar desde la consola
window.__editor = { get esc() { return esc; }, escena, camara, orbita, THREE, abrir: abrirEscenario, guardar: guardarYa, enfocar, seleccionar, usarHerramienta };
