/* Onglets de navigation à défiler (MOBILE, .onglets-nav, amenagerOngletsDefilants) : une rangée qui ne tient pas sur une ligne défile au doigt, avec
   fondu et flèche › à droite (‹ à gauche dès qu'on a défilé), l'onglet ouvert placé en vue ; une rangée qui tient sur une ligne ne change pas ;
   PC : jamais. Affichage seul. Jeu synthétique (indicatif 000456), aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const prep = () => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.brebis = []; DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
};
const attendre = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

// mobile
{
  const p = await (await browser.newContext({ viewport: { width: 360, height: 760 } })).newPage();
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(prep);
  // Inventaire : « Brebis actives | Agnelles actives | Béliers actifs | Agneaux actifs » ne tient pas sur une ligne à 360 px
  await p.evaluate(() => { inventaireActifsTab = 'agneaux'; render('inventaire-actifs'); });
  await attendre(p);
  const etat = () => p.evaluate(() => {
    const bar = document.querySelector('#app .tab-bar.onglets-nav'), cadre = bar.parentElement;
    const actif = bar.querySelector('.tab-btn.active').getBoundingClientRect(), b = bar.getBoundingClientRect();
    return { defil: bar.dataset.defil, cadre: cadre.classList.contains('defil-cadre'), lignes: [...bar.querySelectorAll('.tab-btn')].every(x => x.getBoundingClientRect().height < 50),
      d: !!cadre.querySelector('.defil-fondu.d.visible'), g: !!cadre.querySelector('.defil-fondu.g.visible'), scroll: bar.scrollLeft,
      actifVisible: actif.left >= b.left - 1 && actif.right <= b.right + 1, pageLarge: document.documentElement.scrollWidth > window.innerWidth };
  });
  let e = await etat();
  check(e.defil === 'oui' && e.cadre && e.lignes, 'inventaire : une seule ligne défilante : ' + JSON.stringify(e));
  check(e.actifVisible && e.scroll > 0 && e.g, 'onglet ouvert (Agneaux actifs, le dernier) placé en vue, flèche ‹ à gauche : ' + JSON.stringify(e));
  check(!e.pageLarge, 'la page ne défile jamais sur le côté');
  // retour au premier onglet : flèche › seulement, puis toucher la flèche fait défiler
  await p.evaluate(() => { inventaireActifsTab = 'brebis'; render('inventaire-actifs'); });
  await attendre(p);
  e = await etat();
  check(e.d && !e.g && e.scroll === 0, 'au début : flèche › à droite seulement : ' + JSON.stringify(e));
  await p.click('#app .defil-fondu.d .defil-fleche');
  await p.waitForTimeout(600);
  e = await etat();
  check(e.scroll > 0 && e.g, 'flèche touchée : la ligne défile, flèche ‹ apparaît : ' + JSON.stringify(e));
  // les onglets marchent toujours
  await p.click('#app .tab-bar.onglets-nav .tab-btn[data-tab="beliers"]');
  check(await p.evaluate(() => inventaireActifsTab === 'beliers'), 'toucher un onglet l\'ouvre');
  // une rangée qui tient sur une ligne ne change pas (Registre : 3 onglets courts)
  await p.evaluate(() => render('registre'));
  await attendre(p);
  check(await p.evaluate(() => { const bar = document.querySelector('#app .tab-bar.onglets-nav'); return bar.dataset.defil === 'non' && !bar.parentElement.classList.contains('defil-cadre') && !bar.classList.contains('defil-actif'); }), 'registre : rien ne change');
  await p.context().close();
}
// PC : jamais
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test', refocus: () => {} }; });
  const p = await ctx.newPage();
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(prep);
  await p.evaluate(() => render('registre'));
  await attendre(p);
  check(await p.evaluate(() => !document.querySelector('.defil-cadre') && ![...document.querySelectorAll('.tab-bar.onglets-nav')].some(b => b.dataset.defil)), 'PC : aucune rangée transformée');
  await ctx.close();
}
await browser.close();
console.log('OK test_onglets_defilants');
