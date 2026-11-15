/* Codes d'anomalie du contrôle laitier :
   - 01 à 05 : sens réglé par l'éleveur (Paramètres › Règles d'élevage › Lait, libellesAnomaliesControle, réglage de compte),
     libellés de départ, 02 vide ; un code sans nom s'affiche seul ; toujours avec du lait ;
   - 06 à 11 fixes ; 07, 09, 10 jamais avec du lait (modèle Excel : « 1400/09 » refusé, « 0/09 » accepté ; SIEOL : contrôle laissé de côté) ;
   - fiche brebis : code ET nom (« 03 · Boucle électronique manquante ») en pastille ambre ; tableaux du contrôle laitier : code seul + légende « Codes : 03 = … ».
   Jeu SYNTHÉTIQUE (indicatif 000456), aucune donnée réelle. */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const prep = () => {
  DB = migrateData({}); window.__saves = 0; saveData = () => { window.__saves++; return true; };
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456', nom: 'Exploitation exemple', typeSuivi: 'cls', nbControlesSuivi: 4 });
  DB.brebis = [{ id: 'b1', eid: '250000045620043', numeroCourtTravailSieol: '543', statut: 'active', createdAt: 1, echographies: [], sanitaire: [], notes: [], mouvements: [], modesRepro: [],
    agnelages: [{ date: '2026-11-02', campagne: 2026, codeRepro: 'MN', lambs: [] }],
    controleLaitier: [{ controle: 1, quantite: 1400, anomalie: 3, date: '2027-01-20', campagne: 2026 }, { controle: 2, quantite: 1200, anomalie: 2, date: '2027-02-20', campagne: 2026 }, { controle: 3, quantite: null, anomalie: 9, date: '2027-03-20', campagne: 2026 }] },
    { id: 'b2', eid: '250000045620101', numeroCourtTravailSieol: '601', statut: 'active', createdAt: 1, echographies: [], sanitaire: [], notes: [], mouvements: [], modesRepro: [], agnelages: [{ date: '2026-11-03', campagne: 2026, codeRepro: 'MN', lambs: [] }], controleLaitier: [] }];
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
};
async function ouvrir(bureau) {
  const ctx = await browser.newContext({ viewport: bureau ? { width: 1400, height: 1400 } : { width: 390, height: 844 } });
  if (bureau) await ctx.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test', refocus: () => {} }; });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date('2027-03-25T09:00:00'));
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  p.on('dialog', d => d.accept());
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(prep);
  return p;
}

// 1. Règles pures
{
  const p = await ouvrir(false);
  const r = await p.evaluate(() => {
    const cell = v => { const x = parseCelluleControleLaitierModele(v); return x.invalide ? 'invalide' : !x.present ? 'vide' : (x.quantite === null ? '-' : x.quantite) + '/' + (x.anomalie || ''); };
    return {
      libelles: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(n => texteAnomalieControle(n)),
      cases: ['1400/09', '1400/07', '1400/10', '0/09', '0/07', '0/10', '0/11', '1400/06', '1400/11', '1400/08', '0/08', '0/03', '1400/03', '09', '07', '0'].map(cell)
    };
  });
  eq(r.libelles, ['01 · Problème de pis', '02', '03 · Boucle électronique manquante', '04 · Boucle conventionnelle manquante', '05 · Réforme', '06 · Malade', '07 · Contrôle sauté', '08 · Mammite', '09 · Tarie', '10 · Vide définitive', '11 · Allaitante et traite'], 'libellés de départ (02 sans nom)');
  eq(r.cases, ['invalide', 'invalide', 'invalide', '-/9', '-/7', '-/10', '-/11', '1400/6', '1400/11', '1400/8', '-/8', 'invalide', '1400/3', '-/9', '-/7', 'vide'], 'modèle Excel : 07, 09, 10 jamais avec du lait ; 01 à 05 toujours avec');
  const regle = await p.evaluate(() => { DB.libellesAnomaliesControle = { 1: '', 2: 'Lait anormal', 3: 'Boucle électronique manquante', 4: '', 5: 'Réforme' }; return [1, 2, 4].map(n => texteAnomalieControle(n)); });
  eq(regle, ['01', '02 · Lait anormal', '04'], 'libellés réglés : vide = code seul');
  await p.context().close();
}

