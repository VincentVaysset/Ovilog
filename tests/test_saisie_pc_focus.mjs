/* PC : « des fois je n'arrive pas à écrire dans la case ».
   1. Après une boîte native alert() / confirm(), la page rend le focus clavier à la fenêtre (electronAPI.refocus, bug connu d'Electron sous Windows) ;
      la réponse de confirm est inchangée ; rien de tout ça hors PC.
   2. Un redessin venu de la synchro pendant qu'on tape le n° d'un agneau (champ SANS id) rend le focus au même champ : la frappe continue.
   Jeu synthétique, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);

async function ouvrir(desktop) {
  const ctx = await browser.newContext({ viewport: desktop ? { width: 1500, height: 1000 } : { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-10-23T09:00:00'));
  if (desktop) await page.addInitScript(() => { window.__refocus = 0; window.electronAPI = { isDesktop: true, version: '1.0.test', refocus: () => { window.__refocus++; } }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.type() === 'confirm' ? d.dismiss() : d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    DB = migrateData({}); saveData = function () { return true; };
    const fiche = (e) => ({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] });
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    DB.exploitation.indicatifMarquage = '162991';
    DB.brebis = [fiche('250016299150975')]; DB.beliers = []; DB.agnelles = []; DB.lots = [];
  });
  return page;
}

// ---------------------------------------------------------------- 1. boîtes natives
{
  const page = await ouvrir(true);
  const r = await page.evaluate(() => { alert('test'); const reponse = confirm('test ?'); return { reponse, refocus: window.__refocus }; });
  check(r.refocus === 2, 'PC : focus rendu à la fenêtre après alert ET confirm : ' + JSON.stringify(r));
  check(r.reponse === false, 'PC : la réponse de confirm est inchangée (Annuler = false)');
  await page.context().close();
  const mob = await ouvrir(false);
  check(await mob.evaluate(() => !window.electronAPI && confirm('x') === false), 'mobile : confirm natif inchangé');
  await mob.context().close();
  console.log('OK 1 boîtes natives : focus rendu à la fenêtre sur PC, réponses inchangées, mobile intact.');
}

// ---------------------------------------------------------------- 2. redessin de synchro pendant la frappe d'un n° d'agneau (PC et mobile)
for (const desktop of [true, false]) {
  const nom = desktop ? 'PC' : 'MOBILE';
  const page = await ouvrir(desktop);
  await page.evaluate(() => { resetMisebasRapideSession(); render('misebas-rapide'); });
  await page.fill('#scan-misebas', '50975'); await page.press('#scan-misebas', 'Enter');
  await page.waitForSelector('#lamb-list-rapide');
  const sel = '.eid-input-rapide[data-id="0"]';
  await page.click(sel);
  await page.keyboard.type('610');
  await page.click('.sexe-opt-rapide[data-id="0"][data-val="Femelle"]');
  await page.click(sel); await page.keyboard.press('End');
  // une autre tablette ajoute une brebis pendant la saisie : la donnée arrive, l'écran de saisie ne bouge pas
  await page.evaluate(() => window.__appliquerSynchro(() => { DB.brebis.push(Object.assign({}, DB.brebis[0], { id: 'distante', eid: '250016299150976' })); }));
  await page.keyboard.type('01');
  const r = await page.evaluate(sel => { const c = document.querySelector(sel); return c && { valeur: c.value, focus: document.activeElement === c, femelle: !!document.querySelector('.sexe-opt-rapide[data-id="0"][data-val="Femelle"].active'), recue: DB.brebis.some(b => b.id === 'distante') }; }, sel);
  check(r && r.valeur === '61001' && r.focus, nom + ' : pendant une synchro, le champ du n° reste là, garde le focus et la frappe continue : ' + JSON.stringify(r));
  check(r.femelle && r.recue, nom + ' : le formulaire en cours est intact (sexe choisi) et la donnée distante est bien reçue : ' + JSON.stringify(r));
  await page.click('#btn-valider-misebas');
  check(await page.evaluate(() => DB.brebis[0].agnelages.length === 1 && DB.brebis[0].agnelages[0].lambs[0].eid === '250016299161001'), nom + ' : la mise bas s\'enregistre normalement ensuite');
  // hors écran de saisie, la synchro redessine toujours l'écran (comportement inchangé)
  await page.evaluate(() => { window.__rendus = 0; const r0 = render; render = function () { window.__rendus++; return r0.apply(this, arguments); }; currentView = "home"; window.__appliquerSynchro(() => {}); });
  check(await page.evaluate(() => window.__rendus === 1), nom + ' : hors saisie, la synchro redessine l\'écran comme avant');
  console.log('OK 2 ' + nom + ' : la frappe continue dans le n° de l\'agneau malgré un redessin de synchro.');
  await page.context().close();
}
await browser.close();
console.log('OK test_saisie_pc_focus');
