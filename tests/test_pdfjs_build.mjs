/* Lecteur PDF (pdf.js) inclus dans le build Windows, sans téléchargement : fichiers locaux présents dans www/vendor/pdfjs (version figée, licence),
   chemins identiques à ceux que charge l'appli (PDFJS_FICHIERS), www/ entier embarqué dans l'installeur (electron/package.json : extraResources
   « ../www » → « www », filtre « ** / * ») et aucune étape du workflow de build ne les retire. Aucun navigateur : contrôle des fichiers du dépôt. */
import { readFileSync, existsSync, statSync } from 'fs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const racine = new URL('../', import.meta.url);
const lire = p => readFileSync(new URL(p, racine), 'utf8');
const html = lire('www/index.html');
const m = /const PDFJS_FICHIERS = \[([^\]]+)\]/.exec(html);
check(m, 'PDFJS_FICHIERS déclaré dans index.html');
const fichiers = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
check(fichiers.length === 2 && fichiers.every(f => f.startsWith('vendor/pdfjs/')), 'deux fichiers locaux sous vendor/pdfjs : ' + fichiers.join(', '));
for (const f of fichiers) {
  const u = new URL('www/' + f, racine);
  check(existsSync(u), 'présent dans www/ (donc dans l\'installeur) : ' + f);
  check(statSync(u).size > 100000, 'fichier complet (taille) : ' + f);
  check(readFileSync(u, 'utf8').includes('3.11.174'), 'version figée 3.11.174 : ' + f);
}
check(existsSync(new URL('www/vendor/pdfjs/LICENSE', racine)) && /Apache License/.test(lire('www/vendor/pdfjs/LICENSE')), 'licence Apache 2.0 jointe');
check(!/https?:\/\/[^'"\s]*pdf(\.min)?\.js/.test(html), 'aucun chargement de pdf.js depuis Internet');
const pkg = JSON.parse(lire('electron/package.json'));
const res = (pkg.build && pkg.build.extraResources) || [];
check(res.some(r => r.from === '../www' && r.to === 'www' && (r.filter || []).includes('**/*')), 'installeur Windows : www/ entier embarqué (extraResources)');
check(!res.some(r => (r.filter || []).some(f => /^!.*(vendor|pdfjs)/.test(f))), 'aucune exclusion de vendor/pdfjs dans l\'installeur');
const wf = lire('.github/workflows/build-apk.yml');
check(!/rm\s+[^\n]*vendor\/pdfjs|vendor\/pdfjs[^\n]*rm\s/.test(wf), 'le workflow de build ne retire pas le lecteur PDF');
console.log('OK lecteur PDF local (pdf.js 3.11.174 + licence) présent dans www/, embarqué dans l\'installeur Windows, jamais téléchargé.');
console.log('TOUS LES TESTS « LECTEUR PDF DANS LE BUILD » SONT PASSÉS');
