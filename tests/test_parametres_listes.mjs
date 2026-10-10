/* Refonte Paramètres, partie 3 : Listes. 6 listes (Acheteurs, Causes de mortalité, Intervenants, Cas particuliers d'échographie, Catégories de notes, Types de journal), chacune avec le module
   où elle sert et le nombre de valeurs ; valeurs en étiquettes, clic -> « Renommer » / « Retirer » ; « Ajouter une valeur » + Ajouter. RENOMMER (option A) : la liste ET les enregistrements actifs
   qui portent la valeur (mouvements, mouvements collectifs, soins, traitements collectifs, échographies, notes, journal) ; le registre archivé reste tel qu'enregistré ; fusion avec
   confirmation si le nouveau nom existe ; « Mise à jour inventaire » ni renommable ni retirable. RETIRER : confirmation, enregistrements conservés. Ajout à la volée : option « Ajouter… »
   des 2 menus de la page PC Mouvements (test_pc_mouvements). Saisie au clavier. saveData REMPLACÉ. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

for (const bureau of [true, false]) {
  const nom = bureau ? 'PC' : 'mobile';
  const page = await (await browser.newContext({ viewport: bureau ? { width: 1500, height: 1200 } : { width: 420, height: 2000 } })).newPage();
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  let reponse = true; const confirms = [], alertes = [];
  page.on('dialog', d => { if (d.type() === 'confirm') { confirms.push(d.message()); reponse ? d.accept() : d.dismiss(); } else { alertes.push(d.message()); d.accept(); } });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  const jeu = () => page.evaluate(() => {
    window.__saves = 0; DB = migrateData({}); saveData = function () { window.__saves++; return true; };
    DB.campagneDebut = 2026; DB.campagneInitialisee = true;
    DB.acheteurs = ['Natera', 'Bio Plus']; DB.causesMortalite = ['Mammite', 'Gonflée', MOTIF_MAJ_INVENTAIRE]; DB.intervenants = ['Vincent Vaysset', 'Clément Galibert'];
    DB.casParticuliers = ['Pseudogestation', 'Avortée']; DB.categoriesNotes = ['Boiterie', 'Sinus']; DB.typesJournal = ['Lutte', 'Tonte'];
    const brebis = (n, extra) => Object.assign({ id: 'b' + n, eid: '250 0162991000' + n, statut: 'active', mouvements: [], sanitaire: [], echographies: [], notes: [], agnelages: [] }, extra);
    DB.brebis = [
      brebis(1, { mouvements: [{ type: 'Vendu', acheteur: 'Natera', date: '2026-05-01' }, { type: 'Morte', cause: 'Mammite', date: '2026-05-02' }], sanitaire: [{ type: 'Vaccin', intervenant: 'Vincent Vaysset', date: '2026-04-01' }], echographies: [{ date: '2026-03-01', special: 'Avortée' }], notes: [{ categorie: 'Boiterie', texte: 'x' }] }),
      brebis(2, { mouvements: [{ type: 'Vendu', acheteur: 'Natera', date: '2026-05-03' }, { type: 'Morte', cause: MOTIF_MAJ_INVENTAIRE, date: '2026-05-04' }], agnelages: [{ date: '2026-01-01', lambs: [{ eid: 'l1', mouvements: [{ type: 'Vendu', acheteur: 'Natera', date: '2026-04-04' }], sanitaire: [{ intervenant: 'Vincent Vaysset' }], notes: [{ categorie: 'Boiterie' }] }] }] })];
    DB.beliers = [{ id: 'be1', eid: '250 0162991000b1', statut: 'actif', mouvements: [], sanitaire: [], notes: [{ categorie: 'Boiterie', texte: 'bélier' }] }];
    DB.agnelles = []; DB.mouvementsCollectifs = [{ id: 'mc1', type: 'Vente', acheteur: 'Natera', date: '2026-05-01', membres: [] }, { id: 'mc2', type: 'Morte', cause: 'Mammite', date: '2026-05-02', membres: [] }];
    DB.traitementsCollectifs = [{ id: 'tc1', intervenant: 'Vincent Vaysset', produit: 'X', membres: [] }];
    DB.journal = [{ date: '2026-03-01', type: 'Tonte', texte: 't' }, { date: '2026-03-02', type: 'Tonte', texte: 't2' }, { date: '2026-03-05', type: 'Lutte', texte: 'l' }];
    DB.registre = { brebis: { 'x': { eid: 'x', mouvements: [{ type: 'Vendu', acheteur: 'Natera', date: '2024-05-01' }], sanitaire: [{ intervenant: 'Vincent Vaysset' }], echographies: [{ special: 'Avortée' }] } }, beliers: {}, agnelles: {} };
    DB.notesArchiveesBrebis = { 'z': [{ categorie: 'Boiterie' }] };
    window.__avant = JSON.stringify({ reg: DB.registre, arch: DB.notesArchiveesBrebis });
    prmListeSel = null; prmListeRenom = null; parametresTab = 'listes'; parametresRubrique = 'listes'; render('parametres');
  });
  const val = (cle, v) => `.prm-val[data-list="${cle}"][data-val="${v}"]`;
  const valeurs = (cle) => page.evaluate(c => [...document.querySelectorAll(`.prm-val[data-list="${c}"]`)].map(b => b.textContent), cle);
  await jeu();
  // ---- 1. structure
  eq(await page.evaluate(() => [...document.querySelectorAll('.prm-liste .prm-titre')].map(e => e.textContent)), ['Acheteurs', 'Causes de mortalité', 'Intervenants', "Cas particuliers d'échographie", 'Catégories de notes', 'Types de journal'], nom + ' : les 6 listes');
  eq(await page.evaluate(() => [...document.querySelectorAll('.prm-liste .prm-note')].map(e => e.textContent)), ["Mouvements d'animaux · ventes · 2 valeurs", "Mouvements d'animaux · morts · 3 valeurs", 'Carnet sanitaire · 2 valeurs', 'Échographies · 2 valeurs', 'Fiche animal · notes · 2 valeurs', 'Calendrier · 2 valeurs'], nom + ' : module et nombre de valeurs');
  check(await page.evaluate(() => !document.getElementById('app').textContent.includes('❔') && !document.querySelector('.btn-del-liste')), nom + ' : aucun ❔, plus de boutons « Suppr. »');
  check(await page.evaluate(() => !!document.getElementById('btn-gerer-produits')) === !bureau, nom + ' : « Produits sanitaires » seulement sur mobile');
  check(await page.evaluate(() => document.querySelectorAll('.prm-liste .input-add-liste').length === 6 && [...document.querySelectorAll('.btn-add-liste')].every(b => b.textContent === 'Ajouter')), nom + ' : un champ « Ajouter une valeur » + bouton Ajouter par carte');
  // ---- 2. clic sur une valeur : Renommer / Retirer
  check(await page.evaluate(() => !document.querySelector('.prm-renommer')), nom + ' : pas d\'actions avant le clic');
  await page.click(val('acheteurs', 'Natera'));
  check(await page.evaluate(() => !!document.querySelector('.prm-renommer') && !!document.querySelector('.prm-retirer')), nom + ' : clic sur une valeur -> Renommer et Retirer');
  await page.click(val('acheteurs', 'Natera'));
  check(await page.evaluate(() => !document.querySelector('.prm-renommer')), nom + ' : second clic referme');
  // ---- 3. valeur protégée
  await page.click(val('causesMortalite', 'Mise à jour inventaire'));
  check(await page.evaluate(() => !document.querySelector('.prm-renommer') && !document.querySelector('.prm-retirer') && /ni renommée ni retirée/.test(document.getElementById('liste-causesMortalite').textContent)), nom + ' : « Mise à jour inventaire » ni renommable ni retirable');
  eq(await page.evaluate(() => [renommerValeurListe('causesMortalite', MOTIF_MAJ_INVENTAIRE, 'Autre').ok, DB.causesMortalite.includes(MOTIF_MAJ_INVENTAIRE)]), [false, true], nom + ' : refusé aussi au niveau du code');
  console.log('OK ' + nom + ' : 6 listes (module, nombre), étiquettes, actions au clic, valeur protégée.');
  // ---- 4. renommer : refus, accord, au clavier
  await page.click(val('acheteurs', 'Natera')); await page.click('.prm-renommer');
  await page.fill('.prm-renom-input', ''); await page.click('.prm-renom-input'); await page.keyboard.type('Natéra Bio', { delay: 25 });
  reponse = false; confirms.length = 0; await page.click('.prm-renom-ok');
  check(confirms.length === 1 && /Renommer « Natera » en « Natéra Bio »/.test(confirms[0]) && /4 enregistrement\(s\) actif\(s\)/.test(confirms[0]) && /registre d'élevage archivé \(1 enregistrement\(s\)\) reste tel/.test(confirms[0]), nom + ' : confirmation avec le nombre (3 mouvements + 1 collectif = 4) et le registre inchangé : ' + confirms[0]);
  check(await page.evaluate(() => DB.acheteurs.includes('Natera') && DB.brebis[0].mouvements[0].acheteur === 'Natera' && window.__saves === 0), nom + ' : refus = rien modifié');
  reponse = true; await page.click('.prm-renom-ok'); await page.waitForTimeout(100);
  const r = await page.evaluate(() => ({ liste: DB.acheteurs, m1: DB.brebis[0].mouvements[0].acheteur, m2: DB.brebis[1].mouvements[0].acheteur, lamb: DB.brebis[1].agnelages[0].lambs[0].mouvements[0].acheteur, col: DB.mouvementsCollectifs[0].acheteur, reg: DB.registre.brebis.x.mouvements[0].acheteur, saves: window.__saves }));
  eq([r.liste, r.m1, r.m2, r.lamb, r.col, r.reg, r.saves], [['Natéra Bio', 'Bio Plus'], 'Natéra Bio', 'Natéra Bio', 'Natéra Bio', 'Natéra Bio', 'Natera', 1], nom + ' : liste + 4 enregistrements actifs renommés, registre archivé inchangé, une écriture, ordre conservé');
  eq(await valeurs('acheteurs'), ['Natéra Bio', 'Bio Plus'], nom + ' : étiquettes mises à jour');
  // ---- 5. autres listes : intervenants, échos, notes (béliers inclus), journal, causes
  const renomme = async (cle, ancien, nouveau) => { await page.click(val(cle, ancien)); await page.click(`#liste-${cle} .prm-renommer`); await page.fill('.prm-renom-input', nouveau); await page.press('.prm-renom-input', 'Enter'); await page.waitForTimeout(80); };
  await renomme('intervenants', 'Vincent Vaysset', 'Vincent V.');
  await renomme('casParticuliers', 'Avortée', 'Avortement');
  await renomme('categoriesNotes', 'Boiterie', 'Boiteries');
  await renomme('typesJournal', 'Tonte', 'Tonte annuelle');
  await renomme('causesMortalite', 'Mammite', 'Mammite aiguë');
  const r2 = await page.evaluate(() => ({ soin: DB.brebis[0].sanitaire[0].intervenant, soinLamb: DB.brebis[1].agnelages[0].lambs[0].sanitaire[0].intervenant, tc: DB.traitementsCollectifs[0].intervenant, echo: DB.brebis[0].echographies[0].special, note: DB.brebis[0].notes[0].categorie, noteLamb: DB.brebis[1].agnelages[0].lambs[0].notes[0].categorie, noteBelier: DB.beliers[0].notes[0].categorie, jr: DB.journal.map(e => e.type), cause: DB.brebis[0].mouvements[1].cause, cc: DB.mouvementsCollectifs[1].cause, listes: [DB.intervenants[0], DB.casParticuliers[1], DB.categoriesNotes[0], DB.typesJournal[1], DB.causesMortalite[0]] }));
  eq(r2, { soin: 'Vincent V.', soinLamb: 'Vincent V.', tc: 'Vincent V.', echo: 'Avortement', note: 'Boiteries', noteLamb: 'Boiteries', noteBelier: 'Boiteries', jr: ['Tonte annuelle', 'Tonte annuelle', 'Lutte'], cause: 'Mammite aiguë', cc: 'Mammite aiguë', listes: ['Vincent V.', 'Avortement', 'Boiteries', 'Tonte annuelle', 'Mammite aiguë'] }, nom + ' : soins, traitements collectifs, échos, notes (fiches, agneaux, béliers), journal, causes renommés');
  check(await page.evaluate(() => JSON.stringify({ reg: DB.registre, arch: DB.notesArchiveesBrebis }) === window.__avant), nom + ' : registre archivé et notes archivées strictement inchangés');
  console.log('OK ' + nom + ' : renommage (confirmation, refus, accord, clavier) sur les 6 listes ; registre archivé intact.');
  // ---- 6. fusion si le nom existe
  await page.click(val('acheteurs', 'Natéra Bio')); await page.click('#liste-acheteurs .prm-renommer'); await page.fill('.prm-renom-input', 'Bio Plus');
  confirms.length = 0; await page.click('.prm-renom-ok'); await page.waitForTimeout(100);
  check(/existe déjà/.test(confirms[0] || '') && /Fusionner/.test(confirms[0]), nom + ' : fusion annoncée : ' + confirms[0]);
  eq(await page.evaluate(() => [DB.acheteurs, DB.brebis[0].mouvements[0].acheteur, DB.mouvementsCollectifs[0].acheteur]), [['Bio Plus'], 'Bio Plus', 'Bio Plus'], nom + ' : fusion : une seule valeur, enregistrements sur la valeur existante');
  // ---- 7. retirer : confirmation, enregistrements conservés
  await page.click(val('typesJournal', 'Lutte')); reponse = false; confirms.length = 0; await page.click('.prm-retirer');
  check(/Utilisé dans 1 fiche/.test(confirms[0]) && await page.evaluate(() => DB.typesJournal.includes('Lutte')), nom + ' : retrait refusé = rien : ' + confirms[0]);
  reponse = true; await page.click('.prm-retirer'); await page.waitForTimeout(80);
  check(await page.evaluate(() => !DB.typesJournal.includes('Lutte') && DB.journal.some(e => e.type === 'Lutte')), nom + ' : retiré des menus, enregistrement existant conservé');
  // ---- 8. ajouter : bouton, Entrée au clavier, doublon
  await page.click('.input-add-liste[data-list="intervenants"]'); await page.keyboard.type('Dr Martin', { delay: 25 }); await page.click('.btn-add-liste[data-list="intervenants"]'); await page.waitForTimeout(80);
  await page.click('.input-add-liste[data-list="intervenants"]'); await page.keyboard.type('Dr Dupont', { delay: 25 }); await page.keyboard.press('Enter'); await page.waitForTimeout(80);
  await page.click('.input-add-liste[data-list="intervenants"]'); await page.keyboard.type('dr martin', { delay: 25 }); await page.keyboard.press('Enter'); await page.waitForTimeout(80);
  eq(await page.evaluate(() => DB.intervenants), ['Vincent V.', 'Clément Galibert', 'Dr Martin', 'Dr Dupont'], nom + ' : ajout par bouton et par Entrée, doublon (casse près) ignoré');
  console.log('OK ' + nom + ' : fusion, retrait (enregistrements conservés), ajout au clavier.');
  await page.context().close();
}
await browser.close();
console.log('\nTOUS LES TESTS DE PARAMÈTRES > LISTES SONT PASSÉS');
