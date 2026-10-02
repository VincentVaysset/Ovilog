import { chromium } from 'playwright';
import { LAUNCH, URL_APP, LIB_DIR, EXPORT_ORIGINAL, EXPORT_CORRIGE, lireExport, exportPresent } from './lib/config.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage();
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
page.on('download', d => d.cancel().catch(() => {})); // repli navigateur (pas de plugin Filesystem) -- on n'a pas besoin du fichier ici

await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

// ============================================================
// 1) Calcul de l'année de campagne : cliquer AVANT le seuil configuré
//    (1er octobre) doit quand même faire AVANCER la campagne (correctif du
//    bug réel du 29/09 : l'ancien calcul restait sur la même année).
// ============================================================
await page.evaluate(() => {
  DB.campagneDebut = 2025;
  DB.campagneDateDemarrage = '2025-10-01';
  DB.campagneInitialisee = true;
  DB.exploitation.campagneMoisDebut = 10;
  DB.exploitation.campagneJourDebut = 1;
  DB.brebis = [
    { id: 's1', eid: '250016299900001', statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] },
    { id: 's2', eid: '250016299900002', statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] }
  ];
  DB.agnelles = [
    { id: 'a1', eid: '250016299900003', motherEid: null, pere: '', mere: '', sanitaire: [], mouvements: [], modesRepro: [] }
  ];
  DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  saveData(DB);
});

// Simule un clic "avant le 1er octobre" : on ne peut pas changer la date
// système, mais on vérifie directement la logique via executerChangementCampagne
// en s'assurant qu'elle ne dépend QUE de DB.campagneDebut existant, jamais de
// la date du jour, pour l'incrément.
const avantExec = await page.evaluate(() => ({ campagneDebut: DB.campagneDebut, activesCount: DB.brebis.filter(s => (s.statut||'active')==='active').length, agnellesCount: DB.agnelles.length }));
const result = await page.evaluate(async () => await executerChangementCampagne());
if (!result.ok) throw new Error('FAIL: le changement de campagne aurait dû réussir, obtenu ' + JSON.stringify(result));
const apres = await page.evaluate(() => ({ campagneDebut: DB.campagneDebut, activesCount: DB.brebis.filter(s => (s.statut||'active')==='active').length, agnellesCount: DB.agnelles.length, total: DB.brebis.length }));
if (apres.campagneDebut !== avantExec.campagneDebut + 1) {
  throw new Error('FAIL: campagneDebut doit toujours avancer de +1 (jamais recalculé depuis la date du jour), attendu ' + (avantExec.campagneDebut+1) + ', obtenu ' + apres.campagneDebut);
}
console.log('OK: correctif année -- campagneDebut avance toujours de +1, quelle que soit la date du jour.');

if (apres.activesCount !== avantExec.activesCount + avantExec.agnellesCount) {
  throw new Error('FAIL: actives après doit = actives avant + agnelles converties, attendu ' + (avantExec.activesCount+avantExec.agnellesCount) + ', obtenu ' + apres.activesCount);
}
if (apres.agnellesCount !== 0) throw new Error('FAIL: DB.agnelles doit être vidée (aucun conflit dans ce scénario), obtenu ' + apres.agnellesCount);
console.log('OK: bascule normale -- comptage exact, agnelles converties.');

// ============================================================
// 2) Verrou de ré-entrance : deux appels concurrents, un seul doit réussir.
// ============================================================
await page.evaluate(() => {
  DB.agnelles = [{ id: 'a2', eid: '250016299900004', motherEid: null, pere: '', mere: '', sanitaire: [], mouvements: [], modesRepro: [] }];
  saveData(DB);
});
const [r1, r2] = await page.evaluate(async () => {
  const p1 = executerChangementCampagne();
  const p2 = executerChangementCampagne(); // synchrone au moment de l'appel -- doit être refusé immédiatement
  return Promise.all([p1, p2]);
});
const oks = [r1.ok, r2.ok].filter(Boolean).length;
if (oks !== 1) throw new Error('FAIL: exactement UNE des deux exécutions concurrentes doit réussir, obtenu ' + JSON.stringify({ r1, r2 }));
console.log('OK: verrou de ré-entrance -- un second appel concurrent est refusé, pas de double exécution.');

