// Dibujo 3D de un escenario con three.js. Lo usan el editor (index.html) y el visor (visor.html).
// Cada tipo de elemento tiene una función de dibujo registrada en DIBUJOS: para añadir tipos nuevos basta con
// registrarTipo() en escenario-core.js y registrarDibujo() aquí.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const E = window.Escenario;
const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// Utilidades de geometría con color por vértice
// ---------------------------------------------------------------------------
function pintarGeo(geo, color, variacion, semilla) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color), n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  const rnd = E.mulberry32(semilla || 7);
  for (let k = 0; k < n; k += 3) {
    const v = variacion ? 1 + (rnd() - 0.5) * variacion : 1;
    for (let q = 0; q < 3 && k + q < n; q++) { arr[(k + q) * 3] = c.r * v; arr[(k + q) * 3 + 1] = c.g * v; arr[(k + q) * 3 + 2] = c.b * v; }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  return geo;
}
function unir(geos) { const g = mergeGeometries(geos, false); g.computeVertexNormals(); return g; }
function mover(geo, x, y, z) { geo.translate(x, y, z); return geo; }

// Árboles a 10 m de alto (se escalan): una geometría por especie con tronco y copa en colores
const GEO_ARBOL = {};
function geoArbol(especie) {
  if (GEO_ARBOL[especie]) return GEO_ARBOL[especie];
  const T = '#6b4a2f', partes = [];
  switch (especie) {
    case 'pino':
      partes.push(pintarGeo(mover(new THREE.CylinderGeometry(0.25, 0.4, 4, 6), 0, 2, 0), T, 0.1));
      partes.push(pintarGeo(mover(new THREE.ConeGeometry(2.6, 4.5, 7), 0, 4.6, 0), '#2f5d33', 0.18, 1));
      partes.push(pintarGeo(mover(new THREE.ConeGeometry(2.0, 3.8, 7), 0, 6.6, 0), '#356a39', 0.18, 2));
      partes.push(pintarGeo(mover(new THREE.ConeGeometry(1.3, 3.0, 7), 0, 8.5, 0), '#3b7440', 0.18, 3));
      break;
    case 'abeto':
      partes.push(pintarGeo(mover(new THREE.CylinderGeometry(0.2, 0.35, 3, 6), 0, 1.5, 0), T, 0.1));
      partes.push(pintarGeo(mover(new THREE.ConeGeometry(2.2, 8.5, 8), 0, 5.6, 0), '#24472c', 0.2, 4));
      break;
    case 'palmera': {
      const tr = new THREE.CylinderGeometry(0.22, 0.38, 9, 6, 6);
      const p = tr.attributes.position;
      for (let k = 0; k < p.count; k++) { const y = p.getY(k) + 4.5; p.setX(k, p.getX(k) + Math.pow(y / 9, 2) * 1.4); }
      partes.push(pintarGeo(mover(tr, 0, 4.5, 0), '#8a6b45', 0.15));
      for (let h = 0; h < 7; h++) {
        const hoja = new THREE.ConeGeometry(0.6, 4.2, 4, 1);
        hoja.scale(1, 1, 0.25); hoja.rotateZ(-Math.PI / 2 + 0.55); hoja.translate(2, 0, 0); hoja.rotateY(h / 7 * Math.PI * 2);
        partes.push(pintarGeo(mover(hoja, 1.4, 9, 0), h % 2 ? '#3f8a3a' : '#4f9a40', 0.15, h));
      }
      break;
    }
    case 'abedul':
      partes.push(pintarGeo(mover(new THREE.CylinderGeometry(0.18, 0.3, 6.5, 6), 0, 3.25, 0), '#e8e4da', 0.08));
      partes.push(pintarGeo(mover(new THREE.IcosahedronGeometry(2.2, 1), 0, 7.2, 0).scale(1, 1.35, 1), '#7fae4a', 0.2, 5));
      break;
    case 'seco':
      partes.push(pintarGeo(mover(new THREE.CylinderGeometry(0.2, 0.45, 7, 5), 0, 3.5, 0), '#5a4636', 0.1));
      for (let r = 0; r < 4; r++) { const b = new THREE.CylinderGeometry(0.06, 0.14, 3, 4); b.rotateZ(0.9); b.translate(1.1, 5 + r * 0.6, 0); b.rotateY(r * 1.7); partes.push(pintarGeo(b, '#5a4636', 0.1)); }
      break;
    case 'cactus':
      partes.push(pintarGeo(mover(new THREE.CylinderGeometry(0.55, 0.6, 6, 8), 0, 3, 0), '#4f8a43', 0.12));
      partes.push(pintarGeo(mover(new THREE.CylinderGeometry(0.35, 0.35, 2.2, 7), 1.1, 3.6, 0), '#4f8a43', 0.12));
      partes.push(pintarGeo(mover(new THREE.CylinderGeometry(0.35, 0.35, 1.0, 7).rotateZ(Math.PI / 2), 0.6, 2.6, 0), '#4f8a43', 0.12));
      partes.push(pintarGeo(mover(new THREE.CylinderGeometry(0.3, 0.3, 1.8, 7), -1.0, 4.2, 0), '#4f8a43', 0.12));
      partes.push(pintarGeo(mover(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 7).rotateZ(Math.PI / 2), -0.5, 3.4, 0), '#4f8a43', 0.12));
      break;
    default: // roble
      partes.push(pintarGeo(mover(new THREE.CylinderGeometry(0.35, 0.55, 4.5, 6), 0, 2.25, 0), T, 0.1));
      partes.push(pintarGeo(mover(new THREE.IcosahedronGeometry(3.0, 1), 0, 6.6, 0), '#4c7d32', 0.22, 6));
      partes.push(pintarGeo(mover(new THREE.IcosahedronGeometry(2.0, 1), 1.6, 5.6, 0.8), '#558a37', 0.22, 7));
      partes.push(pintarGeo(mover(new THREE.IcosahedronGeometry(1.9, 1), -1.5, 5.9, -0.6), '#477530', 0.22, 8));
  }
  return (GEO_ARBOL[especie] = unir(partes));
}
const ESPECIES_MIXTO = { templado: ['roble', 'pino', 'abedul'], desierto: ['cactus', 'palmera', 'seco'], tropical: ['palmera', 'roble'], nevado: ['abeto', 'pino'], volcanico: ['seco', 'abeto'], otono: ['roble', 'abedul', 'seco'] };

// Rocas: 4 variantes de radio 1
const GEO_ROCA = [];
function geoRoca(v) {
  v = v % 4;
  if (GEO_ROCA[v]) return GEO_ROCA[v];
  const g = new THREE.IcosahedronGeometry(1, 1);
  const N = E.crearRuido(31 + v * 17), p = g.attributes.position;
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
    const f = 1 + N.ruido(x * 1.7 + v, z * 1.7 + y) * 0.35;
    p.setXYZ(k, x * f * (1 + v * 0.1), Math.max(-0.3, y * f * 0.65), z * f);
  }
  g.translate(0, 0.25, 0);
  return (GEO_ROCA[v] = unir([pintarGeo(g, '#ffffff', 0.25, v + 3)]));
}

