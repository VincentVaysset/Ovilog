/* Lecture d'un PDF avec PyMuPDF : nombre de pages, mots (texte des pages, normalisé), rendu PNG de la page 1 (facultatif). Les mots servent à comparer le CONTENU
   avant/après une refonte de mise en forme (comparaison par multi-ensemble : l'ordre et la mise en page ne comptent pas). */
import { spawnSync } from 'child_process';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
const PY = `import sys, json
import pymupdf as m
d = m.open(sys.argv[1])
mots = []
for p in d:
    for w in p.get_text('words'):
        mots.append(w[4])
sortie = { 'pages': d.page_count, 'mots': mots, 'tailles': [[p.rect.width, p.rect.height] for p in d] }
if len(sys.argv) > 2:
    for i, p in enumerate(d):
        p.get_pixmap(dpi=60).save(sys.argv[2] + '_' + str(i) + '.png')
print(json.dumps(sortie))`;
const dir = mkdtempSync(path.join(tmpdir(), 'ovilog-pdf-'));
let n = 0;
export function lirePdfMots(octets, png) {
  const f = path.join(dir, 'f' + (++n) + '.pdf'); writeFileSync(f, Buffer.from(octets));
  const r = spawnSync('python3', ['-I', '-c', PY, f].concat(png ? [path.join(dir, png)] : []), { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error('PyMuPDF ne lit pas le PDF : ' + (r.stderr || '').slice(0, 300));
  const o = JSON.parse(r.stdout);
  o.mots = o.mots.map(w => w.replace(/[  ]/g, ' ').trim()).filter(Boolean);
  o.dossier = dir;
  return o;
}
export const compterMots = (mots) => { const c = {}; mots.forEach(w => { c[w] = (c[w] || 0) + 1; }); return c; };
// mots de `avant` absents (ou moins nombreux) dans `apres` ; mots ajoutés par `apres`
export function ecartMots(avant, apres) {
  const a = compterMots(avant), b = compterMots(apres), manquants = {}, ajoutes = {};
  for (const w in a) if ((b[w] || 0) < a[w]) manquants[w] = a[w] - (b[w] || 0);
  for (const w in b) if ((a[w] || 0) < b[w]) ajoutes[w] = b[w] - (a[w] || 0);
  return { manquants, ajoutes };
}
