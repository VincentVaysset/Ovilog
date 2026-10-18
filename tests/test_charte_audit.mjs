/* Corrections de l'audit charte (mobile 390 px, PC 1500 px, PDF) : une section par cause (A, B, C…), dans l'ordre des commits.
   Jeu SYNTHÉTIQUE (lib/jeu_pc_ecrans.mjs), saveData REMPLACÉ, aucune écriture. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { jeuPcEcrans } from './lib/jeu_pc_ecrans.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
async function ouvrir(pc) {
  const page = await (await browser.newContext({ viewport: pc ? { width: 1500, height: 950 } : { width: 390, height: 844 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-14T09:00:00'));
  if (pc) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.dismiss());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  return page;
}
const pc = await ouvrir(true), mob = await ouvrir(false);
const ecran = async (page, code) => { await page.evaluate(jeuPcEcrans); await page.evaluate(() => { document.querySelectorAll('.modal-overlay, .sheet-overlay').forEach(o => o.remove()); currentSheepId = 'B1'; currentBelierId = 'bel1'; currentAgnelleId = 'ag1'; currentLotId = 'L1'; }); await page.evaluate(code); await page.waitForTimeout(150); };
const texteApp = (page) => page.evaluate(() => document.getElementById('app').innerText);

// ---------------------------------------------------------------- A. Carnet sanitaire PC : aucun texte de balise affiché
await ecran(pc, "render('sanitaire')");
check(!/div style=|<\/?(div|table)/.test(await texteApp(pc)), 'A. Carnet sanitaire (PC) : aucun morceau de balise affiché');
check(await pc.evaluate(() => !!document.querySelector('#cs-derniers > div > table#cs-table-derniers')), 'A. tableau « Derniers soins » dans son conteneur à défilement');
console.log('A OK');

await browser.close();
console.log('OK');