// Rampa (cuña) de ancho x alto x largo, con la base en y = 0 y la subida hacia +z
function geoRampa(ancho, alto, largo) {
  const a = ancho / 2, l = largo / 2;
  const v = [
    -a, 0, -l, a, 0, -l, a, 0, l, -a, 0, l, // base
    -a, alto, l, a, alto, l // arista alta
  ];
  const idx = [0, 2, 1, 0, 3, 2, /* base */ 0, 1, 5, 0, 5, 4, /* rampa */ 3, 4, 5, 3, 5, 2, /* trasera */ 0, 4, 3, /* lado */ 1, 2, 5];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  const ng = g.toNonIndexed(); ng.computeVertexNormals();
  return ng;
}

// Texturas pequeñas generadas en un lienzo
function texturaRuido(tam, base, amp, semilla) {
  const c = document.createElement('canvas'); c.width = c.height = tam;
  const ctx = c.getContext('2d'), img = ctx.createImageData(tam, tam);
  const N = E.crearRuido(semilla || 5);
  for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
    // ruido periódico: suma de dos octavas sobre un toro
    const a = x / tam * Math.PI * 2, b = y / tam * Math.PI * 2;
    const n = N.fbm(Math.cos(a) * 3 + 10, Math.sin(a) * 3 + Math.cos(b) * 3, 4) * 0.6 + N.ruido(Math.sin(b) * 9 + 3, Math.cos(a) * 9) * 0.4;
    const v = Math.max(0, Math.min(255, base + n * amp));
    const k = (y * tam + x) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function texturaAjedrez() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 32;
  const ctx = c.getContext('2d');
  for (let y = 0; y < 2; y++) for (let x = 0; x < 8; x++) { ctx.fillStyle = (x + y) % 2 ? '#111' : '#fff'; ctx.fillRect(x * 16, y * 16, 16, 16); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  return t;
}
export function crearEtiqueta(texto, opts) {
  opts = opts || {};
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  const fs = 44;
  ctx.font = `bold ${fs}px system-ui, sans-serif`;
  const w = Math.ceil(ctx.measureText(texto).width) + 36;
  c.width = w; c.height = fs + 26;
  ctx.font = `bold ${fs}px system-ui, sans-serif`;
  ctx.fillStyle = opts.fondo || 'rgba(15,20,30,0.72)';
  const r = 16; ctx.beginPath(); ctx.roundRect(0, 0, w, c.height, r); ctx.fill();
  ctx.fillStyle = opts.color || '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(texto, 18, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: opts.depthTest !== false, transparent: true }));
  const alto = opts.alto || 3;
  s.scale.set(alto * w / c.height, alto, 1);
  s.renderOrder = 10;
  if (opts.tamPantalla) { s.material.sizeAttenuation = false; s.scale.set(opts.tamPantalla * w / c.height, opts.tamPantalla, 1); }
  return s;
}
function texturaTexto(texto, fondo, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = fondo; ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 12; ctx.strokeRect(6, 6, 500, 244);
  ctx.fillStyle = color || '#fff8e8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let fs = 90; ctx.font = `bold ${fs}px Georgia, serif`;
  while (ctx.measureText(texto).width > 470 && fs > 20) { fs -= 6; ctx.font = `bold ${fs}px Georgia, serif`; }
  ctx.fillText(texto, 256, 132);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const COLOR_AREA = { pueblo: '#f5c542', zona: '#e74c3c', bosque: '#2ecc71', rocas: '#95a5a6', lago: '#3498db' };
const COLOR_ZONA = { caza: '#e67e22', elite: '#9b59b6', jefe: '#c0392b', pvp: '#e84393', segura: '#2ecc71', arena: '#3498db' };

// ---------------------------------------------------------------------------
// Registro de dibujos por tipo de elemento
// ---------------------------------------------------------------------------
export const DIBUJOS = {};
export function registrarDibujo(tipo, fn) { DIBUJOS[tipo] = fn; }

const matCache = new Map();
function mat(color, extra) {
  const k = color + JSON.stringify(extra || {});
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85 }, extra || {})));
  return matCache.get(k);
}
const MAT_VC = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
const MAT_VC_SUAVE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
function malla(geo, material, sombra) { const m = new THREE.Mesh(geo, material); m.castShadow = sombra !== false; m.receiveShadow = true; return m; }

registrarDibujo('caja', (el) => { const p = el.props; const m = malla(new THREE.BoxGeometry(p.ancho, p.alto, p.fondo), mat(p.color)); m.position.y = p.alto / 2; return m; });
registrarDibujo('plataforma', (el) => {
  const p = el.props, g = new THREE.Group();
  const cuerpo = malla(new THREE.BoxGeometry(p.ancho, p.grosor * 0.8, p.fondo), mat(p.color)); cuerpo.position.y = p.grosor * 0.4;
  const tapa = malla(new THREE.BoxGeometry(p.ancho + 0.1, p.grosor * 0.2, p.fondo + 0.1), mat(p.borde)); tapa.position.y = p.grosor * 0.9;
  g.add(cuerpo, tapa); return g;
});
registrarDibujo('rampa', (el) => { const p = el.props; return malla(geoRampa(p.ancho, p.alto, p.largo), mat(p.color)); });
registrarDibujo('cilindro', (el) => { const p = el.props; const m = malla(new THREE.CylinderGeometry(p.radio, p.radio, p.alto, 24), mat(p.color)); m.position.y = p.alto / 2; return m; });
registrarDibujo('esfera', (el) => { const p = el.props; const m = malla(new THREE.SphereGeometry(p.radio, 24, 16), mat(p.color)); m.position.y = p.radio; return m; });
registrarDibujo('muro', (el) => { const p = el.props; const m = malla(new THREE.BoxGeometry(p.largo, p.alto, p.grosor), mat(p.color)); m.position.y = p.alto / 2 - 0.3; return m; });
registrarDibujo('arbol', (el) => { const m = malla(geoArbol(el.props.especie), MAT_VC); m.scale.setScalar((el.props.alto || 9) / 10); return m; });
registrarDibujo('roca', (el, ctx) => {
  const m = malla(geoRoca(E.hashTexto(el.id)), new THREE.MeshStandardMaterial({ vertexColors: true, color: el.props.color, roughness: 0.95, flatShading: true }));
  m.scale.setScalar(el.props.tam); m.rotation.y = (E.hashTexto(el.id) % 360) * DEG; void ctx; return m;
});

