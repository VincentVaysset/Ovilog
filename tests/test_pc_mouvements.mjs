/* Page PC « Mouvements d'animaux » : saisie d'un mouvement collectif (catégorie en tête, types par catégorie, champs selon le type, tableau à cocher
   des animaux ACTIFS triés par âge décroissant puis n° croissant, filtre par n°, Tout cocher sur le filtré, pastille et alerte de délai viande
   jamais bloquantes, confirmation récapitulative, écriture identique à l'écran mobile, aucun bip en série sur PC), puis mouvements passés (tableau
   unique, filtres, Annuler / Annuler le lot / Modifier, export Excel). saveData est REMPLACÉ par un compteur ; jeu synthétique ; les exports réels,
   s'ils sont présents (OVILOG_EXPORT_*), sont chargés en LECTURE SEULE (section finale). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, EXPORT_CORRIGE, EXPORT_ORIGINAL, exportPresent, lireExport } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1700 } });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
let reponse = true; const confirms = [];
page.on('dialog', d => { if (d.type() === 'confirm') { confirms.push(d.message()); reponse ? d.accept() : d.dismiss(); } else d.accept(); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
const jeu = () => page.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.acheteurs = ['Acheteur A', 'Acheteur B']; DB.causesMortalite = ['Mammite', 'Boiterie'];
  DB.produits = { vaccins: [], antibiotiques: ['Intramicine'], antiparasitaires: [], antiinflammatoires: [], autres: [] };
  DB.produitsInfo = { Intramicine: { posologie: null, delaiAttente: 7, delaiLait: 7, delaiViande: 28 } };
  const A = fiche(eid(8, 8133), { id: 'A' });
  A.agnelages = [{ date: '2026-09-25', campagne: 2026, lambs: [
    { eid: eid(6, 801), sexe: 'Mâle', sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-09-25' }] },
    { eid: eid(6, 802), sexe: 'Mâle', sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-09-25' }] },
    { eid: eid(6, 803), sexe: 'Mâle', sanitaire: [], statutFinal: 'vendu', mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-09-25' }, { type: 'Vendu', acheteur: 'Acheteur A', date: '2026-10-01' }] }] }];
  DB.brebis = [
    A,
    fiche(eid(9, 59), { id: 'B' }), fiche(eid(9, 69), { id: 'C' }),
    fiche(eid(9, 152), { id: 'D', sanitaire: [{ type: 'Traitement', sousType: 'Antibiotique', produit: 'Intramicine', date: '2026-09-20', quantiteCc: 8, intervenant: 'Éleveur', dureeJours: 1, bio: true, delaiLaitJours: 14, delaiViandeJours: 56 }] }),
    fiche(eid(0, 33), { id: 'E' }), fiche(eid(7, 5), { id: 'F' }),
    fiche(eid(9, 77), { id: 'G', statut: 'vendue', mouvements: [{ type: 'Entrée', date: '2024-01-01' }, { type: 'Vente', acheteur: 'Acheteur A', date: '2026-09-01' }] }),
    fiche(eid(8, 600), { id: 'H', mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2026-10-02' }] })     // entrée le 02/10 : sortie datée avant = incohérente
  ];
  DB.beliers = [fiche(eid(9, 90), { id: 'bel1', statut: 'actif' }), fiche(eid(8, 91), { id: 'bel2', statut: 'actif' }), fiche(eid(9, 92), { id: 'bel3', statut: 'vendu' })];
  DB.agnelles = [fiche(eid(5, 41), { id: 'ag1' })];
  DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} }; DB.mouvementsCollectifs = [];
  window.E = eid; window.__avant = JSON.stringify(DB);
});
const $t = sel => page.evaluate(s => document.querySelector(s) ? document.querySelector(s).textContent.replace(/\s+/g, ' ').trim() : null, sel);
const ouvrir = async () => { await page.evaluate(() => { mvPcEtat = null; render('inventaire'); }); await page.waitForSelector('#mv-table'); };
const nums = () => page.evaluate(() => [...document.querySelectorAll('#mv-table tr.clic')].map(r => r.children[1].textContent.trim()));

// ================================================================ 1. structure : catégories, aucun bip, types par catégorie
await jeu(); await ouvrir();
const cats = await page.evaluate(() => [...document.querySelectorAll('#mv-categories button')].map(b => b.textContent).join(' | '));
check(cats === 'Brebis · 7 | Béliers · 2 | Agnelles · 1 | Agneaux · 2', 'sélecteur de catégorie avec l\'effectif ACTIF : ' + cats);
check(!/[Bb]ip/.test(await $t('#pc-mouvements')), 'aucun « Bip en série » sur PC');
check(await page.evaluate(() => !document.querySelector('.sp-mode-btn') && !document.querySelector('[data-mode="bip"]')), 'aucun sélecteur de mode (clic / bip)');
check(await page.evaluate(() => [...document.querySelectorAll('.mv-type')].map(b => b.textContent).join()) === 'Morte,Vente,Vente reproduction,Perte,Autoconsommation', 'types des brebis inchangés');
check(await page.evaluate(() => document.getElementById('mv-date').value) === '2026-10-03', 'date : aujourd\'hui par défaut');
await page.click('.mv-cat[data-cat="beliers"]');
check(await page.evaluate(() => [...document.querySelectorAll('.mv-type')].map(b => b.textContent).join()) === 'Mort,Vente,Vente reproduction,Perte,Autoconsommation', 'béliers : « Mort » (accord inchangé)');
await page.click('.mv-cat[data-cat="agneaux"]');
check(await page.evaluate(() => [...document.querySelectorAll('.mv-type')].map(b => b.textContent).join()) === 'Vendu,Mort', 'agneaux : types inchangés « Vendu / Mort »');
console.log('OK 1 structure : catégories avec effectif actif, aucun bip en série, types par catégorie inchangés (agneaux : Vendu / Mort), date du jour.');

// ================================================================ 2. champs selon le type
await ouvrir();
const champs = async () => page.evaluate(() => ({ ach: !document.getElementById('mv-acheteur').disabled, cau: !document.getElementById('mv-cause').disabled }));
await page.click('.mv-type[data-val="Vente"]');
check(JSON.stringify(await champs()) === '{"ach":true,"cau":false}', 'Vente : acheteur seul');
await page.click('.mv-type[data-val="Vente reproduction"]');
check(JSON.stringify(await champs()) === '{"ach":true,"cau":false}', 'Vente reproduction : acheteur seul');
await page.click('.mv-type[data-val="Morte"]');
check(JSON.stringify(await champs()) === '{"ach":false,"cau":true}', 'Morte : cause seule');
await page.click('.mv-type[data-val="Perte"]');
check(JSON.stringify(await champs()) === '{"ach":false,"cau":true}', 'Perte : cause seule');
await page.click('.mv-type[data-val="Autoconsommation"]');
check(JSON.stringify(await champs()) === '{"ach":false,"cau":false}', 'Autoconsommation : aucun champ');
console.log('OK 2 champs : acheteur (Vente, Vente reproduction), cause (Morte, Perte), rien pour Autoconsommation.');

// ================================================================ 3. tableau : actifs seulement, tri âge décroissant puis n° croissant, filtre, tout cocher
await ouvrir();
const lignes = await page.evaluate(() => [...document.querySelectorAll('#mv-table tr.clic')].map(r => r.children[1].textContent.trim() + '/' + r.children[2].textContent.trim()));
check(lignes[0] === '00005/9 ans' && lignes[1].endsWith('/8 ans') && lignes[2].endsWith('/8 ans') && lignes.slice(3, 6).join() === '00059/7 ans,00069/7 ans,00152/7 ans' && lignes[6] === '00033/6 ans', 'tri : 9 ans, puis 8 ans (n° croissant), 7 ans (59, 69, 152), 6 ans : ' + lignes.join());
check(!lignes.some(l => l.startsWith('00077')), 'la brebis vendue n\'est pas proposée (animaux actifs seulement)');
const entetes = await page.evaluate(() => [...document.querySelectorAll('#mv-table th')].map(x => x.textContent).join('|'));
check(entetes === '|N°|Âge|Statut de reproduction|Dernier soin|Délai en cours', 'colonnes : ' + entetes);
check(await $t('#mv-compte') === '7 brebis · 0 sélectionnée', 'compteur : ' + await $t('#mv-compte'));
await page.fill('#mv-q', '59');
check((await nums()).join() === '00059', 'filtre par n° : 1 ligne');
await page.click('#mv-tout');
check(/7 brebis · 1 sélectionnée/.test(await $t('#mv-compte')), 'Tout cocher : seulement le résultat filtré : ' + await $t('#mv-compte'));
await page.fill('#mv-q', '');
check(await page.evaluate(() => document.querySelectorAll('#mv-table tr.sel').length) === 1, 'la sélection survit à un changement de filtre');
await page.click('#mv-tout');
check(/7 sélectionnées/.test(await $t('#mv-compte')), 'Tout cocher sans filtre : 7');
await page.click('#mv-rien');
check(/0 sélectionnée/.test(await $t('#mv-compte')), 'Tout décocher');
await page.click('#mv-table tr.clic >> nth=1');
check(/1 sélectionnée/.test(await $t('#mv-compte')), 'clic sur une ligne : cochée');
check(await page.evaluate(() => window.__saves === 0 && JSON.stringify(DB) === window.__avant), 'rien d\'écrit pendant la saisie');
console.log('OK 3 tableau : actifs seulement, tri âge décroissant puis n° croissant, colonnes de la maquette, filtre, Tout cocher / décocher sur le filtré, compteur, rien écrit.');

// ================================================================ 4. délai viande : pastille et carte d'information, jamais bloquantes
await ouvrir();
const ligneD = await page.evaluate(() => [...document.querySelectorAll('#mv-table tr.clic')].find(r => r.children[1].textContent.trim() === '00152').textContent.replace(/\s+/g, ' ').trim());
check(/Intramicine · 20\/09/.test(ligneD) && /viande dès le 16\/11/.test(ligneD), 'brebis sous délai viande : dernier soin et pastille « viande dès le 16/11 » : ' + ligneD);
await page.click('.mv-type[data-val="Vente"]');
await page.click('tr.clic[data-id="D"]');       // 00152
let al = await $t('#zone-alerte-vente-delai');
check(al && /n°00152 est encore sous délai d'attente viande/.test(al) && /16-11-2026/.test(al) && /rien n'est bloqué/.test(al), 'carte d\'information (Vente, sous délai) : ' + al);
await page.click('.mv-type[data-val="Morte"]');
check(await page.evaluate(() => !document.getElementById('zone-alerte-vente-delai')), 'Morte : aucune alerte de vente');
console.log('OK 4 délai viande : pastille dans la liste, carte d\'information pour une vente, jamais bloquante.');

// ================================================================ 5. validation : erreurs, aucune écriture
await ouvrir();
await page.click('#mv-valider');
let errs = await $t('#mv-erreurs');
check(/Choisis le type de mouvement/.test(errs) && /Sélectionne au moins une brebis/.test(errs), 'type et animal manquants : ' + errs);
await page.click('.mv-type[data-val="Vente"]'); await page.click('tr.clic[data-id="B"]');
await page.click('#mv-valider');
check(/acheteur est obligatoire/.test(await $t('#mv-erreurs')), 'acheteur obligatoire pour une vente');
await page.fill('#mv-date', ''); await page.dispatchEvent('#mv-date', 'input');
await page.selectOption('#mv-acheteur', 'Acheteur A');
await page.click('#mv-valider');
check(/date est obligatoire/.test(await $t('#mv-erreurs')), 'date obligatoire');
await page.fill('#mv-date', '2026-10-01');
await page.click('tr.clic[data-id="B"]'); await page.click('tr.clic[data-id="H"]');       // décoche B ; coche la brebis H (entrée le 02/10)
await page.click('#mv-valider');
check(/N°00600 est entré\(e\) le 02-10-2026, après la date de sortie choisie \(01-10-2026\)/.test(await $t('#mv-erreurs')), 'chronologie : entrée postérieure à la date de sortie : ' + await $t('#mv-erreurs'));
check(await page.evaluate(() => window.__saves === 0 && JSON.stringify(DB) === window.__avant) && confirms.length === 0, 'aucune écriture, aucune confirmation tant que la saisie est incomplète');
console.log('OK 5 validation : type, acheteur, date, animal, chronologie ; rien d\'écrit.');

// ================================================================ 6. écriture : brebis (Vente), confirmation récapitulative
await ouvrir();
await page.click('.mv-type[data-val="Vente"]'); await page.selectOption('#mv-acheteur', 'Acheteur A');
await page.click('tr.clic[data-id="F"]'); await page.click('tr.clic[data-id="B"]'); await page.click('tr.clic[data-id="D"]');   // 00005, 00059, 00152
check(await $t('#mv-resume') === 'Vente · 3 brebis · Acheteur A · 03-10-2026' && await $t('#mv-valider') === 'Valider 3 mouvements', 'barre de validation : ' + await $t('#mv-resume'));
reponse = false; confirms.length = 0;
await page.click('#mv-valider');
check(confirms.length === 1 && /Vente · 3 brebis · Acheteur A · 03-10-2026/.test(confirms[0]) && /N° : 00005, 00059, 00152/.test(confirms[0]) && /encore sous délai d'attente viande/.test(confirms[0]), 'confirmation récapitulative (type, nombre, acheteur, date, n°, information de délai) : ' + confirms[0]);
check(await page.evaluate(() => window.__saves === 0 && JSON.stringify(DB) === window.__avant), 'confirmation refusée : rien écrit');
reponse = true;
await page.click('#mv-valider');
await page.waitForSelector('#mv-message');
const w = await page.evaluate(() => ({ b: ['B', 'F', 'D'].map(id => { const s = DB.brebis.find(x => x.id === id); const m = s.mouvements[s.mouvements.length - 1]; return [s.statut, m.type, m.acheteur, m.date, m.cause, !!m.collectifId]; }), lot: JSON.parse(JSON.stringify(DB.mouvementsCollectifs)), saves: window.__saves, autres: DB.brebis.filter(s => s.statut !== 'active').map(s => s.id).sort().join() }));
check(JSON.stringify(w.b) === JSON.stringify([['vendue', 'Vente', 'Acheteur A', '2026-10-03', null, true], ['vendue', 'Vente', 'Acheteur A', '2026-10-03', null, true], ['vendue', 'Vente', 'Acheteur A', '2026-10-03', null, true]]), 'les 3 brebis : statut vendue, mouvement Vente / acheteur / date / collectifId : ' + JSON.stringify(w.b));
check(w.lot.length === 1 && w.lot[0].categorie === 'brebis' && w.lot[0].type === 'Vente' && w.lot[0].annulable === true && w.lot[0].membres.length === 3 && w.lot[0].acheteur === 'Acheteur A' && w.lot[0].date === '2026-10-03' && /^MC-/.test(w.lot[0].id), 'lot enregistré (même structure que l\'écran mobile) : ' + JSON.stringify(w.lot[0]));
check(w.saves === 1 && w.autres === 'B,D,F,G', 'une seule écriture ; seules les 3 brebis cochées ont changé (+ la vendue d\'avant) : ' + w.autres);
check(/Enregistré/.test(await $t('#mv-message')) && /Vente · 3 brebis/.test(await $t('#mv-message')) && /0 sélectionnée/.test(await $t('#mv-compte')) && !(await nums()).includes('00005'), 'message, sélection remise à zéro, les brebis vendues ne sont plus proposées');
console.log('OK 6 écriture (brebis) : confirmation récapitulative ; refus = rien écrit ; 3 mouvements, lot enregistré comme sur mobile, une écriture.');

// ================================================================ 7. écriture : béliers (Mort + cause), agnelles (archive), agneaux (Vendu), Autoconsommation
await jeu(); await ouvrir();
await page.click('.mv-cat[data-cat="beliers"]'); await page.click('.mv-type[data-val="Mort"]'); await page.selectOption('#mv-cause', 'Boiterie');
await page.click('#mv-table tr.clic >> nth=0'); confirms.length = 0;
await page.click('#mv-valider'); await page.waitForSelector('#mv-message');
const bel = await page.evaluate(() => { const b = DB.beliers.find(x => x.id === 'bel1' || x.id === 'bel2' && false); const x = DB.beliers.filter(y => y.statut === 'mort').map(y => [y.id, y.mouvements[y.mouvements.length - 1].cause, y.mouvements[y.mouvements.length - 1].type]); return x; });
check(bel.length === 1 && bel[0][1] === 'Boiterie' && bel[0][2] === 'Mort', 'bélier : Mort + cause : ' + JSON.stringify(bel));
await page.click('.mv-cat[data-cat="agnelles"]'); await page.click('.mv-type[data-val="Vente"]'); await page.selectOption('#mv-acheteur', 'Acheteur B');
await page.click('#mv-table tr.clic >> nth=0'); confirms.length = 0;
await page.click('#mv-valider'); await page.waitForSelector('#mv-message');
check(/annulation automatique ne sera pas possible/.test(confirms[0]), 'agnelles : la confirmation prévient que l\'annulation n\'est pas possible');
check(await page.evaluate(() => DB.agnelles.length === 0 && Object.keys(DB.registre.agnelles).length === 1 && DB.mouvementsCollectifs[DB.mouvementsCollectifs.length - 1].annulable === false), 'agnelle archivée au registre et retirée du roster ; lot non annulable (comme l\'écran mobile)');
await page.click('.mv-cat[data-cat="agneaux"]');
check(await page.evaluate(() => [...document.querySelectorAll('#mv-table tr.clic')].length) === 2, 'agneaux actifs : 2 (le vendu n\'est pas proposé)');
await page.click('.mv-type[data-val="Vendu"]'); await page.selectOption('#mv-acheteur', 'Acheteur A');
await page.click('#mv-tout'); await page.click('#mv-valider'); await page.waitForSelector('#mv-message');
const ag = await page.evaluate(() => DB.brebis[0].agnelages[0].lambs.map(l => [l.statutFinal, l.mouvements.length, l.id]));
check(JSON.stringify(ag.map(x => x.slice(0, 2))) === '[["vendu",2],["vendu",2],["vendu",2]]' && await page.evaluate(() => DB.mouvementsCollectifs[DB.mouvementsCollectifs.length - 1].annulable === true && DB.mouvementsCollectifs[DB.mouvementsCollectifs.length - 1].categorie === 'agneaux'), 'agneaux : vendus, lot annulable : ' + JSON.stringify(ag));
await ouvrir();
await page.click('.mv-type[data-val="Autoconsommation"]'); await page.click('#mv-table tr.clic >> nth=0'); await page.click('#mv-valider'); await page.waitForSelector('#mv-message');
const ac = await page.evaluate(() => { const s = DB.brebis.filter(x => x.statut === 'autoconsommée')[0]; const m = s.mouvements[s.mouvements.length - 1]; return [m.type, m.cause, m.acheteur]; });
check(JSON.stringify(ac) === '["Autoconsommation",null,null]', 'Autoconsommation : ni cause ni acheteur : ' + JSON.stringify(ac));
console.log('OK 7 écriture : béliers (Mort + cause), agnelles (archivées, lot non annulable, avertissement), agneaux (Vendu, lot annulable), Autoconsommation sans cause ni acheteur.');

// ================================================================ 8. répertoires : ajout d'un acheteur et d'une cause
await jeu(); await ouvrir();
await page.click('.mv-type[data-val="Vente"]');
await page.fill('#mv-nouvel-acheteur', 'Acheteur Z'); await page.click('#mv-ajout-acheteur');
check(await page.evaluate(() => DB.acheteurs.includes('Acheteur Z') && window.__saves === 1 && document.getElementById('mv-acheteur').value === 'Acheteur Z'), 'acheteur ajouté au répertoire et sélectionné');
await page.click('.mv-type[data-val="Morte"]');
await page.fill('#mv-nouvelle-cause', 'Météorite'); await page.click('#mv-ajout-cause');
check(await page.evaluate(() => DB.causesMortalite.includes('Météorite') && document.getElementById('mv-cause').value === 'Météorite'), 'cause ajoutée à la liste et sélectionnée');
console.log('OK 8 répertoires : acheteur et cause ajoutables depuis la page.');

// ================================================================ 9. routes : PC redirigé vers la page, mobile inchangé
await jeu();
const routes = await page.evaluate(() => { const r = {}; render('mouvement-groupe'); r.groupePC = !!document.getElementById('pc-mouvements'); render('mouvements-collectifs'); r.histoPC = !!document.getElementById('pc-mouvements');
  window.electronAPI.isDesktop = false;
  render('inventaire'); r.invMobile = !document.getElementById('pc-mouvements') && /Mouvement collectif \(vente \/ sortie multiple\)/.test(document.getElementById('app').textContent);
  render('mouvement-groupe'); r.groupeMobile = /Quels animaux sont concernés/.test(document.getElementById('app').textContent) && !document.getElementById('pc-mouvements');
  window.electronAPI.isDesktop = true; return r; });
check(routes.groupePC && routes.histoPC && routes.invMobile && routes.groupeMobile, 'routes : PC → la page ; mobile → écrans d\'origine : ' + JSON.stringify(routes));
console.log('OK 9 routes : mouvement-groupe et mouvements-collectifs redirigent vers la page sur PC ; mobile inchangé.');
await browser.close();
console.log('\nTOUS LES TESTS DE LA PAGE PC « MOUVEMENTS D\'ANIMAUX » (SAISIE) SONT PASSÉS');
