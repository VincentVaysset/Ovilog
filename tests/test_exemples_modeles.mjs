/* Lignes d'exemple des modèles Excel : JAMAIS importées.
   Chaque modèle embarqué (MODELES_IMPORT) est importé TEL QUEL, exemples compris : aucune ligne à enregistrer, rien d'écrit,
   ligne grise « N lignes d'exemple du modèle laissées de côté » ; les exemples des ANCIENNES versions (déjà téléchargées) sont reconnus aussi ;
   une ligne d'exemple modifiée par l'éleveur, elle, est lue normalement. Boutons des cartes d'import : « Importer un fichier Excel » en vert partout.
   Jeu SYNTHÉTIQUE (indicatif 000456), aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1400 } });
await ctx.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test', refocus: () => {} }; });
const p = await ctx.newPage();
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
p.on('dialog', d => d.accept());
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
const prep = () => p.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = () => { window.__saves++; return true; };
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456', nom: 'Exploitation exemple', typeSuivi: 'cls', nbControlesSuivi: 4 });
  // de VRAIES brebis portant les n° des exemples : rien ne doit leur être écrit
  const mk = (id, eid, court) => ({ id, eid, numeroCourtTravailSieol: court, statut: 'active', createdAt: 1, echographies: [], sanitaire: [], notes: [], mouvements: [], modesRepro: [], agnelages: [], controleLaitier: [] });
  DB.brebis = [mk('b1', '250000045620601', '601'), mk('b2', '250000045620602', '602'), mk('b3', '250000045620603', '603'), mk('b4', '250000045620501', '501'), mk('b5', '250000045659001', '')];
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} }; DB.lactationModele = [];
  window.__avant = JSON.stringify(DB);
});
const XM = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const modele = cle => p.evaluate(c => Array.from(base64VersOctets(MODELES_IMPORT[c].b64)), cle);
const charger = async (vue, champ, octets) => {
  await p.evaluate(v => render(v), vue); await p.waitForTimeout(150);
  await p.setInputFiles('#' + champ, { name: 'modele.xlsx', mimeType: XM, buffer: Buffer.from(octets) });
  await p.waitForTimeout(700);
};
const ligneGrise = champ => p.evaluate(c => { const e = document.getElementById(c).parentElement.querySelector('.import-exemples-ignores'); return e ? e.textContent : ''; }, champ);

// 1. chaque modèle importé tel quel : exemples laissés de côté, rien d'écrit
const CAS = [
  ['controle-laitier', 'import-controle-laitier-modele', 'import-cl-modele-file', 5, '#btn-confirm-import-cl-modele'],
  ['lactation-cls', 'import-lactation-modele', 'import-lact-modele-file', 2, '#btn-confirm-import-lact-modele'],
  ['correspondance-sieol', 'import-correspondance-sieol', 'import-corresp-sieol-file', 3, null],
  ['nouveaux-animaux', 'import-nouveaux-animaux', 'import-nouveaux-animaux-file', 6, null]
];
for (const [cle, vue, champ, nb, confirmer] of CAS) {
  await prep();
  await charger(vue, champ, await modele(cle));
  eq(await ligneGrise(champ), nb + ' lignes d\'exemple du modèle laissées de côté (jamais importées).', cle + ' : exemples annoncés');
  const txt = await p.textContent('#app');
  check(!/250105|00000051001|00000123987|00000189234|00000055102|285,4|1\s?620/.test(txt.replace(/Modele_[^ ]*/g, '')), cle + ' : aucun exemple dans l\'aperçu');
  if (confirmer) check(await p.$eval(confirmer, b => b.classList.contains('hidden') || b.disabled), cle + ' : rien à confirmer');
  eq(await p.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), true, cle + ' : rien d\'écrit');
}

// 2. anciens exemples (modèles déjà téléchargés) reconnus, ligne modifiée importée
const rows = await p.evaluate(() => {
  const r = retirerExemplesModele([['Ovilog'], [], [], ['', '', '05-12-2026'], ['EID', 'N° de travail', 'Contrôle 1'], ['', '250103', '09', '', '1200'], ['', '250104', '07', '1400', '900'], ['', '601', '1500', '1300', '1060'], ['↑ Exemples…']], 'Contrôle laitier');
  return { nb: r.nb, restantes: r.rows.filter(x => x && x.length).map(x => x.join('|')) };
});
eq(rows.nb, 2, 'anciens exemples (09 et 07 sans barre) reconnus');
eq(rows.restantes, ['Ovilog', '|' + '|05-12-2026', 'EID|N° de travail|Contrôle 1', '|601|1500|1300|1060'], 'la note est retirée, la ligne modifiée (601, 1500) gardée');

// 3. boutons des cartes : « Importer un fichier Excel » vert partout
await prep();
await p.evaluate(() => { parametresTab = 'imports'; render('parametres'); }); await p.waitForTimeout(400);
const boutons = await p.$$eval('.prm-import .prm-actions .btn-primary', bs => bs.map(b => b.textContent));
eq([...new Set(boutons)].sort(), ['Importer les fichiers SIEOL', 'Importer un fichier Excel'], 'libellés des boutons d\'import (verts)');
check(!(await p.$$eval('.prm-import .prm-actions .btn-secondary', bs => bs.some(b => /Importer/.test(b.textContent)))), 'aucun bouton d\'import blanc');

await browser.close();
console.log('OK test_exemples_modeles');