// Dispersión en un área (bosque, pedregal) con InstancedMesh; la altura sigue al terreno.
function dispersar(el, ctx, cantidad, crearInstancias) {
  const rng = E.crearAzar(el.props.semilla || 1), r = el.props.radio, esc = ctx.esc;
  const pts = [];
  const agua = esc.terreno.agua.activa ? esc.terreno.agua.nivel : -Infinity;
  const caminos = ctx.muestrasCaminos();
  for (let k = 0; k < cantidad * 3 && pts.length < cantidad; k++) {
    const a = rng.next() * Math.PI * 2, d = Math.sqrt(rng.next()) * r;
    const x = el.x + Math.cos(a) * d, z = el.z + Math.sin(a) * d;
    if (!E.dentro(esc, x, z)) continue;
    const h = E.alturaEn(esc, x, z);
    if (h < agua + 0.6) continue;
    if (caminos.some(c => c.cerca(x, z))) continue;
    pts.push({ x, z, y: h, s: rng.next(), rot: rng.next() * Math.PI * 2, v: rng.next() });
  }
  return crearInstancias(pts, rng);
}
registrarDibujo('bosque', (el, ctx) => {
  const p = el.props, area = Math.PI * p.radio * p.radio;
  const n = Math.min(4000, Math.round(area / 1000 * p.densidad));
  return dispersar(el, ctx, n, (pts, rng) => {
    const g = new THREE.Group();
    const especies = p.especie === 'mixto' ? (ESPECIES_MIXTO[ctx.esc.terreno.bioma] || ESPECIES_MIXTO.templado) : [p.especie];
    const porEspecie = {};
    const rocas = [];
    for (const q of pts) {
      if (q.v < (p.rocas || 0) * 0.5) { rocas.push(q); continue; }
      const sp = especies[Math.floor(q.v * 997) % especies.length];
      (porEspecie[sp] = porEspecie[sp] || []).push(q);
    }
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), ejeY = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    for (const [sp, lista] of Object.entries(porEspecie)) {
      const im = new THREE.InstancedMesh(geoArbol(sp), MAT_VC, lista.length);
      lista.forEach((q, k) => {
        const alto = p.altoMin + (p.altoMax - p.altoMin) * q.s;
        p3.set(q.x - el.x, q.y - ctx.baseY - 0.2, q.z - el.z); q4.setFromAxisAngle(ejeY, q.rot); s3.setScalar(alto / 10);
        im.setMatrixAt(k, m4.compose(p3, q4, s3));
        col.setScalar(0.82 + q.v * 0.3); im.setColorAt(k, col);
      });
      im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere();
      g.add(im);
    }
    if (rocas.length) g.add(instanciasRocas(rocas, el, ctx, 0.5, 2.2, '#7d7a74'));
    g.userData.sinEscala = true;
    return g;
  });
});
function instanciasRocas(pts, el, ctx, tMin, tMax, color) {
  const g = new THREE.Group();
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), eje = new THREE.Vector3(0, 1, 0);
  const por = [[], [], [], []];
  pts.forEach(q => por[Math.floor(q.v * 4) % 4].push(q));
  por.forEach((lista, v) => {
    if (!lista.length) return;
    const im = new THREE.InstancedMesh(geoRoca(v), new THREE.MeshStandardMaterial({ vertexColors: true, color, roughness: 0.95, flatShading: true }), lista.length);
    lista.forEach((q, k) => { const t = tMin + (tMax - tMin) * q.s * q.s; p3.set(q.x - el.x, q.y - ctx.baseY, q.z - el.z); q4.setFromAxisAngle(eje, q.rot); s3.setScalar(t); im.setMatrixAt(k, m4.compose(p3, q4, s3)); });
    im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere();
    g.add(im);
  });
  return g;
}
registrarDibujo('rocas', (el, ctx) => {
  const p = el.props;
  const g = dispersar(el, ctx, Math.min(2000, p.cantidad | 0), pts => instanciasRocas(pts, el, ctx, p.tamMin, p.tamMax, p.color));
  g.userData.sinEscala = true; return g;
});
registrarDibujo('lago', (el, ctx) => {
  const p = el.props;
  const m = new THREE.Mesh(new THREE.CircleGeometry(p.radio, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: p.color, transparent: true, opacity: 0.82, roughness: 0.08, metalness: 0.1 }));
  m.position.y = (p.nivel || 0) + 0.05; m.receiveShadow = true; void ctx;
  const g = new THREE.Group(); g.add(m); g.userData.sinEscala = true; return g;
});

// Marcas de juego
registrarDibujo('inicio', (el) => {
  const g = new THREE.Group(), c = el.props.color;
  const poste = malla(new THREE.CylinderGeometry(0.08, 0.08, 4, 8), mat('#dddddd')); poste.position.y = 2;
  const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([0, 3.9, 0, 0, 2.9, 0, 0, 3.4, 1.6], 3)); tri.computeVertexNormals();
  const bandera = new THREE.Mesh(tri, new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide }));
  const flecha = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 3).rotateX(Math.PI / 2), mat(c, { emissive: c, emissiveIntensity: 0.25 }));
  flecha.position.set(0, 0.3, 2.2); flecha.scale.y = 0.2;
  const aro = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.8, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.7 }));
  aro.position.y = 0.08;
  g.add(poste, bandera, flecha, aro); return g;
});
function arco(ancho, alto, materialBanda, colorPoste) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) { const p = malla(new THREE.BoxGeometry(0.5, alto, 0.5), mat(colorPoste)); p.position.set(s * ancho / 2, alto / 2, 0); g.add(p); }
  const banda = malla(new THREE.BoxGeometry(ancho + 0.5, 1.1, 0.3), materialBanda); banda.position.y = alto;
  g.add(banda); return g;
}
let TEX_AJEDREZ = null;
registrarDibujo('meta', (el) => {
  if (!TEX_AJEDREZ) TEX_AJEDREZ = texturaAjedrez();
  const t = TEX_AJEDREZ.clone(); t.wrapS = THREE.RepeatWrapping; t.repeat.set(Math.max(1, el.props.ancho / 8), 1); t.needsUpdate = true;
  const g = arco(el.props.ancho, el.props.alto, new THREE.MeshStandardMaterial({ map: t }), '#eeeeee');
  const linea = new THREE.Mesh(new THREE.PlaneGeometry(el.props.ancho, 1.2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: t, polygonOffset: true, polygonOffsetFactor: -4 }));
  linea.position.y = 0.12; g.add(linea);
  return g;
});
registrarDibujo('checkpoint', (el) => {
  const g = arco(el.props.ancho, el.props.alto, mat(el.props.color, { emissive: el.props.color, emissiveIntensity: 0.35 }), '#dcdcdc');
  const et = crearEtiqueta(String(el.props.orden), { alto: 1.6, fondo: 'rgba(0,0,0,0)' }); et.position.y = el.props.alto + 1.3; g.add(et);
  return g;
});
registrarDibujo('moneda', (el) => {
  const m = malla(new THREE.CylinderGeometry(0.6, 0.6, 0.15, 24).rotateX(Math.PI / 2), mat(el.props.color, { metalness: 0.8, roughness: 0.3, emissive: el.props.color, emissiveIntensity: 0.2 }));
  m.position.y = 1; m.scale.setScalar(el.props.tam || 1); m.userData.girar = true;
  const g = new THREE.Group(); g.add(m); return g;
});
registrarDibujo('luz', (el, ctx) => {
  const g = new THREE.Group(), p = el.props;
  const bombilla = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color: p.color }));
  bombilla.position.y = 3;
  const poste = malla(new THREE.CylinderGeometry(0.07, 0.1, 3, 8), mat('#333333')); poste.position.y = 1.5;
  const luz = new THREE.PointLight(p.color, p.intensidad, p.alcance, 2); luz.position.y = 3;
  g.add(bombilla, poste, luz); void ctx; return g;
});
registrarDibujo('cartel', (el) => {
  const g = new THREE.Group();
  const poste = malla(new THREE.BoxGeometry(0.25, 2.6, 0.25), mat('#5a3d22')); poste.position.y = 1.3;
  const tabla = malla(new THREE.BoxGeometry(2.6, 1.3, 0.12), [mat(el.props.color), mat(el.props.color), mat(el.props.color), mat(el.props.color),
    new THREE.MeshStandardMaterial({ map: texturaTexto(el.props.texto || '', el.props.color) }), new THREE.MeshStandardMaterial({ map: texturaTexto(el.props.texto || '', el.props.color) })]);
  tabla.position.y = 2.5;
  g.add(poste, tabla); return g;
});
registrarDibujo('camara', (el, ctx) => {
  const g = new THREE.Group();
  if (!ctx.editor) return g;
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.6, 4).rotateX(-Math.PI / 2), mat('#222', { emissive: '#3498db', emissiveIntensity: 0.6 }));
  c.position.y = el.props.altura; c.rotation.x = el.props.inclinacion * DEG;
  const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, el.props.altura, 4), new THREE.MeshBasicMaterial({ color: '#3498db' })); palo.position.y = el.props.altura / 2;
  g.add(c, palo); return g;
});

