/* Retour Android (bouton et geste du Pixel, mobile) : MÊME logique que la flèche de l'en-tête (gererRetourAndroid) — d'abord ce qui est ouvert
   (clavier Ovilog, fenêtre, menu), puis l'écran d'avant, puis l'Accueil ; sur l'Accueil, un 1er appui avertit, un 2e (2,5 s) quitte l'appli.
   Formulaire rempli : « Quitter sans enregistrer ? » (message de la charte, jamais confirm()), Continuer garde la saisie, Quitter sort ; même
   message par la flèche. Double appui sur un bouton principal : un seul appui compte (800 ms). saveData REMPLACÉ ; jeu synthétique. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const p = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
p.on('dialog', d => { throw new Error('boîte native inattendue : ' + d.message()); });
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
await p.evaluate(() => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2027; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.brebis = [{ id: 'a', eid: '250000004551001', statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] }];
  window.__quitte = 0; window.Capacitor = { Plugins: { App: { exitApp: () => { window.__quitte++; } } } };
  render('home');
});
const retour = () => p.evaluate(() => gererRetourAndroid());
const vue = () => p.evaluate(() => currentView);

// 1. Accueil : 1er appui avertit, 2e quitte
eq(await retour(), 'avertir', 'Accueil, 1er appui : avertissement');
check(/Appuyez encore sur Retour/.test(await p.textContent('body')), 'message « Appuyez encore sur Retour pour quitter Ovilog »');
eq([await retour(), await p.evaluate(() => window.__quitte)], ['quitter', 1], 'Accueil, 2e appui : l\'appli se ferme');

// 2. menu ouvert : il se ferme d'abord
await p.evaluate(() => { dernierRetourAccueil = 0; openNavDrawer(); });
eq([await retour(), await p.evaluate(() => navDrawerOverlay.classList.contains('hidden')), await vue()], ['menu', true, 'home'], 'menu ouvert : il se ferme, on reste sur l\'écran');

// 3. écran de détail : même chemin que la flèche ; liste de tête : Accueil
await p.evaluate(() => render('list'));
eq([await retour(), await vue()], ['accueil', 'home'], 'écran de tête (liste) : retour à l\'Accueil');
await p.evaluate(() => { render('list'); currentSheepId = 'a'; render('detail', 'a'); });
const viaFleche = await p.evaluate(() => { btnBack.onclick(); return currentView; });
await p.evaluate(() => { render('list'); render('detail', 'a'); });
eq([await retour(), await vue()], ['retour', viaFleche], 'fiche : le retour Android fait comme la flèche');

// 4. fenêtre ouverte : elle se ferme, l'écran reste
await p.evaluate(() => { render('detail', 'a'); });
await p.click('#btn-corriger-eid');
check(await p.$('.sheet-overlay:not(.hidden)'), 'fenêtre ouverte');
eq([await retour(), await vue(), !!(await p.$('.sheet-overlay:not(.hidden)'))], ['fenetre', 'detail', false], 'fenêtre : fermée d\'abord, l\'écran reste');

// 5. formulaire rempli : « Quitter sans enregistrer ? »
await p.evaluate(() => render('add-sheep'));
eq(await retour(), 'retour', 'formulaire vide : retour');
check(!(await p.$('#quitter-saisie')) && (await vue()) !== 'add-sheep', 'formulaire vide : on sort sans question');
await p.evaluate(() => render('add-sheep'));
await p.fill('#input-eid', '250000004551009');
eq(await retour(), 'retour', 'formulaire rempli : retour demandé');
check(await p.isVisible('#quitter-saisie'), 'message « Quitter sans enregistrer ? »');
eq(await vue(), 'add-sheep', 'rien n\'est quitté avant la réponse');
await p.click('#qs-continuer');
eq([await vue(), await p.inputValue('#input-eid'), !!(await p.$('#quitter-saisie'))], ['add-sheep', '250000004551009', false], 'Continuer la saisie : saisie gardée');
eq(await retour(), 'retour', 'retour à nouveau');
eq(await retour(), 'fenetre', 'le message lui-même se ferme par le retour Android (= continuer)');
eq([await vue(), await p.inputValue('#input-eid')], ['add-sheep', '250000004551009'], 'saisie toujours là');
await p.evaluate(() => btnBack.onclick());
check(await p.isVisible('#quitter-saisie'), 'flèche de l\'en-tête : même message');
await p.click('#qs-quitter');
check((await vue()) !== 'add-sheep', 'Quitter sans enregistrer : on sort');
eq(await p.evaluate(() => DB.brebis.length), 1, 'rien n\'est enregistré');

// 6. double appui sur un bouton principal : un seul compte
await p.evaluate(() => {
  render('home'); window.__n = 0;
  const b = document.createElement('button'); b.className = 'btn btn-primary'; b.id = 'bt-test'; b.textContent = 'Enregistrer';
  b.onclick = () => window.__n++; document.body.appendChild(b);
});
await p.click('#bt-test'); await p.click('#bt-test', { force: true });
eq(await p.evaluate(() => window.__n), 1, 'double appui : un seul enregistrement');
await p.waitForTimeout(900);
await p.click('#bt-test');
eq(await p.evaluate(() => window.__n), 2, 'après 800 ms, le bouton redevient utilisable (ex. message d\'erreur)');
console.log('OK : Accueil (avertir puis quitter), menu, fenêtre, écran d\'avant, formulaire rempli, double appui.');
await browser.close();
console.log('test_retour_android : OK');
