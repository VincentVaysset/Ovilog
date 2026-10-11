/* Pas de scan sur PC : aucun libellé, placeholder ni bouton ne laisse penser qu'on peut scanner (« Scanner ou saisir… », « bip »). Les champs deviennent « Saisir un n° » ou « Saisir un n° / EID » là où l'EID est accepté ;
   la saisie d'un EID au clavier reste possible. Le scan reste sur mobile : mêmes écrans, libellés d'origine. Jeu SYNTHÉTIQUE, saveData REMPLACÉ, aucune écriture. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { jeuPcEcrans } from './lib/jeu_pc_ecrans.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1440, height: 1000 } : { width: 390, height: 900 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(jeuPcEcrans);
  return page;
}
const pc = await ouvrir(true), mob = await ouvrir(false);
// texte visible + placeholders + titres de boutons de l'écran
const texte = (page) => page.evaluate(() => { const app = document.getElementById('app'); return app.innerText + ' | ' + [...app.querySelectorAll('input, textarea')].map(i => i.placeholder || '').join(' | ') + ' | ' + [...app.querySelectorAll('[aria-label], [title]')].map(e => (e.getAttribute('aria-label') || '') + (e.title || '')).join(' | '); });
const ECRANS = [
  ['Brebis', 'render("list")'], ['Béliers', 'render("beliers")'], ['Agneaux', 'render("agneaux")'], ['Agnelles', 'render("agnelles-inventaire")'], ['Saisie de mises bas', 'render("misebas-rapide")'],
  ['Mouvements d\'animaux', 'render("mouvement-groupe")'], ['Chantier de tri (lots)', 'lotsPcEtat=null;render("lots")'], ['Chantier de tri, étape 2', 'lotsPcEtat=lotsPcEtatInitial();lotsPcEtat.lotId="L1";currentLotId="L1";render("edit-lot")'],
  ['Tri des agnelles', 'render("agnelles")'], ['Contrôle de lot', 'render("controle-lot-delai")'], ['Carnet sanitaire', 'render("sanitaire")'], ['Contrôle laitier', 'render("controle-laitier")'], ['Échographies', 'render("echo-rapide")'],
  ['Inventaire', 'render("inventaire-actifs")'], ['Ajout d\'une brebis', 'render("add-sheep")'], ['Ajout d\'un bélier', 'render("add-belier")'], ['Ajout d\'une agnelle', 'editingAgnelleId=null;addAgnelleOrigin="agnelles";render("add-agnelle")'],
  ['Ajout d\'agnelage', 'currentSheepId="B1";editContext=null;render("add-agnelage","B1")']];
for (const [nom, code] of ECRANS) {
  await pc.evaluate(code); await pc.waitForTimeout(120);
  const t = await texte(pc);
  check(!/scann|\bbip|bipe|bipage/i.test(t), nom + ' (PC) : aucun libellé de scan ni de bip : ' + (t.match(/.{0,40}(scann|\bbip|bipe|bipage).{0,40}/i) || [''])[0]);
}
console.log('OK 1 ' + ECRANS.length + ' écrans PC sans libellé de scan ni de bip.');
// champs : « Saisir un n° » / « Saisir un n° / EID », saisie d'un EID au clavier toujours possible, ids conservés
await pc.evaluate('render("list")');
eq(await pc.evaluate(() => [document.getElementById('scan-open').placeholder, !!document.getElementById('scan-open-err')]), ['Saisir un n° / EID', true], 'Brebis (PC) : placeholder et ids');
await pc.evaluate('render("beliers")'); eq(await pc.evaluate(() => document.getElementById('scan-open-belier').placeholder), 'Saisir un n° / EID', 'Béliers (PC)');
await pc.evaluate('render("agneaux")'); eq(await pc.evaluate(() => document.getElementById('scan-open-agneau').placeholder), 'Saisir un n° / EID', 'Agneaux (PC)');
await pc.evaluate('render("agnelles-inventaire")'); eq(await pc.evaluate(() => document.getElementById('scan-open-agnelle').placeholder), 'Saisir un n° / EID', 'Agnelles (PC)');
await pc.evaluate('render("misebas-rapide")'); eq(await pc.evaluate(() => document.getElementById('scan-misebas').placeholder), 'Saisir un n° / EID', 'Saisie de mises bas (PC)');
await pc.evaluate('render("controle-lot-delai")'); eq(await pc.evaluate(() => document.getElementById('scan-controle-lot').placeholder), 'Saisir un n° / EID', 'Contrôle de lot (PC)');
await pc.evaluate('render("list")'); await pc.fill('#scan-open', await pc.evaluate(() => DB.brebis[0].eid)); await pc.press('#scan-open', 'Enter'); await pc.waitForTimeout(200);
check(await pc.evaluate(() => currentView === 'detail'), 'un EID complet saisi au clavier ouvre toujours la fiche');
console.log('OK 2 champs « Saisir un n° / EID », ids conservés, saisie d\'un EID au clavier toujours possible.');
// le mobile ne change pas : le scan y reste
await mob.evaluate('render("list")');
eq(await mob.evaluate(() => document.getElementById('scan-open').placeholder), 'Scanner ou saisir un n°', 'Brebis (mobile) : libellé de scan conservé');
await mob.evaluate('render("beliers")'); eq(await mob.evaluate(() => document.getElementById('scan-open-belier').placeholder), 'Scanner ou saisir l\'EID', 'Béliers (mobile) : libellé de scan conservé');
await mob.evaluate('render("controle-lot-delai")'); check(await mob.evaluate(() => /Scanner une brebis/.test(document.getElementById('app').innerText)), 'Contrôle de lot (mobile) : « Scanner une brebis » conservé');
await mob.evaluate('render("misebas-rapide")'); check(await mob.evaluate(() => /Scanner/.test(document.getElementById('app').innerText + [...document.querySelectorAll('input')].map(i => i.placeholder).join(' '))), 'Saisie de mises bas (mobile) : le scan reste');
console.log('OK 3 mobile inchangé : le scan reste.');
await browser.close();
console.log('\nTOUS LES TESTS « PAS DE SCAN SUR PC » SONT PASSÉS.');
