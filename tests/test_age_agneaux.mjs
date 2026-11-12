/* Âge des agneaux (boucle de la campagne 2027 en 7, comme une brebis de 2017 : le n° seul ne les distingue pas) : d'après la date de la
   mise bas, en jours avant 2 mois puis en mois (texteAgeAgneau, texteAgeListe), Carnet sanitaire (mobile et PC)
   et Mouvements. Bips : un seul contexte audio réutilisé (playBeep). saveData REMPLACÉ ; jeu synthétique (indicatif 000456). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const prep = () => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
  DB.produits = { vaccins: [], antibiotiques: ['Produit A'], antiparasitaires: [], antiinflammatoires: [], autres: [] };
  DB.produitsInfo = { 'Produit A': { delaiLait: 7, delaiViande: 28 } };
  const E = n => '2500000456' + n;
  const fiche = (n, id) => ({ id, eid: E(n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] });
  DB.brebis = [fiche('20101', 'b1'), fiche('60102', 'b2')];
  DB.brebis[0].agnelages = [{ date: '2026-11-08', campagne: 2026, codeRepro: 'MN', lambs: [{ sexe: 'Mâle', eid: E('71001') }, { sexe: 'Femelle' }] }];
  DB.brebis[1].agnelages = [{ date: '2026-09-01', campagne: 2026, codeRepro: 'MN', lambs: [{ sexe: 'Mâle', eid: E('71002') }] }];
  DB.beliers = []; DB.agnelles = [{ id: 'a1', eid: E('71003'), statut: 'active', sanitaire: [], mouvements: [], notes: [] }];
  DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
};

for (const mobile of [true, false]) {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1400, height: 900 } });
  if (!mobile) await ctx.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test', refocus: () => {} }; });
  const p = await ctx.newPage();
  const T = mobile ? 'mobile' : 'PC';
  await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  p.on('dialog', d => d.accept());
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(prep);

  // 1. règle du n° inchangée (une brebis de 2017 a une boucle en 7 comme un agneau de la campagne 2027 : seul l'agneau, par sa mise bas, est daté)
  const E = n => '2500000456' + n;
  eq(await p.evaluate(es => es.map(e => [anneeNaissance(e), age(e)]), [E('71001'), E('61001'), E('01001')]), [[2017, 9], [2026, 0], [2020, 6]], T + ' : règle du n° inchangée');
  // 2. âge des agneaux : jours avant 2 mois, puis mois
  eq(await p.evaluate(() => [texteAgeAgneau('2026-11-08'), texteAgeAgneau('2026-09-22'), texteAgeAgneau('2026-09-21'), texteAgeAgneau('2026-09-01'), texteAgeAgneau('2025-11-20'), texteAgeAgneau('2026-12-01'), texteAgeAgneau('')]),
    ['12 j', '59 j', '2 mois', '2 mois', '12 mois', null, null], T + ' : jours avant 2 mois, puis mois');
  // 3. Carnet sanitaire : agneaux en jours / mois, agnelle de l'année à 0 an, jamais 9 ans
  const lib = await p.evaluate(() => Object.fromEntries(animauxEligiblesCarnet().map(a => [a.court || a.numero, texteAgeListe(a)])));
  eq([lib['71001'], lib['71002']], ['12 j', '2 mois'], T + ' : Carnet : âge des agneaux d\'après leur mise bas (jamais « 9 ans »)');
  check(Object.entries(lib).some(([k, v]) => /sans n°/.test(k) && v === '12 j'), T + ' : agneau sans n° : âge d\'après sa mise bas : ' + JSON.stringify(lib));
  await p.evaluate(() => { carnetSanitaireEtat = null; carnetOnglet = 'nouveau'; render('sanitaire'); });
  await p.selectOption('#cs-produit', 'Produit A'); await p.fill('#cs-dose', '2'); await p.selectOption('#cs-voie', { index: 1 });
  await p.click('#cs-suivant'); await p.waitForSelector(mobile ? '#cs-cards' : '#cs-table');
  const texte = await p.evaluate(m => document.querySelector(m ? '#cs-cards' : '#cs-table').textContent, mobile);
  check(/n°71001 Agneau · 12 j/.test(texte.replace(/\s+/g, ' ')) && /n°71002 Agneau · 2 mois/.test(texte.replace(/\s+/g, ' ')) || /71001.*12 j/.test(texte) && /71002.*2 mois/.test(texte), T + ' : écran du Carnet : ' + texte.replace(/\s+/g, ' ').slice(0, 300));
  // 4. Mouvements : agneaux en jours / mois
  eq(await p.evaluate(() => animauxMouvementPc('agneaux').map(texteAgeListe)), ['12 j', '2 mois'], T + ' : Mouvements : âge des agneaux');
  await ctx.close();
}
await browser.close();
console.log('OK test_age_agneaux');
