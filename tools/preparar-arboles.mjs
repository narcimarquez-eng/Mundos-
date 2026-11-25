// Prepara los árboles .glb para el escenario (bosques con niveles de detalle).
// De cada modelo de modelos-fuente/arboles/ sale glb/arboles/<id>.glb con:
//   - nodos «tronco» y «copa»: el modelo completo, con vértices soldados y texturas en WebP (≤ 1024 px)
//   - nodos «tronco_medio» y «copa_medio»: la versión para media distancia, que comparte materiales y texturas:
//     el tronco simplificado con meshoptimizer y la copa con menos tarjetas de hojas, algo más grandes
//     para que el follaje no se vea más ralo.
// Y glb/arboles/indice.json con medidas y triángulos.
// Uso: cd tools && npm install && node preparar-arboles.mjs
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, weldPrimitive, prune, textureCompress, simplifyPrimitive, getBounds, meshopt } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fuente = path.join(raiz, 'modelos-fuente/arboles');
const destino = path.join(raiz, 'glb/arboles');
fs.mkdirSync(destino, { recursive: true });

const OPC = {
  tamTextura: 1024,
  calidadWebp: 86,
  troncoMedio: 0.3,      // proporción de triángulos del tronco que quedan en la versión media
  copaMedio: 0.4,        // proporción de tarjetas de hojas que quedan en la versión media
  agrandarCopa: 1.4      // cuánto crecen las tarjetas que quedan
};

await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

