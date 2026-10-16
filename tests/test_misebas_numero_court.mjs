/* Agneaux nés dans l'élevage : à la mise bas, on tape seulement les 5 derniers chiffres de la boucle (ex. 61001) ou le numéro national (162991 61001) et l'EID complet est reconstitué
   (« 2500 » + indicatif de marquage + n° individuel). Toute autre saisie (EID bippé de 15 chiffres, saisie libre) reste telle quelle. Sans indicatif à 6 chiffres : erreur claire, rien de deviné.
   Le chiffre d'année du n° est comparé à la date de naissance : ALERTE seulement, jamais un blocage. Couvre la fonction commune (resoudreEidAgneau), la saisie rapide MOBILE et PC, et la fiche brebis.
   Jeu synthétique, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

async function ouvrir(desktop) {
  const ctx = await browser.newContext({ viewport: desktop ? { width: 1500, height: 1200 } : { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
  if (desktop) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; return true; };
    const eid = (n) => '250016299' + '9' + 3 + String(n).padStart(5, '0');
    const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    DB.exploitation.indicatifMarquage = '162991';
    DB.brebis = [fiche(eid(101)), fiche(eid(102)), fiche(eid(103))];
    DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  });
  return page;
}
const EXISTANTE = '250016299' + '9' + 3 + '00101';

// ================================================================ 1. la fonction commune
{
  const page = await ouvrir(false);
  const r = await page.evaluate(() => {
    const f = (v, d) => resoudreEidAgneau(v, d || '2026-10-02');
    const sans = (() => { const sauve = DB.exploitation.indicatifMarquage; DB.exploitation.indicatifMarquage = ''; const x = f('61001'); DB.exploitation.indicatifMarquage = sauve; return x; })();
    const repli = (() => { const sauve = DB.exploitation.indicatifMarquage; DB.exploitation.indicatifMarquage = ''; DB.exploitation.prefixeEid = '162991'; const x = f('61001'); DB.exploitation.indicatifMarquage = sauve; DB.exploitation.prefixeEid = ''; return x; })();
    const court = (() => { const sauve = DB.exploitation.indicatifMarquage; DB.exploitation.indicatifMarquage = '1629'; const x = f('61001'); DB.exploitation.indicatifMarquage = sauve; return x; })();
    return { cinq: f('61001'), espaces: f('162991 61001'), onze: f('16299161001'), annee: f('71001'), bippe: f('250016299161001'), libre: f('ABC12'), quatre: f('6100'), vide: f(''), sans, repli, court, ageNaissance: anneeNaissance(f('61001').eid) };
  });
  eq(r.cinq.eid, '250016299161001', '5 chiffres : EID complet reconstitué (2500 + 162991 + 61001)');
  check(r.cinq.auto && r.cinq.national === '162991 61001' && !r.cinq.alerte && !r.cinq.erreur, 'n° national affiché, aucune alerte quand le chiffre d\'année colle à la date : ' + JSON.stringify(r.cinq));
  eq(r.espaces.eid, '250016299161001', 'n° national avec espace (162991 61001)');
  eq(r.onze.eid, '250016299161001', 'n° national sans espace (11 chiffres)');
  check(r.annee.eid === '250016299171001' && /chiffre d'année du n° \(7\).*2026/.test(r.annee.alerte) && !r.annee.erreur, 'chiffre d\'année différent : ALERTE seulement (n° gardé) : ' + JSON.stringify(r.annee));
  check(r.bippe.eid === '250016299161001' && !r.bippe.auto, 'EID bippé de 15 chiffres : inchangé');
  check(r.libre.eid === 'ABC12' && !r.libre.auto && r.quatre.eid === '6100' && !r.quatre.auto, 'saisie libre ou 4 chiffres : gardée telle quelle');
  check(r.vide.eid === '' && !r.vide.auto, 'vide : rien');
  check(r.sans.erreur && /Paramètres › Exploitation/.test(r.sans.erreur) && r.sans.eid === '61001', 'sans indicatif : erreur claire, rien de deviné : ' + JSON.stringify(r.sans));
  check(r.repli.eid === '250016299161001', 'repli sur le préfixe EID s\'il n\'y a pas d\'indicatif de marquage');
  check(r.court.erreur, 'indicatif incomplet (4 chiffres) : erreur, rien de deviné');
  eq(r.ageNaissance, 2026, 'l\'année de naissance lue dans l\'EID reconstitué est celle de la mise bas');
  console.log('OK 1 fonction commune : 5 chiffres, n° national, EID bippé inchangé, saisie libre inchangée, indicatif absent = erreur, alerte d\'année sans blocage.');
  await page.context().close();
}

// ================================================================ 2. saisie rapide, MOBILE puis PC (même logique, deux gabarits)
for (const desktop of [false, true]) {
  const nom = desktop ? 'PC' : 'MOBILE';
  const page = await ouvrir(desktop);
  const E3 = n => '250016299' + '9' + 3 + String(n).padStart(5, '0');
  await page.evaluate(() => { resetMisebasRapideSession(); render('misebas-rapide'); });
  await page.fill('#scan-misebas', E3(101).slice(-5));
  await page.press('#scan-misebas', 'Enter');
  await page.waitForSelector('#lamb-list-rapide');
  const sexe = async (i, v) => page.click(`.sexe-opt-rapide[data-id="${i}"][data-val="${v}"]`);
  const aper = async i => page.evaluate(i => ({ texte: document.querySelector(`.eid-preview-rapide[data-id="${i}"]`).textContent, couleur: document.querySelector(`.eid-preview-rapide[data-id="${i}"]`).style.color, pastille: (document.querySelector(`[data-pastille="${i}"]`) || {}).textContent }), i);
  check(await page.evaluate(() => /71001/.test(document.querySelector('.eid-input-rapide').placeholder)), nom + ' : le champ indique qu\'on peut taper le n° (ex. 71001)');

  // agneau 1 : 5 chiffres (chiffre d'année 6 = 2026) ; agneau 2 : n° national avec espace
  await sexe(0, 'Mâle');
  await page.fill('.eid-input-rapide[data-id="0"]', '61001');
  let a = await aper(0);
  check(a.texte === "Né dans l'élevage : 162991 61001" && (desktop || a.pastille === 'N° complété'), nom + ' : aperçu « Né dans l\'élevage : 162991 61001 »' + (desktop ? '' : ' + pastille « N° complété »') + ' : ' + JSON.stringify(a));
  await page.click('#add-lamb-rapide');
  await sexe(1, 'Femelle');
  await page.fill('.eid-input-rapide[data-id="1"]', '162991 61002');
  // doublon dans la même portée
  await page.fill('.eid-input-rapide[data-id="1"]', '61001');
  await page.click('#btn-valider-misebas');
  check(/même EID/.test(await page.evaluate(() => document.getElementById('err').textContent)), nom + ' : deux agneaux avec le même n° dans la portée : refusé');
  // alerte de chiffre d'année : visible, jamais bloquante
  await page.fill('.eid-input-rapide[data-id="1"]', '71002');
  a = await aper(1);
  check(/chiffre d'année du n° \(7\)/.test(a.texte) && /ambre/.test(a.couleur || 'var(--ch-ambre-texte)'), nom + ' : alerte discrète sur le chiffre d\'année : ' + JSON.stringify(a));
  // la date suit : en la passant à 2027 l'alerte disparaît pour 71002 et apparaît pour 61001
  await page.fill('#f-date-rapide', '2027-01-10'); await page.dispatchEvent('#f-date-rapide', 'change');
  eq(await page.evaluate(() => [/chiffre d'année/.test(document.querySelector('.eid-preview-rapide[data-id="0"]').textContent), /chiffre d'année/.test(document.querySelector('.eid-preview-rapide[data-id="1"]').textContent)]), [true, false], nom + ' : l\'alerte suit la date de naissance');
  await page.fill('#f-date-rapide', '2026-10-02'); await page.dispatchEvent('#f-date-rapide', 'change');
  await page.fill('.eid-input-rapide[data-id="1"]', '162991 61002');
  await page.click('#btn-valider-misebas');
  const ag = await page.evaluate(() => DB.brebis.find(b => b.id.endsWith('00101')).agnelages);
  check(ag.length === 1 && ag[0].lambs.map(l => l.eid).join() === '250016299161001,250016299161002', nom + ' : EID complets enregistrés : ' + JSON.stringify(ag.map(x => x.lambs.map(l => l.eid))));
  const mouv = await page.evaluate(() => JSON.stringify(DB.brebis.find(b => b.id.endsWith('00101')).agnelages[0].lambs.map(l => (l.mouvements || []).length + ':' + (l.sanitaire || []).length)));
  check(/"\d+:1"/.test(mouv), nom + ' : Séléphérol toujours ajouté à chaque agneau vivant : ' + mouv);

  // l'EID reconstitué est unique sur toute la base : un second agneau avec le même n° est refusé
  await page.evaluate(() => { resetMisebasRapideSession(); render('misebas-rapide'); });
  await page.fill('#scan-misebas', E3(102).slice(-5)); await page.press('#scan-misebas', 'Enter');
  await page.waitForSelector('#lamb-list-rapide');
  await sexe(0, 'Mâle');
  await page.fill('.eid-input-rapide[data-id="0"]', '61001');
  check(/déjà|utilisé/i.test((await aper(0)).texte), nom + ' : n° déjà donné à un autre agneau : signalé dès la saisie');
  await page.click('#btn-valider-misebas');
  check(/déjà|utilisé/i.test(await page.evaluate(() => document.getElementById('err').textContent)) && (await page.evaluate(() => DB.brebis.find(b => b.id.endsWith('00102')).agnelages.length)) === 0, nom + ' : et refusé à l\'enregistrement');

  // un EID bippé (15 chiffres) reste accepté tel quel, et sans indicatif le n° court est refusé avec un message clair
  await page.fill('.eid-input-rapide[data-id="0"]', '250016299163333');
  a = await aper(0);
  check(a.texte === "Numéro d'ordre : n°63333" && (desktop || a.pastille === 'EID bippé'), nom + ' : EID bippé de 15 chiffres : comportement inchangé : ' + JSON.stringify(a));
  await page.evaluate(() => { DB.exploitation.indicatifMarquage = ''; });
  await page.fill('.eid-input-rapide[data-id="0"]', '63333');
  check(/Paramètres › Exploitation/.test((await aper(0)).texte), nom + ' : sans indicatif : message clair sous le champ');
  await page.click('#btn-valider-misebas');
  check(/Paramètres › Exploitation/.test(await page.evaluate(() => document.getElementById('err').textContent)) && (await page.evaluate(() => DB.brebis.find(b => b.id.endsWith('00102')).agnelages.length)) === 0, nom + ' : sans indicatif : enregistrement bloqué, rien de deviné');
  console.log('OK 2 ' + nom + ' : 5 chiffres et n° national complétés, doublon et EID déjà pris refusés, alerte d\'année qui suit la date, EID bippé inchangé, indicatif absent bloquant.');
  await page.context().close();
}

// ================================================================ 3. fiche brebis (Nouvel agnelage), mobile
{
  const page = await ouvrir(false);
  await page.evaluate(() => { currentSheepId = DB.brebis[2].id; editContext = null; render('add-agnelage'); });
  await page.waitForSelector('#btn-save-agnelage');
  await page.click('.sexe-opt[data-id="1"][data-val="Mâle"]');
  check(await page.evaluate(() => /71001/.test(document.querySelector('.eid-input').placeholder)), 'fiche brebis : le champ indique qu\'on peut taper le n°');
  await page.fill('.eid-input[data-id="1"]', '61005');
  eq(await page.evaluate(() => document.querySelector('.eid-preview[data-id="1"]').textContent), "Né dans l'élevage : 162991 61005", 'fiche brebis : aperçu du n° complété');
  await page.click('#btn-save-agnelage');
  const eids = await page.evaluate(() => DB.brebis[2].agnelages.map(a => a.lambs.map(l => l.eid)));
  eq(eids, [['250016299161005']], 'fiche brebis : EID complet enregistré');
  console.log('OK 3 fiche brebis : même règle que la saisie rapide.');
  await page.context().close();
}
await browser.close();
console.log('OK test_misebas_numero_court');
