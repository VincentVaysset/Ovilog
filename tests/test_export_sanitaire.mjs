/* Exports du Sanitaire (Excel et PDF) : référence « export identique avant/après » pour les colonnes EXISTANTES (N°, Catégorie,
   Type de soin, Produit, Date, Dose, N° ordonnance, Campagne), sans filtre et avec filtres (tests/ref/export_sanitaire_avant.json,
   pris AVANT les nouvelles colonnes, jeu synthétique partagé), puis contrôle des colonnes ajoutées : voie, durée, date de fin,
   fait par, reprise du lait, vente dès le (Excel) ; PDF : date de fin, voie, fait par en priorité, reprise du lait / vente dès le
   seulement si la place le permet, sans chevauchement. Les PDF Agnelage et Mouvements restent identiques octet pour octet
   (test_cl_registre_reference). Régénérer la référence (code d'AVANT) : OVILOG_MAJ_REF=1 node test_export_sanitaire.mjs */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { jeuRegistre } from './lib/jeu_registre_cl.mjs';
import { LAUNCH, URL_APP } from './lib/config.mjs';
const REF = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ref', 'export_sanitaire_avant.json');
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

// Capture : feuille « Sanitaire » de l'Excel et arguments du PDF Sanitaire, sans filtre puis avec filtres
const capture = () => page.evaluate(async () => {
  const cap = [];
  window.buildXlsxWorkbook = async (s) => { cap.push({ t: 'xlsx', s: JSON.parse(JSON.stringify(s)) }); return new Uint8Array([1]); };
  const nomBp = window.buildPdfTableCharte ? 'buildPdfTableCharte' : 'buildPdfTable', bp = window[nomBp]; window[nomBp] = (a) => { cap.push({ t: 'pdf', a: JSON.parse(JSON.stringify({ title: a.title, subtitle: a.subtitle, columns: a.columns, rows: a.rows, landscape: a.landscape, fontSize: a.fontSize, headerSize: a.headerSize })) }); return bp(a); };
  window.saveOrShareBinaryFile = async (nom, bytes) => { cap.push({ t: 'file', nom }); };
  const cas = {
    sans_filtre: () => { registreFiltre = ''; registreColFiltres = { agnelage: { sexe: '', campagne: '' }, mouvements: { categorie: '', type: '', campagne: '' }, sanitaire: { categorie: '', type: '', campagne: '' } }; },
    avec_filtres: () => { registreFiltre = '1'; registreColFiltres = { agnelage: { sexe: '', campagne: '' }, mouvements: { categorie: '', type: '', campagne: '' }, sanitaire: { categorie: 'Brebis', type: 'Traitement · Antibiotique', campagne: '' } }; }
  };
  const R = {};
  for (const [nom, set] of Object.entries(cas)) {
    set(); registreView = 'sanitaire';
    cap.length = 0; await exportRegistreXlsx();
    R[nom + '_xlsx'] = cap.find(x => x.t === 'xlsx').s.find(f => f.name === 'Sanitaire').rows;
    cap.length = 0; await exportRegistrePdf();
    const p = cap.find(x => x.t === 'pdf').a;
    R[nom + '_pdf'] = { title: p.title, subtitle: p.subtitle, labels: p.columns.map(c => c.label), rows: p.rows, nomFichier: cap.find(x => x.t === 'file').nom, columns: p.columns, fontSize: p.fontSize || null };
  }
  return R;
});
await page.evaluate(jeuRegistre);
const avant = await capture();

if (process.env.OVILOG_MAJ_REF === '1' || !existsSync(REF)) {
  writeFileSync(REF, JSON.stringify({ sans_filtre_xlsx: avant.sans_filtre_xlsx, avec_filtres_xlsx: avant.avec_filtres_xlsx, sans_filtre_pdf: { labels: avant.sans_filtre_pdf.labels, rows: avant.sans_filtre_pdf.rows, title: avant.sans_filtre_pdf.title, nomFichier: avant.sans_filtre_pdf.nomFichier }, avec_filtres_pdf: { labels: avant.avec_filtres_pdf.labels, rows: avant.avec_filtres_pdf.rows, title: avant.avec_filtres_pdf.title, nomFichier: avant.avec_filtres_pdf.nomFichier } }));
  console.log('Référence écrite : ' + REF); await browser.close(); process.exit(0);
}
const ref = JSON.parse(readFileSync(REF, 'utf8'));
const N = 8;   // colonnes d'origine

