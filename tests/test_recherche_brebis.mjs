/* Liste BREBIS (mobile et PC) : le champ du haut est une recherche qui filtre la liste en direct (même correspondance que l'Inventaire : n° court / long SIEOL, n° officiel, n° d'ordre, EID,
   partielle, sans espaces ni casse), le n° court est en gras (n° d'ordre en repli) avec l'étiquette SIEOL ; Entrée / scan : EID complet ou n° à un seul résultat -> fiche (même bip), plusieurs
   résultats -> JAMAIS d'ouverture automatique (bip ambigu, la liste reste filtrée sur les candidats), aucun résultat -> bip « raté » ; liste vide et « aucun résultat » ; même tri ; aucune écriture.
   Jeu SYNTHÉTIQUE, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const A = [1046, 1568], B = [220], AMBIGU = [700, 700];

function jeu(vide) {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  window.EID = eid;
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.brebis = vide ? [] : [
    fiche(eid(8, 133), { id: 'A', numeroCourtTravailSieol: '8133', numeroLongTravailSieol: '258133' }),
    fiche(eid(9, 59), { id: 'B' }),
    fiche(eid(9, 152), { id: 'C', numeroCourtTravailSieol: '9152', numeroLongTravailSieol: '259152' }),
    fiche(eid(5, 33), { id: 'D', numeroCourtTravailSieol: '533', numeroLongTravailSieol: '250033' }),
    fiche(eid(7, 777), { id: 'E', numeroCourtTravailSieol: '777', numeroLongTravailSieol: '257777' }),
    fiche(eid(6, 777), { id: 'F' }),            // même n° d'ordre 00777 que E : collision
    fiche(eid(9, 99), { id: 'M', statut: 'vendue', mouvements: [{ type: 'Entrée', date: '2024-01-01' }, { type: 'Vente', acheteur: 'Natera', date: '2026-09-01' }] })];
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} }; DB.mouvementsCollectifs = [];
  window.__avant = JSON.stringify(DB); window.__saves = 0;
}
async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1440, height: 1000 } : { width: 390, height: 900 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__beeps = [];
    window.AudioContext = class { constructor() { this.currentTime = 0; this.destination = {}; } createOscillator() { const o = { frequency: { value: 0 }, type: '', connect() {}, start() { window.__beeps.push(o.frequency.value); }, stop() {} }; return o; } createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; } };
  });
  await page.evaluate(jeu, false);
  return page;
}
const lignes = (page, bureau) => page.evaluate(b => [...document.querySelectorAll(b ? '#brebis-liste .list-table-row .num' : '#brebis-liste .al-num')].map(x => x.firstChild.textContent.trim()), bureau);
const vide = page => page.evaluate(() => (document.querySelector('#brebis-liste .empty') || {}).textContent || null);
const bips = page => page.evaluate(() => window.__beeps.slice());
const entree = async (page, v) => { await page.evaluate(() => { window.__beeps = []; }); await page.evaluate(v => { const el = document.querySelector('#scan-open'); el.value = v; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true })); }, v); await page.waitForTimeout(350); };
const taper = async (page, v) => { await page.fill('#scan-open', v); await page.waitForTimeout(60); };
const TOUT = ['8133', '9152', 'n°00059', '533', '777', 'n°00777'];

for (const bureau of [false, true]) {
  const nom = bureau ? 'PC' : 'mobile';
  const p = await ouvrir(bureau);
  await p.evaluate(() => render('list'));

  // ---- 1. liste complète, n° court en gras (n° d'ordre en repli), étiquette SIEOL, tri
  const tout = await lignes(p, bureau);
  eq(tout.length, 6, nom + ' : 6 brebis actives (la vendue n\'est pas listée)');
  eq([...tout].sort(), [...TOUT].sort(), nom + ' : n° court en gras, n° d\'ordre en repli');
  const attendu = await p.evaluate(() => sortByAge(DB.brebis.filter(s => (s.statut || 'active') === 'active')).map(s => s.numeroCourtTravailSieol || 'n°' + numeroVisuel(s.eid)));
  eq(tout, attendu, nom + ' : même tri qu\'avant (du plus âgé au plus jeune)');
  const gras = await p.evaluate(b => { const q = b ? '#brebis-liste .list-table-row .num' : '#brebis-liste .al-num'; const e = document.querySelector(q); const tags = [...document.querySelectorAll(b ? '#brebis-liste .list-table-row' : '#brebis-liste .al-ligne')].map(r => !!r.querySelector('.compact-tag')); return { poids: getComputedStyle(e).fontWeight, tags }; }, bureau);
  check(Number(gras.poids) >= 600, nom + ' : n° en gras : ' + gras.poids);
  eq(gras.tags.filter(Boolean).length, 4, nom + ' : étiquette SIEOL sur les 4 brebis qui ont un n° SIEOL (pas sur les n°00059 et n°00777)');
  const champ = await p.evaluate(() => ({ ph: document.getElementById('scan-open').placeholder, err: !!document.getElementById('scan-open-err'), titre: pageTitle.textContent }));
  eq(champ, { ph: 'Scanner ou saisir un n°', err: true, titre: 'Brebis (6)' }, nom + ' : champ, ids conservés, titre');

  // ---- 2. recherche par chaque type de numéro (correspondance partielle, sans espaces ni casse)
  const eidA = await p.evaluate(() => EID(8, 133));
  const officielA = eidA.slice(-11);
  for (const [q, att, lib] of [['8133', ['8133'], 'n° court'], ['258133', ['8133'], 'n° long'], [officielA, ['8133'], 'n° officiel (11 chiffres)'], ['00059', ['n°00059'], 'n° d\'ordre'],
    [eidA, ['8133'], 'EID complet'], [eidA.replace(/(\d{3})(\d{3})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4 $5'), ['8133'], 'EID complet avec espaces'], [' 81 33 ', ['8133'], 'espaces']]) {
    await taper(p, q);
    eq(await lignes(p, bureau), att, nom + ' : recherche par ' + lib + ' « ' + q + ' »');
  }
  await taper(p, '9152'); eq(await lignes(p, bureau), ['9152'], nom + ' : n° court 9152');
  await taper(p, '59');                      // partielle : n°00059 (n° d'ordre) et 259152 (n° long de la 9152)
  eq(await lignes(p, bureau), tout.filter(x => ['9152', 'n°00059'].includes(x)), nom + ' : correspondance partielle « 59 », ordre conservé');
  await taper(p, '');
  eq(await lignes(p, bureau), tout, nom + ' : champ vidé -> liste complète, même tri');
  console.log('OK 1-2 ' + nom + ' : n° court en gras + SIEOL, tri, recherche par n° court / long / officiel / d\'ordre / EID, partielle, espaces.');

  // ---- 3. filtre en direct à la frappe, le champ garde le focus, ligne de compte
  await p.click('#scan-open'); await p.keyboard.type('81');
  const live = await p.evaluate(() => ({ actif: document.activeElement && document.activeElement.id, compte: document.getElementById('brebis-compte').textContent, nb: document.querySelectorAll('#brebis-liste .al-ligne, #brebis-liste .list-table-row').length }));
  eq(live, { actif: 'scan-open', compte: '1 brebis sur 6', nb: 1 }, nom + ' : filtre en direct, focus conservé, compte');
  await p.keyboard.type('33'); check((await lignes(p, bureau)).length === 1, nom + ' : frappe suivante');
  check(await p.evaluate(() => currentView === 'list'), nom + ' : la frappe n\'ouvre jamais de fiche');
  await taper(p, ''); check(await p.evaluate(() => /Tape un n°|^$/.test(document.getElementById('brebis-compte').textContent) || document.getElementById('brebis-compte').classList.contains('hidden')), nom + ' : ligne de compte effacée sans filtre');

  // ---- 4. aucun résultat
  await taper(p, '99999');
  eq(await lignes(p, bureau), [], nom + ' : aucune ligne');
  eq(await vide(p), 'Aucune brebis ne correspond à « 99999 ».', nom + ' : message « aucun résultat »');
  console.log('OK 3-4 ' + nom + ' : filtre en direct, focus, compte, aucun résultat.');

  // ---- 5. collision : même n° d'ordre -> les deux listés, Entrée n'ouvre rien
  await taper(p, '00777');
  eq(await lignes(p, bureau), ['777', 'n°00777'].sort((a, b) => tout.indexOf(a) - tout.indexOf(b)), nom + ' : collision, les deux animaux sont listés');
  await entree(p, '00777');
  const col = await p.evaluate(() => ({ vue: currentView, msg: document.getElementById('scan-open-err').textContent, visible: !document.getElementById('scan-open-err').classList.contains('hidden'), nb: document.querySelectorAll('#brebis-liste .al-ligne, #brebis-liste .list-table-row').length }));
  check(col.vue === 'list' && col.visible && /2 animaux correspondent/.test(col.msg) && col.nb === 2, nom + ' : Entrée sur un n° ambigu : aucune ouverture, message, liste sur les 2 candidats : ' + JSON.stringify(col));
  eq(await bips(p), AMBIGU, nom + ' : bip ambigu');
  console.log('OK 5 ' + nom + ' : collision (même n° d\'ordre) : tous listés, jamais d\'ouverture automatique.');

  // ---- 6. scan / Entrée : unique -> fiche, EID complet -> fiche, introuvable -> bip raté
  await entree(p, '99999');
  check(await p.evaluate(() => currentView === 'list' && /Aucune brebis trouvée pour « 99999 »/.test(document.getElementById('scan-open-err').textContent)), nom + ' : introuvable : message, on reste sur la liste');
  eq(await bips(p), B, nom + ' : bip « raté »');
  await p.evaluate(() => render('list'));
  await entree(p, '8133');
  eq(await p.evaluate(() => [currentView, DB.brebis.find(s => s.id === 'A') && document.getElementById('app').textContent.includes('8133')]), ['detail', true], nom + ' : Entrée sur un n° à un seul résultat : la fiche s\'ouvre');
  eq(await bips(p), A, nom + ' : bip « trouvé »');
  await p.evaluate(() => render('list'));
  await entree(p, await p.evaluate(() => EID(6, 777)));
  check(await p.evaluate(() => currentView === 'detail' && document.getElementById('app').textContent.includes('00777')), nom + ' : scan d\'un EID complet : la fiche de la bonne brebis (malgré la collision d\'ordre)');
  console.log('OK 6 ' + nom + ' : scan / Entrée (unique, EID complet, introuvable) et bips.');

  // ---- 7. aucune écriture
  check(await p.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), nom + ' : aucune écriture, DB identique');

  // ---- 8. liste vide
  await p.evaluate(jeu, true); await p.evaluate(() => render('list'));
  const v = await p.evaluate(() => ({ msg: document.getElementById('app').textContent.includes('Aucune brebis active pour l\'instant'), champ: !!document.getElementById('scan-open'), liste: !!document.querySelector('#brebis-liste') }));
  eq(v, { msg: true, champ: true, liste: false }, nom + ' : liste vide : message, champ présent, pas de liste');
  await taper(p, '123'); await entree(p, '123');
  check(await p.evaluate(() => currentView === 'list'), nom + ' : liste vide : saisie et Entrée sans erreur');
  console.log('OK 8 ' + nom + ' : liste vide.');
  await p.context().close();
}
await browser.close();
console.log('\nTOUS LES TESTS DE LA RECHERCHE BREBIS SONT PASSÉS.');
