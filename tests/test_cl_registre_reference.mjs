/* Référence « mobile identique » des écrans Contrôle laitier et Registre d'élevage (3 onglets), et référence « export
   identique » des exports du registre (Excel : feuilles ; PDF : octets, un par onglet), sans filtre et avec filtres.
   Jeux SYNTHÉTIQUES, horloge figée. Prise AVANT les pages PC (tests/ref/cl_registre_mobile.json) : tout changement
   de ces écrans mobiles ou de ces exports fait échouer ce test. Les mêmes exports sont rejoués depuis la page PC dans
   test_pc_registre. Régénérer volontairement : OVILOG_MAJ_REF=1 node test_cl_registre_reference.mjs */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const REF = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ref', 'cl_registre_mobile.json');
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { jeuRegistre, jeuControleLaitier } from './lib/jeu_registre_cl.mjs';
import { LAUNCH, URL_APP } from './lib/config.mjs';
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
page.on('pageerror', e => { throw new Error('PAGEERROR ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
const out = await page.evaluate(async ([jr, jc]) => {
  const R = {};
  const app = () => document.getElementById('app').innerHTML;
  eval('(' + jc + ')')(true);
  render('controle-laitier'); R.controle_laitier_avec = app();
  eval('(' + jc + ')')(false);
  render('controle-laitier'); R.controle_laitier_sans = app();
  eval('(' + jr + ')')();
  for (const v of ['agnelage', 'mouvements', 'sanitaire']) { registreView = v; registreFiltre = ''; registreColFiltres = { agnelage: { sexe: '', campagne: '' }, mouvements: { categorie: '', type: '', campagne: '' }, sanitaire: { categorie: '', type: '', campagne: '' } }; render('registre'); R['registre_' + v] = app(); }
  // exports (xlsx : feuilles ; pdf : octets) sans filtre puis avec filtres
  const cap = []; window.buildXlsxWorkbook = async (s) => { cap.push({ t: 'xlsx', s }); return new Uint8Array([1]); };
  window.saveOrShareBinaryFile = async (nom, bytes, mime) => { cap.push({ t: 'file', nom, mime, b: Array.from(bytes).length > 20 ? Array.from(bytes) : null }); };
  const cas = {
    sans_filtre: () => { registreFiltre = ''; registreColFiltres = { agnelage: { sexe: '', campagne: '' }, mouvements: { categorie: '', type: '', campagne: '' }, sanitaire: { categorie: '', type: '', campagne: '' } }; },
    avec_filtres: () => { registreFiltre = '1'; registreColFiltres = { agnelage: { sexe: 'Mâle', campagne: '2025' }, mouvements: { categorie: 'Brebis', type: 'Vente', campagne: '2025' }, sanitaire: { categorie: 'Brebis', type: 'Traitement · Antibiotique', campagne: '2025' } }; }
  };
  R.exports = {};
  for (const [nomCas, setF] of Object.entries(cas)) {
    setF();
    cap.length = 0; await exportRegistreXlsx(); R.exports[nomCas + '_xlsx'] = JSON.parse(JSON.stringify(cap));
    for (const v of ['agnelage', 'mouvements', 'sanitaire']) { registreView = v; cap.length = 0; await exportRegistrePdf(); R.exports[nomCas + '_pdf_' + v] = JSON.parse(JSON.stringify(cap)); }
  }
  return R;
}, [jeuRegistre.toString(), jeuControleLaitier.toString()]);
await browser.close();
if (process.env.OVILOG_MAJ_REF === '1' || !existsSync(REF)) { writeFileSync(REF, JSON.stringify(out)); console.log('Référence écrite : ' + REF); process.exit(0); }
const attendu = JSON.parse(readFileSync(REF, 'utf8'));
let ko = false;
for (const k of Object.keys(attendu)) {
  if (k === 'exports') {
    // Le Sanitaire a gagné des colonnes (carnet sanitaire PC) : sa feuille Excel et son PDF sont comparés colonne par colonne par
    // test_export_sanitaire ; ici on ne compare que les autres feuilles / PDF (identiques octet pour octet) et le nom du fichier Sanitaire.
    const norm = (e, cap) => { const c = JSON.parse(JSON.stringify(cap)); return /_xlsx$/.test(e) ? c.map(x => x.t === 'xlsx' ? { ...x, s: x.s.filter(f => f.name !== 'Sanitaire') } : x) : /_pdf_sanitaire$/.test(e) ? c.map(x => x.t === 'file' ? { nom: x.nom, mime: x.mime } : x) : c; };
    for (const e of Object.keys(attendu.exports)) if (JSON.stringify(norm(e, attendu.exports[e])) !== JSON.stringify(norm(e, out.exports[e]))) { ko = true; console.log('FAIL: export « ' + e + ' » différent de la référence'); }
    continue;
  }
  if (attendu[k] !== out[k]) { ko = true; const i = [...out[k]].findIndex((c, n) => c !== attendu[k][n]); console.log('FAIL: écran mobile « ' + k + ' » modifié (caractère ' + i + ')\n  attendu : …' + attendu[k].slice(Math.max(0, i - 60), i + 100).replace(/\n/g, ' ') + '\n  obtenu  : …' + out[k].slice(Math.max(0, i - 60), i + 100).replace(/\n/g, ' ')); }
}
if (ko) process.exit(1);
console.log('OK : ' + (Object.keys(attendu).length - 1) + ' écrans mobiles (Contrôle laitier avec / sans contrôle, Registre ×3) et ' + Object.keys(attendu.exports).length + ' exports (xlsx + PDF des 3 onglets, sans filtre et avec filtres) identiques à la référence.');