// Modelos GLB (importados o de la biblioteca del Creador RPG)
function marcadorFalta(texto) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.MeshStandardMaterial({ color: '#c0392b', wireframe: true }));
  m.position.y = 0.75; g.add(m);
  const et = crearEtiqueta(texto, { alto: 0.8 }); et.position.y = 2.2; g.add(et);
  return g;
}
function dibujarModelo(el, ctx, ruta, altura) {
  const g = new THREE.Group();
  if (!ruta) { g.add(marcadorFalta('Sin modelo')); return g; }
  const temporal = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#888', wireframe: true }));
  temporal.position.y = 0.5; temporal.scale.setScalar(Math.max(1, altura || 2)); g.add(temporal);
  ctx.cargarModelo(ruta).then(res => {
    g.remove(temporal);
    if (!res) { g.add(marcadorFalta('No se pudo cargar')); return; }
    const obj = SkeletonUtils.clone(res.escena);
    // base en y = 0, centrado en x/z y, si se pide, escalado a una altura
    const caja = new THREE.Box3().setFromObject(obj), tam = caja.getSize(new THREE.Vector3());
    const s = altura > 0 && tam.y > 0 ? altura / tam.y : 1;
    obj.scale.multiplyScalar(s);
    const c = caja.getCenter(new THREE.Vector3());
    obj.position.set(-c.x * s, -caja.min.y * s, -c.z * s);
    obj.traverse(o => { if (o.isMesh) { o.castShadow = el.props.sombras !== false; o.receiveShadow = true; } });
    g.add(obj);
    if (res.animaciones && res.animaciones.length) ctx.animar(obj, res.animaciones);
    ctx.alCambiar();
  });
  return g;
}
registrarDibujo('glb', (el, ctx) => dibujarModelo(el, ctx, el.props.modelo, el.props.alturaObjetivo));
registrarDibujo('enemigo', (el, ctx) => {
  const g = dibujarModelo(el, ctx, el.props.modelo, el.props.alturaObjetivo || 2.4);
  if (ctx.editor || ctx.etiquetas) { const et = crearEtiqueta((el.nombre || 'Enemigo') + ' · Nv ' + el.props.nivel, { alto: 0.9 }); et.position.y = (el.props.alturaObjetivo || 2.4) + 1; g.add(et); }
  return g;
});

