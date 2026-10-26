/* Cause (facultative) d'un agneau mort-né, saisie à la mise bas : même liste que les morts (DB.causesMortalite, « Ajouter… » sans quitter l'écran),
   sur les trois saisies (saisie rapide mobile, saisie PC, fiche brebis, création et modification). Rien n'est bloqué sans cause ; un mort-né sans
   cause n'a pas de champ `cause`. Accueil PC « Mortalité agneaux » : chaque perte comptée une fois (mort-né avec cause sous sa cause, sans cause dans
   « Mort-nés »). Paramètres › Listes : renommer une cause met à jour les mort-nés, le compteur d'utilisation les compte. Les anciens mort-nés ne
   changent pas. saveData REMPLACÉ ; jeu synthétique (EID d'exemple, indicatif 000456). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
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
    DB = migrateData({}); saveData = () => true;
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    window.E = n => '250000004569' + String(n).padStart(3, '0');
    const fiche = (n, extra) => Object.assign({ id: 'b' + n, eid: E(n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] }, extra || {});
    DB.brebis = [1, 2, 3, 4, 5].map(n => fiche(n)); DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
    // ancien mort-né (sans cause) d'une campagne passée : ne doit jamais changer
    DB.brebis[4].agnelages = [{ date: '2025-03-01', campagne: 2025, codeRepro: 'MN', lambs: [{ sexe: 'Mort-né', adopte: false, sexeMortNe: 'Mâle' }] }];
    DB.causesMortaliteAgneaux = ['Faiblesse', 'Écrasé <b>']; DB.causesMortalite = ['Maladie adulte'];
    window.__ancien = JSON.stringify(DB.brebis[4].agnelages);
  });
  return page;
}
const lambs = (p, n) => p.evaluate(n => JSON.parse(JSON.stringify((DB.brebis.find(b => b.id === 'b' + n).agnelages.slice(-1)[0] || { lambs: [] }).lambs)).map(l => { delete l.mouvements; delete l.sanitaire; return l; }), n);
const options = (p, sel) => p.evaluate(sel => [...document.querySelector(sel).options].map(o => o.textContent), sel);

async function saisieRapide(p, n) {
  await p.evaluate(() => { resetMisebasRapideSession(); render('misebas-rapide'); });
  await p.fill('#scan-misebas', String(await p.evaluate(n => E(n).slice(-5), n))); await p.press('#scan-misebas', 'Enter');
  await p.waitForSelector('#f-date-rapide');
  await p.evaluate(() => { const q = document.querySelector('#repro-question-rapide .repro-question-btn[data-code="MN"]'); if (q) q.click(); else { const b = document.querySelector('.repro-code-opt-rapide[data-val="MN"]'); if (b) b.click(); } });
}

for (const bureau of [false, true]) {
  const nom = bureau ? 'PC' : 'mobile';
  const p = await ouvrir(bureau);
  // ================================================================ 1. saisie rapide : menu de cause seulement sur un mort-né
  await saisieRapide(p, 1);
  eq(await p.evaluate(() => !!document.querySelector('.cause-mortne-rapide')), false, nom + ' : pas de menu de cause sur un agneau vivant');
  await p.check('.mortne-check-rapide[data-id="0"]');
  eq(await options(p, '.cause-mortne-rapide[data-id="0"]'), ['—', 'Faiblesse', 'Écrasé <b>', 'Ajouter…'], nom + ' : menu de cause (liste des causes AGNEAUX seulement, texte échappé, « Ajouter… »)');
  if (bureau) check(/Adoption \/ cause/.test(await p.evaluate(() => document.querySelector('#app thead').textContent)), 'PC : en-tête « Adoption / cause »');
  else check(/Cause \(facultative\)/.test(await p.evaluate(() => document.querySelector('.mb-ag').textContent)), 'mobile : libellé « Cause (facultative) »');
  // « Ajouter… » : nouvelle cause créée et choisie sans quitter l'écran
  await p.selectOption('.cause-mortne-rapide[data-id="0"]', '__ajouter__');
  await p.fill('#liste-ajout-input', 'Froid'); await p.click('#liste-ajout-ok');
  eq([await p.evaluate(() => document.querySelector('.cause-mortne-rapide[data-id="0"]').value), await p.evaluate(() => DB.causesMortaliteAgneaux.includes('Froid') && !DB.causesMortalite.includes('Froid')), await p.evaluate(() => !!document.querySelector('[data-brebis-trouvee]'))], ['Froid', true, true], nom + ' : « Ajouter… » crée la cause, la choisit, la saisie continue');
  // décocher puis recocher « Mort-né » : la cause est oubliée
  await p.uncheck('.mortne-check-rapide[data-id="0"]'); await p.check('.mortne-check-rapide[data-id="0"]');
  eq(await p.evaluate(() => document.querySelector('.cause-mortne-rapide[data-id="0"]').value), '', nom + ' : un agneau qui n\'est plus mort-né perd sa cause');
  await p.selectOption('.cause-mortne-rapide[data-id="0"]', 'Faiblesse');
  // second agneau : mort-né sans cause ; troisième : vivant
  await p.click('#add-lamb-rapide'); await p.check('.mortne-check-rapide[data-id="1"]');
  await p.click('#add-lamb-rapide'); await p.click('.sexe-opt-rapide[data-id="2"][data-val="Mâle"]'); await p.fill('.eid-input-rapide[data-id="2"]', '250000004561' + (bureau ? '002' : '001'));
  await p.click('#btn-valider-misebas'); await p.waitForSelector('#mb-confirmation');
  eq((await lambs(p, 1)).map(l => [l.sexe, l.cause === undefined ? 'sans champ' : l.cause]), [['Mort-né', 'Faiblesse'], ['Mort-né', 'sans champ'], ['Mâle', 'sans champ']], nom + ' : cause enregistrée sur le mort-né seulement, facultative (aucun blocage sans cause)');
  console.log('OK 1 ' + nom + ' saisie rapide : menu de cause sur le mort-né, « Ajouter… », cause enregistrée, facultative.');

  // ================================================================ 2. fiche brebis : création puis modification
  await p.evaluate(() => { currentSheepId = 'b2'; editContext = null; render('add-agnelage', 'b2'); });
  await p.evaluate(() => { const b = document.querySelector('.repro-code-opt[data-val="MN"]'); b.click(); const q = document.querySelector('#repro-question .repro-question-btn[data-code="MN"]'); if (q) q.click(); });
  eq(await p.evaluate(() => document.querySelector('.cause-mortne-block[data-id="1"]').classList.contains('hidden')), true, nom + ' : fiche, menu de cause caché tant que « Mort-né » n\'est pas choisi');
  await p.click('.sexe-opt[data-id="1"][data-val="Mort-né"]');
  eq(await p.evaluate(() => document.querySelector('.cause-mortne-block[data-id="1"]').classList.contains('hidden')), false, nom + ' : fiche, menu de cause affiché pour un mort-né');
  await p.selectOption('.cause-mortne[data-id="1"]', 'Écrasé <b>');
  await p.click('#btn-save-agnelage');
  eq((await lambs(p, 2)).map(l => [l.sexe, l.cause]), [['Mort-né', 'Écrasé <b>']], nom + ' : fiche, cause enregistrée (texte brut, jamais converti)');
  // modification : cause reprise, puis retirée
  await p.evaluate(() => { currentSheepId = 'b2'; editContext = { kind: 'agnelages', idx: 0 }; render('add-agnelage', 'b2'); });
  eq(await p.evaluate(() => document.querySelector('.cause-mortne[data-id="1"]').value), 'Écrasé <b>', nom + ' : fiche, la cause enregistrée est reprise en modification');
  await p.selectOption('.cause-mortne[data-id="1"]', '');
  await p.click('#btn-save-agnelage');
  eq((await lambs(p, 2)).map(l => [l.sexe, 'cause' in l]), [['Mort-né', false]], nom + ' : fiche, cause retirée = plus de champ');
  console.log('OK 2 ' + nom + ' fiche brebis : menu sur le mort-né seulement, cause enregistrée, reprise et retirée en modification.');

  // ================================================================ 3. accueil PC, listes, ancien mort-né
  if (bureau) {
    await p.evaluate(() => {
      // b3 : agneau mort après la naissance, même cause qu'un mort-né
      DB.brebis[2].agnelages = [{ date: '2026-11-02', campagne: 2026, codeRepro: 'MN', lambs: [{ sexe: 'Femelle', adopte: false, eid: '250000004561003', statutFinal: 'mort', mouvements: [{ type: 'Entrée', date: '2026-11-02' }, { type: 'Mort', date: '2026-11-05', cause: 'Faiblesse' }] }] }];
    });
    // mort-nés de la campagne : b1 (Faiblesse + sans cause, saisis sur PC), b2 (sans cause) ; mort après naissance : b3 (Faiblesse)
    const m = await p.evaluate(() => accueilPcData().mortalite.agneaux);
    eq([m.pertes, m.mortNes, m.causes], [4, 3, [['Mort-nés', 2], ['Faiblesse', 2]]], 'accueil PC : chaque perte une fois, mort-né avec cause sous sa cause, sans cause dans « Mort-nés »');
    await p.evaluate(() => render('home'));
    check(/Faiblesse\s*2/.test(await p.evaluate(() => document.getElementById('bloc-mortalite-agneaux').innerText)), 'accueil PC : carte Mortalité agneaux, « Faiblesse 2 »');
    eq(await p.evaluate(() => [compterUsageCauseMortaliteAgneaux('Faiblesse'), compterPorteursListe('causesMortaliteAgneaux', 'Faiblesse', false), compterUsageCauseMortalite('Faiblesse')]), [2, 2, 0], 'listes : le compteur de la liste agneaux compte le mort-né (et la liste adultes ne le compte pas)');
    eq(await p.evaluate(() => renommerValeurListe('causesMortaliteAgneaux', 'Faiblesse', 'Agneau faible')), { ok: true, modifies: 2, fusion: false }, 'listes : renommer met à jour le mort-né et le mouvement');
    eq((await lambs(p, 1))[0].cause, 'Agneau faible', 'listes : cause du mort-né renommée');
  }
  eq(await p.evaluate(() => JSON.stringify(DB.brebis[4].agnelages) === window.__ancien), true, nom + ' : ancien mort-né sans cause inchangé');
  if (bureau) console.log('OK 3 accueil PC (une perte = une ligne), compteur et renommage des causes, ancien mort-né inchangé.');
}
await browser.close();
console.log('TOUT OK test_cause_mort_ne');
