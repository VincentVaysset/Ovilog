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
const MOTS_PIED_DISPARUS = ['export', 'généré', 'automatiquement'];   // ancien pied « Ovilog — export généré automatiquement », remplacé par le pied unique « Ovilog — [export] · [campagne] »
const COMMUNS = ['OVILOG', 'Ovilog', 'Édité', 'le', '·', '—', /^\d\d-\d\d-\d{4}$/, /^[\d.,]+$/, /^\d+\/\d+$/, 'Page', 'Campagne', 'Année']   // + pied de page unique « Ovilog — [export] · Campagne X »;
const MIGRES = {
  registre_agnelage: { paysage: true, ajouts: ['Registre', "d'élevage", 'Agnelage', 'Agneaux', 'enregistrés', 'Mâles', 'Femelles', 'Morts-nés'] },
  registre_mouvements: { paysage: true, ajouts: ['Registre', "d'élevage", 'Mouvements', 'Animaux', 'au', 'registre', 'Actifs', 'Entrées', 'Sorties', 'Achat', 'Autre', 'entrée', 'Naissance', '·', 'mâle', 'femelle'], ignorer: ['Entrée', 'Morte', 'Vendu', 'Naissance', 'Achat'] },   // un seul nom par événement (Achat, Naissance · mâle…) : affichage voulu
  registre_sanitaire: { paysage: true, ajouts: ['Registre', "d'élevage", 'Sanitaire', 'Soins', 'enregistrés', 'Traitements', 'Vaccins', 'Autres'] },
  traitements12: { paysage: true, ajouts: ['Animaux', 'actifs', 'brebis,', 'antenaises,', 'béliers', 'Aucun', 'traitement', 'compté', 'et', 'plus', 'seuil', 'dépassé', '%', 'Traitements', 'sur', '12', 'mois', 'suivi', 'bio', 'Ovilog'] },
  // regroupement voulu (une ligne par BREBIS avec tous ses produits, compteur en brebis) : « 3 traitement(s) » devient « 2 brebis sous délai », la 2e ligne de
  // n°00018 et son « 6 » (jours restants du 1er soin) disparaissent, les colonnes « Produit » et « Date du soin » deviennent « Produits (soin, fin du délai) »
  sous_delai: { paysage: false, ajouts: ["Sous", "délai", "d'attente", 'lait', 'brebis', 'sous', 'Produits', '(soin,', 'fin', 'du', 'délai)', 'soin', ';', 'Brebis'],   // titre « Sous délai d'attente · Brebis » (onglet)
    ignorer: ['traitement(s)', 'Produit', 'Date'], tolerer: { 3: 1, 6: 1, 'n°00018': 1 } },
  controle_laitier: { paysage: true, ajouts: ['Contrôle', 'laitier'], ignorer: ['undefined'], tolerer: { 0: 1, 2550: 1, 2985: 1, '(mL)': 1, Cumul: 1, campagne: 1 } },   // l'ancien PDF imprimait le mot « undefined » comme sous-titre (défaut) : retiré ; colonne « Cumul campagne (mL) » retirée à la demande (colonnes = écran : N° court, Date de mise bas, C1, C2, C3), son titre et ses 3 valeurs (0, 2550, 2985) disparaissent
  bilan_lactation: { paysage: false, ajouts: ['Litrage', 'total', 'produit', 'L', 'Brebis', 'passées', 'à', 'la', 'traite', '/', 'brebis',
    // deux histogrammes mensuels ajoutés au PDF (mêmes barres que la page PC)
    'de', 'par', 'mois', 'Tank', 'octobre', 'septembre', 'en', 'milliers', 'litres', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Bilan', 'lactation', 'présentes,', 'moyenne', 'mensuelle', 'Effectif', 'au', 'premier', 'jour', 'chaque', 'trait', 'pointillé', '='], ignorer: ['Ovilog', '—', '·'] },   // « Ovilog — » devant le titre et « · » entre exploitation et campagne : remplacés par le logo OVILOG et la mise en page de l'en-tête
  bilan_age: { paysage: false, ajouts: ['Bilan', 'de', 'reproduction', 'troupeau', 'Brebis', 'présentes', 'Mises', 'bas', 'Campagne', 'DÉTAIL', 'PAR', 'MILLÉSIME'], ignorer: ['Ovilog', '—', '·', 'édité'] },   // « Ovilog — », « · » et « édité » : repris par le logo OVILOG et l'en-tête (« Édité le »)
  bilan_complet: { paysage: false, ajouts: ['Bilan', 'de', 'reproduction', 'ANTENAISES'], ignorer: ['Ovilog', '—', '·', 'édité', 'page', 'ANTENAIS...'],   // « ANTENAIS... » : l'en-tête tronqué de la référence est désormais écrit en entier
    tolerer: { 1: 1, 2: 3, '/': 2, campagne: 2, bilan: 2 } },   // « Ovilog — », « · », « édité le » et « page i / N » : repris par le logo, l'en-tête et le pied « Page i/N » de la charte
  lot_ia: { paysage: true, ajouts: ['Lot', 'de', 'reproduction', 'IA', 'Éponge', 'Effectif', 'du', 'lot', 'Mises', 'bas', 'Fertilité', 'Prolificité', '%'], ignorer: ['Ovilog', '—', '·', 'édité'] },   // « Ovilog — », « · » et « édité le » : repris par le logo OVILOG et l'en-tête
  lot_eponge: { paysage: false, ajouts: ['Lot', 'de', 'reproduction', 'IA', 'Éponge', 'Effectif', 'du', 'lot', 'Mises', 'bas', 'Fertilité', 'Prolificité', '%'], ignorer: ['Ovilog', '—', '·', 'édité'] },
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
  const e = ecartMots(ref[nom].mots.filter(w => !(att.ignorer || []).includes(w) && !MOTS_PIED_DISPARUS.includes(w)), r.mots.filter(w => !MOTS_PIED_DISPARUS.includes(w)));
  Object.keys(att.tolerer || {}).forEach(w => { if (e.manquants[w] && e.manquants[w] <= att.tolerer[w]) delete e.manquants[w]; });   // chiffres du pied « page i / N » devenu « Page i/N »
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
  const b64 = await pc.evaluate(() => { const rows = Array.from({ length: 140 }, (_, i) => ['n°0012' + String(100000 + i), 'Brebis', 'Vente', 'Réforme — texte plutôt long numéro ' + i, '0' + (i % 9 + 1) + '-10-2026', 'Campagne 2026']);
    const o = buildPdfTableCharte({ title: 'Registre test', subtitle: '140 ligne(s)', columns: ['N°', 'Catégorie', 'Type', 'Cause / détail', 'Date', 'Campagne'].map((l, k) => ({ label: l, x: k * 90 })), rows, landscape: true });
    let s = ''; for (const x of o) s += String.fromCharCode(x); return btoa(s); });
  const r = lirePdfMots(Buffer.from(b64, 'base64'), 'h_gros');
  check(r.pages >= 3 && r.tailles.every(t => t[0] > t[1]), 'grand tableau : ' + r.pages + ' pages en paysage');
  check(['n°0012100000', 'n°0012100139'].every(w => r.mots.includes(w)) && r.mots.filter(w => w === 'Brebis').length === 140, 'grand tableau : les 140 lignes sont présentes, rien de coupé');
  check(r.mots.filter(w => w === 'Catégorie').length === r.pages && r.mots.includes('Page') && r.mots.includes(r.pages + '/' + r.pages), 'grand tableau : en-tête de colonnes sur chaque page et pied « Page n/N »');
  console.log('OK grand tableau paysage : ' + r.pages + ' pages, 140 lignes, en-tête répété.');
}
await browser.close();
console.log('\nTOUS LES TESTS « PDF HARMONISÉS » SONT PASSÉS (' + Object.keys(MIGRES).length + ' PDF)');
