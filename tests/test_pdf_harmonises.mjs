/* Chantier « PDF harmonisés » : chaque PDF migré vers la charte colorée (logo OVILOG, titre, filet vert, en-tête de tableau vert, lignes alternées, tuiles, pied « Page X/Y »).
   Pour chaque PDF migré : (1) CONTENU identique à la référence prise AVANT la refonte (ref/pdf_avant.json, mots du PDF noir et blanc sur un jeu synthétique) : aucun mot manquant, et les
   seuls mots ajoutés sont ceux de la charte (logo, « Édité le », tuiles, pied de page) ; (2) MÊME PDF sur PC et sur mobile (octets identiques) ; (3) fichier ouvert et rendu avec PyMuPDF,
   en-tête vert en haut de la page 1, orientation attendue ; aucune écriture de données. Régénérer la référence (code d'AVANT) : OVILOG_MAJ_REF=1 node capture_pdf_avant.mjs */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { installerCasPdf } from './lib/jeux_pdf.mjs';
import { jeuRegistre } from './lib/jeu_registre_cl.mjs';
import { lirePdfMots, ecartMots } from './lib/pdf_texte.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const ref = JSON.parse(readFileSync(new URL('./ref/pdf_avant.json', import.meta.url)));
// PDF déjà migrés vers la charte : paysage ou portrait, et mots que la charte AJOUTE (logo, édition, tuiles, pied de page) en plus du contenu d'origine
const COMMUNS = ['OVILOG', 'Ovilog', 'Édité', 'le', '·', '—', /^\d\d-\d\d-\d{4}$/, /^\d+$/, /^\d+\/\d+$/, 'Page'];
const MIGRES = {
  registre_agnelage: { paysage: true, ajouts: ['Registre', "d'élevage", 'Agnelage', 'Agneaux', 'enregistrés', 'Mâles', 'Femelles', 'Morts-nés'] },
  registre_mouvements: { paysage: true, ajouts: ['Registre', "d'élevage", 'Mouvements', 'Animaux', 'au', 'registre', 'Actifs', 'Entrées', 'Sorties'] },
  registre_sanitaire: { paysage: true, ajouts: ['Registre', "d'élevage", 'Sanitaire', 'Soins', 'enregistrés', 'Traitements', 'Vaccins', 'Autres'] },
  registre_sanitaire_filtre: { paysage: true, ajouts: ['Registre', "d'élevage", 'Sanitaire', 'Soins', 'enregistrés', 'Traitements', 'Vaccins', 'Autres'] }
};
const browser = await chromium.launch(LAUNCH);
async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1500, height: 1000 } : { width: 420, height: 1400 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(`window.__jeuRegistre = ${jeuRegistre.toString()}`);
  await page.evaluate(installerCasPdf);
  return page;
}
const pc = await ouvrir(true), mob = await ouvrir(false);
const octets = (page, nom) => page.evaluate(async (n) => { const o = await window.CAS_PDF[n](); let s = ''; for (const x of o) s += String.fromCharCode(x); return btoa(s); }, nom);
for (const [nom, att] of Object.entries(MIGRES)) {
  const [bp, bm] = [await octets(pc, nom), await octets(mob, nom)];
  check(bp === bm, nom + ' : même PDF sur PC et sur mobile (octets identiques)');
  const r = lirePdfMots(Buffer.from(bp, 'base64'), 'h_' + nom);
  const e = ecartMots(ref[nom].mots, r.mots);
  check(Object.keys(e.manquants).length === 0, nom + ' : contenu d\'origine intact, mots manquants : ' + JSON.stringify(e.manquants));
  const autorises = COMMUNS.concat(att.ajouts);
  const inattendus = Object.keys(e.ajoutes).filter(w => !autorises.some(a => a instanceof RegExp ? a.test(w) : a === w));
  check(inattendus.length === 0, nom + ' : mots ajoutés inattendus : ' + JSON.stringify(inattendus));
  check(r.tailles[0][0] > r.tailles[0][1] === !!att.paysage, nom + ' : orientation ' + (att.paysage ? 'paysage' : 'portrait') + ' ' + JSON.stringify(r.tailles[0]));
  check(r.vert > 150, nom + ' : en-tête vert Ovilog (titre et filet verts) : ' + r.vert + ' pixels verts');
  const nbPages = r.pages;
  check(r.mots.includes('Page') && r.mots.includes('1/' + nbPages), nom + ' : pied « Page 1/' + nbPages + ' »');
  check(await pc.evaluate(() => window.__saves === 0) && await mob.evaluate(() => window.__saves === 0), nom + ' : aucune écriture de données');
  console.log('OK ' + nom + ' : contenu identique à l\'ancien PDF (' + ref[nom].mots.length + ' mots), même PDF PC / mobile, ' + nbPages + ' page(s), charte colorée.');
}
// ---- grand tableau paysage : plusieurs pages, rien de coupé, en-tête repris, pied « Page n/N »
{
  const b64 = await pc.evaluate(() => { const rows = Array.from({ length: 140 }, (_, i) => ['n°6299' + String(100000 + i), 'Brebis', 'Vente', 'Réforme — texte plutôt long numéro ' + i, '0' + (i % 9 + 1) + '-10-2026', 'Campagne 2026']);
    const o = buildPdfTableCharte({ title: 'Registre test', subtitle: '140 ligne(s)', columns: ['N°', 'Catégorie', 'Type', 'Cause / détail', 'Date', 'Campagne'].map((l, k) => ({ label: l, x: k * 90 })), rows, landscape: true });
    let s = ''; for (const x of o) s += String.fromCharCode(x); return btoa(s); });
  const r = lirePdfMots(Buffer.from(b64, 'base64'), 'h_gros');
  check(r.pages >= 3 && r.tailles.every(t => t[0] > t[1]), 'grand tableau : ' + r.pages + ' pages en paysage');
  check(['n°6299100000', 'n°6299100139'].every(w => r.mots.includes(w)) && r.mots.filter(w => w === 'Brebis').length === 140, 'grand tableau : les 140 lignes sont présentes, rien de coupé');
  check(r.mots.filter(w => w === 'Catégorie').length === r.pages && r.mots.includes('Page') && r.mots.includes(r.pages + '/' + r.pages), 'grand tableau : en-tête de colonnes sur chaque page et pied « Page n/N »');
  console.log('OK grand tableau paysage : ' + r.pages + ' pages, 140 lignes, en-tête répété.');
}
await browser.close();
console.log('\nTOUS LES TESTS « PDF HARMONISÉS » SONT PASSÉS (' + Object.keys(MIGRES).length + ' PDF)');
