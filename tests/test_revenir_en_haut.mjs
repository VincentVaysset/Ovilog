/* « Revenir en haut » (MOBILE, majRevenirEnHaut) : bouton tout en bas des pages plus longues que deux écrans, hors du contenu de l'écran, jamais
   flottant ; absent sur une page courte, sur un écran à barre fixe en bas (.mn-barre) et sur PC ; toucher = haut de la page. Tri des agnelles :
   plus de boutons « Lots de recherche » / « Créer une liste » en bas. Jeu synthétique (indicatif 000456), aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const prep = n => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.brebis = Array.from({ length: n }, (_, i) => ({ id: 'b' + i, eid: '2500000456' + String(60100 + i), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }));
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
};
const attendre = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const visible = p => p.evaluate(() => !document.getElementById('revenir-haut').classList.contains('hidden'));
{
  const p = await (await browser.newContext({ viewport: { width: 390, height: 760 } })).newPage();
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(prep, 3);
  await p.evaluate(() => { inventaireActifsTab = 'brebis'; render('inventaire-actifs'); }); await attendre(p);
  check(!(await visible(p)), 'page courte : pas de bouton');
  await p.evaluate(prep, 60);
  await p.evaluate(() => render('inventaire-actifs')); await attendre(p);
  check(await visible(p), 'longue liste : bouton « Revenir en haut » en bas');
  check(await p.evaluate(() => { const z = document.getElementById('revenir-haut'); return !document.getElementById('app').contains(z) && getComputedStyle(z).position !== 'fixed' && z.getBoundingClientRect().top >= document.getElementById('app').getBoundingClientRect().bottom - 1; }), 'tout en bas, hors du contenu, jamais flottant');
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await p.click('#btn-revenir-haut');
  await p.waitForFunction(() => window.scrollY === 0, null, { timeout: 3000 });
  // écran à barre fixe en bas : jamais
  await p.evaluate(() => { app.insertAdjacentHTML('beforeend', '<div class="mn-barre"></div>'); }); await attendre(p);
  check(!(await visible(p)), 'barre fixe en bas : pas de bouton');
  // Tri des agnelles : plus de « Lots de recherche » / « Créer une liste » en bas
  await p.evaluate(() => render('agnelles')); await attendre(p);
  check(await p.evaluate(() => !document.querySelector('.tri-nav') && ![...document.querySelectorAll('#app button')].some(b => /Lots de recherche|Créer une liste/.test(b.textContent) && !b.closest('.tab-bar'))), 'tri des agnelles : plus de boutons de navigation en bas');
  await p.context().close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 800 } });
  await ctx.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test', refocus: () => {} }; });
  const p = await ctx.newPage();
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(prep, 120);
  await p.evaluate(() => { inventaireActifsTab = 'brebis'; render('inventaire-actifs'); }); await attendre(p);
  check(!(await visible(p)), 'PC : jamais');
  await ctx.close();
}
await browser.close();
console.log('OK test_revenir_en_haut');