// RPG: maqueta del pueblo (casas y muralla a partir de su configuración del Creador de Pueblos)
const PALETAS_PUEBLO = {
  l2_fantasy: ['#d9cdb4', '#8b3a2f'], european: ['#e8dcc6', '#9c4a30'], fortified: ['#b8ad9c', '#5d4a3a'], trade: ['#e6d2a8', '#a4532d'],
  dwarven: ['#8f8577', '#4b4038'], elven: ['#e9efe0', '#3f7a5a'], desert: ['#e3c99a', '#c9a46a'], nordic: ['#8a6a4a', '#3e4a52'], oriental: ['#e7dcc8', '#7a2a2a'], swamp: ['#7a6a52', '#4a5a3a']
};
registrarDibujo('pueblo', (el, ctx) => {
  const cfg = el.props.cfg || E.cfgPuebloPorDefecto(1, 3), R = el.props.radio, esc = ctx.esc;
  const g = new THREE.Group(); g.userData.sinEscala = true;
  const [pared, tejado] = PALETAS_PUEBLO[cfg.style] || PALETAS_PUEBLO.european;
  const rng = E.crearAzar(cfg.seed || 1);
  const yLocal = (x, z) => E.alturaEn(esc, el.x + x, el.z + z) - ctx.baseY;
  // Suelo de la plaza y calles principales
  const suelo = new THREE.CircleGeometry(R * 0.2, 40).rotateX(-Math.PI / 2);
  const ps = suelo.attributes.position;
  for (let k = 0; k < ps.count; k++) ps.setY(k, yLocal(ps.getX(k), ps.getZ(k)) + 0.08);
  g.add(malla(pintarGeo(suelo, '#b3a48e', 0.05), MAT_VC_SUAVE, false));
  const geos = [];
  const rot = (cfg.rotation || 0) * DEG;
  for (let s = 0; s < 4; s++) {
    const a = rot + s * Math.PI / 2, ancho = cfg.roadWidth || 7, n = 24;
    const calle = new THREE.PlaneGeometry(ancho, R * 0.95, 1, n).rotateX(-Math.PI / 2);
    calle.translate(0, 0, R * 0.95 / 2); calle.rotateY(-a + Math.PI / 2);
    const pc = calle.attributes.position;
    for (let k = 0; k < pc.count; k++) pc.setY(k, yLocal(pc.getX(k), pc.getZ(k)) + 0.07);
    geos.push(pintarGeo(calle, '#9c8f7c', 0.05, s));
  }
  // Casas en anillos, sin pisar las calles
  const nCasas = Math.round((cfg.size || 3) * 9 * (cfg.houseDensity || 80) / 80);
  const casas = [];
  for (let k = 0; k < nCasas * 6 && casas.length < nCasas; k++) {
    const a = rng.next() * Math.PI * 2, d = R * (0.24 + rng.next() * 0.58);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    // distancia a las calles (4 rectas desde el centro)
    let lejos = true;
    for (let s = 0; s < 4; s++) { const b = rot + s * Math.PI / 2; const dist = Math.abs(-Math.sin(b) * x + Math.cos(b) * z); const proy = Math.cos(b) * x + Math.sin(b) * z; if (proy > 0 && dist < (cfg.roadWidth || 7) / 2 + 5) lejos = false; }
    if (!lejos || casas.some(c => Math.hypot(c.x - x, c.z - z) < 11)) continue;
    casas.push({ x, z, w: 6 + rng.next() * 4, f: 6 + rng.next() * 3, pisos: 1 + Math.floor(rng.next() * (cfg.maxFloors || 2)), a: Math.atan2(z, x) });
  }
  for (const c of casas) {
    const h = c.pisos * 3.2, y = yLocal(c.x, c.z);
    const cuerpo = new THREE.BoxGeometry(c.w, h + 1, c.f); cuerpo.translate(0, (h + 1) / 2 - 1, 0);
    const techo = new THREE.ConeGeometry(Math.hypot(c.w, c.f) / 2 + 0.4, 3.4, 4); techo.rotateY(Math.PI / 4); techo.scale(c.w / Math.hypot(c.w, c.f) * 1.41, 1, c.f / Math.hypot(c.w, c.f) * 1.41); techo.translate(0, h + 1.7, 0);
    for (const [geo, col] of [[cuerpo, pared], [techo, tejado]]) { geo.rotateY(-c.a); geo.translate(c.x, y, c.z); geos.push(pintarGeo(geo, col, 0.12, Math.round(c.x * 13))); }
  }
  // Muralla con 4 puertas y torres
  if (cfg.hasWalls) {
    const rm = R * 0.88, segs = 48;
    for (let k = 0; k < segs; k++) {
      const a0 = k / segs * Math.PI * 2, a1 = (k + 1) / segs * Math.PI * 2, am = (a0 + a1) / 2;
      const enPuerta = [0, 1, 2, 3].some(s => { let d = Math.abs(((am - rot - s * Math.PI / 2) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI); return d < 0.07; });
      if (enPuerta) continue;
      const x0 = Math.cos(a0) * rm, z0 = Math.sin(a0) * rm, x1 = Math.cos(a1) * rm, z1 = Math.sin(a1) * rm;
      const largo = Math.hypot(x1 - x0, z1 - z0) + 0.4, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      const w = new THREE.BoxGeometry(largo, 7, 1.6); w.translate(0, 2.5, 0); w.rotateY(-Math.atan2(z1 - z0, x1 - x0)); w.translate(mx, yLocal(mx, mz), mz);
      geos.push(pintarGeo(w, '#8d8478', 0.08, k));
      if (k % 6 === 0) { const t = new THREE.CylinderGeometry(2.4, 2.6, 11, 8); t.translate(x0, yLocal(x0, z0) + 4, z0); geos.push(pintarGeo(t, '#7f776b', 0.08, k + 99)); }
    }
  }
  if (geos.length) g.add(malla(unir(geos), MAT_VC));
  if (ctx.editor || ctx.etiquetas) { const et = crearEtiqueta('🏘 ' + el.nombre + ' · Nv ' + (el.props.nivel || 1), { alto: Math.max(4, R * 0.06) }); et.position.y = yLocal(0, 0) + 22; g.add(et); }
  return g;
});
registrarDibujo('zona', (el, ctx) => {
  const p = el.props, g = new THREE.Group(); g.userData.sinEscala = true;
  const col = COLOR_ZONA[p.subtipo] || '#e74c3c';
  // Enemigos colocados en la zona
  const lista = (p.enemigos || []).filter(e => e && e.modelo);
  const rng = E.crearAzar(p.semilla || 1);
  let total = 0;
  for (const en of lista) {
    for (let k = 0; k < Math.min(20, en.cantidad || 1) && total < 40; k++, total++) {
      const a = rng.next() * Math.PI * 2, d = Math.sqrt(rng.next()) * p.radio * 0.75;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const m = dibujarModelo({ props: { sombras: true } }, ctx, en.modelo, en.alto || 2.4);
      m.position.set(x, E.alturaEn(ctx.esc, el.x + x, el.z + z) - ctx.baseY, z);
      m.rotation.y = rng.next() * Math.PI * 2;
      g.add(m);
    }
  }
  if (ctx.editor || ctx.etiquetas) {
    const et = crearEtiqueta('⚔ ' + el.nombre + ' · Nv ' + p.nivelMin + '–' + p.nivelMax, { alto: Math.max(3, p.radio * 0.05), fondo: 'rgba(80,10,10,0.7)' });
    et.position.y = E.alturaEn(ctx.esc, el.x, el.z) - ctx.baseY + 12; g.add(et);
  }
  g.userData.colorArea = col;
  return g;
});
registrarDibujo('mazmorra', (el, ctx) => {
  const g = new THREE.Group();
  const piedra = '#6f6a63';
  for (const s of [-1, 1]) { const p = malla(new THREE.BoxGeometry(1.6, 6, 1.6), mat(piedra)); p.position.set(s * 3, 3, 0); g.add(p); }
  const din = malla(new THREE.BoxGeometry(8.2, 1.6, 2), mat('#5d5852')); din.position.y = 6.6; g.add(din);
  const hueco = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 6), new THREE.MeshBasicMaterial({ color: '#050505' })); hueco.position.set(0, 3, -0.2); g.add(hueco);
  const fondo = malla(new THREE.BoxGeometry(9, 8, 6), mat('#57524b')); fondo.position.set(0, 3.5, -3.4); g.add(fondo);
  for (let k = 0; k < 5; k++) { const r = malla(geoRoca(k), mat('#6a655d', { vertexColors: true, flatShading: true })); r.scale.setScalar(1.5 + (k % 3)); r.position.set(-5 + k * 2.5, 0, -6 - (k % 2) * 2); g.add(r); }
  if (ctx.editor || ctx.etiquetas) { const et = crearEtiqueta('🕳 ' + el.nombre + ' · Nv ' + el.props.nivel, { alto: 2.4 }); et.position.y = 10; g.add(et); }
  return g;
});

// ---------------------------------------------------------------------------
// La escena
// ---------------------------------------------------------------------------
export class Escena3D {
  // opts: { scene, renderer, editor, calidad: 'baja'|'media'|'alta', cargarModeloLocal(id) → Promise<ArrayBuffer>, alCambiar() }
  constructor(opts) {
    this.o = Object.assign({ editor: false, calidad: 'media', etiquetas: true, mostrarAreas: true }, opts);
    this.scene = opts.scene;
    this.renderer = opts.renderer;
    this.raiz = new THREE.Group(); this.scene.add(this.raiz);
    this.gTerreno = new THREE.Group(); this.gCaminos = new THREE.Group(); this.gElementos = new THREE.Group(); this.gAreas = new THREE.Group();
    this.raiz.add(this.gTerreno, this.gCaminos, this.gElementos, this.gAreas);
    this.objetos = new Map(); // id → Object3D
    this.modelos = new Map(); // ruta → Promise<{ escena, animaciones }>
    this.mezcladores = [];
    this.reloj = 0;
    this._muestrasCaminos = null;
    this.loader = new GLTFLoader();
    const draco = new DRACOLoader(); draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/libs/draco/gltf/');
    this.loader.setDRACOLoader(draco); this.loader.setMeshoptDecoder(MeshoptDecoder);
    this._crearAmbiente();
    this.texSuelo = texturaRuido(256, 200, 55, 11);
  }