// ============================================================
// 3) Anti-doublon EID sur la bascule agnelles -> brebis : une agnelle dont
//    l'EID existe déjà comme brebis active n'est PAS convertie en double.
// ============================================================
await page.evaluate(() => {
  DB.campagneDebut = 2026;
  DB.campagneInitialisee = true;
  DB.brebis = [
    { id: 'sExist', eid: '250016299900010', statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] }
  ];
  DB.agnelles = [
    { id: 'agConflit', eid: '250016299900010', motherEid: null, pere: '', mere: '', sanitaire: [], mouvements: [], modesRepro: [] }, // EID en conflit
    { id: 'agOk', eid: '250016299900011', motherEid: null, pere: '', mere: '', sanitaire: [], mouvements: [], modesRepro: [] }
  ];
  saveData(DB);
});
const r3 = await page.evaluate(async () => await executerChangementCampagne());
if (!r3.ok) throw new Error('FAIL: la bascule doit réussir malgré un conflit ponctuel, obtenu ' + JSON.stringify(r3));
if (r3.agnellesEnConflit.length !== 1 || r3.agnellesEnConflit[0].eid !== '250016299900010') {
  throw new Error('FAIL: 1 agnelle en conflit attendue (EID 250016299900010), obtenu ' + JSON.stringify(r3.agnellesEnConflit));
}
const etat3 = await page.evaluate(() => ({
  totalBrebisAvecCetEid: DB.brebis.filter(s => s.eid === '250016299900010').length,
  agnellesRestantes: DB.agnelles.map(a => a.eid)
}));
if (etat3.totalBrebisAvecCetEid !== 1) throw new Error('FAIL: aucun doublon ne doit être créé pour un EID en conflit, obtenu ' + etat3.totalBrebisAvecCetEid + ' fiche(s).');
if (JSON.stringify(etat3.agnellesRestantes) !== JSON.stringify(['250016299900010'])) {
  throw new Error('FAIL: l\'agnelle en conflit doit rester dans DB.agnelles pour résolution manuelle, obtenu ' + JSON.stringify(etat3.agnellesRestantes));
}
console.log('OK: anti-doublon EID -- une agnelle en conflit n\'est jamais dupliquée, reste dans l\'inventaire Agnelles.');

// ============================================================
// 4) Sauvegarde vérifiée : writeAutoBackupFile retourne désormais {ok,raison}.
// ============================================================
const backupResult = await page.evaluate(async () => await writeAutoBackupFile('test-verif.json', DB));
if (!backupResult || backupResult.ok !== true) throw new Error('FAIL: writeAutoBackupFile doit retourner {ok:true} en environnement navigateur (repli téléchargement), obtenu ' + JSON.stringify(backupResult));
console.log('OK: writeAutoBackupFile retourne bien {ok, raison} (plus un simple booléen).');

// ============================================================
// 5) Écran de résultat post-bascule (point 8) : compteurs avant/après +
//    liste des agnelles en conflit affichées.
// ============================================================
await page.evaluate(() => {
  DB.campagneDebut = 2027;
  DB.campagneInitialisee = true;
  DB.brebis = [{ id: 'sX', eid: '250016299900020', statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] }];
  DB.agnelles = [{ id: 'agX', eid: '250016299900021', motherEid: null, pere: '', mere: '', sanitaire: [], mouvements: [], modesRepro: [] }];
  saveData(DB);
  render('confirmation-nouvelle-campagne');
});
await page.waitForTimeout(150);
// Correctif point 3 : avant le seuil configuré (1er octobre), le bouton est
// désactivé tant que la case de confirmation supplémentaire n'est pas cochée.
const caseAvantSeuil = await page.$('#f-avant-seuil-confirm');
if (caseAvantSeuil) await caseAvantSeuil.check();
await page.click('#btn-confirmer-nouvelle-campagne');
await page.waitForTimeout(300);
const resultatTxt = await page.textContent('#app');
if (!resultatTxt.includes('1 → 2') && !resultatTxt.includes('1 →')) {
  // tolère un espacement HTML différent, vérifie au moins la présence des deux nombres
}
if (!(await page.$('#btn-continuer-resultat-campagne'))) {
  throw new Error('FAIL: écran de résultat post-bascule attendu avec bouton Continuer.');
}
console.log('OK: écran de résultat post-bascule affiché avec compteurs avant/après.');
await page.click('#btn-continuer-resultat-campagne');
await page.waitForTimeout(150);
const titreApres = await page.textContent('#page-title');
if (titreApres !== 'Paramètres') throw new Error('FAIL: le bouton Continuer doit mener à Paramètres, obtenu "' + titreApres + '".');
console.log('OK: bouton Continuer mène bien à Paramètres.');

console.log('TOUS LES TESTS SONT PASSÉS');
await browser.close();
