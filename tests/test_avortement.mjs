/* Avortement noté à la mise bas (saisie rapide mobile, saisie PC, fiche brebis) : c'est LA mise bas de la campagne, ses avortons (nombre
   obligatoire) sont des mort-nés marqués avorton (agneaux nés, mort-nés « dont avortons », prolificité). Code Repro posé d'office, jamais
   demandé : au plus tard G max jours après l'IA / l'éponge du lot = IA (EP) ; au-delà = retour ; hors lot = MN. Question de traite obligatoire :
   oui = attendue à la traite (rien d'écrit) ; non = « Pas traite cette campagne », motif « Avortement » (retiré si la saisie est annulée).
   Modification : date et nombre seulement. saveData REMPLACÉ ; jeu synthétique (indicatif 000456). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

async function ouvrir(bureau) {
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1400, height: 1000 } : { width: 390, height: 844 } })).newPage();
  await page.clock.setFixedTime(new Date('2027-04-15T09:00:00'));
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(() => {
    DB = migrateData({}); saveData = () => true;
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
    window.E = n => '250000004569' + String(n).padStart(3, '0');
    const fiche = n => ({ id: 'b' + n, eid: E(n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
    DB.brebis = [1, 2, 3, 4, 5, 6].map(fiche); DB.beliers = []; DB.agnelles = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
    // lot IA du 20/10/2026 (brebis 1 à 4), lot éponge (brebis 5) ; brebis 6 hors lot
    DB.lots = [{ id: 'LIA', type: 'reproduction', nom: 'IA octobre', mode: 'IA', cible: 'Brebis', dateCreation: '2026-10-20', dateEvenement: '2026-10-20', campagneMisesBas: 2026, membres: [1, 2, 3, 4].map(E) },
      { id: 'LEP', type: 'reproduction', nom: 'Éponge octobre', mode: 'EP', cible: 'Brebis', dateCreation: '2026-10-04', dateEvenement: '2026-10-20', campagneMisesBas: 2026, membres: [E(5)] }];
    DB.brebis.forEach(b => { const n = +b.id.slice(1); if (n <= 4) b.modesRepro.push({ date: '2026-10-20', mode: 'IA', lotId: 'LIA', campagne: 2026 }); if (n === 5) b.modesRepro.push({ date: '2026-10-20', mode: 'EP', lotId: 'LEP', campagne: 2026 }); });
    window.J = j => new Date(Date.UTC(2026, 9, 20) + j * 86400000).toISOString().slice(0, 10);
  });
  return page;
}
const brebis = (p, n) => p.evaluate(n => JSON.parse(JSON.stringify(DB.brebis.find(b => b.id === 'b' + n))), n);
const erreur = p => p.evaluate(() => { const e = document.getElementById('err'); return e && !e.classList.contains('hidden') ? e.textContent : ''; });
const fixerDate = (p, sel, d) => p.evaluate(([sel, d]) => { const i = document.querySelector(sel); i.value = d; i.dispatchEvent(new Event('change')); }, [sel, d]);

async function avortementRapide(p, n, j, nb, traite) {
  await p.evaluate(() => { resetMisebasRapideSession(); render('misebas-rapide'); });
  await p.fill('#scan-misebas', await p.evaluate(n => E(n).slice(-5), n)); await p.press('#scan-misebas', 'Enter');
  await p.waitForSelector('#f-date-rapide');
  await p.click('.mb-mode-btn[data-val="avo"]');
  await fixerDate(p, '#f-date-rapide', await p.evaluate(j => J(j), j));
  if (nb !== null) await p.fill('#avo-nb', String(nb));
  if (traite !== null) await p.click(`.avo-traite-btn[data-val="${traite}"]`);
  await p.click('#btn-valider-misebas');
}

for (const bureau of [false, true]) {
  const nom = bureau ? 'PC' : 'mobile';
  const p = await ouvrir(bureau);
  // ================================================================ 1. code Repro posé d'office
  eq(await p.evaluate(() => [codeReproAvortement(DB.brebis[0], J(90)), codeReproAvortement(DB.brebis[0], J(152)), codeReproAvortement(DB.brebis[0], J(153)), codeReproAvortement(DB.brebis[4], J(60)), codeReproAvortement(DB.brebis[5], J(90))]),
    ['IA', 'IA', 'RE', 'EP', 'MN'], nom + ' : IA jusqu\'à G max, retour au-delà, EP pour une éponge, MN hors lot');

  // ================================================================ 2. saisie rapide : écran, contrôles, « pas traite »
  await p.evaluate(() => { resetMisebasRapideSession(); render('misebas-rapide'); });
  await p.fill('#scan-misebas', await p.evaluate(() => E(1).slice(-5))); await p.press('#scan-misebas', 'Enter');
  await p.waitForSelector('#f-date-rapide');
  await p.click('.mb-mode-btn[data-val="avo"]');
  eq(await p.evaluate(() => [[...document.querySelectorAll('.mb-partie-mb')].every(el => el.hidden && el.offsetParent === null), !!document.querySelector('#avo-bloc'), document.querySelectorAll('.avo-traite-btn.btn-primary').length]),
    [true, true, 0], nom + ' : avortement : agneaux et code Repro masqués, bloc avortement, aucune réponse de traite par défaut');
  await fixerDate(p, '#f-date-rapide', await p.evaluate(() => J(90)));
  check(/IA, posé d'office/.test(await p.evaluate(() => document.getElementById('avo-repro').textContent)), nom + ' : code Repro affiché, posé d\'office');
  await p.click('#btn-valider-misebas');
  check(/nombre d'avortons/.test(await erreur(p)), nom + ' : nombre d\'avortons obligatoire');
  await p.fill('#avo-nb', '2'); await p.click('#btn-valider-misebas');
  check(/sera-t-elle traite/.test(await erreur(p)), nom + ' : question de traite obligatoire');
  await p.click('.avo-traite-btn[data-val="non"]'); await p.click('#btn-valider-misebas');
  await p.waitForSelector('#mb-confirmation');
  check(/Avortement enregistré[\s\S]*Avortement · 2 avortons/.test(await p.evaluate(() => document.getElementById('mb-confirmation').textContent)), nom + ' : confirmation « Avortement · 2 avortons »');
  let b1 = await brebis(p, 1);
  eq([b1.agnelages.length, b1.agnelages[0].avortement, b1.agnelages[0].avortementTraite, b1.agnelages[0].codeRepro, b1.agnelages[0].campagne, b1.agnelages[0].lambs], [1, true, false, 'IA', 2026, [{ sexe: 'Mort-né', adopte: false, avorton: true }, { sexe: 'Mort-né', adopte: false, avorton: true }]],
    nom + ' : avortement enregistré (2 avortons mort-nés, IA réussie)');
  eq(await p.evaluate(() => [situationTraiteCampagne(DB.brebis[0]).code, situationTraiteCampagne(DB.brebis[0]).motif, DB.motifsNonTraite.includes('Avortement')]), ['pasTraite', 'Avortement', true], nom + ' : non = pas traite, motif Avortement (ajouté à la liste)');
  // annuler la saisie : l'avortement ET la marque qu'il a posée partent
  await p.click('#btn-annuler-derniere');
  b1 = await brebis(p, 1);
  eq([b1.agnelages.length, (b1.nonTraite || []).length], [0, 0], nom + ' : annuler la saisie retire l\'avortement et la marque « pas traite »');

  // ================================================================ 3. « traite » : attendue ; retour au-delà de G max
  await avortementRapide(p, 2, 155, 1, 'oui');
  const b2 = await brebis(p, 2);
  eq([b2.agnelages[0].codeRepro, b2.agnelages[0].avortementTraite, (b2.nonTraite || []).length], ['RE', true, 0], nom + ' : avortement au-delà de G max = retour ; oui = rien d\'écrit');
  eq(await p.evaluate(() => situationTraiteCampagne(DB.brebis[1]).code), 'attendue', nom + ' : oui = attendue à la traite');
  // une seule mise bas par campagne : l'avortement bloque une seconde saisie
  await p.evaluate(() => { resetMisebasRapideSession(); render('misebas-rapide'); });
  await p.fill('#scan-misebas', await p.evaluate(() => E(2).slice(-5))); await p.press('#scan-misebas', 'Enter');
  await p.waitForSelector('#mb-blocage');

  // ================================================================ 4. comptages : mises bas, nés, mort-nés dont avortons, prolificité
  await avortementRapide(p, 3, 100, 2, 'non');
  await p.evaluate(() => { DB.brebis[3].agnelages = [{ date: J(148), campagne: 2026, codeRepro: 'IA', lambs: [{ sexe: 'Mâle', adopte: false, eid: '250000004561001' }, { sexe: 'Femelle', adopte: false, eid: '250000004561002' }] }]; });
  eq(await p.evaluate(() => { const st = miseBasRapideStats(misebasCampagneRows()); return [st.misesBas, st.nes, st.mortNes, st.avortons, Math.round(st.prolificite * 100) / 100, st.portees.simples, st.portees.doubles]; }), [3, 5, 3, 3, 1.67, 0, 1], nom + ' : avortons comptés dans les nés et les mort-nés (dont avortons), prolificité ; un avortement n\'est pas une portée');
  const m = await p.evaluate(() => mortaliteSanitaireData());
  eq([m.agneauxMortNes, m.agneauxAvortons, m.agneauxMortNesSansCause], [3, 3, 0], nom + ' : mortalité : avortons à part des mort-nés sans cause');
  eq(await p.evaluate(() => accueilPcData().mortalite.agneaux.causes.find(c => c[0] === 'Avortons')), ['Avortons', 3], nom + ' : accueil PC : ligne « Avortons »');

  // ================================================================ 5. fiche brebis : création, puis modification (date et nombre seulement)
  await p.evaluate(() => { currentSheepId = 'b6'; editContext = null; render('add-agnelage', 'b6'); });
  await p.click('.mb-mode-btn[data-val="avo"]');
  await fixerDate(p, '#f-date', await p.evaluate(() => J(80)));
  await p.fill('#avo-nb', '1');
  await p.click('#btn-save-agnelage');
  check(/sera-t-elle traite/.test(await erreur(p)), nom + ' : fiche : question de traite obligatoire');
  await p.click('.avo-traite-btn[data-val="non"]'); await p.click('#btn-save-agnelage');
  let b6 = await brebis(p, 6);
  eq([b6.agnelages[0].avortement, b6.agnelages[0].codeRepro, b6.agnelages[0].lambs.length, b6.nonTraite[0].motif], [true, 'MN', 1, 'Avortement'], nom + ' : fiche : avortement hors lot = MN, pas traite');
  await p.evaluate(() => { const t = [...document.querySelectorAll('#app button, #app [role="tab"], #app .tab-btn')].find(x => /^Repro/.test(x.textContent.trim())); if (t) t.click(); });
  check(/Avortement · 1 avorton/.test(await p.evaluate(() => document.getElementById('app').innerText)), nom + ' : fiche : « Avortement · 1 avorton » affiché');
  await p.evaluate(() => { currentSheepId = 'b6'; editContext = { kind: 'agnelages', idx: 0 }; render('add-agnelage', 'b6'); });
  eq(await p.evaluate(() => [!!document.querySelector('.mb-mode-btn'), !!document.querySelector('.avo-traite-btn'), document.getElementById('avo-nb').value, document.querySelectorAll('.lamb-list .card, #lamb-list .card').length]), [false, false, '1', 0], nom + ' : modification : ni bascule ni question de traite, nombre repris');
  await p.fill('#avo-nb', '3'); await p.click('#btn-save-agnelage');
  b6 = await brebis(p, 6);
  eq([b6.agnelages.length, b6.agnelages[0].lambs.length, b6.agnelages[0].avortementTraite, b6.agnelages[0].campagne, b6.nonTraite.length], [1, 3, false, 2026, 1], nom + ' : modification : nombre changé, réponse de traite et campagne gardées');
  console.log('OK ' + nom + ' : avortement (code Repro, traite, comptages, fiche).');
  await p.context().close();
}
await browser.close();
console.log('\nTOUS LES TESTS « AVORTEMENT » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