// Azar determinista por número
const azar = n => { let t = (n + 0x6D2B79F5) >>> 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function triangulos(prim) { const i = prim.getIndices(); return (i ? i.getCount() : prim.getAttribute('POSITION').getCount()) / 3; }

// Copia de una primitiva con sus propios accesores (para poder cambiarla sin tocar la original)
function copiarPrimitiva(doc, prim) {
  const nueva = doc.createPrimitive().setMaterial(prim.getMaterial()).setMode(prim.getMode());
  for (const sem of prim.listSemantics()) {
    const a = prim.getAttribute(sem);
    nueva.setAttribute(sem, doc.createAccessor().setType(a.getType()).setArray(a.getArray().slice()).setNormalized(a.getNormalized()).setBuffer(a.getBuffer()));
  }
  const ind = prim.getIndices();
  if (ind) nueva.setIndices(doc.createAccessor().setType('SCALAR').setArray(ind.getArray().slice()).setBuffer(ind.getBuffer()));
  return nueva;
}

// Copa con menos tarjetas: agrupa los triángulos en piezas unidas (cada tarjeta o ramita), se queda con una
// parte y agranda cada pieza alrededor de su centro.
function aclararCopa(prim, proporcion, agrandar) {
  const ind = prim.getIndices().getArray();
  const pos = prim.getAttribute('POSITION').getArray();
  const nV = pos.length / 3;
  const padre = new Uint32Array(nV); for (let i = 0; i < nV; i++) padre[i] = i;
  const buscar = a => { while (padre[a] !== a) { padre[a] = padre[padre[a]]; a = padre[a]; } return a; };
  const unir = (a, b) => { a = buscar(a); b = buscar(b); if (a !== b) padre[a] = b; };
  for (let t = 0; t < ind.length; t += 3) { unir(ind[t], ind[t + 1]); unir(ind[t], ind[t + 2]); }
  // centro de cada pieza
  const suma = new Map();
  for (let v = 0; v < nV; v++) {
    const r = buscar(v); let s = suma.get(r);
    if (!s) { s = [0, 0, 0, 0]; suma.set(r, s); }
    s[0] += pos[v * 3]; s[1] += pos[v * 3 + 1]; s[2] += pos[v * 3 + 2]; s[3]++;
  }
  const queda = new Map();
  for (const r of suma.keys()) queda.set(r, azar(r * 7919 + 17) < proporcion);
  const nuevos = [];
  for (let t = 0; t < ind.length; t += 3) if (queda.get(buscar(ind[t]))) nuevos.push(ind[t], ind[t + 1], ind[t + 2]);
  const p2 = pos.slice();
  for (let v = 0; v < nV; v++) {
    const r = buscar(v); if (!queda.get(r)) continue;
    const s = suma.get(r);
    for (let c = 0; c < 3; c++) { const m = s[c] / s[3]; p2[v * 3 + c] = m + (pos[v * 3 + c] - m) * agrandar; }
  }
  prim.getAttribute('POSITION').setArray(p2);
  prim.getIndices().setArray(nV > 65535 ? new Uint32Array(nuevos) : new Uint16Array(nuevos));
  let piezasQuedan = 0; for (const v of queda.values()) if (v) piezasQuedan++;
  return { piezas: suma.size, quedan: piezasQuedan };
}

// Ajustes por especie: el pinsapo tiene la copa hecha de miles de ramitas finas; si se quitan muchas se queda calvo
const POR_ESPECIE = { pinsapo: { copaMedio: 0.6, agrandarCopa: 1.25 } };

const indice = [];
for (const archivo of fs.readdirSync(fuente).filter(f => f.endsWith('.glb')).sort()) {
  const id = archivo.replace(/\.glb$/, '');
  const opc = Object.assign({}, OPC, POR_ESPECIE[id] || {});
  const doc = await io.read(path.join(fuente, archivo));
  // Extensiones que no aportan nada aquí (bump a 0, ior por defecto)
  for (const ext of doc.getRoot().listExtensionsUsed()) if (['KHR_materials_ior', 'EXT_materials_bump'].includes(ext.extensionName)) ext.dispose();
  await doc.transform(dedup(), weld(), prune({ keepAttributes: true }));
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [OPC.tamTextura, OPC.tamTextura], quality: OPC.calidadWebp }));

  const escena = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
  const nodos = doc.getRoot().listNodes().filter(n => n.getMesh());
  const datos = { id, tris: { cerca: 0, medio: 0 } };
  for (const nodo of nodos) {
    const malla = nodo.getMesh();
    const hojas = malla.listPrimitives().some(p => p.getMaterial() && p.getMaterial().getAlphaMode() === 'MASK');
    const nombre = hojas ? 'copa' : 'tronco';
    nodo.setName(nombre); malla.setName(nombre);
    const mallaMedia = doc.createMesh(nombre + '_medio');
    for (const prim of malla.listPrimitives()) {
      datos.tris.cerca += triangulos(prim);
      const copia = copiarPrimitiva(doc, prim);
      if (hojas) {
        const r = aclararCopa(copia, opc.copaMedio, opc.agrandarCopa);
        datos.tarjetas = r;
        // Copas de pocas piezas grandes (hojas de palmera): mejor simplificar cada hoja que quitar hojas
        if (r.piezas < 300) {
          const vuelta = copiarPrimitiva(doc, prim);
          copia.dispose();
          mallaMedia.addPrimitive(vuelta);
          simplifyPrimitive(vuelta, { simplifier: MeshoptSimplifier, ratio: opc.copaMedio, error: 0.03, lockBorder: false });
          datos.tarjetas.simplificada = true;
          datos.tris.medio += triangulos(vuelta);
          continue;
        }
      } else {
        // El tronco tiene caras planas (normales por cara): sin normales se pueden soldar los vértices y
        // simplificar de verdad; el visor recalcula normales suaves, que de lejos se ven igual.
        copia.setAttribute('NORMAL', null);
        weldPrimitive(copia);
        simplifyPrimitive(copia, { simplifier: MeshoptSimplifier, ratio: opc.troncoMedio, error: 0.01, lockBorder: false });
      }
      datos.tris.medio += triangulos(copia);
      mallaMedia.addPrimitive(copia);
    }
    const nodoMedio = doc.createNode(nombre + '_medio').setMesh(mallaMedia)
      .setTranslation(nodo.getTranslation()).setRotation(nodo.getRotation()).setScale(nodo.getScale());
    const padre = nodo.getParentNode();
    if (padre) padre.addChild(nodoMedio); else escena.addChild(nodoMedio);
  }
  await doc.transform(prune({ keepAttributes: true }));
  const b = getBounds(escena);
  // Compresión de la geometría (EXT_meshopt_compression; el visor la lee con MeshoptDecoder)
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  datos.alto = +(b.max[1] - b.min[1]).toFixed(2);
  datos.ancho = +Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]).toFixed(2);
  const salida = path.join(destino, id + '.glb');
  await io.write(salida, doc);
  datos.kb = Math.round(fs.statSync(salida).size / 1024);
  datos.kbOriginal = Math.round(fs.statSync(path.join(fuente, archivo)).size / 1024);
  indice.push(datos);
  console.log(`${id}: ${datos.kbOriginal} KB → ${datos.kb} KB · ${datos.alto} m · triángulos cerca ${datos.tris.cerca}, medio ${datos.tris.medio}` + (datos.tarjetas ? ` · piezas de copa ${datos.tarjetas.piezas} → ${datos.tarjetas.quedan}` : ''));
}
fs.writeFileSync(path.join(destino, 'indice.json'), JSON.stringify(indice, null, 1) + '\n');
