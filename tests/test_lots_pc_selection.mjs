/* Chantier de tri › Lots (PC), panneau d'un lot : cocher une brebis ne fait plus remonter la liste (position du tableau et de la page conservées
   à chaque redessin : case, « Tout cocher », tri) ; le n° tapé dans « Rechercher un n° » puis Entrée COCHE la brebis quand un seul animal
   correspond (champ vidé, curseur gardé, message vert), sinon rien n'est coché (plusieurs : la liste reste filtrée, aucune ou déjà dans le lot :
   message ambre) ; rien n'est écrit dans le lot avant « Affecter ». saveData REMPLACÉ par un compteur ; jeu synthétique. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 1400, height: 800 } })).newPage();
await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

await page.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  window.E = (d, n) => '2500000456' + d + String(n).padStart(4, '0');
  const f = (d, n) => ({ id: 'b' + d + n, eid: E(d, n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] });
  DB.brebis = [];
  for (let n = 1; n <= 60; n++) DB.brebis.push(f(8, n));
  DB.brebis.push(f(9, 12));                                   // n°90012 : « 0012 » correspond à 80012 ET 90012
  DB.agnelles = []; DB.lots = []; DB.evenementsLots = [];
  lotsPcEtat = null; render('lots');
});
await page.click('#lt-type .opt-btn[data-val="recherche"]');
await page.fill('#lt-nom', 'Lot test'); await page.waitForTimeout(400);
await page.click('#lt-creer'); await page.waitForSelector('#lt-table');
const lotId = await page.evaluate(() => lotsPcEtat.lotId);
const saves0 = await page.evaluate(() => window.__saves);
const etat = () => page.evaluate(() => {
  const s = document.querySelector('#pc-lots .lt-scroll');
  return { liste: s.scrollTop, page: Math.round(document.scrollingElement.scrollTop), coches: lotsPcEtat.selection.size };
});

// ================================================================ 1. cocher en bas de la liste : ni la liste ni la page ne remontent
await page.evaluate(() => { const s = document.querySelector('#pc-lots .lt-scroll'); s.scrollTop = s.scrollHeight; document.scrollingElement.scrollTop = 300; });
const avant = await etat();
check(avant.liste > 200 && avant.page > 0, 'préparation : liste et page défilées : ' + JSON.stringify(avant));
await page.evaluate(() => { const r = [...document.querySelectorAll('#lt-table tr.clic')].pop(); r.click(); });
await page.waitForTimeout(100);
const apres = await etat();
eq([apres.liste, apres.page, apres.coches], [avant.liste, avant.page, 1], 'brebis cochée en bas : la liste et la page restent à la même position');
check(await page.evaluate(() => [...document.querySelectorAll('#lt-table tr.clic')].pop().querySelector('input').checked), 'la case de la dernière ligne est cochée');
await page.evaluate(() => { const r = [...document.querySelectorAll('#lt-table tr.clic')].pop(); r.click(); });
eq((await etat()).liste, avant.liste, 'décocher : même position');
await page.click('#lt-tout');
const tout = await etat();
eq([tout.liste, tout.coches], [avant.liste, 61], '« Tout cocher » : même position, 61 cochées');
await page.click('#lt-rien');
eq((await etat()).coches, 0, '« Tout décocher » : plus rien de coché');
check(await page.evaluate(() => window.__saves) === saves0, 'cocher et décocher n\'écrivent rien');
console.log('OK 1 position conservée : case cochée ou décochée en bas de liste, « Tout cocher », page défilée.');

// ================================================================ 2. n° tapé + Entrée : coche si un seul animal correspond
const msg = () => page.evaluate(() => { const m = document.getElementById('lt-msg-numero'); return m ? [m.className.replace('msg-charte ', ''), m.textContent.replace(/\s+/g, ' ').trim()] : null; });
const champ = () => page.evaluate(() => [document.getElementById('lt-q').value, document.activeElement && document.activeElement.id]);
const coche = n => page.evaluate(k => lotsPcEtat.selection.has(cleanEid(E(...k))), n);
const entree = async v => { await page.fill('#lt-q', v); await page.press('#lt-q', 'Enter'); await page.waitForTimeout(450); };
// n° court exact (5 derniers chiffres de l'EID)
await entree('80045');
eq([await coche([8, 45]), await champ(), await msg()], [true, ['', 'lt-q'], ['ok', 'n°80045 cochée · 1 sélectionnée']], 'un seul résultat : cochée, champ vidé, curseur gardé, message vert');
check(await page.evaluate(() => document.querySelector('#lt-table tr[data-eid="' + E(8, 45) + '"] input').checked), 'la case de n°80045 est cochée dans la liste (filtre vidé)');
await entree('2500000456 80046');
eq([await coche([8, 46]), (await msg())[0]], [true, 'ok'], 'EID complet tapé (avec espace) : coché');
// plusieurs : rien de coché, liste filtrée sur la saisie
await entree('0012');
const plusieurs = await page.evaluate(() => [lotsPcEtat.selection.size, document.getElementById('lt-q').value, [...document.querySelectorAll('#lt-table tr[data-eid]')].map(r => r.children[1].textContent.trim())]);
eq([plusieurs[0], plusieurs[1], await msg()], [2, '0012', ['alerte', '2 brebis correspondent à « 0012 » : coche la bonne dans la liste.']], 'plusieurs résultats : rien de coché, saisie gardée, message ambre');
check(plusieurs[2].includes('80012') && plusieurs[2].includes('90012'), 'la liste est filtrée sur les brebis correspondantes : ' + plusieurs[2].join(','));
// aucune
await entree('77777');
eq([await page.evaluate(() => lotsPcEtat.selection.size), await msg()], [2, ['alerte', 'Aucune brebis ne correspond au n° « 77777 » : rien n\'est coché.']], 'aucun résultat : rien de coché, message ambre');
// taper efface le message
await page.fill('#lt-q', '8'); await page.waitForTimeout(450);
eq(await msg(), null, 'une nouvelle frappe efface le message');
// rien n'est écrit avant « Affecter »
check(await page.evaluate(id => (DB.lots.find(l => l.id === id).membres || []).length === 0, lotId), 'rien n\'est écrit dans le lot avant « Affecter »');
check(await page.evaluate(() => window.__saves) === saves0, 'aucune écriture avant « Affecter »');
// déjà dans le lot : après affectation, le n° tapé ne coche rien
await page.fill('#lt-q', ''); await page.waitForTimeout(450);
await page.click('#lt-affecter'); await page.waitForTimeout(300);
check(await page.evaluate(id => DB.lots.find(l => l.id === id).membres.length === 2, lotId), 'Affecter : les 2 brebis cochées entrent dans le lot');
await entree('80045');
eq([await page.evaluate(() => lotsPcEtat.selection.size), await msg()], [0, ['alerte', 'n°80045 est déjà dans ce lot : rien n\'est coché.']], 'déjà dans le lot : rien de coché, message ambre');
console.log('OK 2 n° + Entrée : un résultat = coché (champ vidé, curseur gardé) ; plusieurs, aucun ou déjà dans le lot = rien de coché, message ; rien écrit avant Affecter.');

await browser.close();
console.log('OK test_lots_pc_selection');
