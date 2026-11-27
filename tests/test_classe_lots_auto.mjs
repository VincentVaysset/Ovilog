/* Chantier du 27/11, point 7 : (1) classe par quart : seules 1, 2, 3 et 4 s'affichent (`classeParQuartAffichee`) — une classe 0 ou hors liste
   donne « - », sur la fiche (Index, Carrière), au tri des agnelles et aux Lots PC (classe de la mère), dans l'aperçu de l'import Lactation et dans
   l'export des écarts ; (2) lot AUTOMATIQUE (« À passer à l'écho »…) : une brebis sortie après la création du lot n'y apparaît plus, en temps
   réel (recherche en bergerie, liste des lots), sans que le lot enregistré soit réécrit ; un lot fait à la main reste tel quel.
   Jeu synthétique, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.clock.setFixedTime(new Date('2026-11-26T09:00:00'));
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);

// ================================================================ 1. classe 0 jamais affichée
eq(await page.evaluate(() => [0, '0', 1, '2', 3, 4, 5, '', null, undefined, 'x', 2.5, '3,0'].map(classeParQuartAffichee)), [null, null, 1, 2, 3, 4, null, null, null, null, null, null, 3], 'classeParQuartAffichee : 1 à 4 seulement');
const r = await page.evaluate(() => {
  DB = migrateData({}); saveData = function () {};
  DB.campagneDebut = 2027; DB.campagneDateDemarrage = '2026-09-29'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { typeSuivi: 'cls' });
  const f = (id, n) => ({ id, eid: '2500000129' + String(30000 + n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] });
  DB.brebis = [f('b1', 1), f('b2', 2)];
  DB.lactationModele = [   // import « Lactation » : classes 4 ici, jamais lues pour la classe (source unique = Bilan SIEOL)
    { eid: DB.brebis[0].eid, campagne: 2026, lactationTotale: 146.2, joursTraite: 87, lactationMoyenne: 1.7, indiceCumule: 1650, classeParQuart: 4 },
    { eid: DB.brebis[0].eid, campagne: 2025, lactationTotale: 300, classeParQuart: 4 },
    { eid: DB.brebis[1].eid, campagne: 2026, lactationTotale: 320, classeParQuart: 4 }];
  DB.bilanLactation = [
    { eid: DB.brebis[0].eid, campagne: 2026, lactTotale: 146.2, classeParQuart: 0 },   // classe 0 : jamais affichée
    { eid: DB.brebis[0].eid, campagne: 2025, lactTotale: 300, classeParQuart: 0 },
    { eid: DB.brebis[1].eid, campagne: 2026, lactTotale: 320, classeParQuart: 3 }];
  render('detail', 'b1');
  const html = document.getElementById('app').innerHTML;
  return { classe0: /Classe 0\b/.test(html), index: /Classe par quart|classeParQuart/.test(html), precedente: [lactationPrecedenteBrebis(DB.brebis[0].eid).classe, lactationPrecedenteBrebis(DB.brebis[1].eid).classe],
    genealogie: [lactationBrebisCampagne(DB.brebis[0].eid, 2026).classe, lactationBrebisCampagne(DB.brebis[1].eid, 2026).classe] };
});
check(!r.classe0, 'fiche : aucune « Classe 0 » (Carrière, Index)');
eq(r.precedente, [null, 3], 'classe de la campagne précédente (tri des agnelles, Lots PC) : 0 → « - », 3 gardée');
eq(r.genealogie, [null, 3], 'généalogie (classe de la mère) : 0 → « - »');
// onglet Index de la fiche : la case de la classe affiche « - »
const idx = await page.evaluate(() => {
  const t = [...document.querySelectorAll('.tab-btn, .fiche-tab, [data-tab]')].find(b => /Index/.test(b.textContent));
  if (t) t.click();
  const app = document.getElementById('app').textContent.replace(/\s+/g, ' ');
  return { trouve: !!t, texte: (app.match(/Classe par quart\s*-?\S*/) || [''])[0] };
});
check(idx.trouve, 'onglet Index présent (suivi CLS)');
check(/^Classe par quart\s*-/.test(idx.texte), 'Index : la classe 0 s\'affiche « - » : ' + idx.texte);
// source unique : la classe 4 de l'import « Lactation » n'apparaît jamais ; suivi CLO : aucune classe, d'où qu'elle vienne
const src = await page.evaluate(() => {
  const avant = { b2: lactationBrebisCampagne(DB.brebis[1].eid, 2026), carriere4: /Classe 4\b/.test(document.getElementById('app').innerHTML) };
  DB.exploitation.typeSuivi = 'clo';
  const clo = [lactationBrebisCampagne(DB.brebis[1].eid, 2026).classe, lactationPrecedenteBrebis(DB.brebis[1].eid).classe, lactationBrebisCampagne(DB.brebis[1].eid, 2026).lactation];
  render('detail', 'b2'); const html = document.getElementById('app').innerHTML;
  DB.exploitation.typeSuivi = 'cls';
  return { b2: [avant.b2.classe, avant.b2.lactation], carriere4: avant.carriere4, clo, cloClasse: /Classe [0-9]\b/.test(html) };
});
eq(src.b2, [3, 320], 'Bilan SIEOL : classe 3 et 320 L (l\'import Lactation dit 4 : jamais lu)');
check(!src.carriere4, 'fiche : aucune « Classe 4 » venue de l\'import Lactation');
eq(src.clo, [null, null, 320], 'suivi CLO : aucune classe (lactation totale du Bilan gardée)');
check(!src.cloClasse, 'suivi CLO : aucune pastille « Classe N » sur la fiche');
console.log('OK 1 classe par quart : 1 à 4 seulement, « - » sinon (fiche Index et Carrière, campagne précédente, généalogie) ; source unique = Bilan SIEOL ; CLO sans classe.');

