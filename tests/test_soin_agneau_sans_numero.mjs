/* Soin sur un agneau pas encore bouclé (Carnet sanitaire) : l'agneau est proposé par sa mère (« Mâle de n°69002 (sans n°) »), le soin va sur SA fiche et le suit au
   bouclage ; référence interne posée au premier soin seulement (jamais un n°, eid vide) ; sous délai d'attente et registre sanitaire par la mère jusqu'au bouclage ;
   annulation du lot ; soin collectif (agneau sans n° + agneau bouclé) et sa suppression. saveData REMPLACÉ ; jeu synthétique (indicatif 000456), aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
p.on('dialog', d => d.accept());
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
await p.evaluate(() => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
  DB.produits = { vaccins: [], antibiotiques: ['Produit A'], antiparasitaires: [], antiinflammatoires: [], autres: [] };
  DB.produitsInfo = { 'Produit A': { delaiLait: 7, delaiViande: 28, surOrdonnance: false } };
  const fiche = (n, id) => ({ id, eid: '250000045' + n, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
  DB.brebis = [fiche('669002', 'b1'), fiche('670193', 'b2')];
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  DB.brebis[0].agnelages = [{ date: '2026-11-15', campagne: 2026, codeRepro: 'MN', lambs: [{ sexe: 'Mâle', adopte: false }, { sexe: 'Femelle', adopte: false }, { sexe: 'Mort-né', adopte: false }] }];
  DB.brebis[1].agnelages = [{ date: '2026-11-02', campagne: 2026, codeRepro: 'MN', lambs: [{ sexe: 'Mâle', adopte: false, eid: '250000045671012', sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-11-02' }] }] }];
  window.__avant = JSON.stringify(DB);
});
const lamb = i => p.evaluate(i => JSON.parse(JSON.stringify(DB.brebis[0].agnelages[0].lambs[i])), i);

// 1. proposés par leur mère, mort-né exclu ; l'affichage n'écrit rien
eq(await p.evaluate(() => animauxEligiblesCarnet().filter(a => a.sansNumero).map(a => a.court).sort()), ['Femelle de n°69002 (sans n°)', 'Mâle de n°69002 (sans n°)'], 'agneaux sans n° proposés par leur mère (mort-né exclu)');
await p.evaluate(() => { carnetSanitaireEtat = null; carnetDernierLot = null; render('sanitaire'); });
check(await p.evaluate(() => JSON.stringify(DB) === window.__avant), 'affichage seul : rien n\'est écrit');

// 2. soin sur le mâle sans n° (mobile)
const saisirSoin = async () => {
  await p.evaluate(() => { carnetSanitaireEtat = null; carnetDernierLot = null; render('sanitaire'); });
  await p.selectOption('#cs-produit', 'Produit A'); await p.fill('#cs-dose', '2'); await p.selectOption('#cs-voie', { index: 1 });
  await p.click('#cs-suivant'); await p.waitForSelector('#cs-cards');
};
await saisirSoin();
check(await p.evaluate(() => /Mâle de n°69002 \(sans n°\)/.test(document.getElementById('cs-cards').textContent)), 'carte « Mâle de n°69002 (sans n°) »');
await p.fill('#cs-q', '69002');
check(await p.evaluate(() => document.querySelectorAll('#cs-cards .sheep-item[data-eid^="sansn:"]').length === 2 && document.querySelectorAll('#cs-cards .sheep-item').length === 3), 'recherche par le n° de la mère : la mère et ses deux agneaux sans n°');
await p.click('#cs-cards .sheep-item[data-eid="sansn:b1:0:0"]');
await p.click('#cs-enregistrer'); await p.waitForSelector('#cs-dernier-lot');
let m = await lamb(0);
check(m.sanitaire.length === 1 && m.sanitaire[0].produit === 'Produit A' && /^AG-/.test(m.ref) && !m.eid, 'soin sur la fiche de l\'agneau, référence interne posée, aucun n° : ' + JSON.stringify(m));
eq(await p.evaluate(() => carnetDernierLot.eids), [m.ref], 'lot du dernier soin : la référence interne');
check(!(await lamb(1)).ref, 'la femelle (sans soin) n\'a pas de référence');

// 3. annuler le lot
await p.click('#cs-annuler-lot'); await p.waitForFunction(() => !document.getElementById('cs-dernier-lot'));
eq((await lamb(0)).sanitaire, [], 'annulation : soin retiré');

// 4. de nouveau : sous délai (viande) et registre par la mère
await saisirSoin();
check(await p.evaluate(() => !!document.querySelector('#cs-cards .sheep-item[data-eid^="AG-"]')), 'agneau déjà soigné : retrouvé par sa référence interne');
await p.click('#cs-cards .sheep-item[data-eid^="AG-"]');
await p.click('#cs-enregistrer'); await p.waitForSelector('#cs-dernier-lot');
eq(await p.evaluate(() => sousDelaiParAnimal('agneaux').map(r => [r.libelle, r.eid, r.soins.map(s => s.type)])), [['Mâle de n°69002 (sans n°)', '', ['viande']]], 'sous délai, onglet Agneaux : par la mère, délai viande');
await p.evaluate(() => { sousDelaiOnglet = 'agneaux'; render('sous-delai'); });
check(await p.evaluate(() => /Mâle de n°69002 \(sans n°\)/.test(document.getElementById('app').textContent)), 'écran Sous délai : « Mâle de n°69002 (sans n°) »');
eq(await p.evaluate(() => registreSanitaireRows().filter(r => r.categorie === 'Agneau').map(r => [r.numeroAffiche, r.produit])), [['Mâle de n°69002 (sans n°)', 'Produit A']], 'registre sanitaire : par la mère');
eq(await p.evaluate(() => registreSanitaireFilteredRows('69002', {}).length), 1, 'registre : retrouvé par le n° de la mère');
eq(await p.evaluate(() => feuilleSanitaireXlsx(registreSanitaireRows()).rows[1][0]), 'Mâle de n°69002 (sans n°)', 'Excel du registre : par la mère');

// 5. bouclage : le soin suit, le n° remplace la mère partout
await p.evaluate(() => identifierAgneau(DB.brebis[0], 0, 0, '71013'));
m = await lamb(0);
check(m.eid === '250000045671013' && m.sanitaire.length === 1, 'bouclé : le soin est resté sur l\'agneau');
eq(await p.evaluate(() => registreSanitaireRows().filter(r => r.categorie === 'Agneau').map(r => [r.numeroAffiche || null, r.eid])), [[null, '250000045671013']], 'registre : le n° de l\'agneau dès le bouclage');
eq(await p.evaluate(() => sousDelaiParAnimal('agneaux').map(r => [r.libelle || null, r.eid])), [[null, '250000045671013']], 'sous délai : le n° de l\'agneau');

// 6. soin collectif : femelle sans n° + agneau bouclé de b2, puis suppression du traitement collectif
await saisirSoin();
await p.click('#cs-cards .sheep-item[data-eid="sansn:b1:0:1"]');
await p.click('#cs-cards .sheep-item[data-eid="250000045671012"]');
await p.click('#cs-enregistrer'); await p.waitForSelector('#cs-dernier-lot');
const f = await lamb(1);
check(f.sanitaire.length === 1 && f.sanitaire[0].collectifId && /^AG-/.test(f.ref), 'collectif : soin sur la femelle sans n°');
eq(await p.evaluate(() => DB.traitementsCollectifs[0].membres.length), 2, 'collectif : deux membres');
await p.evaluate(() => render('traitements-collectifs'));
await p.click('.btn-del-collectif[data-key^="id:"]');
eq(await p.evaluate(() => [DB.brebis[0].agnelages[0].lambs[1].sanitaire.length, DB.brebis[1].agnelages[0].lambs[0].sanitaire.length, DB.traitementsCollectifs.length]), [0, 0, 0], 'suppression du collectif : agneau sans n° compris');

await browser.close();
console.log('\nTOUS LES TESTS « SOIN SUR UN AGNEAU SANS N° » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
