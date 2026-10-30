/* Deux listes de causes de mortalité : adultes (DB.causesMortalite : brebis, béliers) et agneaux (DB.causesMortaliteAgneaux : agneaux, mort-nés,
   agnelles gardées). Chaque écran ne propose que sa liste (Mouvements PC et mobile selon la catégorie, mouvement individuel, mort-né, « Déclarer
   mort » d'un agneau avec cause facultative) ; « Ajouter… » range la cause dans la bonne liste ; compteurs et renommage séparés ; liste agneaux
   remplie une fois avec les causes déjà portées par des agneaux / mort-nés / agnelles, sans rien modifier ni retirer ; synchronisée (META_FIELDS).
   saveData REMPLACÉ ; jeu synthétique (EID d'exemple, indicatif 000456). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { readFileSync } from 'fs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1400, height: 1000 } : { width: 390, height: 844 } })).newPage();
  await page.clock.setFixedTime(new Date('2027-03-20T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(() => {
    // export d'avant la séparation : pas de liste agneaux
    window.__ancien = {
      causesMortalite: ['Mammite', 'Faiblesse', 'Mise à jour inventaire'],
      brebis: [{ id: 'b1', eid: '250000004569001', statut: 'active', createdAt: 1, echographies: [], sanitaire: [], notes: [], controleLaitier: [], modesRepro: [],
        mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }, { type: 'Morte', cause: 'Mammite', date: '2026-12-01' }],
        agnelages: [{ date: '2026-11-01', campagne: 2026, codeRepro: 'MN', lambs: [
          { sexe: 'Mâle', adopte: false, eid: '250000004561001', statutFinal: 'mort', sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-11-01' }, { type: 'Mort', cause: 'Faiblesse', date: '2026-11-05' }] },
          { sexe: 'Femelle', adopte: false, eid: '250000004561002', statutFinal: 'mort', sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-11-01' }, { type: 'Mort', cause: 'Mort', date: '2026-11-06' }] },
          { sexe: 'Mort-né', adopte: false, cause: 'Froid' },
          { sexe: 'Femelle', adopte: false, eid: '250000004561004', sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-11-01' }] }] }] }],
      beliers: [], agnelles: [{ id: 'a1', eid: '250000004561010', statut: 'morte', mouvements: [{ type: 'Morte', cause: 'Diarrhée', date: '2026-12-02' }] }],
      mouvementsCollectifs: [{ id: 'mc1', categorie: 'agneaux', type: 'Mort', cause: 'Écrasé', date: '2026-11-07', membres: [] }, { id: 'mc2', categorie: 'brebis', type: 'Morte', cause: 'Mise à jour inventaire', date: '2026-12-03', membres: [] }]
    };
    const copie = JSON.parse(JSON.stringify(window.__ancien));
    DB = migrateData(copie); saveData = () => true;
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true; DB.lots = [];
  });
  return page;
}
const options = (p, sel) => p.evaluate(sel => [...document.querySelector(sel).options].map(o => o.value).filter(v => v && v !== '__ajouter__'), sel);

for (const bureau of [false, true]) {
  const nom = bureau ? 'PC' : 'mobile';
  const p = await ouvrir(bureau);
  // ================================================================ 1. liste agneaux remplie une fois, rien de modifié ni retiré
  const init = await p.evaluate(() => ({ ag: DB.causesMortaliteAgneaux.slice().sort(), ad: DB.causesMortalite, intacts: (() => { const t = migrateData(Object.assign(JSON.parse(JSON.stringify(window.__ancien)), { causesMortaliteAgneaux: [] })); return ['brebis', 'agnelles', 'mouvementsCollectifs', 'causesMortalite'].every(k => JSON.stringify(DB[k]) === JSON.stringify(t[k])); })() }));
  init.meta = /'causesMortaliteAgneaux'/.test(readFileSync(new URL('../www/index.html', import.meta.url), 'utf8').match(/const META_FIELDS = \[[\s\S]*?\];/)[0]);
  eq(init, { ag: ['Diarrhée', 'Faiblesse', 'Froid', 'Écrasé'].sort(), ad: ['Mammite', 'Faiblesse', 'Mise à jour inventaire'], intacts: true, meta: true }, nom + ' : liste agneaux = causes déjà portées par agneaux, mort-nés, agnelles (sans « Mort » ni « Mise à jour inventaire ») ; liste adultes inchangée ; enregistrements intacts ; synchronisée');
  eq(await p.evaluate(() => migrateData({ causesMortaliteAgneaux: [], brebis: [{ agnelages: [{ lambs: [{ sexe: 'Mort-né', cause: 'Froid' }] }] }] }).causesMortaliteAgneaux), [], nom + ' : liste agneaux déjà présente (même vide) jamais re-remplie');
  eq(await p.evaluate(() => migrateData({}).causesMortaliteAgneaux), [], nom + ' : compte neuf : liste agneaux vide');
  console.log('OK 1 ' + nom + ' : remplissage initial de la liste agneaux, une seule fois, rien de modifié.');

  // ================================================================ 2. écrans : chaque catégorie a sa liste
  await p.evaluate(() => { DB.causesMortalite = ['Mammite', 'Mise à jour inventaire']; DB.causesMortaliteAgneaux = ['Faiblesse', 'Froid']; });
  if (bureau) {
    await p.evaluate(() => { mvPcEtat = null; render('inventaire'); }); await p.waitForSelector('#mv-table');
    const vu = {};
    for (const [cat, type] of [['brebis', 'Morte'], ['beliers', 'Mort'], ['agnelles', 'Morte'], ['agneaux', 'Mort']]) {
      await p.click(`.mv-cat[data-cat="${cat}"]`); await p.click(`.mv-type[data-val="${type}"]`);
      vu[cat] = await options(p, '#mv-cause');
    }
    eq(vu, { brebis: ['Mammite', 'Mise à jour inventaire'], beliers: ['Mammite', 'Mise à jour inventaire'], agnelles: ['Faiblesse', 'Froid'], agneaux: ['Faiblesse', 'Froid'] }, 'PC Mouvements : brebis et béliers = adultes, agnelles et agneaux = agneaux');
    await p.selectOption('#mv-cause', '__ajouter__'); await p.fill('#liste-ajout-input', 'Coccidiose'); await p.click('#liste-ajout-ok');
    eq(await p.evaluate(() => [DB.causesMortaliteAgneaux.includes('Coccidiose'), DB.causesMortalite.includes('Coccidiose'), document.getElementById('mv-cause').value]), [true, false, 'Coccidiose'], 'PC Mouvements, agneaux : « Ajouter… » range la cause dans la liste agneaux');
  } else {
    const vu = {};
    for (const [cat, type] of [['brebis', 'Morte'], ['agneaux', 'Mort'], ['agnelles', 'Morte'], ['beliers', 'Mort']]) {
      await p.evaluate(cat => { mvMobNouveau = mvMobNouveauInitial(cat); renderNouveauMouvementMobile(); }, cat);
      await p.click(`#mn-types .mn-chip[data-val="${type}"]`);
      vu[cat] = await options(p, '#mn-cause');
    }
    eq(vu, { brebis: ['Mammite', 'Mise à jour inventaire'], agneaux: ['Faiblesse', 'Froid'], agnelles: ['Faiblesse', 'Froid'], beliers: ['Mammite', 'Mise à jour inventaire'] }, 'mobile Nouveau mouvement : brebis et béliers = adultes, agnelles et agneaux = agneaux');
  }
  // mouvement individuel : brebis (puces adultes), agneau (puces agneaux), « + » dans la bonne liste
  await p.evaluate(() => { currentSheepId = 'b1'; editContext = null; render('add-mouvement', 'b1'); });
  await p.click('.type-opt[data-val="Morte"]');
  eq(await p.evaluate(() => [...document.querySelectorAll('#cause-list .chip')].map(c => c.textContent)), ['Mammite', 'Mise à jour inventaire'], nom + ' : fiche brebis, mouvement : causes adultes');
  await p.evaluate(() => { currentAgneauEid = '250000004561004'; editAgneauContext = null; render('add-mouvement-agneau'); });
  await p.click('.type-opt[data-val="Mort"]');
  const puces = await p.evaluate(() => [...document.querySelectorAll('#cause-list .chip')].map(c => c.textContent));
  check(puces.includes('Faiblesse') && !puces.includes('Mammite'), nom + ' : fiche agneau, mouvement : causes agneaux : ' + puces);
  await p.fill('#new-cause', 'Ictère'); await p.click('#add-cause');
  eq(await p.evaluate(() => [DB.causesMortaliteAgneaux.includes('Ictère'), DB.causesMortalite.includes('Ictère')]), [true, false], nom + ' : fiche agneau, « + » range la cause dans la liste agneaux');
  console.log('OK 2 ' + nom + ' : chaque écran propose la liste de sa catégorie ; « Ajouter… » / « + » dans la bonne liste.');

  // ================================================================ 3. « Déclarer mort » un agneau : cause facultative (liste agneaux)
  await p.evaluate(() => { const l = DB.brebis[0].agnelages[0].lambs[3]; showLambSortieModal(l, 'mort', () => {}); });
  const opts = await options(p, '.lambsortie-cause');
  check(opts.includes('Faiblesse') && !opts.includes('Mammite'), nom + ' : Déclarer mort : menu des causes agneaux : ' + opts);
  await p.selectOption('.lambsortie-cause', 'Froid'); await p.click('#lambsortie-confirm');
  eq(await p.evaluate(() => { const l = DB.brebis[0].agnelages[0].lambs[3]; return [l.statutFinal, l.mouvements.slice(-1)[0].type, l.mouvements.slice(-1)[0].cause]; }), ['mort', 'Mort', 'Froid'], nom + ' : Déclarer mort avec cause : cause enregistrée');
  await p.evaluate(() => { const l = DB.brebis[0].agnelages[0].lambs[3]; l.mouvements.pop(); l.statutFinal = undefined; showLambSortieModal(l, 'mort', () => {}); });
  await p.click('#lambsortie-confirm');
  eq(await p.evaluate(() => DB.brebis[0].agnelages[0].lambs[3].mouvements.slice(-1)[0].cause), 'Mort', nom + ' : Déclarer mort sans cause : enregistré comme avant (« Non renseignée » à l\'accueil)');
  console.log('OK 3 ' + nom + ' : Déclarer mort un agneau, cause facultative de la liste agneaux.');

  // ================================================================ 4. Paramètres › Listes : compteurs et renommage séparés
  await p.evaluate(() => { DB.causesMortalite = ['Faiblesse', 'Mammite']; DB.causesMortaliteAgneaux = ['Faiblesse', 'Froid']; DB.brebis[0].mouvements[1].cause = 'Faiblesse'; });
  eq(await p.evaluate(() => [compterUsageCauseMortalite('Faiblesse'), compterUsageCauseMortaliteAgneaux('Faiblesse')]), [1, 1], nom + ' : « Faiblesse » comptée 1 fois par liste (brebis / agneau)');
  eq(await p.evaluate(() => renommerValeurListe('causesMortaliteAgneaux', 'Faiblesse', 'Agneau faible')), { ok: true, modifies: 1, fusion: false }, nom + ' : renommer dans la liste agneaux');
  eq(await p.evaluate(() => [DB.brebis[0].mouvements[1].cause, DB.brebis[0].agnelages[0].lambs[0].mouvements[1].cause, DB.causesMortalite.includes('Faiblesse')]), ['Faiblesse', 'Agneau faible', true], nom + ' : seul l\'agneau est renommé, la brebis et la liste adultes gardent « Faiblesse »');
  console.log('OK 4 ' + nom + ' : compteurs et renommage séparés par liste.');
}
await browser.close();
console.log('TOUT OK test_causes_mortalite_listes');
