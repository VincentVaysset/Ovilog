/* Lots échographies, partie 5 : raccourci « Créer les lots Vides / Simples / Doubles » (onglet PC Échographies). Récapitulatif avant création (noms par défaut avec la date du jour,
   modifiables ; effectifs ; case « Inclure les vides définitives » cochée par défaut avec « dont N vides définitives » ; gestantes sans comptage, cas particuliers et sans écho laissés
   à part), aucun lot sans brebis, aucun écrasement d'un lot de même nom (avertissement, lot écarté), Annuler ne crée rien, création de lots de recherche journalisés avec des ids
   distincts, saisie réelle des noms au clavier. saveData REMPLACÉ ; jeu synthétique ; export réel en LECTURE SEULE (récapitulatif seulement, rien n'est créé). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, EXPORT_ORIGINAL, exportPresent, lireExport } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 1700, height: 2000 }, locale: 'en-US' })).newPage();
await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const $t = sel => page.evaluate(s => document.querySelector(s) ? document.querySelector(s).textContent.replace(/\s+/g, ' ').trim() : null, sel);

const jeu = () => page.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  window.E = (d, n) => '2500162991' + d + String(n).padStart(4, '0');
  const e = (date, extra) => Object.assign({ type: 'stade', date, stade: null, agneaux: null, nombreAgneaux: null, special: null, parasitisme: false, campagne: 2026 }, extra);
  const b = (d, n, echos, extra) => Object.assign({ id: 'b' + d + n, eid: E(d, n), statut: 'active', createdAt: 1, echographies: echos, agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] }, extra || {});
  DB.brebis = [
    b(8, 1, [e('2026-09-01', { type: 'constat', stade: 'Vide' })]),                                  // vide
    b(8, 2, [e('2026-09-01', { stade: 'Vide' })], { videesDefinitives: [{ campagne: 2026, date: '2026-09-20' }] }),   // vide ET vide définitive
    b(8, 3, [e('2026-09-01', { stade: 'Vide' })]),                                                    // vide
    b(9, 4, [e('2026-09-01', { stade: 'Milieu', agneaux: 'Simple' })]),                               // simple
    b(9, 5, [e('2026-09-01', { stade: 'Fin', nombreAgneaux: 1 })]),                                   // simple
    b(9, 6, [e('2026-09-01', { stade: 'Milieu', agneaux: 'Double' })]),                               // double
    b(0, 7, [e('2026-09-01', { stade: 'Début', nombreAgneaux: 4 })]),                                 // double
    b(0, 8, [e('2026-09-01', { type: 'constat', stade: 'Pleine' })]),                                 // gestante sans comptage
    b(0, 9, [e('2026-09-01', { special: 'Avortée' })]),                                               // cas particulier
    b(0, 10, []),                                                                                     // sans écho
    b(0, 11, [e('2026-09-01', { stade: 'Vide' })], { statut: 'vendue' })                              // non active
  ];
  DB.lots = [{ id: 'LX', nom: 'Doubles du 03-10-2026', dateCreation: '2026-10-01', membres: [E(9, 6)], journal: 1 }];
  DB.evenementsLots = [{ id: 'EL-init-LX', lotId: 'LX', type: 'initial', eids: [E(9, 6)], date: '2026-10-01T00:00:00.000Z', source: 'migration' }];
  materialiserMembresLot(DB.lots[0]);
  DB.lots.push({ id: 'LCUR', nom: 'Lot en cours', dateCreation: '2026-10-03', membres: [], journal: 1, membresEmpreinte: empreinteMembresLot([]), journalN: 0 });
  lotsPcEtat = lotsPcEtatInitial(); lotsPcEtat.lotId = 'LCUR'; lotsPcEtat.onglet = 'echos';
  window.__avant = JSON.stringify(DB.brebis);
  render('lots');
});

// ================================================================ 1. fonctions pures : plan, noms, collisions, vides définitives
await jeu();
const plan = await page.evaluate(() => {
  const act = DB.brebis.filter(s => s.statut === 'active');
  const noms = echoNomsRaccourci('2026-10-03');
  const p1 = echoPlanLotsRaccourci(act, 2026, { noms, inclureVidesDefinitives: true }, DB.lots).map(l => [l.cle, l.nom, l.eids.length, l.nbVidesDefinitives, l.creer, l.raison]);
  const p2 = echoPlanLotsRaccourci(act, 2026, { noms, inclureVidesDefinitives: false }, DB.lots).map(l => [l.cle, l.eids.length]);
  const p3 = echoPlanLotsRaccourci(act, 2027, { noms, inclureVidesDefinitives: true }, DB.lots).map(l => [l.cle, l.eids.length, l.creer, l.raison]);
  const p4 = echoPlanLotsRaccourci(act, 2026, { noms: { vides: ' vides  du 03-10-2026 ', simples: 'vides du 03-10-2026', doubles: '' }, inclureVidesDefinitives: true }, []).map(l => [l.creer, l.raison]);
  return { noms, p1, p2, p3, p4 };
});
eq(plan.noms, { vides: 'Vides du 03-10-2026', simples: 'Simples du 03-10-2026', doubles: 'Doubles du 03-10-2026' }, 'noms par défaut avec la date du jour');
eq(plan.p1[0].slice(0, 5), ['vides', 'Vides du 03-10-2026', 3, 1, true], 'Vides : 3 brebis dont 1 vide définitive');
eq(plan.p1[1].slice(0, 5), ['simples', 'Simples du 03-10-2026', 2, 0, true], 'Simples : 2');
check(plan.p1[2][2] === 2 && plan.p1[2][4] === false && /existe déjà/.test(plan.p1[2][5]), 'Doubles : le nom existe déjà → lot écarté, raison donnée : ' + JSON.stringify(plan.p1[2]));
eq(plan.p2, [['vides', 2], ['simples', 2], ['doubles', 2]], 'sans les vides définitives : Vides = 2');
check(plan.p3.every(l => l[1] === 0 && l[2] === false && /aucune brebis/.test(l[3])), 'campagne sans écho : aucun lot (0 brebis) : ' + JSON.stringify(plan.p3));
check(plan.p4[0][0] === true && plan.p4[1][0] === false && /même nom/.test(plan.p4[1][1]) && plan.p4[2][0] === false, 'noms comparés sans casse ni espaces superflus ; doublon entre les 3 lots et nom vide écartés : ' + JSON.stringify(plan.p4));
console.log('OK 1 plan : noms par défaut, effectifs, vides définitives (dont N), lot de même nom écarté sans écrasement, 0 brebis = aucun lot, doublons de noms.');

// ================================================================ 2. récapitulatif à l'écran, saisie réelle des noms
await page.click('#lt-echo-raccourci');
await page.waitForSelector('#rl-modal');
check(await page.evaluate(() => document.querySelectorAll('.lot-existant-test, tr').length >= 0) && await page.evaluate(() => DB.lots.length) === 2, 'ouvrir le récapitulatif ne crée rien');
eq([await $t('#rl-nb-vides'), await $t('#rl-nb-simples'), await $t('#rl-nb-doubles')], ['· 3 brebis', '· 2 brebis', '· 2 brebis'], 'effectifs affichés');
check(/dont 1 vide définitive/.test(await $t('#rl-modal')) && await page.evaluate(() => document.getElementById('rl-inclure').checked), 'case « Inclure les vides définitives » cochée par défaut, « dont 1 vide définitive »');
check(/gestantes sans comptage 1 · cas particuliers 1 · sans écho 1/.test(await $t('#rl-apart')), 'laissées à part : ' + await $t('#rl-apart'));
check(/Ce lot ne sera pas créé : un lot « Doubles du 03-10-2026 » existe déjà/.test(await $t('#rl-av-doubles')) && /Créer 2 lots \(3 \+ 2 brebis\)/.test(await $t('#rl-creer')), 'avertissement de nom pris, 2 lots seulement : ' + await $t('#rl-creer'));
await page.click('#rl-inclure');
check(/· 2 brebis \(sans les vides définitives\)/.test(await $t('#rl-nb-vides')) && /Créer 2 lots \(2 \+ 2 brebis\)/.test(await $t('#rl-creer')), 'décocher : Vides = 2');
await page.click('#rl-inclure');
// saisie réelle : remplacer le nom des Doubles caractère par caractère, puis passer au champ suivant
await page.click('#rl-nom-doubles', { clickCount: 3 }); await page.keyboard.type('Doubles à suivre', { delay: 30 });
check(await page.evaluate(() => document.activeElement.id + '|' + document.getElementById('rl-nom-doubles').value) === 'rl-nom-doubles|Doubles à suivre', 'nom tapé au clavier, focus conservé (le récapitulatif n\'est pas redessiné pendant la frappe)');
check(await $t('#rl-av-doubles') === '' && /Créer 3 lots \(3 \+ 2 \+ 2 brebis\)/.test(await $t('#rl-creer')), 'nom libre : 3 lots : ' + await $t('#rl-creer'));
await page.click('#rl-nom-simples', { clickCount: 3 }); await page.keyboard.type('Vides du 03-10-2026', { delay: 20 });
check(/même nom qu'un autre des 3 lots/.test(await $t('#rl-av-simples')) && /Créer 2 lots/.test(await $t('#rl-creer')), 'même nom que Vides : écarté : ' + await $t('#rl-av-simples'));
await page.click('#rl-nom-simples', { clickCount: 3 }); await page.keyboard.type('Simples du jour', { delay: 20 });
console.log('OK 2 récapitulatif : effectifs, vides définitives (cochée par défaut, décochable), brebis laissées à part, avertissement de nom pris, saisie réelle des noms.');

// ================================================================ 3. Annuler ne crée rien ; Créer crée 3 lots journalisés distincts
await page.click('#rl-annuler');
check(await page.evaluate(() => DB.lots.length === 2 && !document.getElementById('rl-modal')), 'Annuler : rien n\'est créé');
await page.click('#lt-echo-raccourci'); await page.waitForSelector('#rl-modal');
await page.click('#rl-nom-vides', { clickCount: 3 }); await page.keyboard.type('Vides test', { delay: 15 });
await page.click('#rl-nom-simples', { clickCount: 3 }); await page.keyboard.type('Simples test', { delay: 15 });
await page.click('#rl-nom-doubles', { clickCount: 3 }); await page.keyboard.type('Doubles test', { delay: 15 });
await page.click('#rl-creer'); await page.waitForTimeout(500);
const lots = await page.evaluate(() => DB.lots.slice(2).map(l => ({ nom: l.nom, type: l.type || null, date: l.dateCreation, j: l.journal, n: l.membres.length, ev: DB.evenementsLots.filter(e => e.lotId === l.id).length, id: l.id })));
eq(lots.map(l => [l.nom, l.type, l.date, l.j, l.n, l.ev]), [['Vides test', null, '2026-10-03', 1, 3, 1], ['Simples test', null, '2026-10-03', 1, 2, 1], ['Doubles test', null, '2026-10-03', 1, 2, 1]], '3 lots de recherche créés, journalisés (1 événement chacun)');
check(new Set(lots.map(l => l.id)).size === 3 && await page.evaluate(() => DB.evenementsLots.filter(e => e.type === 'affectation').every(e => DB.lots.some(l => l.id === e.lotId))), 'ids distincts même créés dans la même milliseconde (horloge figée) : ' + lots.map(l => l.id).join(','));
const existant = await page.evaluate(() => { const l = DB.lots.find(x => x.id === 'LX'); return [l.nom, l.membres.length]; });
eq(existant, ['Doubles du 03-10-2026', 1], 'le lot existant de même nom par défaut n\'est pas touché');
check(/3 lots créés : « Vides test » \(3\), « Simples test » \(2\), « Doubles test » \(2\)/.test(await $t('#lt-msg-raccourci')), 'message : ' + await $t('#lt-msg-raccourci'));
check(await page.evaluate(() => { const r = document.querySelector('tr[data-eid="' + E(8, 1) + '"]'); return r.textContent.includes('Vides test'); }), 'les lots créés apparaissent aussitôt dans la colonne Lots');
console.log('OK 3 Annuler ne crée rien ; Créer : 3 lots de recherche journalisés, ids distincts, message, lot existant intact.');

// ================================================================ 4. campagne sans écho : aucun lot ; brebis jamais modifiées
await page.evaluate(() => { lotsPcEtat.F.echo.campagne = 2027; render('lots'); });
await page.click('#lt-echo-raccourci'); await page.waitForSelector('#rl-modal');
check(await page.evaluate(() => document.getElementById('rl-creer').disabled) && /Aucun lot à créer/.test(await $t('#rl-creer')) && /campagne 2028 · à venir/.test(await $t('#rl-modal')), 'campagne sans écho : « Aucun lot à créer », bouton inactif');
await page.click('#rl-annuler');
check(await page.evaluate(() => JSON.stringify(DB.brebis) === window.__avant), 'les brebis ne sont jamais modifiées');
console.log('OK 4 campagne sans écho : aucun lot, bouton inactif ; brebis intactes.');

// ================================================================ 5. données réelles : récapitulatif seul, rien n'est créé
if (exportPresent(EXPORT_ORIGINAL)) {
  const j = JSON.stringify(lireExport(EXPORT_ORIGINAL));
  const out = await page.evaluate(async (json) => {
    DB = migrateData(JSON.parse(json)); window.__saves = 0; saveData = function () { window.__saves++; };
    const avant = JSON.stringify(DB.brebis), nl = DB.lots.length;
    DB.lots.push({ id: 'LTEST', nom: 'Test lecture', dateCreation: '2026-10-03', membres: [], journal: 1, membresEmpreinte: empreinteMembresLot([]), journalN: 0 });
    lotsPcEtat = lotsPcEtatInitial(); lotsPcEtat.lotId = 'LTEST'; lotsPcEtat.onglet = 'echos'; lotsPcEtat.F.echo.campagne = DB.campagneDebut + 1;
    render('lots');
    document.getElementById('lt-echo-raccourci').click();
    const t = id => document.getElementById(id).textContent;
    const r = { vides: t('rl-nb-vides'), simples: t('rl-nb-simples'), doubles: t('rl-nb-doubles'), vd: document.querySelector('#rl-modal label[style*="gap:8px"]').textContent.replace(/\s+/g, ' '), creer: t('rl-creer'), apart: t('rl-apart') };
    document.getElementById('rl-annuler').click();
    const act = DB.brebis.filter(s => (s.statut || 'active') === 'active');
    r.resume = echoResumeCampagne(act, DB.campagneDebut + 1);
    r.intact = JSON.stringify(DB.brebis) === avant && window.__saves === 0 && DB.lots.length === nl + 1;
    return r;
  }, j);
  check(out.intact && out.vides === '· ' + out.resume.vides + ' brebis' && out.simples === '· ' + out.resume.simples + ' brebis' && out.doubles === '· ' + out.resume.doubles + ' brebis', 'données réelles : récapitulatif = répartition commune, rien de créé : ' + JSON.stringify(out));
  console.log('OK 5 données réelles (lecture seule) : ' + out.vides + ' vides · ' + out.simples + ' simples · ' + out.doubles + ' doubles ; ' + out.vd + ' ; ' + out.apart);
}
await browser.close();
console.log('\nTOUS LES TESTS DU RACCOURCI « LOTS VIDES / SIMPLES / DOUBLES » SONT PASSÉS');
