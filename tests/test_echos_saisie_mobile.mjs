/* Échographies rapides (MOBILE) : écran de session (Constat / Stades, comptage Aucun / Simple-double / 1-2-3 et +, lot, date, interrupteur « Dernière écho de la campagne », campagne, « Démarrer la session ») puis
   écran de saisie (tuiles Pleines / Vides / Réussite, carte brebis avec « Précédente : … », Résultat, Comptage, Cas particulier en puces dont Parasitisme et « + Autre », barre « Passer | Enregistrer et suivante »).
   Enchaînement : « Enregistrer et suivante » enregistre, vide le champ de scan et passe à la brebis suivante ; « Passer » n'enregistre rien. Le lot FILTRE les brebis : une brebis scannée hors du lot est signalée (alerte), jamais
   refusée. Dernière écho : une brebis Vide devient vide définitive. Jeu synthétique, aucune donnée réelle. La saisie d'écho n'existe pas sur PC (voir test_echographies_pc). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
const dialogues = []; page.on('dialog', d => { dialogues.push(d.type() + ':' + d.message()); d.accept(); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

await page.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; return true; };
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  window.E = eid;
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.brebis = [fiche(eid(3, 101)), fiche(eid(3, 102)), fiche(eid(3, 103)), fiche(eid(3, 104)),
    fiche(eid(3, 105), { echographies: [{ type: 'stade', date: '2026-09-27', stade: 'Vide', agneaux: null, nombreAgneaux: null, special: null, parasitisme: false, campagne: 2026 }] }),
    fiche(eid(3, 106), { echographies: [{ type: 'stade', date: '2026-09-20', stade: 'Milieu', agneaux: null, nombreAgneaux: 2, special: null, parasitisme: false, campagne: 2026 }] })];
  DB.beliers = []; DB.agnelles = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  DB.lots = [{ id: 'lia', nom: 'Lot IA test', type: 'reproduction', mode: 'IA', cible: 'Brebis', membres: [eid(3, 101), eid(3, 102)], dateEvenement: '2026-10-01', dateCreation: '2026-10-01' }];
  resetEchoRapideSession(); render('echo-rapide');
});
const saisir = async (val) => { await page.fill('#scan-echo', val); await page.press('#scan-echo', 'Enter'); };
const echos = (n) => page.evaluate((n) => JSON.parse(JSON.stringify(DB.brebis.find(b => b.eid === E(3, n)).echographies)), n);

// ================================================================ 1. écran de session
const sess = await page.evaluate(() => ({ type: [...document.querySelectorAll('#echo-type .tab-btn')].map(b => b.dataset.val + (b.classList.contains('active') ? '*' : '')), comptage: [...document.querySelectorAll('#echo-comptage .tab-btn')].map(b => b.dataset.val + (b.classList.contains('active') ? '*' : '')),
  lots: [...document.querySelectorAll('#f-echo-lot option')].map(o => o.value + '|' + o.textContent), date: document.getElementById('f-echo-date').value, interrupteur: document.getElementById('f-dernier-echo').type + ':' + document.getElementById('f-dernier-echo').checked,
  combo: !!document.getElementById('f-echo-session-combo'), demarrer: document.getElementById('btn-start-echo-session').textContent, campagne: [...document.querySelectorAll('.campagne-echo-opt')].map(b => b.dataset.val + (b.classList.contains('active') ? '*' : '')) }));
eq(sess.type, ['constat', 'stade*'], 'type d\'écho : Constat / Stades'); eq(sess.comptage, ['aucun', 'simple_double', 'exact*'], 'comptage : Aucun / Simple-double / 1, 2, 3 et +');
eq(sess.lots, ['tous|Toutes les brebis', 'MN|Monte naturelle', 'lia|Lot IA test'], 'lots proposés'); eq(sess.date, '2026-10-02', 'date du jour par défaut');
eq(sess.interrupteur, 'checkbox:false', 'interrupteur « Dernière écho » éteint'); check(!sess.combo, 'la liste déroulante des 6 combinaisons a disparu'); eq(sess.demarrer, 'Démarrer la session', 'bouton');
eq(sess.campagne, ['2026*', '2027'], 'campagne : ligne discrète, en cours par défaut');
await page.click('#echo-type [data-val="constat"]'); await page.click('#echo-comptage [data-val="simple_double"]');
eq(await page.evaluate(() => [echoRapideSession.resultMethod, echoRapideSession.comptageMode]), ['constat', 'simple_double'], 'choix mémorisés'); // puis retour aux Stades + nombre exact
await page.click('#echo-type [data-val="stade"]'); await page.click('#echo-comptage [data-val="exact"]');
await page.selectOption('#f-echo-lot', 'lia'); await page.fill('#f-echo-date', '2026-10-01'); await page.dispatchEvent('#f-echo-date', 'change');
await page.check('#f-dernier-echo');
await page.click('#btn-start-echo-session');
await page.waitForSelector('#scan-echo');
eq(await page.evaluate(() => [echoRapideSession.demarree, echoRapideSession.lot, echoRapideSession.date, echoRapideSession.dernierEcho]), [true, 'lia', '2026-10-01', true], 'session démarrée avec lot, date et dernière écho');

// ================================================================ 2. saisie : tuiles, carte brebis, « Précédente »
const t0 = await page.evaluate(() => [...document.querySelectorAll('#echo-tuiles .tuile-charte')].map(t => [t.querySelector('.l').textContent, t.querySelector('.n').textContent, t.className.replace('tuile-charte ', '')]));
eq(t0, [['Pleines', '0', 'vert'], ['Vides', '0', 'ambre'], ['Réussite', '—', 'bleu']], 'tuiles Pleines / Vides / Réussite');
await saisir(E_(105));
function E_(n) { return '250016299' + '9' + 3 + String(n).padStart(5, '0'); }
await page.waitForSelector('#carte-echo-brebis');
const c1 = await page.evaluate(() => ({ prec: document.getElementById('echo-precedente').textContent, texte: document.getElementById('carte-echo-brebis').textContent.replace(/\s+/g, ' '), alerteLot: !!document.getElementById('alerte-lot-echo'),
  barre: [...document.querySelectorAll('.mn-barre .btn')].map(b => b.textContent), stades: [...document.querySelectorAll('.stade-opt')].map(b => b.dataset.val), compt: !document.getElementById('nombre-agneaux-block').classList.contains('hidden') }));
check(/Précédente : Vide/.test(c1.prec) && /écho du 27-09-2026/.test(c1.texte), 'carte brebis : « Précédente : Vide » et date de l\'écho : ' + JSON.stringify(c1));
check(c1.alerteLot && /n'est pas dans le lot « Lot IA test »/.test(await page.evaluate(() => document.getElementById('alerte-lot-echo').textContent)), 'brebis hors du lot : alerte (jamais refusée)');
eq(c1.barre.slice(0, 2), ['Passer', 'Enregistrer et suivante'], 'barre fixe'); eq(c1.stades, ['Début', 'Milieu', 'Fin', 'Vide'], 'stades de la monte naturelle + Vide (vocabulaire déduit de la brebis, jamais choisi)'); check(!c1.compt, 'comptage masqué tant qu\'aucun résultat');
// aucun résultat : message, rien enregistré
await page.click('#btn-valider-echo');
check(/Choisis un résultat/.test(await page.evaluate(() => document.getElementById('err').textContent)) && (await echos(105)).length === 1, 'sans résultat : message, rien enregistré');
// « Vide » : pas de comptage ; dernière écho -> vide définitive
await page.click('.stade-opt[data-val="Vide"]');
check(await page.evaluate(() => document.getElementById('nombre-agneaux-block').classList.contains('hidden')), 'Vide : pas de comptage');
await page.click('#btn-valider-echo');
await page.waitForFunction(() => document.querySelector('#echo-n-vides').textContent === '1');
let e105 = await echos(105);
eq([e105.length, e105[1].stade, e105[1].date, e105[1].campagne, e105[1].type], [2, 'Vide', '2026-10-01', 2026, 'stade'], 'écho enregistrée à la date de la session');
check(await page.evaluate(() => estVideDefinitiveCampagne(DB.brebis.find(b => b.eid === E(3, 105)))), 'dernière écho : la brebis Vide devient vide définitive');
const apres = await page.evaluate(() => ({ scan: document.getElementById('scan-echo').value, carte: !!document.getElementById('carte-echo-brebis'), t: [...document.querySelectorAll('#echo-tuiles .n')].map(n => n.textContent), actif: document.activeElement && document.activeElement.id }));
eq(apres, { scan: '', carte: false, t: ['0', '1', '0,0 %'], actif: 'scan-echo' }, 'enchaînement : champ de scan vidé et actif, tuiles Pleines 0 / Vides 1 / Réussite 0,0 %');

// ================================================================ 3. brebis du lot : comptage, puces, Passer
await saisir(E_(101));
await page.waitForSelector('#carte-echo-brebis');
check(await page.evaluate(() => !document.getElementById('alerte-lot-echo') && !document.getElementById('echo-precedente')), 'brebis du lot, sans écho précédente : ni alerte ni « Précédente »');
await page.click('.stade-opt[data-val="Début"]');
check(await page.evaluate(() => !document.getElementById('nombre-agneaux-block').classList.contains('hidden')), 'résultat non vide : comptage visible');
await page.click('#btn-valider-echo');
check(/nombre d'agneaux/.test(await page.evaluate(() => document.getElementById('err').textContent)) && (await echos(101)).length === 0, 'comptage exigé (nombre exact) : message, rien enregistré');
await page.click('#nombre-agneaux-group [data-val="4"]');
// puces : Parasitisme indépendant ; un cas particulier remplace le stade ; + Autre enrichit la liste
const puces = await page.evaluate(() => [...document.querySelectorAll('#special-list .chip')].map(c => c.textContent));
eq(puces, ['Parasitisme', 'Pseudogestation', 'Avortée', '+ Autre'], 'cas particuliers : Parasitisme, liste modulable, + Autre');
await page.click('#chip-parasit');
check(await page.evaluate(() => document.getElementById('chip-parasit').classList.contains('selected') && document.querySelector('.stade-opt.active').dataset.val === 'Début'), 'Parasitisme s\'ajoute au résultat sans le retirer');
await page.click('#chip-autre-cas'); await page.fill('#nouveau-cas', 'Mammite'); await page.press('#nouveau-cas', 'Enter');
check(await page.evaluate(() => DB.casParticuliers.includes('Mammite') && document.querySelector('#special-list .chip.selected:not(#chip-parasit)').textContent === 'Mammite' && !document.querySelector('.stade-opt.active')), '+ Autre : cas ajouté à la liste, sélectionné, remplace le stade');
await page.click('.stade-opt[data-val="Milieu"]');
check(await page.evaluate(() => !document.querySelector('#special-list .chip.selected:not(#chip-parasit)') && document.querySelector('.stade-opt.active').dataset.val === 'Milieu'), 'choisir un stade retire le cas particulier');
// Passer : rien n'est enregistré
const avantPasser = await page.evaluate(() => window.__saves);
await page.click('#btn-passer-echo');
check(await page.evaluate((a) => !document.getElementById('carte-echo-brebis') && window.__saves === a && echoRapideSession.count === 1, avantPasser) && (await echos(101)).length === 0, 'Passer : brebis suivante sans rien enregistrer');
// enregistrement complet : IA + 2 agneaux + parasitisme
await saisir(E_(101));
await page.waitForSelector('#carte-echo-brebis');
await page.click('.stade-opt[data-val="Milieu"]'); await page.click('#nombre-agneaux-group [data-val="2"]'); await page.click('#chip-parasit');
await page.click('#btn-valider-echo');
await page.waitForFunction(() => document.querySelector('#echo-n-pleines').textContent === '1');
const e101 = (await echos(101))[0];
eq([e101.stade, e101.nombreAgneaux, e101.agneaux, e101.parasitisme, e101.special, e101.date, e101.campagne], ['Milieu', 2, null, true, null, '2026-10-01', 2026], 'écho complète enregistrée');
check(await page.evaluate(() => !estVideDefinitiveCampagne(DB.brebis.find(b => b.eid === E(3, 101)))), 'pleine : jamais vide définitive');
eq(await page.evaluate(() => [...document.querySelectorAll('#echo-tuiles .n')].map(n => n.textContent)), ['1', '1', '50,0 %'], 'tuiles : 1 pleine, 1 vide, réussite 50,0 %');
// cas particulier enregistré : ne compte ni pleine ni vide
await saisir(E_(102)); await page.waitForSelector('#carte-echo-brebis');
await page.click('#special-list .chip:has-text("Avortée")'); await page.click('#btn-valider-echo');
await page.waitForFunction(() => echoRapideSession.count === 3);
const e102 = (await echos(102))[0];
eq([e102.special, e102.stade, e102.date], ['Avortée', null, '2026-10-01'], 'cas particulier enregistré sans stade');
eq(await page.evaluate(() => [...document.querySelectorAll('#echo-tuiles .n')].map(n => n.textContent)), ['1', '1', '50,0 %'], 'un cas particulier ne compte ni en pleines ni en vides');
// doublon à la même date
await saisir(E_(101)); await page.waitForSelector('#carte-echo-brebis'); await page.click('.stade-opt[data-val="Milieu"]'); await page.click('#nombre-agneaux-group [data-val="1"]'); await page.click('#btn-valider-echo');
check(/à cette date/.test(await page.evaluate(() => document.getElementById('err').textContent)) && (await echos(101)).length === 1, 'deux échos à la même date pour une brebis : refusé');
eq(dialogues, [], 'aucune boîte de dialogue pendant la saisie (campagne en cours)');
console.log('OK : échographies rapides mobile (session, lot filtre + alerte, Précédente, comptage, puces, Passer, Enregistrer et suivante, dernière écho, tuiles).');
await browser.close();
