// Genera js/catalogo-rpg.js: la lista de modelos .glb del repositorio Creador-de-mundos-Rpg
// que el editor ofrece en «Biblioteca RPG» (se cargan desde la dirección configurada en el escenario).
// Uso: node tools/generar-catalogo-rpg.mjs ../Creador-de-mundos-Rpg
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(process.argv[2] || '../Creador-de-mundos-Rpg');
const salida = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../js/catalogo-rpg.js');

function nombreBonito(archivo) {
  return archivo.replace(/\.glb$/i, '').replace(/^enemy[-_]/, '').replace(/_low$|_lejos$/, '')
    .replace(/^df-\d+-/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function lista(dir) {
  const p = path.join(raiz, dir);
  if (!fs.existsSync(p)) return [];
  return fs.readdirSync(p).filter(f => f.toLowerCase().endsWith('.glb')).sort();
}

const modelos = [];
// Enemigos: versión «low» de cada grupo
const low = path.join(raiz, 'glb/low');
if (fs.existsSync(low)) {
  const recorrer = (rel, sub) => {
    for (const f of lista(rel)) modelos.push({ ruta: `${rel}/${f}`, nombre: nombreBonito(f), grupo: 'enemigos', sub });
    for (const d of fs.readdirSync(path.join(raiz, rel)).sort()) {
      if (fs.statSync(path.join(raiz, rel, d)).isDirectory()) recorrer(`${rel}/${d}`, sub ? sub + '/' + d : d);
    }
  };
  recorrer('glb/low', '');
}
for (const f of fs.readdirSync(raiz).filter(f => /^enemy.*\.glb$/i.test(f)).sort()) {
  modelos.push({ ruta: f, nombre: nombreBonito(f), grupo: 'enemigos', sub: 'no-muertos-raiz' });
}
for (const f of lista('glb/cabanas')) modelos.push({ ruta: 'glb/cabanas/' + f, nombre: nombreBonito(f), grupo: 'edificios' });
for (const f of lista('glb/pueblo').filter(f => !/_lejos/.test(f))) modelos.push({ ruta: 'glb/pueblo/' + f, nombre: nombreBonito(f), grupo: 'edificios' });
for (const f of lista('glb/pueblo/piezas')) modelos.push({ ruta: 'glb/pueblo/piezas/' + f, nombre: nombreBonito(f), grupo: 'decorado' });
for (const f of lista('glb').filter(f => /muelle|puente/.test(f))) modelos.push({ ruta: 'glb/' + f, nombre: nombreBonito(f), grupo: 'decorado' });
for (const f of lista('glb/mazmorras')) modelos.push({ ruta: 'glb/mazmorras/' + f, nombre: nombreBonito(f), grupo: 'mazmorras' });

const js = `// Generado por tools/generar-catalogo-rpg.mjs: no editar a mano.
// Modelos .glb del repositorio Creador-de-mundos-Rpg. Rutas relativas a la «dirección del Creador RPG» del escenario.
(function (raiz) {
  const CATALOGO = ${JSON.stringify(modelos, null, 0).replace(/},{/g, '},\n    {')};
  if (typeof module !== 'undefined' && module.exports) module.exports = CATALOGO;
  else raiz.CatalogoRPG = CATALOGO;
})(typeof window !== 'undefined' ? window : globalThis);
`;
fs.writeFileSync(salida, js);
console.log(modelos.length + ' modelos →', salida);
