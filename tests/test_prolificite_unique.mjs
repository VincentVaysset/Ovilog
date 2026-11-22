/* Prolificité : UNE fonction (calculProlificite) pour l'Accueil, le Bilan de campagne, les lots IA / éponge, les millésimes, les groupes d'âge
   et les Mises bas : agneaux nés (mort-nés et avortons compris) ÷ mises bas, au centième ; « — » (null) sans mise bas, jamais 0.
   Garde-fou : plus aucune autre formule « nés ÷ mises bas » dans le code. Jeu synthétique. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
for (const mobile of [true, false]) {
  const nom = mobile ? 'mobile' : 'PC';
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1400, height: 900 } });
  if (!mobile) await ctx.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test', refocus: () => {} }; });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  eq(await p.evaluate(() => [calculProlificite(3, 2), calculProlificite(7, 3), calculProlificite(0, 0), calculProlificite(4, 0)]), [1.5, 2.33, null, null], nom + ' : règle commune');
  // compte sans aucune mise bas : « — » partout, jamais 0
  await p.evaluate(() => {
    DB = migrateData({}); saveData = () => true;
    DB.campagneDebut = 2027; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    DB.brebis = [{ id: 'a', eid: '250000045651001', statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [], controleLaitier: [], modesRepro: [], videesDefinitives: [] }];
    render('home');
  });
  await p.waitForTimeout(200);
  eq(await p.evaluate(() => dashboardStatsData().prolificite), null, nom + ' : Accueil sans mise bas = null');
  const txt = await p.evaluate(() => document.body.innerText);
  check(!/0,00\s*\n?\s*Prolificit/.test(txt) && !/Prolificit[ée]\s*\n?\s*0,00/.test(txt), nom + ' : l\'Accueil n\'affiche jamais 0,00 de prolificité sans mise bas');
  if (mobile) {
    // garde-fou : plus de formule recopiée
    eq(await p.evaluate(() => {
      const tout = [...document.scripts].map(s => s.textContent).join('\n');
      return (tout.match(/prolificite\s*[:=]\s*(?!calculProlificite)[^,;\n]*\//g) || []).filter(l => !/prolificitePrevisionnelle|prolificite \* 100/.test(l));
    }), [], 'aucune autre formule de prolificité que calculProlificite');
  }
  console.log('OK ' + nom + ' : prolificité commune, « — » sans mise bas.');
  await ctx.close();
}
await browser.close();
console.log('test_prolificite_unique : OK');
