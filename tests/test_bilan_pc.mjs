/* Page PC du Bilan de reproduction (bilanReproductionDesktopHtml), affichée seulement
   quand isDesktopMode() (simulé par window.electronAPI.isDesktop). Jeu synthétique qui
   reproduit le bilan externe du 23/09 : on relit les chiffres DANS le DOM (KPI, tableau
   par groupe, courbe, portées, millésimes, mouvements), le sélecteur de campagne, les
   alertes, les cartes de lots, le bouton « PDF bilan par âge » ; le mobile garde son
   tableau compact (HTML identique à bilanReproductionHtml). Aucune écriture (0 saveData).
   Aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, EXPORT_CORRIGE, exportPresent } from './lib/config.mjs';
import { readFileSync } from 'fs';

const browser = await chromium.launch(LAUNCH);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

async function ouvrir(desktop) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  if (desktop) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    DB = migrateData({});
    window.__saves = 0;
    const o = saveData; saveData = function (...a) { window.__saves++; return o.apply(this, a); };
    window.eid = (c, n) => '2500162999' + c + String(n).padStart(4, '0');
    window.fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
    // Reproduit le bilan externe du 23/09 (voir test_bilan_calculs) + courbe en 10 semaines
    window.jeu = () => {
      const plans = {
        adultes: { n: 296, doubles: 59, mortNes: 8, femelles: 175, males: 172, mortsF: 13, mortsM: 12, vides: 30, chiffres: [3, 4], entree: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }] },
        antenaises: { n: 67, doubles: 5, mortNes: 6, femelles: 38, males: 28, mortsF: 7, mortsM: 6, vides: 8, chiffres: [5], entree: [{ type: 'Entrée', cause: 'Renouvellement (agnelle devenue brebis)', date: '2025-10-01' }] }
      };
      const poids = [12, 38, 71, 84, 63, 41, 26, 15, 9, 4];
      const jours = []; poids.forEach((w, i) => { for (let k = 0; k < w; k++) jours.push(new Date(Date.UTC(2026, 0, 5 + i * 7 + (k % 7))).toISOString().slice(0, 10)); });
      const brebis = []; let c = 0, ji = 0;
      for (const nom of ['adultes', 'antenaises']) {
        const p = plans[nom];
        const sexes = [].concat(Array(p.mortNes).fill('Mort-né'), Array(p.femelles).fill('Femelle'), Array(p.males).fill('Mâle'));
        let mF = p.mortsF, mM = p.mortsM;
        const lambs = sexes.map(s => { const l = { sexe: s }; if (s === 'Femelle' && mF > 0) { l.statutFinal = 'mort'; l.mouvements = [{ type: 'Mort', date: '2026-02-20' }]; mF--; } else if (s === 'Mâle' && mM > 0) { l.statutFinal = 'mort'; l.mouvements = [{ type: 'Mort', date: '2026-02-21' }]; mM--; } return l; });
        let k = 0;
        for (let i = 0; i < p.n; i++) { const nb = i < p.doubles ? 2 : 1; brebis.push(fiche(eid(p.chiffres[i % p.chiffres.length], ++c), { mouvements: p.entree, agnelages: [{ date: jours[ji++], campagne: 2025, lambs: lambs.slice(k, k + nb) }] })); k += nb; }
        for (let i = 0; i < p.vides; i++) brebis.push(fiche(eid(p.chiffres[i % p.chiffres.length], ++c), { mouvements: p.entree }));
      }
      DB.campagneDebut = 2025; DB.campagneDateDemarrage = '2025-10-01'; DB.campagneInitialisee = true;
      DB.brebis = brebis; DB.beliers = []; DB.agnelles = []; DB.lots = [];
      DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
      DB.exploitation = Object.assign({}, DB.exploitation);
      window.__eidsBrebis = brebis.map(b => b.eid);
    };
    window.ouvrirBilan = () => { bilanCampagneTab = 'reproduction'; render('bilan-campagne'); };
  });
  return page;
}
const texte = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, sel);
// Valeurs d'une ligne d'un tableau (th/td après le libellé), repérée par son libellé.
const ligneTable = (page, tableIdx, libelle) => page.evaluate(({ tableIdx, libelle }) => {
  const t = document.querySelectorAll('.brd-t')[tableIdx];
  const tr = [...t.querySelectorAll('tr')].find(r => r.cells[0] && r.cells[0].textContent.replace(/\s+/g, ' ').trim().startsWith(libelle));
  return tr ? [...tr.cells].slice(1).map(c => c.textContent.replace(/\s+/g, ' ').trim()) : null;
}, { tableIdx, libelle });

// ================================================================ 1. page PC
const page = await ouvrir(true);
await page.evaluate(() => { jeu(); ouvrirBilan(); });
await page.waitForSelector('.brd');
check((await page.evaluate(() => document.querySelectorAll('.brd-kpi').length)) === 4, '4 KPI exactement (le KPI « portées doubles » est supprimé)');
const labels = await page.evaluate(() => [...document.querySelectorAll('.brd-kpi-l')].map(e => e.textContent.trim()));
check(labels.join('|') === 'Mises bas|Prolificité|Mortinatalité|Mortalité après naissance', 'libellés des KPI : ' + labels);
const kv = await page.evaluate(() => [...document.querySelectorAll('.brd-kpi-v')].map(e => e.textContent.trim()));
check(kv.join('|') === '363|1,18|3,3 %|9,2 %', 'valeurs des KPI : ' + kv);
check(/427 agneaux nés/.test(await texte(page, '.brd-kpi')) && /14 morts-nés/.test(await texte(page, '.brd-kpis')) && /38 sur 413 nés vivants/.test(await texte(page, '.brd-kpis')), 'sous-titres des KPI (427 nés, 14 morts-nés, 38 sur 413)');
check(!/doubles/i.test(await texte(page, '.brd-kpis')), 'aucune mention « portées doubles » dans les KPI');
const sub = await texte(page, '.brd-sub');
check(sub === 'Campagne 2026 · du 01/10/2025 au 30/09/2026 · troupeau entier', 'sous-titre : ' + sub);
const att = { 'Mises bas': ['296', '67', '363'], 'Portées simples': ['237', '62', '299'], 'Portées doubles': ['59', '5', '64'], 'Portées triples': ['0', '0', '0'], 'Agneaux nés': ['355', '72', '427'], 'Femelles': ['175', '38', '213'], 'Mâles': ['172', '28', '200'], 'Morts-nés': ['8', '6', '14'], 'Morts après naissance': ['25', '13', '38'], 'Prolificité': ['1,20', '1,07', '1,18'], 'Mortalité totale': ['9,30 %', '26,39 %', '12,18 %'], 'Brebis présentes': ['326', '75', '401'] };
for (const [lib, v] of Object.entries(att)) {
  const got = await ligneTable(page, 0, lib);
  check(got && got.join('|') === v.join('|'), 'tableau par groupe « ' + lib + ' » attendu ' + v + ', obtenu ' + got);
}
check(/Antenaises\s*2025/.test(await texte(page, '.brd-t th.ant')) && /millésime le plus jeune/.test(await texte(page, '.brd-note')), 'en-tête Antenaises avec son millésime + règle expliquée');
console.log('OK 1 page PC : 4 KPI (363 / 1,18 / 3,3 % / 9,2 %), tableau par groupe identique au bilan du 23/09 (296+67, 299/64/0, 427, 38, 1,20/1,07/1,18, 9,30/26,39/12,18 %), titre « du 01/10/2025 au 30/09/2026 ».');

// ---- courbe, portées, millésimes
const courbe = await page.evaluate(() => ({
  barres: [...document.querySelectorAll('.brd-svg rect')].map(r => r.querySelector('title').textContent.split(' : ')[1].split(' ')[0]),
  pic: [...document.querySelectorAll('.brd-svg rect')].filter(r => r.getAttribute('fill-opacity') === '1').length,
  semaines: [...document.querySelectorAll('.brd-svg text')].map(t => t.textContent).filter(t => /^S\d+$/.test(t)),
  note: document.querySelectorAll('.brd-note')[1].textContent.replace(/\s+/g, ' ')
}));
check(courbe.barres.join(',') === '12,38,71,84,63,41,26,15,9,4' && courbe.pic === 1 && courbe.semaines.join(',') === 'S1,S2,S3,S4,S5,S6,S7,S8,S9,S10', 'courbe SVG : 10 semaines, une seule barre « pic » : ' + JSON.stringify(courbe));
check(/pic en S4 : 84/.test(courbe.note) && /S1 = semaine du 05-01-2026/.test(courbe.note), 'légende de la courbe : ' + courbe.note);
const portees = await page.evaluate(() => [...document.querySelectorAll('.brd-porteerow')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));
check(portees.join('|') === 'Simples299|Doubles64|Triples0', 'répartition des portées (nombres, sans pourcentage) : ' + portees);
const mill = await page.evaluate(() => [...document.querySelectorAll('.brd-t')[1].querySelectorAll('tr')].slice(1).map(r => [...r.cells].map(c => c.textContent.replace(/\s+/g, ' ').trim())));
check(mill.length === 3 && mill[0][0].startsWith('2025') && /antenaises/.test(mill[0][0]) && mill[0][1] === '75' && mill[0][2] === '67' && mill[1][0] === '2024' && mill[1].slice(1, 3).join() === '163,148' && mill[2][0] === '2023' && mill[2].slice(1, 3).join() === '163,148', 'détail par millésime (le plus jeune d\'abord, repéré antenaises) : ' + JSON.stringify(mill));
console.log('OK 1b courbe (12,38,71,84,63,41,26,15,9,4 ; pic S4 en vert plein), portées 299/64/0 sans pourcentage, détail par millésime (2025 antenaises en tête).');

// ---- mouvements
const mvB = await ligneTable(page, 2, 'Entrées');
check(mvB && mvB.join('|') === '0|75|0|75', 'mouvements brebis : entrées adultes 0, antenaises 75 (les 75 présentes ont été renouvelées le 01/10/2025), agnelles 0 : ' + mvB);
const renouvB = await ligneTable(page, 2, 'Renouvelées');
check(renouvB && renouvB.join('|') === '0|75|0|75', 'dont renouvelées : ' + renouvB);
const mvA = await page.evaluate(() => [...document.querySelectorAll('.brd-t')[3].querySelectorAll('tr')].map(r => [...r.cells].map(c => c.textContent.replace(/\s+/g, ' ').trim())));
const nes = mvA.find(r => r[0] === 'Nés vivants');
check(nes && nes.slice(1).join('|') === '175|172|38|28|413', 'mouvements agneaux : nés vivants 175 | 172 | 38 | 28 = 413 : ' + nes);
console.log('OK 1c mouvements des brebis et des agneaux (nés vivants 413).');
check((await page.evaluate(() => window.__saves)) === 0, 'aucun saveData pendant l\'affichage');

// ================================================================ 2. mobile inchangé
const mobile = await ouvrir(false);
await mobile.evaluate(() => { jeu(); ouvrirBilan(); });
await mobile.waitForSelector('#btn-export-bilan-age-pdf');
const mob = await mobile.evaluate(() => ({ brd: !!document.querySelector('.brd'), egal: (() => { const d = document.createElement('div'); d.innerHTML = bilanReproductionHtml(); return document.getElementById('app').innerHTML.includes(d.innerHTML); })(), th: [...document.querySelectorAll('table th')].map(t => t.textContent.trim()).join('|') }));
check(!mob.brd && mob.egal && /Indicateur\|Antenaises\|Brebis/.test(mob.th), 'mobile : tableau compact inchangé, aucune page PC : ' + JSON.stringify(mob));
console.log('OK 2 mobile : tableau compact inchangé (HTML identique à bilanReproductionHtml), pas de page PC.');
await mobile.context().close();

// ================================================================ 3. sélecteur de campagne, lots
await page.evaluate(() => {
  jeu();
  // une campagne précédente (2024 -> « campagne 2025 ») avec quelques mises bas, plus deux lots (IA et éponge)
  DB.brebis.slice(0, 5).forEach(b => b.agnelages.push({ date: '2025-02-10', campagne: 2024, lambs: [{ sexe: 'Mâle' }, { sexe: 'Femelle' }] }));
  const membres = DB.brebis.slice(0, 20).map(b => b.eid);
  DB.lots = [
    { id: 'lot-ep', type: 'reproduction', mode: 'EP', cible: 'Brebis', nom: 'Lot éponge test', membres, dateCreation: '2025-08-01', dateEvenement: '2025-08-01' },
    { id: 'lot-ia', type: 'reproduction', mode: 'IA', cible: 'Brebis', nom: 'Lot IA test', membres, dateCreation: '2025-08-10', dateEvenement: '2025-08-10' }
  ];
  ouvrirBilan();
});
await page.waitForSelector('#brd-campagne-select');
const opts = await page.evaluate(() => [...document.querySelectorAll('#brd-campagne-select option')].map(o => o.textContent.trim()));
check(opts.join('|') === 'Campagne 2026 (en cours)|Campagne 2025', 'sélecteur de campagne : ' + opts);
check(await page.evaluate(() => !!document.querySelector('.lot-eponge-card') && !!document.querySelector('.lot-ia-card')), 'cartes Lots IA et Éponge présentes sur la page PC (campagne en cours)');
check(await page.evaluate(() => /détail par millésime ci-dessus/.test(document.querySelector('.brd').textContent) && !/tableau ci-dessous/.test(document.querySelector('.brd').textContent)), 'note des lots adaptée à la page PC');
await page.click('.lot-eponge-head');
check(await page.evaluate(() => !document.querySelector('.lot-eponge-body').classList.contains('hidden')), 'la carte de lot se déplie au clic');
await page.selectOption('#brd-campagne-select', '2024');
await page.waitForFunction(() => /Campagne 2025/.test(document.querySelector('.brd-sub').textContent));
const sub2 = await texte(page, '.brd-sub');
check(sub2 === 'Campagne 2025 · du 01/10/2024 au 30/09/2025 · troupeau entier · campagne terminée', 'campagne passée : ' + sub2);
const kv2 = await page.evaluate(() => [...document.querySelectorAll('.brd-kpi-v')].map(e => e.textContent.trim()));
check(kv2[0] === '5' && kv2[1] === '2,00', 'campagne passée : 5 mises bas, prolificité 2,00 : ' + kv2);
check(await page.evaluate(() => !document.querySelector('.lot-eponge-card') && !document.querySelector('.brd-alert.info strong')), 'campagne passée : ni cartes de lots ni taux de réussite en cours');
// la campagne courante affiche le comparatif vs la précédente
await page.selectOption('#brd-campagne-select', '2025');
await page.waitForFunction(() => /Campagne 2026/.test(document.querySelector('.brd-sub').textContent));
const delta = await texte(page, '.brd-kpis');
check(/vs campagne 2025/.test(delta) && /\+358/.test(delta) && /−0,82/.test(delta), 'comparatif vs campagne précédente (mises bas +358, prolificité −0,82) : ' + delta);
console.log('OK 3 sélecteur de campagne (2026 en cours / 2025 terminée), cartes de lots IA/Éponge dépliables, comparatif « vs campagne 2025 » sur les KPI.');

// ================================================================ 3b. sélecteur toujours visible, campagne sans donnée
await page.evaluate(() => { jeu(); bilanReproductionCampagneAffichee = null; ouvrirBilan(); });   // aucune donnée avant la campagne en cours
await page.waitForSelector('#brd-campagne-select');
const opts2 = await page.evaluate(() => [...document.querySelectorAll('#brd-campagne-select option')].map(o => o.textContent.trim()));
check(opts2.join('|') === 'Campagne 2026 (en cours)|Campagne 2025', 'sélecteur toujours visible, au minimum la campagne en cours et la précédente, même sans donnée : ' + opts2);
check(await page.evaluate(() => !/Aucune mise bas enregistrée/.test(document.querySelector('.brd').textContent)), 'campagne en cours avec données : pas de bandeau « aucune mise bas »');
await page.selectOption('#brd-campagne-select', '2024');
await page.waitForFunction(() => /Campagne 2025/.test(document.querySelector('.brd-sub').textContent));
const vide = await page.evaluate(() => ({ bandeau: document.querySelector('.brd-alert.info > span').textContent.replace(/\s+/g, ' ').trim(), bouton: document.getElementById('btn-saisie-resume') ? document.getElementById('btn-saisie-resume').textContent.trim() : null, sel: document.getElementById('brd-campagne-select').value, kv: [...document.querySelectorAll('.brd-kpi-v')].map(e => e.textContent.trim()).join('|'), note: !!document.querySelector('.brd-vide') }));
check(vide.bandeau === 'Aucune mise bas enregistrée pour la campagne 2025 — résumé de campagne non saisi.' && vide.bouton === 'Saisir le résumé de la campagne 2025' && vide.sel === '2024' && vide.kv === '0|—|—|—' && vide.note, 'campagne précédente sans donnée : sélectionnable, bandeau « aucune mise bas enregistrée » + « résumé non saisi » : ' + JSON.stringify(vide));
await page.evaluate(() => { DB.resumesCampagne = { 2024: { source: 'test' } }; ouvrirBilan(); });
const saisi = await page.evaluate(() => document.querySelector('.brd-alert.info > span').textContent.replace(/\s+/g, ' ').trim());
check(saisi === 'Aucune mise bas enregistrée pour la campagne 2025.', 'résumé saisi : la mention « résumé non saisi » disparaît : ' + saisi);
await page.evaluate(() => { delete DB.resumesCampagne; DB.brebis = []; bilanReproductionCampagneAffichee = null; ouvrirBilan(); });
check(await page.evaluate(() => document.querySelectorAll('#brd-campagne-select option').length) === 2 && await page.evaluate(() => /Aucune mise bas enregistrée pour la campagne 2026 — résumé de campagne non saisi\./.test(document.querySelector('.brd').textContent)), 'troupeau vide : sélecteur présent (2 campagnes) et bandeau pour la campagne en cours');
console.log('OK 3b sélecteur toujours visible (campagne en cours + précédente même sans donnée), campagne vide sélectionnable avec « aucune mise bas enregistrée — résumé de campagne non saisi », mention retirée quand un résumé existe.');

// ================================================================ 4. alertes
await page.evaluate(() => {
  jeu();
  // aucune agnelle entrée à la bascule : le millésime le plus jeune garde un renouvellement ancien -> avertissement
  DB.brebis.filter(b => b.eid.charAt(10) === '5').forEach(b => { b.mouvements = [{ type: 'Entrée', cause: 'Renouvellement', date: '2025-09-01' }]; });
  // une brebis entrée après le démarrage qui a mis bas, un agneau sans sexe, une mise bas sans date
  DB.brebis.push(fiche(eid(3, 9001), { mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2025-12-01' }], agnelages: [{ date: '2026-03-01', campagne: 2025, lambs: [{ sexe: 'Femelle' }] }] }));
  DB.brebis.push(fiche(eid(3, 9002), { agnelages: [{ date: null, campagne: 2025, lambs: [{}] }] }));
  ouvrirBilan();
});
await page.waitForSelector('.brd');
const al = await page.evaluate(() => ({ warn: !!document.querySelector('.brd-alert.warn') && /pas de renouvellement/.test(document.querySelector('.brd-alert.warn').textContent), info: [...document.querySelectorAll('.brd-alert.info')].map(a => a.textContent.replace(/\s+/g, ' ')).join(' / '), err: document.querySelector('details.brd-alert.err') ? document.querySelector('details.brd-alert.err').textContent.replace(/\s+/g, ' ') : null }));
check(al.warn, 'avertissement « pas de renouvellement » affiché');
check(/1 mise bas de brebis absente de la population de départ \(entrées après le démarrage de la campagne\) est comptée dans les totaux, pas dans la fertilité/.test(al.info), 'brebis hors population de départ expliquée : ' + al.info);
check(al.err && /Agneau sans sexe valide/.test(al.err) && /Mise bas sans date/.test(al.err) && /rien n'a été corrigé/.test(al.err), 'points de données à vérifier listés, rien corrigé : ' + al.err);
const sx = await ligneTable(page, 0, 'Sexe non renseigné');
check(sx && sx[2] === '1', 'ligne « Sexe non renseigné » ajoutée au tableau : ' + sx);
console.log('OK 4 alertes : avertissement de renouvellement, hors population de départ, anomalies listées (rien corrigé), ligne « sexe non renseigné ».');

// ================================================================ 5. campagne vide + bouton PDF par âge + pureté
await page.evaluate(() => { DB.brebis = DB.brebis.slice(0, 5); DB.brebis.forEach(b => b.agnelages = []); DB.lots = []; ouvrirBilan(); });
await page.waitForSelector('.brd');
const kv3 = await page.evaluate(() => [...document.querySelectorAll('.brd-kpi-v')].map(e => e.textContent.trim()));
check(kv3.join('|') === '0|—|—|—' && /Aucune mise bas datée/.test(await texte(page, '.brd-vide')), 'campagne sans mise bas : 0 / — / — / — et message sur la courbe : ' + kv3);
await page.evaluate(() => { window.__pdf = 0; window.exportBilanAgeExactPdf = async () => { window.__pdf++; }; ouvrirBilan(); });
await page.waitForSelector('#btn-export-bilan-age-pdf');
await page.click('#btn-export-bilan-age-pdf');
await page.waitForFunction(() => window.__pdf === 1);
check(await page.evaluate(() => window.__saves) === 0, 'aucun saveData sur toute la session d\'affichage');
console.log('OK 5 campagne sans mise bas (0 / — / — / —, pas d\'erreur), bouton « PDF bilan par âge » branché, 0 saveData.');

// ================================================================ 6. export réel (lecture seule) : le sélecteur est visible
if (!exportPresent(EXPORT_CORRIGE)) console.log('SKIP : export corrigé absent');
else {
  const reel = await ouvrir(true);
  await reel.evaluate((d) => { DB = migrateData(JSON.parse(JSON.stringify(d))); window.__saves = 0; ouvrirBilan(); }, JSON.parse(readFileSync(EXPORT_CORRIGE, 'utf8')));
  await reel.waitForSelector('#brd-campagne-select');
  const o = await reel.evaluate(() => [...document.querySelectorAll('#brd-campagne-select option')].map(x => x.textContent.trim()));
  check(o.join('|') === 'Campagne 2027 (en cours)|Campagne 2026', 'export du 29/09 : sélecteur visible, campagne 2027 (en cours) et 2026 : ' + o);
  check(await reel.evaluate(() => /Aucune mise bas enregistrée pour la campagne 2027 — résumé de campagne non saisi\./.test(document.querySelector('.brd').textContent)), 'export du 29/09 : campagne 2027 sans mise bas -> bandeau');
  await reel.selectOption('#brd-campagne-select', '2025');
  await reel.waitForFunction(() => /Campagne 2026/.test(document.querySelector('.brd-sub').textContent));
  check(await reel.evaluate(() => /Aucune mise bas enregistrée pour la campagne 2026 — résumé de campagne non saisi\./.test(document.querySelector('.brd-alert.info').textContent) && window.__saves === 0), 'export du 29/09 : campagne 2026 sélectionnable, « aucune mise bas enregistrée — résumé non saisi », 0 saveData');
  console.log('OK 6 export du 29/09 : sélecteur visible (2027 en cours / 2026), campagne 2026 sans mise bas sélectionnable avec la mention « résumé de campagne non saisi ».');
  await reel.context().close();
}

await page.screenshot({ path: process.env.OVILOG_CAPTURE || '/dev/null' }).catch(() => {});
console.log('\nTOUS LES TESTS DE LA PAGE PC DU BILAN SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
await browser.close();
process.exit(0);