// ================================================================ 1. colonnes existantes identiques (Excel), sans filtre et avec filtres
for (const cas of ['sans_filtre', 'avec_filtres']) {
  const x = avant[cas + '_xlsx'], r = ref[cas + '_xlsx'];
  check(x.length === r.length && x.length > 1, cas + ' Excel : même nombre de lignes (' + x.length + ' / ' + r.length + ')');
  check(JSON.stringify(x.map(l => l.slice(0, N))) === JSON.stringify(r), cas + ' Excel : les 8 colonnes d\'origine sont identiques, mêmes lignes dans le même ordre');
  check(x.every(l => l.length === N + 6), cas + ' Excel : 6 colonnes ajoutées sur chaque ligne');
  check(JSON.stringify(x[0].slice(N)) === JSON.stringify(['Voie', 'Durée (jours)', 'Date de fin', 'Fait par', 'Reprise du lait', 'Vente / départ dès le']), cas + ' Excel : en-têtes ajoutés : ' + x[0].slice(N));
}
console.log('OK 1 Excel : 8 colonnes d\'origine identiques à la référence d\'avant (sans filtre : ' + avant.sans_filtre_xlsx.length + ' lignes ; avec filtres : ' + avant.avec_filtres_xlsx.length + ' lignes), 6 colonnes ajoutées à la suite.');

// ================================================================ 2. colonnes existantes identiques (PDF)
for (const cas of ['sans_filtre', 'avec_filtres']) {
  const p = avant[cas + '_pdf'], r = ref[cas + '_pdf'];
  check(p.title === r.title && p.nomFichier === r.nomFichier, cas + ' PDF : titre et nom de fichier identiques : ' + p.nomFichier);
  check(JSON.stringify(p.labels.slice(0, N)) === JSON.stringify(r.labels), cas + ' PDF : en-têtes d\'origine identiques et dans le même ordre');
  check(JSON.stringify(p.rows.map(l => l.slice(0, N))) === JSON.stringify(r.rows), cas + ' PDF : valeurs des 8 colonnes d\'origine identiques, mêmes lignes');
  check(['Date de fin', 'Voie', 'Fait par'].every(l => p.labels.includes(l)), cas + ' PDF : date de fin, voie, fait par présents : ' + p.labels.join(' | '));
}
console.log('OK 2 PDF : 8 colonnes d\'origine identiques (en-têtes, valeurs, lignes, titre, nom de fichier), sans filtre et avec filtres ; date de fin, voie, fait par ajoutés.');

// ================================================================ 3. valeurs ajoutées : ancien soin « — », soin récent complet, délai 0, fait par
await page.evaluate(() => {
  const A = DB.brebis[0];
  A.sanitaire.push({ type: 'Traitement', sousType: 'Antibiotique', produit: 'Intramicine', date: '2026-09-30', quantiteCc: 8, voie: 'Intramusculaire', dureeJours: 3, intervenant: 'Dr Martin', commentaire: '', delaiLaitJours: 7, delaiViandeJours: 28 });
  A.sanitaire.push({ type: 'Vaccin', sousType: null, produit: 'Bravoxin 10', date: '2026-10-01', quantiteCc: 2, voie: 'Sous-cutanée', dureeJours: 1, intervenant: 'Éleveur', commentaire: '', delaiLaitJours: 0, delaiViandeJours: 0 });
});
const apres = await capture();
const lignes = apres.sans_filtre_xlsx;
const ln = (produit, date) => lignes.find(l => l[3] === produit && l[4] === date);
const recent = ln('Intramicine', '30-09-2026'), vaccin = ln('Bravoxin 10', '01-10-2026'), ancien = ln('Intramicine', '20-09-2026'), plaie = lignes.find(l => l[3] === 'Aluspray');
check(JSON.stringify(recent.slice(N)) === JSON.stringify(['Intramusculaire', 3, '02-10-2026', 'Dr Martin', '10-10-2026', '31-10-2026']), 'soin récent (30/09, 3 jours, lait 7, viande 28) : dernière 02/10, lait 10/10, viande 31/10 : ' + JSON.stringify(recent.slice(N)));
check(JSON.stringify(vaccin.slice(N)) === JSON.stringify(['Sous-cutanée', 1, '01-10-2026', 'Éleveur', 'aucune attente', 'aucune attente']), 'délai 0 : « aucune attente » : ' + JSON.stringify(vaccin.slice(N)));
check(ancien && ancien.slice(N).every(v => v === '—'), 'ancien soin (sans voie, durée ni intervenant) : les 6 valeurs ajoutées en « — » : ' + JSON.stringify(ancien && ancien.slice(N)));
check(plaie.slice(N).every(v => v === '—'), 'ancien soin de plaie : toutes les valeurs ajoutées en « — » : ' + JSON.stringify(plaie.slice(N)));
const sele = lignes.find(l => l[3] === 'Séléphérol');
check(sele && sele.slice(N).filter(v => v === '—').length >= 4, 'Séléphérol sans fiche : « — » (jamais inventé) : ' + JSON.stringify(sele && sele.slice(N)));
console.log('OK 3 valeurs ajoutées : voie, durée, date de fin, fait par, reprise du lait, vente dès le ; délai 0 « aucune attente » ; anciens soins et Séléphérol sans fiche « — ».');

