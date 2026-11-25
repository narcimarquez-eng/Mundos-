// Prepara las casas andaluzas para el Creador de Pueblos (js/casas-glb.js, familia «andaluza»).
// De cada modelo de modelos-fuente/casas/ salen glb/pueblo/<id>.glb y <id>_lejos.glb:
//   - sin la losa de suelo (nodos *_Suelo): en el pueblo la casa se apoya en el terreno o la calle
//   - texturas en WebP (≤ 1024 px cerca, 256 px lejos)
//   - la versión lejana sin macetas, plantas, flores ni barandillas
// Uso: cd tools && npm install && node preparar-casas.mjs
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, weld, textureCompress, getBounds } from '@gltf-transform/functions';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fuente = path.join(raiz, 'modelos-fuente/casas');
const destino = path.join(raiz, 'glb/pueblo');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

async function preparar(archivo, lejos) {
  const doc = await io.read(path.join(fuente, archivo));
  for (const ext of doc.getRoot().listExtensionsUsed()) if (['KHR_materials_ior'].includes(ext.extensionName)) ext.dispose();
  for (const n of doc.getRoot().listNodes()) {
    const nom = n.getName() || '';
    if (/_Suelo$/.test(nom) || (lejos && /Maceta|Planta|Flor|Buganvilla|Barandilla|Hojas/.test(nom))) n.dispose();
  }
  await doc.transform(prune(), dedup(), weld());
  // sin la losa, la casa empieza a 0,12 m: se baja para que apoye en el suelo
  const esc = doc.getRoot().listScenes()[0];
  const y0 = getBounds(esc).min[1];
  for (const n of esc.listChildren()) { const t = n.getTranslation(); n.setTranslation([t[0], t[1] - y0, t[2]]); }
  const tam = lejos ? 256 : 1024;
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tam, tam], quality: lejos ? 80 : 88 }));
  const id = archivo.replace(/\.glb$/, '') + (lejos ? '_lejos' : '');
  const salida = path.join(destino, id + '.glb');
  await io.write(salida, doc);
  const b = getBounds(doc.getRoot().listScenes()[0]);
  return { id, kb: Math.round(fs.statSync(salida).size / 1024), min: b.min.map(v => +v.toFixed(2)), max: b.max.map(v => +v.toFixed(2)) };
}

for (const f of fs.readdirSync(fuente).filter(f => f.endsWith('.glb')).sort()) {
  for (const lejos of [false, true]) {
    const r = await preparar(f, lejos);
    console.log(`${r.id}: ${r.kb} KB · caja ${r.min} → ${r.max}`);
  }
}