// 2. Paramètres › Règles d'élevage › Lait (PC) : réglage enregistré, codes fixes rappelés
{
  const p = await ouvrir(true);
  await p.evaluate(() => { parametresTab = 'regles'; render('parametres'); }); await p.waitForTimeout(300);
  eq(await p.$$eval('#card-lait .prm-code-ligne input', is => is.map(i => i.value)), ['Problème de pis', '', 'Boucle électronique manquante', 'Boucle conventionnelle manquante', 'Réforme'], 'champs pré-remplis');
  eq(await p.$$eval('#card-lait .prm-code-fixe', ds => ds.map(d => [...d.children].map(c => c.textContent).join(' '))), ['06 Malade avec ou sans lait', '07 Contrôle sauté jamais avec du lait', '08 Mammite avec ou sans lait', '09 Tarie jamais avec du lait', '10 Vide définitive jamais avec du lait', '11 Allaitante et traite avec ou sans lait'], 'codes fixes rappelés');
  await p.fill('#f-code-anomalie-2', 'Lait <anormal>');
  await p.click('#btn-save-codes-anomalie'); await p.waitForTimeout(200);
  eq(await p.evaluate(() => DB.libellesAnomaliesControle), { 1: 'Problème de pis', 2: 'Lait <anormal>', 3: 'Boucle électronique manquante', 4: 'Boucle conventionnelle manquante', 5: 'Réforme' }, 'réglage enregistré');
  check(/'libellesAnomaliesControle'/.test(readFileSync(new URL('../www/index.html', import.meta.url), 'utf8').match(/const META_FIELDS = \[[\s\S]*?\];/)[0]), 'réglage de compte (synchronisé)');
  eq(await p.evaluate(() => DB.brebis[0].controleLaitier.map(c => c.anomalie)), [3, 2, 9], 'codes enregistrés inchangés');
  // fiche brebis : code et nom, pastille ambre, texte échappé
  await p.evaluate(() => { currentSheepId = 'b1'; ficheBrebisTabSheepId = 'b1'; ficheBrebisTab = 'ctrl'; render('detail'); }); await p.waitForTimeout(300);
  eq(await p.$$eval('.cl-ano-fiche', ts => ts.map(t => t.textContent)), ['09 · Tarie', '02 · Lait <anormal>', '03 · Boucle électronique manquante'], 'fiche : code et nom');
  check(await p.$$eval('.cl-ano-fiche', ts => ts.every(t => t.classList.contains('compact-tag-amber'))), 'fiche : pastilles ambre');
  check(!(await p.$('.cl-ano-fiche b, .cl-ano-fiche anormal')), 'fiche : libellé échappé');
  // tableau PC du contrôle laitier : légende
  await p.evaluate(() => render('controle-laitier')); await p.waitForTimeout(300);
  check(/Codes : 02 = Lait <anormal> · 03 = Boucle électronique manquante · 09 = Tarie/.test(await p.textContent('#app')), 'PC : légende des codes');
  await p.context().close();
}

// 3. Contrôle laitier mobile : code seul dans les cartes, légende
{
  const p = await ouvrir(false);
  await p.evaluate(() => render('controle-laitier')); await p.waitForTimeout(300);
  eq(await p.$$eval('.cl-carte .cl-ano', as => as.map(a => a.textContent)), ['03', '02', '09'], 'mobile : code seul');
  check(/Codes : 02 = sans nom · 03 = Boucle électronique manquante · 09 = Tarie/.test(await p.textContent('.cl-legende')), 'mobile : légende');
  await p.context().close();
}

// 4. SIEOL : lait + 07 / 09 / 10 laissé de côté
{
  const p = await ouvrir(true);
  await p.evaluate(() => render('import-controle-laitier-sieol')); await p.waitForTimeout(150);
  await p.setInputFiles('#import-cl-resume-file', { name: 'r.csv', mimeType: 'text/csv', buffer: Buffer.from('num_controle;date_controle;lait_total;nb_brebis\n4;20/04/2027;1500;10\n') }); await p.waitForTimeout(200);
  await p.setInputFiles('#import-cl-cahier-file', { name: 'c.csv', mimeType: 'text/csv', buffer: Buffer.from('numero_visuel_sieol;ctl4_ml;ctl4_anomalie\n543;1300;09\n601;0;09\n') }); await p.waitForTimeout(300);
  const rejet = await p.textContent('#import-cl-rejets10');
  check(/n°543 C4 : 1\s300\smL avec le code 09/.test(rejet), 'SIEOL : lait + 09 laissé de côté : ' + rejet);
  await p.click('#btn-confirm-import-cl'); await p.waitForTimeout(300);
  eq(await p.evaluate(() => DB.brebis.map(b => b.controleLaitier.filter(c => c.controle === 4).map(c => [c.quantite, c.anomalie]))), [[], [[null, 9]]], 'SIEOL : seul « 0 + 09 » est importé');
  await p.context().close();
}

await browser.close();
console.log('OK test_codes_anomalie');
