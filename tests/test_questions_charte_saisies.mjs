/* Parcours de saisie sans boîte native (lot 3, point 14) : « Terminer la session » (mises bas, échographies), échographie de la campagne À
   VENIR et date de mise bas future posent une question de la charte (questionCharte : oui en vert, non en blanc), jamais confirm() ;
   rien n'est fait avant la réponse ; « oui » rejoue le geste. Jeu synthétique. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
p.on('dialog', d => { throw new Error('boîte native inattendue : ' + d.message()); });
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
await p.evaluate(() => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2027; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.brebis = [];
});
// 1. Terminer la session de mises bas : question, « Continuer » garde l'écran, « Terminer » ramène à l'Accueil
await p.evaluate(() => { render('misebas-rapide'); misebasRapideCount = 2; });
await p.click('#btn-fin-session-mb');
check(/Session de mises bas : 2 saisies enregistrées/.test(await p.textContent('#question-charte')), 'mises bas : question de la charte');
await p.click('#qc-non');
eq(await p.evaluate(() => currentView), 'misebas-rapide', '« Continuer la session » : on reste');
await p.click('#btn-fin-session-mb'); await p.click('#qc-oui');
eq(await p.evaluate(() => currentView), 'home', '« Terminer la session » : Accueil');
// 2. échographie de la campagne à venir : question, puis le geste est rejoué une seule fois
eq(await p.evaluate(() => { window.__n = 0; return [confirmerCampagneEcho(2027, () => window.__n++), !!document.getElementById('question-charte')]; }), [true, false], 'campagne en cours : aucune question');
eq(await p.evaluate(() => [confirmerCampagneEcho(2028, () => { window.__n++; confirmerCampagneEcho(2028, () => {}) && window.__n++; }), !!document.getElementById('question-charte')]), [false, true], 'campagne à venir : question, rien de fait');
await p.click('#qc-oui');
eq(await p.evaluate(() => [window.__n, !!document.getElementById('question-charte')]), [2, false], '« Oui » : le geste est rejoué et passe (une seule fois)');
eq(await p.evaluate(() => confirmerCampagneEcho(2028, () => {})), false, 'la réponse ne vaut que pour ce geste : la question revient la fois suivante');
await p.click('#qc-non');
console.log('OK : Terminer la session, campagne à venir : questions de la charte, aucune boîte native.');
await browser.close();
console.log('test_questions_charte_saisies : OK');
