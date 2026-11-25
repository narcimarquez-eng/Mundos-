// Prepara los edificios grandes (modelos-fuente/edificios/ → glb/edificios/): une las mallas por material para dibujar
// con pocas llamadas, quita la losa de suelo (la pone el terreno) y pasa las texturas a WebP.
// Uso: cd tools && npm install && node preparar-edificios.mjs
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, flatten, join, weld, textureCompress, getBounds } from '@gltf-transform/functions';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fuente = path.join(raiz, 'modelos-fuente/edificios'), destino = path.join(raiz, 'glb/edificios');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of fs.readdirSync(fuente).filter(f => f.endsWith('.glb'))) {
  const doc = await io.read(path.join(fuente, f));
  for (const ext of doc.getRoot().listExtensionsUsed()) if (['KHR_materials_ior', 'EXT_materials_bump'].includes(ext.extensionName)) ext.dispose();
  const antes = doc.getRoot().listMeshes().length;
  for (const n of doc.getRoot().listNodes()) if (/_Plaza$|_Suelo$/.test(n.getName() || '')) n.dispose();
  await doc.transform(prune(), dedup(), flatten(), join({ keepNamed: false }), weld(), prune());
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 86 }));
  const salida = path.join(destino, f);
  await io.write(salida, doc);
  const b = getBounds(doc.getRoot().listScenes()[0]);
  console.log(f, antes, 'mallas →', doc.getRoot().listMeshes().length, '·', Math.round(fs.statSync(salida).size / 1024), 'KB · caja', b.min.map(v => v.toFixed(2)), b.max.map(v => v.toFixed(2)));
}