// ================================================================ 4. PDF : mise en page sans chevauchement, priorité, repli
const pdf = apres.sans_filtre_pdf;
const largeurs = await page.evaluate(([cols, rows, taille]) => {
  const t = taille || 9.5;
  return cols.map((c, i) => Math.max(pdfTextWidth(c.label, t + 0.5, true), ...rows.map(r => pdfTextWidth(String(r[i] || ''), t, false))));
}, [pdf.columns, pdf.rows, pdf.fontSize]);
for (let i = 0; i < pdf.columns.length - 1; i++) check(pdf.columns[i].x + largeurs[i] <= pdf.columns[i + 1].x, 'colonne « ' + pdf.columns[i].label + ' » ne chevauche pas la suivante');
const fin = pdf.columns[pdf.columns.length - 1].x + largeurs[largeurs.length - 1];
check(fin <= 762, 'la dernière colonne tient dans la largeur utile (762 pt) : ' + fin.toFixed(1));
check(['Date de fin', 'Voie', 'Fait par'].every(l => pdf.labels.includes(l)), 'mentions réglementaires toujours présentes : ' + pdf.labels.join(' | '));
const sansPlace = avant.sans_filtre_pdf;   // jeu d'anciens soins (textes courts) : la place permet les 13 colonnes, police réduite à 8 pt
check(sansPlace.labels.length === 13 && sansPlace.fontSize === 8 && sansPlace.labels.includes('Reprise du lait') && sansPlace.labels.includes('Vente / départ dès le'), 'quand la place le permet : reprise du lait et vente dès le ajoutés (13 colonnes, 8 pt) : ' + sansPlace.labels.length + ' colonnes, police ' + sansPlace.fontSize);
check(pdf.labels.length === 11 ? !pdf.labels.includes('Reprise du lait') && !pdf.labels.includes('Vente / départ dès le') : true, 'sinon les deux colonnes facultatives sont abandonnées (jamais les mentions réglementaires)');
// jeu large : textes longs -> reprise du lait / vente dès le abandonnés avant date de fin, voie, fait par
await page.evaluate(() => {
  const A = DB.brebis[0];
  for (let i = 0; i < 3; i++) A.sanitaire.push({ type: 'Traitement', sousType: 'Anti-inflammatoire', produit: 'Produit au nom commercial extrêmement long numéro ' + i, date: '2026-09-2' + i, quantiteCc: 12.5, voie: 'Intramusculaire profonde', dureeJours: 2, intervenant: 'Vétérinaire de la clinique de la vallée', commentaire: '', numeroOrdonnance: 'ORD-2026-000' + i, delaiLaitJours: 3, delaiViandeJours: 10 });
});
const large = (await capture()).sans_filtre_pdf;
check(['Date de fin', 'Voie', 'Fait par'].every(l => large.labels.includes(l)), 'jeu large : date de fin, voie, fait par toujours présents : ' + large.labels.join(' | '));
const lg = await page.evaluate(([cols, rows, taille]) => { const t = taille || 9.5; return cols.map((c, i) => Math.max(pdfTextWidth(c.label, t + 0.5, true), ...rows.map(r => pdfTextWidth(String(r[i] || ''), t, false)))); }, [large.columns, large.rows, large.fontSize]);
for (let i = 0; i < large.columns.length - 1; i++) check(large.columns[i].x + lg[i] <= large.columns[i + 1].x, 'jeu large : pas de chevauchement (« ' + large.columns[i].label + ' »)');
check(large.columns[large.columns.length - 1].x + lg[lg.length - 1] <= 762, 'jeu large : tient dans la page');
console.log('OK 4 PDF : mise en page calculée d\'après la largeur du texte (police ' + (pdf.fontSize || 9.5) + ' pt jeu normal, ' + (large.fontSize || 9.5) + ' pt jeu large ; ' + large.labels.length + ' colonnes), sans chevauchement, mentions réglementaires conservées.');

// ================================================================ 5. bouton « Exporter le carnet (Excel) » de la page PC
const carnet = await page.evaluate(async () => {
  const cap = [];
  window.buildXlsxWorkbook = async (s) => { cap.push({ t: 'xlsx', s: JSON.parse(JSON.stringify(s)) }); return new Uint8Array([1]); };
  window.saveOrShareBinaryFile = async (nom, bytes, mime) => { cap.push({ t: 'file', nom, mime }); };
  carnetSanitairePcEtat = null; render('sanitaire');
  document.getElementById('cs-export').click();
  await new Promise(r => setTimeout(r, 100));
  return cap;
});
const feuille = carnet.find(x => x.t === 'xlsx').s;
check(feuille.length === 1 && feuille[0].name === 'Sanitaire' && feuille[0].rows[0].length === 14 && feuille[0].rows.length === 1 + (await page.evaluate(() => registreSanitaireRows().length)), 'bouton carnet : une feuille « Sanitaire » de 14 colonnes, tout le carnet (sans filtre)');
check(/^carnet-sanitaire-2026-10-02\.xlsx$/.test(carnet.find(x => x.t === 'file').nom), 'nom de fichier : ' + carnet.find(x => x.t === 'file').nom);
console.log('OK 5 bouton « Exporter le carnet (Excel) » : feuille Sanitaire complète.');
await browser.close();
console.log('\nTOUS LES TESTS DES EXPORTS DU SANITAIRE SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