// ================================================================ 2. lot automatique : sans les brebis sorties, en temps réel
const L = await page.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  DB.campagneDebut = 2027; DB.campagneDateDemarrage = '2026-09-29'; DB.campagneInitialisee = true;
  const f = (id, n) => ({ id, eid: '2500000129' + String(40000 + n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] });
  DB.brebis = [f('a', 1), f('b', 2), f('c', 3)];
  DB.lots = [{ id: 'auto-echo-a-passer', nom: 'À passer à l\'écho', membres: DB.brebis.map(b => b.eid), dateCreation: '2026-11-20', auto: true },
    { id: 'L1', nom: 'Lot fait à la main', type: 'recherche', membres: DB.brebis.map(b => b.eid), dateCreation: '2026-11-20' }];
  // la brebis b est vendue après la création du lot
  const b = DB.brebis[1]; b.mouvements.push({ type: 'Vente', acheteur: 'Acheteur C', date: '2026-11-25' }); recalculerStatutBrebis(b);
  const avant = JSON.stringify(DB.lots);
  currentLotId = 'auto-echo-a-passer'; render('lot-search');
  const auto = { compteur: document.getElementById('lot-compteur').textContent, texte: document.getElementById('app').textContent };
  currentLotId = 'L1'; render('lot-search');
  const main = { compteur: document.getElementById('lot-compteur').textContent };
  render('lots');
  const liste = document.getElementById('app').textContent.replace(/\s+/g, ' ');
  return { auto, main, liste, inchange: JSON.stringify(DB.lots) === avant, numeroMorte: numeroVisuel(b.eid), affiches: membresLotAffiches(DB.lots[0]).length };
});
eq([L.auto.compteur, L.affiches], ['0 / 2 trouvée(s)', 2], 'lot automatique : la brebis vendue après sa création n\'est plus à chercher');
check(!L.auto.texte.includes(L.numeroMorte), 'lot automatique : la vendue n\'apparaît pas');
eq(L.main.compteur, '0 / 3 trouvée(s)', 'lot fait à la main : tel quel');
check(/2 brebis/.test(L.liste) && /3 brebis/.test(L.liste), 'liste des lots : 2 brebis pour le lot automatique, 3 pour le lot fait à la main : ' + L.liste.slice(0, 300));
check(L.inchange, 'affichage seul : le lot enregistré n\'est pas réécrit');
console.log('OK 2 lot automatique : brebis sortie retirée en temps réel (recherche, liste des lots), lot enregistré inchangé ; lot fait à la main tel quel.');
await browser.close();
console.log('TOUS LES TESTS « CLASSE PAR QUART ET LOTS AUTOMATIQUES » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