  // --- Cielo, sol y niebla ---
  _crearAmbiente() {
    this.cielo = new Sky(); this.cielo.scale.setScalar(10000);
    const u = this.cielo.material.uniforms;
    u.turbidity.value = 2; u.rayleigh.value = 0.9; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.8;
    this.scene.add(this.cielo);
    this.sol = new THREE.DirectionalLight('#fff4e0', 2.4);
    this.sol.castShadow = this.o.calidad !== 'baja';
    const sm = this.o.calidad === 'alta' ? 4096 : 2048;
    this.sol.shadow.mapSize.set(sm, sm);
    this.sol.shadow.bias = -0.0004; this.sol.shadow.normalBias = 0.6;
    this.scene.add(this.sol, this.sol.target);
    this.hemi = new THREE.HemisphereLight('#cfe3ff', '#5a5040', 0.9);
    this.scene.add(this.hemi);
    this.scene.fog = new THREE.Fog('#bcd3e6', 300, 3000);
    this.foco = new THREE.Vector3();
  }
  setHora(h) {
    this.hora = h;
    const t = (h - 6) / 12; // 0 amanecer, 0.5 mediodía, 1 anochecer
    const elev = Math.sin(t * Math.PI) * 70; // grados
    const azim = 30 + (t - 0.5) * 160; // a mediodía el sol viene del lado de la cámara inicial (+x, +z)
    const dia = THREE.MathUtils.clamp((elev + 6) / 20, 0, 1);
    const ocaso = THREE.MathUtils.clamp(1 - Math.abs(elev - 4) / 14, 0, 1) * dia;
    const sun = new THREE.Vector3().setFromSphericalCoords(1, (90 - Math.max(elev, -10)) * DEG, azim * DEG);
    this.cielo.material.uniforms.sunPosition.value.copy(sun);
    this.dirSol = sun.clone();
    this.sol.intensity = 0.15 + 2.6 * dia;
    this.sol.color.set('#fff4e0').lerp(new THREE.Color('#ff9a52'), ocaso);
    if (dia < 0.05) this.sol.color.set('#8fa6d8');
    this.hemi.intensity = 0.2 + 0.8 * dia;
    this.hemi.color.set('#cfe3ff').lerp(new THREE.Color('#33406a'), 1 - dia);
    const niebla = new THREE.Color('#bcd3e6').lerp(new THREE.Color('#e6a77a'), ocaso).lerp(new THREE.Color('#0c1220'), 1 - dia);
    this.scene.fog.color.copy(niebla);
    this.scene.background = niebla.clone();
    this.cielo.visible = dia > 0.02;
    this.renderer.toneMappingExposure = 0.3 + 0.25 * dia;
    this._colocarSol();
  }
  setNubes(n) { // 0–1
    const u = this.cielo.material.uniforms;
    if (u.cloudCoverage) { u.cloudCoverage.value = n; u.cloudDensity.value = 0.25 + n * 0.4; }
  }
  setNiebla(n) { // 0–1
    const tam = this.esc ? this.esc.terreno.tam : 1024;
    const lejos = THREE.MathUtils.lerp(Math.max(6000, tam * 3), Math.max(250, tam * 0.25), n);
    this.scene.fog.near = lejos * 0.08; this.scene.fog.far = lejos;
  }
  setFoco(x, z, radio) {
    this.foco.set(x, this.esc ? E.alturaEn(this.esc, x, z) : 0, z);
    if (radio) this.radioSombra = radio;
    this._colocarSol();
  }
  _colocarSol() {
    if (!this.dirSol) return;
    const r = this.radioSombra || 200;
    this.sol.position.copy(this.foco).addScaledVector(this.dirSol, r * 3);
    this.sol.target.position.copy(this.foco);
    const c = this.sol.shadow.camera;
    c.left = -r; c.right = r; c.top = r; c.bottom = -r; c.near = 1; c.far = r * 7;
    c.updateProjectionMatrix();
  }

  // --- Construcción completa ---
  construir(esc) {
    this.esc = esc;
    this._muestrasCaminos = null;
    this.construirTerreno();
    this.construirAgua();
    this.construirCaminos();
    this.reconstruirElementos();
    this.setHora(esc.ambiente.hora);
    this.setNiebla(esc.ambiente.niebla);
    this.setNubes(esc.ambiente.nubes == null ? 0.4 : esc.ambiente.nubes);
    this.setFoco(0, 0, Math.min(esc.terreno.tam * 0.6, this.o.editor ? 700 : 220));
  }

