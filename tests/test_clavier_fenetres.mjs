/* Clavier Ovilog dans les FENÊTRES (mobile) : fiche produit (Produits et délais › Nouveau produit, aussi ouverte depuis le Carnet) — le clavier
   s'ouvre AU-DESSUS de la fenêtre (avant : derrière, invisible, délais impossibles à saisir), le champ reste visible, « Suivant » passe au champ chiffré
   suivant de la MÊME fenêtre ; un champ de texte (nom du produit) garde le clavier du TÉLÉPHONE (jamais coupé). Jeu synthétique, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
await p.evaluate(() => {
  DB = migrateData({}); saveData = () => true; DB.campagneDebut = 2026; DB.campagneInitialisee = true;
  DB.brebis = []; DB.beliers = []; DB.agnelles = []; DB.lots = [];
  render('produits-delais');
  ouvrirFicheProduitModal({});
});
await p.waitForSelector('#fp-viande');
const ouvert = () => p.evaluate(() => !!document.querySelector('#clavier-ovilog.ouvert'));

// 1. texte : clavier du téléphone, jamais le clavier Ovilog
await p.tap('#fp-nom');
check(!(await ouvert()), 'nom du produit (texte) : pas de clavier Ovilog');
check(await p.evaluate(() => document.getElementById('fp-nom').getAttribute('inputmode') !== 'none'), 'nom du produit : le clavier du téléphone n\'est pas coupé');

// 2. délai viande : clavier Ovilog AU-DESSUS de la fenêtre, champ visible
await p.tap('#fp-viande');
check(await ouvert(), 'délai viande : clavier Ovilog ouvert');
await p.waitForTimeout(400);
const vis = await p.evaluate(() => {
  const k = document.querySelector('#clavier-ovilog .k[data-k="7"]').getBoundingClientRect(), dessus = document.elementFromPoint(k.left + k.width / 2, k.top + k.height / 2);
  const champ = document.getElementById('fp-viande').getBoundingClientRect(), clavier = document.getElementById('clavier-ovilog').getBoundingClientRect();
  return { toucheDessus: !!(dessus && dessus.closest('#clavier-ovilog')), champVisible: champ.bottom <= clavier.top && champ.top >= 0, ok: document.querySelector('#clavier-ovilog .k[data-k="ok"]').textContent };
});
eq(vis, { toucheDessus: true, champVisible: true, ok: 'Suivant' }, 'clavier au premier plan (pas sous la fenêtre), champ visible au-dessus, « Suivant »');
await p.tap('#clavier-ovilog .k[data-k="2"]'); await p.tap('#clavier-ovilog .k[data-k="1"]');
eq(await p.inputValue('#fp-viande'), '21', 'délai viande saisi au clavier Ovilog');

// 3. Suivant : délai lait (champ suivant de la MÊME fenêtre), puis Terminé
await p.tap('#clavier-ovilog .k[data-k="ok"]');
eq(await p.evaluate(() => document.activeElement && document.activeElement.id), 'fp-lait', '« Suivant » passe au délai lait');
await p.tap('#clavier-ovilog .k[data-k="5"]');
eq(await p.inputValue('#fp-lait'), '5', 'délai lait saisi');
eq(await p.evaluate(() => document.querySelector('#clavier-ovilog .k[data-k="ok"]').textContent), 'Terminé', 'dernier champ chiffré de la fenêtre : « Terminé »');
await p.tap('#clavier-ovilog .k[data-k="ok"]');
check(!(await ouvert()), 'Terminé : le clavier se range');

await browser.close();
console.log('\nTOUS LES TESTS DU CLAVIER OVILOG DANS LES FENÊTRES SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
