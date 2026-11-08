/* Carnet sanitaire, recherche par n° (PC et mobile) : MÊME règle que l'Accueil (numerosRechercheAnimal : 5 derniers chiffres, n° de travail SIEOL court et
   long, n° de travail du bélier, EID) ; un agneau sans n° est retrouvé par TOUS les n° de sa mère ; n° tapé puis OK / Entrée ou bippé (resoudreNumeroCarnet) :
   un seul = coché, plusieurs = liste réduite (rien d'office), aucun = message ambre ; un bip = l'animal bippé, jamais ses agneaux.
   saveData REMPLACÉ ; jeu synthétique (indicatif 000456), aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

const prep = () => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
  DB.produits = { vaccins: [], antibiotiques: ['Produit A'], antiparasitaires: [], antiinflammatoires: [], autres: [] };
  DB.produitsInfo = { 'Produit A': { delaiLait: 7, delaiViande: 28, surOrdonnance: false } };
  const fiche = (n, id) => ({ id, eid: '250000045' + n, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
  DB.brebis = [fiche('601023', 'b1'), fiche('669002', 'b2')];
  DB.brebis[0].numeroCourtTravailSieol = '023'; DB.brebis[0].numeroLongTravailSieol = '2106023';
  DB.brebis[1].numeroCourtTravailSieol = '512';
  DB.beliers = [{ id: 'r1', eid: '250000045500777', statut: 'actif', numeroTravailSieol: '88', sanitaire: [], mouvements: [], notes: [] }];
  DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  DB.brebis[0].agnelages = [{ date: '2026-11-15', campagne: 2026, codeRepro: 'MN', lambs: [{ sexe: 'Mâle', adopte: false }] }];
  DB.brebis[1].agnelages = [{ date: '2026-11-10', campagne: 2026, codeRepro: 'MN', lambs: [{ sexe: 'Mâle', adopte: false }, { sexe: 'Femelle', adopte: false }] }];
};

for (const mobile of [true, false]) {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1400, height: 900 } });
  if (!mobile) await ctx.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test', refocus: () => {} }; });
  const p = await ctx.newPage();
  const T = mobile ? 'mobile' : 'PC';
  await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  p.on('dialog', d => d.accept());
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(prep);
  check(await p.evaluate(() => isDesktopMode()) === !mobile, T + ' : mode attendu');

  // 1. fonctions pures
  if (mobile) {
    const res = q => p.evaluate(q => { const r = resoudreNumeroCarnet(animauxEligiblesCarnet(), q); return [r.statut, r.item ? r.item.court || r.item.numero : (r.candidats || []).map(a => a.court || a.numero).sort()]; }, q);
    eq(await res('023'), ['ambigu', ['023', 'Mâle de n°01023 (sans n°)']], 'n° court SIEOL de la mère : la brebis et son agneau sans n°, rien d\'office');
    eq(await res('23'), ['ambigu', ['023', 'Mâle de n°01023 (sans n°)']], 'zéros de tête ignorés');
    eq(await res('2106023'), ['ambigu', ['023', 'Mâle de n°01023 (sans n°)']], 'n° long SIEOL');
    eq(await res('512'), ['ambigu', ['512', 'Femelle de n°69002 (sans n°)', 'Mâle de n°69002 (sans n°)']], 'n° court SIEOL d\'une autre mère (bug signalé)');
    eq(await res('88'), ['trouve', '88'], 'n° de travail du bélier');
    eq(await res('250000045601023'), ['trouve', '023'], 'bip de la mère = la brebis seule, jamais ses agneaux');
    eq(await res('00045601023'), ['trouve', '023'], 'n° national (11 chiffres)');
    eq(await res('999'), ['absent', []], 'aucun');
    const filtre = q => p.evaluate(q => animalFiltresCarnet(animauxEligiblesCarnet(), { cats: { brebis: true, antenaises: true, agnelles: true, beliers: true, agneaux: true }, q }).map(a => a.court || a.numero).sort(), q);
    eq(await filtre('512'), ['512', 'Femelle de n°69002 (sans n°)', 'Mâle de n°69002 (sans n°)'], 'filtre au fil de la frappe : n° de travail de la mère');
    eq(await filtre('2106'), ['023', 'Mâle de n°01023 (sans n°)'], 'filtre : morceau du n° long SIEOL');
    eq(await filtre('69 002'), ['512', 'Femelle de n°69002 (sans n°)', 'Mâle de n°69002 (sans n°)'], 'filtre : espaces ignorés');
    eq(await filtre('88'), ['88'], 'filtre : n° de travail du bélier');
    // même correspondance que l'Accueil (liste des brebis)
    check(await p.evaluate(() => brebisCorrespondantA(DB.brebis, '2106').length === 1 && animauxEligiblesCarnet().find(a => a.numero === '01023').nums.includes('2106023')), 'mêmes n° que l\'Accueil');
  }

  // 2. écran : n° tapé puis Entrée / OK
  await p.evaluate(() => { carnetSanitaireEtat = null; carnetDernierLot = null; render('sanitaire'); });
  await p.selectOption('#cs-produit', 'Produit A'); await p.fill('#cs-dose', '2'); await p.selectOption('#cs-voie', { index: 1 });
  await p.click('#cs-suivant'); await p.waitForSelector(mobile ? '#cs-cards' : '#cs-table');
  const lignes = () => p.evaluate(m => [...document.querySelectorAll(m ? '#cs-cards .sheep-item' : '#cs-table tr.clic')].map(e => e.dataset.eid), mobile);
  const fb = () => p.evaluate(() => { const f = document.getElementById('cs-scan-feedback'); return f.classList.contains('hidden') ? '' : f.textContent; });
  const sel = () => p.evaluate(() => [...carnetSanitaireEtat.selection].sort());

  await p.fill('#cs-q', '512'); await p.press('#cs-q', 'Enter');
  eq((await lignes()).length, 3, T + ' : plusieurs animaux pour ce n° : liste réduite à eux');
  eq(await sel(), [], T + ' : rien coché d\'office');
  check(/3 animaux portent ce n°/.test(await fb()), T + ' : message ambre : ' + await fb());
  check(await p.evaluate(() => document.getElementById('cs-q').value === '512'), T + ' : le n° reste dans le champ');
  await p.click(mobile ? '#cs-cards .sheep-item[data-eid="sansn:b2:0:0"]' : '#cs-table tr.clic[data-eid="sansn:b2:0:0"]');
  eq(await sel(), ['sansn:b2:0:0'], T + ' : l\'agneau touché est coché');
  eq((await lignes()).length, 6, T + ' : la liste complète revient');
  check(await p.evaluate(() => document.getElementById('cs-q').value === ''), T + ' : champ vidé');

  await p.fill('#cs-q', '88'); await p.press('#cs-q', 'Enter');
  eq(await sel(), ['250000045500777', 'sansn:b2:0:0'], T + ' : un seul animal : coché');
  check(/n°00777 ajouté/.test(await fb()) && await p.evaluate(() => document.getElementById('cs-q').value === '' && document.activeElement.id === 'cs-q'), T + ' : champ vidé, curseur gardé : ' + await fb());
  await p.fill('#cs-q', '88'); await p.press('#cs-q', 'Enter');
  check(/déjà sélectionné/.test(await fb()), T + ' : déjà coché : rien de plus');
  eq((await sel()).length, 2, T + ' : rien de plus coché');

  await p.fill('#cs-q', '777777'); await p.press('#cs-q', 'Enter');
  check(/Aucun animal éligible ne porte exactement le n°777777/.test(await fb()), T + ' : aucun : message ambre');
  check(await p.evaluate(() => getComputedStyle(document.getElementById('cs-scan-feedback')).color) !== 'rgb(163, 58, 49)', T + ' : jamais en rouge');

  if (mobile) {
    // bip de la mère : la brebis seule
    await p.fill('#cs-q', '');
    await p.evaluate(() => onEidScanned('250000045601023'));
    eq(await sel(), ['250000045500777', '250000045601023', 'sansn:b2:0:0'], 'bip de la mère : la brebis cochée, pas son agneau');
  }
  // enregistrer : le soin va sur l'agneau sans n° touché
  await p.click('#cs-enregistrer'); await p.waitForSelector('#cs-dernier-lot');
  check(await p.evaluate(() => DB.brebis[1].agnelages[0].lambs[0].sanitaire.length === 1 && !DB.brebis[1].agnelages[0].lambs[1].sanitaire), T + ' : soin sur l\'agneau sans n° choisi');
  await ctx.close();
}
await browser.close();
console.log('OK test_carnet_numeros');