  construirTerreno() {
    const esc = this.esc, t = esc.terreno, r = t.res;
    if (this.terreno) { this.gTerreno.remove(this.terreno); this.terreno.geometry.dispose(); }
    if (this.falda) { this.gTerreno.remove(this.falda); this.falda.geometry.dispose(); }
    const geo = new THREE.PlaneGeometry(t.tam, t.tam, r - 1, r - 1).rotateX(-Math.PI / 2);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(r * r * 3), 3));
    // uv en metros para la textura de detalle
    const uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * t.tam / 6, uv.getY(k) * t.tam / 6);
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, map: this.texSuelo });
    this.terreno = new THREE.Mesh(geo, m);
    this.terreno.receiveShadow = true; this.terreno.castShadow = this.o.calidad === 'alta';
    this.terreno.name = 'terreno';
    this.gTerreno.add(this.terreno);
    // Falda en los bordes para que el terreno parezca un bloque
    this.falda = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: '#5b4a3a', roughness: 1, side: THREE.DoubleSide }));
    this.falda.visible = t.bordes !== 'infinito' || this.o.editor;
    this.gTerreno.add(this.falda);
    this._rango = E.rangoAlturas(esc);
    this.actualizarTerreno();
  }

  // Actualiza alturas y colores (en una región de la rejilla o entero)
  actualizarTerreno(reg, soloColor) {
    const esc = this.esc, t = esc.terreno, r = t.res;
    if (!this.terreno || this.terreno.geometry.attributes.position.count !== r * r) return this.construirTerreno();
    const pos = this.terreno.geometry.attributes.position, col = this.terreno.geometry.attributes.color;
    if (!reg) { reg = { i0: 0, i1: r - 1, j0: 0, j1: r - 1 }; this._rango = E.rangoAlturas(esc); }
    const i0 = Math.max(0, reg.i0 - 1), i1 = Math.min(r - 1, reg.i1 + 1), j0 = Math.max(0, reg.j0 - 1), j1 = Math.min(r - 1, reg.j1 + 1);
    const cols = E.MATERIALES.map(m => new THREE.Color(m.color));
    if (!this._ruidoColor || this._ruidoColor.semilla !== t.gen.semilla) { this._ruidoColor = E.crearRuido((t.gen.semilla || 1) + 555); this._ruidoColor.semilla = t.gen.semilla; }
    const N = this._ruidoColor, p = E.paso(esc), m0 = -t.tam / 2;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * r + i;
      if (!soloColor) pos.setY(k, t.alturas[k]);
      const c = cols[E.materialEn(esc, i, j, this._rango)] || cols[1];
      // variación: grano fino por vértice + manchas grandes, para que el suelo no sea plano
      const x = m0 + i * p, z = m0 + j * p;
      const mancha = N.fbm(x / 90, z / 90, 3);
      const v = (0.94 + ((Math.imul(k, 2654435761) >>> 0) % 1000) / 1000 * 0.12) * (0.92 + mancha * 0.16);
      const calido = Math.max(0, N.ruido(x / 260 + 7, z / 260 - 3)) * 0.12;
      col.setXYZ(k, (c.r + calido * 0.5) * v, (c.g + calido * 0.25) * v, c.b * v);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
    if (!soloColor) {
      this.terreno.geometry.computeVertexNormals();
      this.terreno.geometry.computeBoundingSphere(); this.terreno.geometry.computeBoundingBox();
      this._actualizarFalda();
    }
  }
  _actualizarFalda() {
    const esc = this.esc, t = esc.terreno, r = t.res, m = t.tam / 2, p = E.paso(esc);
    const fondo = Math.min(this._rango.min, t.agua.activa ? t.agua.nivel : this._rango.min) - Math.max(10, t.tam * 0.02);
    const borde = [];
    for (let i = 0; i < r; i++) borde.push([i, 0]);
    for (let j = 1; j < r; j++) borde.push([r - 1, j]);
    for (let i = r - 2; i >= 0; i--) borde.push([i, r - 1]);
    for (let j = r - 2; j >= 0; j--) borde.push([0, j]);
    const v = [];
    for (let k = 0; k < borde.length - 1; k++) {
      const [ia, ja] = borde[k], [ib, jb] = borde[k + 1];
      const ax = -m + ia * p, az = -m + ja * p, bx = -m + ib * p, bz = -m + jb * p;
      const ha = t.alturas[ja * r + ia], hb = t.alturas[jb * r + ib];
      v.push(ax, ha, az, bx, hb, bz, bx, fondo, bz, ax, ha, az, bx, fondo, bz, ax, fondo, az);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
    this.falda.geometry.dispose(); this.falda.geometry = g;
  }

  construirAgua() {
    const esc = this.esc, a = esc.terreno.agua;
    if (this.agua) { this.gTerreno.remove(this.agua); this.agua.geometry.dispose(); this.agua = null; }
    if (!a.activa) return;
    const B = E.BIOMAS[esc.terreno.bioma] || E.BIOMAS.templado;
    const tam = this.o.editor || esc.terreno.bordes !== 'infinito' ? esc.terreno.tam : esc.terreno.tam * 8;
    this.agua = new THREE.Mesh(new THREE.PlaneGeometry(tam, tam).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: a.color || B.agua, transparent: true, opacity: 0.84, roughness: 0.06, metalness: 0.15 }));
    this.agua.position.y = a.nivel; this.agua.receiveShadow = true; this.agua.name = 'agua';
    this.gTerreno.add(this.agua);
  }

  // --- Caminos ---
  muestrasCaminos() {
    if (this._muestrasCaminos) return this._muestrasCaminos;
    this._muestrasCaminos = this.esc.caminos.filter(c => c.puntos.length >= 2).map(c => {
      const mu = E.muestrearCamino(c, 3), lim = c.ancho / 2 + 1.5;
      const celdas = new Map();
      for (const m of mu) { const k = Math.floor(m.x / 10) + ',' + Math.floor(m.z / 10); if (!celdas.has(k)) celdas.set(k, []); celdas.get(k).push(m); }
      return { cerca(x, z) {
        const cx = Math.floor(x / 10), cz = Math.floor(z / 10);
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = celdas.get((cx + a) + ',' + (cz + b)); if (l) for (const m of l) if (Math.hypot(m.x - x, m.z - z) < lim) return true; }
        return false;
      } };
    });
    return this._muestrasCaminos;
  }
  construirCaminos() {
    this._muestrasCaminos = null;
    for (const o of this.gCaminos.children.slice()) { this.gCaminos.remove(o); o.geometry && o.geometry.dispose(); }
    for (const c of this.esc.caminos) this.gCaminos.add(this._mallaCamino(c));
  }
  _mallaCamino(c) {
    const esc = this.esc;
    const mu = E.muestrearCamino(c, 1.5);
    const g = new THREE.BufferGeometry();
    if (mu.length < 2) { const m = new THREE.Mesh(g); m.userData.caminoId = c.id; return m; }
    const tipo = E.TIPOS_CAMINO.find(t => t[0] === c.tipo) || E.TIPOS_CAMINO[0];
    const base = new THREE.Color(E.MATERIALES[tipo[2]].color), blanco = new THREE.Color('#f2f2f2'), borde = base.clone().multiplyScalar(0.8);
    const cruz = c.bordes ? [-0.5, -0.47, -0.44, -0.41, -0.2, 0, 0.2, 0.41, 0.44, 0.47, 0.5] : [-0.5, -0.38, -0.2, 0, 0.2, 0.38, 0.5];
    const colorEn = u => { const a = Math.abs(u); if (c.bordes && a > 0.435 && a < 0.475) return blanco; if (a > 0.45) return borde; return base; };
    const pos = [], col = [], uv = [], idx = [];
    const W = cruz.length;
    const agua = esc.terreno.agua.activa ? esc.terreno.agua.nivel + 0.3 : -Infinity;
    for (let k = 0; k < mu.length; k++) {
      const a = mu[Math.max(0, k - 1)], b = mu[Math.min(mu.length - 1, k + 1)];
      let dx = b.x - a.x, dz = b.z - a.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const nx = -dz, nz = dx;
      for (let q = 0; q < W; q++) {
        const u = cruz[q], x = mu[k].x + nx * u * c.ancho, z = mu[k].z + nz * u * c.ancho;
        const y = Math.max(E.alturaEn(esc, x, z), agua) + (Math.abs(u) > 0.49 ? 0.04 : 0.14);
        pos.push(x, y, z);
        const cc = colorEn(u), v = 0.95 + ((k * 7 + q * 13) % 10) / 100;
        col.push(cc.r * v, cc.g * v, cc.b * v);
        uv.push((u + 0.5) * c.ancho / 6, mu[k].d / 6);
      }
      if (k > 0) for (let q = 0; q < W - 1; q++) { const a0 = (k - 1) * W + q, a1 = a0 + 1, b0 = k * W + q, b1 = b0 + 1; idx.push(a0, a1, b0, a1, b1, b0); }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: c.tipo === 'asfalto' ? 0.75 : 0.95, map: this.texSuelo, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.receiveShadow = true; m.userData.caminoId = c.id;
    return m;
  }

  // --- Elementos ---
  _ctx(el) {
    const self = this;
    return {
      esc: this.esc, editor: this.o.editor, etiquetas: this.o.etiquetas,
      baseY: this._baseY(el),
      cargarModelo: ruta => self.cargarModelo(ruta),
      animar: (obj, anims) => self._animar(obj, anims),
      muestrasCaminos: () => self.muestrasCaminos(),
      alCambiar: () => self.o.alCambiar && self.o.alCambiar()
    };
  }
  _baseY(el) { return E.alturaEn(this.esc, el.x, el.z) + (el.y || 0); }
  reconstruirElementos() {
    for (const id of Array.from(this.objetos.keys())) this.quitarElemento(id);
    for (const el of this.esc.elementos) this.actualizarElemento(el);
  }
  actualizarElemento(el) {
    this.quitarElemento(el.id);
    const fn = DIBUJOS[el.tipo];
    const g = new THREE.Group();
    g.userData.elId = el.id;
    if (fn) { try { g.add(fn(el, this._ctx(el))); } catch (e) { console.error('Error dibujando', el, e); g.add(marcadorFalta('Error: ' + el.tipo)); } }
    else g.add(marcadorFalta('Tipo sin dibujo: ' + el.tipo));
    this.colocar(el, g);
    this.gElementos.add(g);
    this.objetos.set(el.id, g);
    // Contorno de las áreas
    const def = E.TIPOS[el.tipo];
    if (def && def.forma === 'area' && (this.o.editor || this.o.mostrarAreas)) {
      const col = (g.children[0] && g.children[0].userData.colorArea) || COLOR_AREA[el.tipo] || '#ffffff';
      const aro = this._aro(el.x, el.z, el.props.radio, col);
      aro.userData.elId = el.id; this.gAreas.add(aro);
      g.userData.aro = aro;
    }
    return g;
  }
  colocar(el, g) {
    g = g || this.objetos.get(el.id);
    if (!g) return;
    const def = E.TIPOS[el.tipo] || {};
    g.position.set(el.x, this._baseY(el), el.z);
    const area = def.forma === 'area';
    g.rotation.set(0, area ? 0 : (el.rotY || 0) * DEG, 0);
    g.scale.setScalar(area ? 1 : (el.escala || 1));
  }
  quitarElemento(id) {
    const g = this.objetos.get(id);
    if (!g) return;
    this.gElementos.remove(g);
    if (g.userData.aro) { this.gAreas.remove(g.userData.aro); g.userData.aro.geometry.dispose(); }
    this.mezcladores = this.mezcladores.filter(m => { let dentroG = false; m.raiz.traverseAncestors(a => { if (a === g) dentroG = true; }); return !dentroG; });
    g.traverse(o => { if (o.geometry && !Object.values(GEO_ARBOL).includes(o.geometry) && !GEO_ROCA.includes(o.geometry)) o.geometry.dispose(); });
    this.objetos.delete(id);
  }
  _aro(x, z, r, color) {
    const n = Math.max(48, Math.min(256, Math.round(r))), pts = [];
    for (let k = 0; k <= n; k++) { const a = k / n * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; pts.push(px, E.sueloEn(this.esc, px, pz) + 0.6, pz); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color, dashSize: 4, gapSize: 2.5, transparent: true, opacity: 0.9, depthTest: false }));
    l.computeLineDistances(); l.renderOrder = 5;
    return l;
  }
  setMostrarAreas(v) { this.o.mostrarAreas = v; this.gAreas.visible = v; }

  // --- Modelos .glb ---
  // ruta: 'local:<id>' (importado, en IndexedDB), 'rpg:<ruta>' (biblioteca del Creador RPG) o una URL
  resolverRuta(ruta) {
    if (ruta.startsWith('rpg:')) return (this.esc.enlaces.rpgBase || E.RPG_BASE).replace(/\/?$/, '/') + ruta.slice(4);
    return ruta;
  }
  cargarModelo(ruta) {
    const clave = ruta.startsWith('local:') ? ruta : this.resolverRuta(ruta);
    if (this.modelos.has(clave)) return this.modelos.get(clave);
    const pr = (async () => {
      try {
        this._cargando = (this._cargando || 0) + 1; this.o.alCargar && this.o.alCargar(this._cargando);
        let gltf;
        if (ruta.startsWith('local:')) {
          const buf = this.o.cargarModeloLocal ? await this.o.cargarModeloLocal(ruta.slice(6)) : null;
          if (!buf) throw new Error('Modelo local no encontrado: ' + ruta);
          gltf = await this.loader.parseAsync(buf, '');
        } else gltf = await this.loader.loadAsync(clave);
        return { escena: gltf.scene, animaciones: gltf.animations || [] };
      } catch (e) {
        console.warn('No se pudo cargar el modelo', ruta, e);
        this.modelos.delete(clave);
        return null;
      } finally { this._cargando--; this.o.alCargar && this.o.alCargar(this._cargando); }
    })();
    this.modelos.set(clave, pr);
    return pr;
  }
  _animar(obj, anims) {
    if (this.o.editor && !this.o.animarEnEditor) return;
    const mx = new THREE.AnimationMixer(obj);
    const clip = anims.find(a => /idle|reposo|espera|stand/i.test(a.name)) || anims[0];
    const accion = mx.clipAction(clip); accion.play(); accion.time = Math.random() * clip.duration;
    mx.raiz = obj;
    this.mezcladores.push(mx);
  }
  actualizar(dt) {
    this.reloj += dt;
    if (this.cielo.material.uniforms.time) this.cielo.material.uniforms.time.value = this.reloj;
    for (const m of this.mezcladores) m.update(dt);
    this.gElementos.traverse(o => { if (o.userData.girar) o.rotation.y += dt * 2; });
  }

  // --- Consultas ---
  // Punto del terreno bajo un rayo (marcha a lo largo del rayo sobre el mapa de alturas)
  rayoTerreno(rayo, conAgua) {
    const esc = this.esc;
    if (!esc) return null;
    const o = rayo.origin, d = rayo.direction;
    const pasoR = Math.max(0.5, E.paso(esc) * 0.5), max = esc.terreno.tam * 3;
    const suelo = (x, z) => conAgua ? E.sueloEn(esc, x, z) : E.alturaEn(esc, x, z);
    let tPrev = 0, prevSobre = o.y - suelo(o.x, o.z);
    if (prevSobre < 0) return null;
    // Avance con paso que crece con la distancia
    for (let t = pasoR; t < max; t += pasoR * (1 + t / 400)) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      const m = esc.terreno.tam / 2;
      if (Math.abs(x) > m * 1.5 || Math.abs(z) > m * 1.5) { if (d.y >= 0) return null; continue; }
      const sobre = y - suelo(x, z);
      if (sobre < 0 && E.dentro(esc, x, z)) {
        let a = tPrev, b = t;
        for (let k = 0; k < 18; k++) { const c = (a + b) / 2; const yy = o.y + d.y * c, xx = o.x + d.x * c, zz = o.z + d.z * c; if (yy - suelo(xx, zz) > 0) a = c; else b = c; }
        const tt = (a + b) / 2;
        return new THREE.Vector3(o.x + d.x * tt, o.y + d.y * tt, o.z + d.z * tt);
      }
      tPrev = t; prevSobre = sobre;
    }
    return null;
  }
  // Elemento bajo un rayo (devuelve su id)
  rayoElemento(raycaster) {
    const hits = raycaster.intersectObjects(this.gElementos.children, true);
    for (const h of hits) {
      if (h.object.isSprite) continue;
      let o = h.object;
      while (o && !o.userData.elId) o = o.parent;
      if (o) return { id: o.userData.elId, punto: h.point, dist: h.distance };
    }
    return null;
  }
}
