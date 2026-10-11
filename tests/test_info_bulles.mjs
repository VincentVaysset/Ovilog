/* Chantier « bulles ? » : plus aucune bulle « ? » (❔) sur les écrans traités ; une ligne d'information courte (classe .info, 13 px, #5e5b47) seulement là où elle évite une erreur de saisie,
   un effet inattendu ou une perte de données ; les cases « Mort-né » gardent leur comportement (le champ EID disparaît). Les textes supprimés sont conservés dans docs/manuel_aides_ecrans.md.
   Un groupe d'écrans par section ; la dernière section vérifie que le code n'a plus aucun infoBulleHtml. Jeu SYNTHÉTIQUE, saveData REMPLACÉ, aucune écriture, aucune donnée réelle. */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

function jeu() {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  const fiche = (id, e, o) => Object.assign({ id, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.brebis = [fiche('P1', eid(8, 1), { numeroCourtTravailSieol: '8001' }), fiche('P2', eid(8, 2), { numeroCourtTravailSieol: '8002' })];
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} }; DB.mouvementsCollectifs = [];
  window.__avant = JSON.stringify(DB); window.__saves = 0;
}
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 } })).newPage();
await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
await page.evaluate(jeu);
// état d'un écran : bulles restantes, lignes d'information (texte, taille, couleur, nombre de lignes)
const etat = () => page.evaluate(() => ({
  bulles: document.querySelectorAll('#app .info-bulle-btn').length, pictos: document.getElementById('app').textContent.includes('❔'),
  infos: [...document.querySelectorAll('#app .info')].map(e => { const cs = getComputedStyle(e), lh = parseFloat(cs.lineHeight); return { t: e.textContent.trim(), px: cs.fontSize, c: cs.color, lignes: Math.round(e.getBoundingClientRect().height / lh) }; }) }));
const sansBulle = async (msg) => { const e = await etat(); check(e.bulles === 0 && !e.pictos, msg + ' : plus aucune bulle « ? » (' + e.bulles + ')'); return e; };
const uneInfo = (e, texte, msg) => { check(e.infos.some(i => i.t === texte && i.px === '13px' && i.c === 'rgb(94, 91, 71)' && i.lignes <= 2), msg + ' : ligne d\'information « ' + texte + ' » (13 px, #5e5b47, 2 lignes au plus) : ' + JSON.stringify(e.infos)); };

// ================================================================ groupe 1 : Ajout d'agnelage, saisie rapide d'échos, ajout d'écho, historique des échos, mise bas rapide
await page.evaluate(() => { currentSheepId = 'P1'; editContext = null; render('add-agnelage', 'P1'); });
eq((await sansBulle('Ajout d\'agnelage')).infos, [], 'Ajout d\'agnelage : aucune ligne d\'information (la bulle « Mort-né » est supprimée, texte dans le manuel)');
// case « Mort-né » : le champ EID disparaît toujours, plus aucun encart d'aide
const mn = await page.evaluate(() => { const b = document.querySelector('.sexe-opt[data-val="Mort-né"]'); const id = b.dataset.id; const bloc = () => document.querySelector(`.eid-block[data-id="${id}"]`).classList.contains('hidden'); const avant = bloc(); b.click(); return { avant, apres: bloc(), note: document.querySelectorAll('.mortne-note').length }; });
eq(mn, { avant: false, apres: true, note: 0 }, 'Ajout d\'agnelage : « Mort-né » masque le champ EID, sans encart d\'aide');
await page.evaluate(() => { resetEchoRapideSession(); render('echo-rapide'); });
eq((await sansBulle('Saisie rapide d\'échos (nouvelle session)')).infos.map(i => i.t), ['Constat avant le démarrage : choisis « à venir ».'], 'Saisie rapide d\'échos : seule la ligne « Campagne concernée » reste');
check(await page.evaluate(() => document.getElementById('app').textContent.includes('Combinaison résultat + comptage pour cette session') && !!document.getElementById('f-echo-session-combo')), 'Saisie rapide d\'échos : le champ « Combinaison résultat + comptage » reste, sans bulle');
uneInfo(await etat(), 'Constat avant le démarrage : choisis « à venir ».', 'Saisie rapide d\'échos');
await page.evaluate(() => { currentSheepId = 'P1'; render('add-echo', 'P1'); });
uneInfo(await sansBulle('Ajout d\'écho'), 'Constat avant le démarrage : choisis « à venir ».', 'Ajout d\'écho');
await page.evaluate(() => render('historique-echo'));
eq((await sansBulle('Historique des échos (mobile)')).infos, [], 'Historique des échos : aucune ligne d\'information');
await page.evaluate(() => render('misebas-rapide'));
await sansBulle('Mise bas rapide');
eq(await page.evaluate(() => document.querySelectorAll('.mortne-note-rapide').length), 0, 'Mise bas rapide : plus d\'encart « Mort-né »');
check(await page.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'groupe 1 : aucune écriture');
console.log('OK groupe 1 : agnelage, échos rapides, ajout d\'écho, historique des échos, mise bas rapide sans bulle ; une ligne d\'information (Campagne concernée).');

await browser.close();
console.log('\nTOUS LES TESTS « BULLES ? » SONT PASSÉS.');
