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
await page.selectOption('#mv-acheteur', '__ajouter__'); await page.click('#liste-ajout-input'); await page.keyboard.type('Acheteur Z', { delay: 20 }); await page.click('#liste-ajout-ok');
check(await page.evaluate(() => DB.acheteurs.includes('Acheteur Z') && window.__saves === 1 && document.getElementById('mv-acheteur').value === 'Acheteur Z'), 'acheteur ajouté au répertoire et sélectionné');
await page.click('.mv-type[data-val="Morte"]');
await page.selectOption('#mv-cause', '__ajouter__'); await page.click('#liste-ajout-input'); await page.keyboard.type('Météorite', { delay: 20 }); await page.keyboard.press('Enter');
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

// ================================================================ 10. mouvements passés : tableau unique, colonnes, période par défaut
await jeu(); await ouvrir();
const colsP = await page.evaluate(() => [...document.querySelectorAll('#mvp-table th')].map(x => x.textContent).join('|'));
check(colsP === 'Date|N°|Catégorie|Type|Cause / acheteur|Lot|Actions', 'colonnes du tableau passé : ' + colsP);
check(await page.evaluate(() => !document.querySelector('.tab-bar') && !document.querySelector('.tab-btn')) && !/Gérer \/ annuler/.test(await $t('#pc-mouvements')), 'plus d\'onglets ni d\'écran « Gérer / annuler » sur PC');
check(!await page.evaluate(() => document.querySelector('#mvp-carte') === null) && await page.evaluate(() => !document.querySelector('#mv-passes .pc-kpi')), 'aucune carte de synthèse au-dessus du tableau');
const optP = await page.evaluate(() => [...document.querySelectorAll('#mvp-periode option')].map(o => o.textContent).join('|'));
check(/^Campagne en cours\|/.test(optP) && /Toutes$/.test(optP), 'période : campagne en cours par défaut, « Toutes » en dernier : ' + optP);
let lp = await page.evaluate(() => [...document.querySelectorAll('#mvp-table tr[data-eid]')].map(r => [...r.children].slice(0, 5).map(c => c.textContent.trim()).join('/')));
check(lp.length === 1 && /^01-10-2026\/.*803\/Agneau\/Vendu\/Acheteur A$/.test(lp[0]), 'campagne en cours : seul l\'agneau vendu le 01/10 : ' + JSON.stringify(lp));
await page.selectOption('#mvp-periode', 'toutes');
lp = await page.evaluate(() => [...document.querySelectorAll('#mvp-table tr[data-eid]')].map(r => r.children[2].textContent + ':' + r.children[3].textContent.trim()));
check(lp.length === 2 && lp.join() === 'Agneau:Vendu,Brebis:Vente', 'Toutes : l\'agneau (01/10) puis la brebis vendue le 01/09 (date décroissante) : ' + lp.join());
console.log('OK 10 passés : tableau unique, colonnes de la maquette, ni onglets ni écran « Gérer / annuler », période par défaut = campagne en cours.');

// ================================================================ 11. lot : libellé, annulation avec confirmation (refus puis accord)
await jeu(); await ouvrir();
await page.click('.mv-type[data-val="Vente"]'); await page.selectOption('#mv-acheteur', 'Acheteur A');
await page.click('tr.clic[data-id="B"]'); await page.click('tr.clic[data-id="C"]'); await page.click('#mv-valider'); await page.waitForSelector('#mv-message');
await page.click('.mv-type[data-val="Vente"]'); await page.selectOption('#mv-acheteur', 'Acheteur B');
await page.click('tr.clic[data-id="E"]'); await page.click('#mv-valider'); await page.waitForTimeout(100);
await page.click('.mv-type[data-val="Morte"]'); await page.selectOption('#mv-cause', 'Mammite');
await page.click('tr.clic[data-id="F"]'); await page.click('tr.clic[data-id="A"]'); await page.click('#mv-valider'); await page.waitForTimeout(100);
const libs = await page.evaluate(() => [...new Set([...document.querySelectorAll('#mvp-table tr[data-eid] td:nth-child(6) .pc-pill')].map(p => p.textContent.trim()))].sort());
check(JSON.stringify(libs) === JSON.stringify(['Lot du 03/10 · 1 brebis · Acheteur B', 'Lot du 03/10 · 2 brebis · Acheteur A', 'Lot du 03/10 · 2 brebis · Mammite']), 'libellés de lot (jour/mois · effectif · acheteur ou cause) : ' + JSON.stringify(libs));
check(await page.evaluate(() => document.querySelectorAll('.mv-annuler-lot').length) === 5 && await page.evaluate(() => document.querySelectorAll('.mv-annuler').length) === 1, 'les 5 lignes d\'un lot portent « Annuler le lot » ; seul l\'agneau vendu seul (sans lot) a « Annuler »');
const avantLot = await page.evaluate(() => { window.__saves = 0; return JSON.stringify(DB); });
reponse = false; confirms.length = 0;
await page.click('.mv-annuler-lot >> nth=0');
check(confirms.length === 1 && /Annuler ce lot \?/.test(confirms[0]) && /Lot du 03\/10 · \d brebis? · /.test(confirms[0]), 'confirmation avant annulation du lot : ' + confirms[0]);
check(await page.evaluate(a => JSON.stringify(DB) === a && window.__saves === 0, avantLot), 'annulation refusée : rien n\'est modifié');
reponse = true; confirms.length = 0;
const idLot = await page.evaluate(() => DB.mouvementsCollectifs.find(l => l.acheteur === 'Acheteur A').id);
await page.click(`.mv-annuler-lot[data-id="${idLot}"] >> nth=0`);
check(confirms.length === 1 && /2 brebis restaurées/.test(confirms[0]), 'la confirmation indique le nombre de brebis restaurées : ' + confirms[0]);
const apresLot = await page.evaluate(() => ({ b: DB.brebis.filter(x => ['B', 'C'].includes(x.id)).map(x => [x.statut, x.mouvements.length, x.mouvements.some(m => m.collectifId)]), lots: DB.mouvementsCollectifs.length, saves: window.__saves, autres: DB.brebis.filter(x => ['E', 'F', 'A'].includes(x.id)).map(x => x.statut).join() }));
check(JSON.stringify(apresLot.b) === '[["active",1,false],["active",1,false]]' && apresLot.lots === 2 && apresLot.saves === 1 && apresLot.autres === 'morte,vendue,morte', 'annulation acceptée : les 2 brebis redeviennent « active », le lot disparaît, les autres lots intacts, une seule écriture : ' + JSON.stringify(apresLot));
check(/Lot annulé/.test(await $t('#mv-message')) && (await nums()).includes('00059') && (await nums()).includes('00069'), 'message « Lot annulé » ; les brebis réapparaissent dans la saisie');
console.log('OK 11 lots : libellé « Lot du JJ/MM · N · acheteur ou cause », confirmation (nombre restauré), refus = rien, accord = statut « active » restauré.');

// ================================================================ 12. mouvement individuel : Annuler (confirmation), Modifier
await jeu();
await page.evaluate(() => { const s = DB.brebis.find(x => x.id === 'E'); s.mouvements.push({ type: 'Vente', acheteur: 'Acheteur B', date: '2026-10-02' }); s.statut = 'vendue';
  const f = DB.brebis.find(x => x.id === 'F'); f.mouvements.push({ type: 'Morte', cause: 'Mammite', date: '2026-10-02' }); f.statut = 'morte'; window.__avant = JSON.stringify(DB); });
await ouvrir();
check(await page.evaluate(() => document.querySelectorAll('.mv-annuler').length) === 3 && await page.evaluate(() => document.querySelectorAll('.mv-modifier').length) === 3, 'mouvements individuels (2 brebis + 1 agneau) : « Modifier » et « Annuler » sur chaque ligne');
reponse = false; confirms.length = 0;
await page.click('tr[data-eid="' + await page.evaluate(() => E(0, 33)) + '"] .mv-annuler');
check(confirms.length === 1 && /Annuler ce mouvement \?/.test(confirms[0]) && /Vente · Acheteur B · 02-10-2026/.test(confirms[0]) && /repasse « active »/.test(confirms[0]), 'confirmation (mouvement) : ' + confirms[0]);
check(await page.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'refus : rien modifié');
reponse = true;
await page.click('tr[data-eid="' + await page.evaluate(() => E(0, 33)) + '"] .mv-annuler');
const ind = await page.evaluate(() => { const s = DB.brebis.find(x => x.id === 'E'); return [s.statut, s.mouvements.length, window.__saves]; });
check(JSON.stringify(ind) === '["active",1,1]', 'annulation acceptée : « active », mouvement retiré : ' + JSON.stringify(ind));
check(await page.evaluate(() => document.querySelectorAll('#mvp-table tr[data-eid]').length) === 2, 'la ligne annulée disparaît du tableau');
await page.click('.mv-modifier >> nth=0');
await page.waitForTimeout(100);
check(await page.evaluate(() => currentView) !== 'inventaire' && await page.evaluate(() => detailOrigin === 'inventaire' || belierDetailOrigin === 'inventaire' || agneauDetailOrigin === 'inventaire'), 'Modifier ouvre l\'écran individuel avec retour vers la fiche (origine = inventaire)');
console.log('OK 12 individuel : Annuler (confirmation, refus = rien, accord = « active »), Modifier ouvre l\'écran existant.');

// ================================================================ 13. agnelles archivées, agneaux (lot annulable), lots système « Mise à jour inventaire »
await jeu(); await ouvrir();
await page.click('.mv-cat[data-cat="agnelles"]'); await page.click('.mv-type[data-val="Vente"]'); await page.selectOption('#mv-acheteur', 'Acheteur B');
await page.click('#mv-table tr.clic >> nth=0'); await page.click('#mv-valider'); await page.waitForSelector('#mv-message');
await page.click('.mv-cat[data-cat="agneaux"]'); await page.click('.mv-type[data-val="Vendu"]'); await page.selectOption('#mv-acheteur', 'Acheteur A');
await page.click('#mv-tout'); await page.click('#mv-valider'); await page.waitForTimeout(100);
const rowsAg = await page.evaluate(() => [...document.querySelectorAll('#mvp-table tr[data-eid]')].map(r => r.children[2].textContent + '|' + r.children[6].textContent.replace(/\s+/g, ' ').trim()));
const ag1 = rowsAg.find(r => r.startsWith('Agnelle'));
check(ag1 && !/Modifier|Annuler/.test(ag1) && /agnelle archivée/.test(ag1), 'agnelle : aucun bouton, mention « archivée » : ' + ag1);
check(rowsAg.filter(r => r.startsWith('Agneau')).length === 3 && rowsAg.filter(r => r.startsWith('Agneau')).every(r => /Annuler le lot/.test(r)) === false, 'agneaux : 2 du lot annulable + l\'agneau vendu avant (sans lot) : ' + JSON.stringify(rowsAg));
const lotAgn = await page.evaluate(() => DB.mouvementsCollectifs.find(l => l.categorie === 'agneaux').id);
reponse = true; confirms.length = 0;
await page.click(`.mv-annuler-lot[data-id="${lotAgn}"] >> nth=0`);
check(/2 agneaux restaurés/.test(confirms[0]), 'agneaux : confirmation avec le nombre restauré : ' + confirms[0]);
const agApres = await page.evaluate(() => DB.brebis[0].agnelages[0].lambs.map(l => [l.statutFinal || null, l.mouvements.length]));
check(JSON.stringify(agApres) === '[[null,1],[null,1],["vendu",2]]', 'agneaux du lot revenus actifs, celui vendu avant reste vendu : ' + JSON.stringify(agApres));
// lot système « Mise à jour inventaire »
await page.evaluate(() => { const eids = [E(9, 59), E(9, 69), E(0, 33)]; DB.brebis.filter(x => eids.includes(x.eid)).forEach(x => { x.mouvements.push({ type: 'Perte', cause: MOTIF_MAJ_INVENTAIRE, date: '2026-10-02', collectifId: 'MC-SYS' }); x.statut = 'perdue'; });
  DB.mouvementsCollectifs.push({ id: 'MC-SYS', categorie: 'brebis', annulable: true, type: 'Perte', cause: MOTIF_MAJ_INVENTAIRE, acheteur: null, date: '2026-10-02', membres: eids, createdAt: 1 }); mvPcEtat = null; render('inventaire'); });
await page.waitForSelector('#mvp-table');
check(await page.evaluate(() => document.querySelector('.mv-annuler-lot[data-id="MC-SYS"]') !== null) && /Lot du 02\/10 · 3 brebis · Mise à jour inventaire/.test(await $t('#mvp-table')), 'lot système affiché avec son libellé');
reponse = false; confirms.length = 0;
await page.click('.mv-annuler-lot[data-id="MC-SYS"] >> nth=0');
check(/Annuler cette « Mise à jour inventaire » \?/.test(confirms[0]) && /3 brebis restaurées/.test(confirms[0]), 'lot système : la confirmation affiche le nombre restauré : ' + confirms[0]);
reponse = true;
await page.click('.mv-annuler-lot[data-id="MC-SYS"] >> nth=0');
check(await page.evaluate(() => DB.brebis.filter(x => [E(9, 59), E(9, 69), E(0, 33)].includes(x.eid)).every(x => x.statut === 'active' && !x.mouvements.some(m => m.collectifId)) && !DB.mouvementsCollectifs.some(l => l.id === 'MC-SYS')), 'lot système annulé : 3 brebis « active », lot supprimé');
console.log('OK 13 agnelles (archivées, aucun bouton), agneaux (lot annulable, nombre restauré), lot système (confirmation avec le nombre restauré).');

// ================================================================ 14. archivés au registre : ni bouton, ni lot partiellement annulé en silence
await jeu();
await page.evaluate(() => { DB.registre.brebis[E(7, 5)] = { eid: E(7, 5), mouvements: [{ type: 'Entrée', date: '2020-01-01' }, { type: 'Vente', acheteur: 'Acheteur A', date: '2026-10-02', collectifId: 'MC-ARC' }], agnelages: [] };
  DB.brebis = DB.brebis.filter(x => x.id !== 'F');
  const B = DB.brebis.find(x => x.id === 'B'); B.mouvements.push({ type: 'Vente', acheteur: 'Acheteur A', date: '2026-10-02', collectifId: 'MC-ARC' }); B.statut = 'vendue';
  DB.mouvementsCollectifs.push({ id: 'MC-ARC', categorie: 'brebis', annulable: true, type: 'Vente', cause: null, acheteur: 'Acheteur A', date: '2026-10-02', membres: [E(9, 59), E(7, 5)], createdAt: 1 }); });
await ouvrir();
const ligArc = await page.evaluate(() => [...document.querySelectorAll('#mvp-table tr[data-eid]')].map(r => r.children[1].textContent.trim() + '|' + r.children[6].textContent.replace(/\s+/g, ' ').trim()));
check(ligArc.some(l => l.startsWith('00005|') && /animal archivé/.test(l) && !/Annuler/.test(l)) && ligArc.some(l => l.startsWith('00059|') && /Annuler le lot/.test(l)), 'archivé : mention sans bouton ; membre vivant : « Annuler le lot » : ' + JSON.stringify(ligArc));
reponse = true; confirms.length = 0;
await page.click('.mv-annuler-lot[data-id="MC-ARC"] >> nth=0');
check(/1 brebis restaurée/.test(confirms[0]) && /1 brebis déjà archivée au registre : non restaurable/.test(confirms[0]), 'confirmation : 1 restaurée, 1 archivée non restaurable : ' + confirms[0]);
const arc = await page.evaluate(() => [DB.brebis.find(x => x.id === 'B').statut, DB.mouvementsCollectifs.find(l => l.id === 'MC-ARC') ? DB.mouvementsCollectifs.find(l => l.id === 'MC-ARC').membres.join() : null, DB.registre.brebis[E(7, 5)].mouvements.length]);
check(arc[0] === 'active' && /00005$/.test(arc[1]) && !/00059/.test(arc[1]) && arc[2] === 2, 'lot conservé pour l\'archivée (jamais supprimé en silence), registre intact : ' + JSON.stringify(arc));
console.log('OK 14 archivés : mention sans bouton ; annulation d\'un lot partiel : le membre archivé reste dans le lot, registre intact.');

// ================================================================ 15. filtres : catégories, type, acheteur, n°, période, « voir tout »
await jeu();
await page.evaluate(() => { const mk = (id, mv, st) => { const s = DB.brebis.find(x => x.id === id); s.mouvements.push(mv); s.statut = st; };
  mk('B', { type: 'Vente', acheteur: 'Acheteur A', date: '2026-10-02' }, 'vendue'); mk('C', { type: 'Morte', cause: 'Mammite', date: '2026-10-02' }, 'morte');
  mk('E', { type: 'Vente', acheteur: 'Acheteur B', date: '2026-10-03' }, 'vendue');
  const bel = DB.beliers.find(x => x.id === 'bel1'); bel.mouvements.push({ type: 'Mort', cause: 'Boiterie', date: '2026-10-02' }); bel.statut = 'mort'; });
await ouvrir();
const comptePer = () => page.evaluate(() => document.querySelectorAll('#mvp-table tr[data-eid]').length);
check(await comptePer() === 5, 'période en cours : 5 mouvements (agneau + 3 brebis + bélier) : ' + await comptePer());
check(/5 mouvements/.test(await $t('#mvp-compte')), 'compteur du tableau');
const cp = await page.evaluate(() => [...document.querySelectorAll('.mvp-cat')].map(b => b.textContent.replace(/\s+/g, ' ').trim()).join('|'));
check(cp === '✓ Brebis 3|✓ Béliers 1|✓ Agnelles 0|✓ Agneaux 1', 'catégories : effectifs dans la période : ' + cp);
await page.click('.mvp-cat[data-cat="brebis"]');
check(await comptePer() === 2, 'décocher Brebis : reste bélier + agneau');
await page.click('.mvp-cat[data-cat="brebis"]');
await page.selectOption('#mvp-type', 'Vente');
check(await comptePer() === 2, 'type = Vente : 2');
await page.selectOption('#mvp-acheteur', 'Acheteur B');
check(await comptePer() === 1, 'acheteur B + Vente : 1');
await page.selectOption('#mvp-type', ''); await page.selectOption('#mvp-acheteur', '');
await page.fill('#mvp-q', '33');
check(await comptePer() === 1 && /00033/.test(await $t('#mvp-table')), 'recherche par n° (33) : 1 ligne');
check(await page.evaluate(() => document.activeElement.id) === 'mvp-q', 'le champ de recherche garde le focus pendant la frappe');
await page.fill('#mvp-q', '');
await page.selectOption('#mvp-periode', 'toutes');
check(await comptePer() === 6, 'toutes périodes : 6 (la brebis vendue le 01/09 s\'ajoute)');
// export : capture des données envoyées à buildXlsxWorkbook
await page.evaluate(() => { window.__xlsx = null; buildXlsxWorkbook = async (feuilles) => { window.__xlsx = feuilles; return new Uint8Array([1]); }; saveOrShareBinaryFile = async (nom) => { window.__xlsxNom = nom; }; });
await page.click('#mvp-export'); await page.waitForTimeout(100);
const xl = await page.evaluate(() => ({ nom: window.__xlsxNom, f: window.__xlsx[0] }));
check(/^mouvements-animaux_2026-10-03\.xlsx$/.test(xl.nom) && xl.f.name === 'Mouvements' && xl.f.rows[0].join() === 'Date,N°,Catégorie,Type,Cause / acheteur,Lot' && xl.f.rows.length === 7, 'export Excel : nom, feuille, en-têtes, 6 lignes (filtres appliqués) : ' + xl.nom + ' ' + xl.f.rows.length);
// voir tout : plus de 50 lignes
await page.evaluate(() => { const s = DB.brebis.find(x => x.id === 'D'); for (let i = 0; i < 60; i++) { const c = JSON.parse(JSON.stringify(s)); c.id = 'X' + i; c.eid = E(1, 100 + i); c.statut = 'vendue'; c.mouvements = [{ type: 'Entrée', date: '2024-01-01' }, { type: 'Vente', acheteur: 'Acheteur A', date: '2026-10-02' }]; DB.brebis.push(c); } mvPcEtat = null; mvPassesEtat.periode = 'courante'; render('inventaire'); });
await page.waitForSelector('#mvp-voir-tout');
check(await comptePer() === 50 && /Voir les \d+ autres/.test(await $t('#mvp-voir-tout')), 'au-delà de 50 lignes : 50 affichées + « Voir les N autres »');
await page.click('#mvp-voir-tout');
check(await comptePer() > 50, '« Voir les autres » affiche tout');
console.log('OK 15 filtres (catégories, type, acheteur, n°, période), focus conservé, export Excel, pagination à 50.');

// ================================================================ 16. mobile : les écrans d'origine ne montrent pas le tableau PC
await jeu();
const mob = await page.evaluate(() => { window.electronAPI.isDesktop = false; render('inventaire'); const r = !document.getElementById('mvp-table') && !!document.querySelector('.tab-bar'); window.electronAPI.isDesktop = true; return r; });
check(mob, 'mobile : onglets d\'origine, pas de tableau des mouvements passés PC');
console.log('OK 16 mobile inchangé.');

// ================================================================ 17. DONNÉES RÉELLES (lecture seule : saveData remplacé, rien n'est écrit sur disque)
if (exportPresent(EXPORT_CORRIGE)) {
  const reel = lireExport(EXPORT_CORRIGE);
  // comptage INDÉPENDANT, directement dans le JSON de l'export : une ligne par mouvement de sortie (vivants + registre archivé), sans doublon
  const SORT = new Set(['Morte', 'Mort', 'Vente', 'Vendu', 'Vente reproduction', 'Perte', 'Autoconsommation']);
  const attendu = new Map(); const addA = (cat, eid, m) => { if (SORT.has(m.type)) attendu.set([eid.replace(/\s+/g, ''), m.type, m.date, m.cause || '', m.acheteur || '', m.collectifId || ''].join('|'), cat); };
  reel.brebis.forEach(s => { (s.mouvements || []).forEach(m => addA('Brebis', s.eid, m)); (s.agnelages || []).forEach(ag => (ag.lambs || []).forEach(l => { if (l.eid && !(l.sexe === 'Femelle' && l.triStatut === 'gardée')) (l.mouvements || []).forEach(m => addA('Agneau', l.eid, m)); })); });
  (reel.beliers || []).forEach(s => (s.mouvements || []).forEach(m => addA('Bélier', s.eid, m)));
  ['brebis', 'beliers', 'agnelles'].forEach(k => Object.entries((reel.registre || {})[k] || {}).forEach(([e, v]) => (v.mouvements || []).forEach(m => addA(k === 'brebis' ? 'Brebis' : k === 'beliers' ? 'Bélier' : 'Agnelle', e, m))));
  const actifsBrebis = reel.brebis.filter(s => (s.statut || 'active') === 'active').length, actifsBeliers = (reel.beliers || []).filter(s => (s.statut || 'actif') === 'actif').length;
  await page.evaluate(j => { DB = migrateData(JSON.parse(j)); window.__saves = 0; saveData = function () { window.__saves++; }; window.__reel = JSON.stringify(DB); }, JSON.stringify(reel));
  const t0 = Date.now(); await ouvrir(); const dt = Date.now() - t0;
  check(dt < 4000, 'rendu de la page avec les données réelles en moins de 4 s : ' + dt + ' ms');
  const catsR = await page.evaluate(() => [...document.querySelectorAll('#mv-categories button')].map(b => b.textContent).join(' | '));
  check(catsR.startsWith('Brebis · ' + actifsBrebis + ' | Béliers · ' + actifsBeliers), 'effectifs actifs réels : ' + catsR + ' (attendu ' + actifsBrebis + ' brebis, ' + actifsBeliers + ' béliers)');
  await page.selectOption('#mvp-periode', 'toutes');
  const nbR = await page.evaluate(() => document.querySelectorAll('#mvp-table tr[data-eid]').length);
  check(nbR === attendu.size, 'tableau « Toutes » = comptage indépendant du JSON : ' + nbR + ' lignes pour ' + attendu.size + ' attendues');
  const parCat = await page.evaluate(() => { const r = {}; document.querySelectorAll('#mvp-table tr[data-eid]').forEach(tr => { const c = tr.children[2].textContent; r[c] = (r[c] || 0) + 1; }); return r; });
  const parCatAtt = {}; attendu.forEach(c => { parCatAtt[c] = (parCatAtt[c] || 0) + 1; });
  check(JSON.stringify(Object.entries(parCat).sort()) === JSON.stringify(Object.entries(parCatAtt).sort()), 'répartition par catégorie identique : ' + JSON.stringify(parCat) + ' / ' + JSON.stringify(parCatAtt));
  // les lots réels (ventes Natera) : libellé et annulation
  const lotsR = await page.evaluate(() => [...new Set([...document.querySelectorAll('#mvp-table tr[data-eid] td:nth-child(6) .pc-pill')].map(p => p.textContent.trim()))]);
  console.log('   lots réels affichés :', JSON.stringify(lotsR));
  check(lotsR.some(l => /^Lot du 15\/09 · 4 brebis · Natera$/.test(l)) && lotsR.some(l => /^Lot du 15\/09 · 4 béliers · Natera$/.test(l)), 'lots réels : « Lot du 15/09 · 4 brebis · Natera » et « … 4 béliers … »');
  const idsR = await page.evaluate(() => DB.mouvementsCollectifs.map(l => [l.id, l.categorie]));
  reponse = false; confirms.length = 0;
  await page.click(`.mv-annuler-lot[data-id="${idsR.find(x => x[1] === 'brebis')[0]}"] >> nth=0`);
  console.log('   confirmation lot réel :', confirms[0].replace(/\n+/g, ' / '));
  check(/Annuler ce lot \?/.test(confirms[0]) && /4 brebis restaurées/.test(confirms[0]), 'lot réel de 4 brebis : la confirmation annonce 4 brebis restaurées');
  check(await page.evaluate(() => JSON.stringify(DB) === window.__reel && window.__saves === 0), 'refus : les données réelles ne bougent pas');
  // aller-retour sur de vraies brebis : vente collective puis annulation du lot => base IDENTIQUE à l'octet près
  reponse = true;
  await ouvrir();
  await page.click('.mv-type[data-val="Vente"]'); await page.selectOption('#mv-acheteur', await page.evaluate(() => DB.acheteurs[0]));
  await page.fill('#mv-q', '1'); await page.click('#mv-tout'); await page.fill('#mv-q', '');
  const nSel = await page.evaluate(() => document.querySelectorAll('#mv-table tr.sel').length);
  check(nSel > 5, 'sélection d\'un lot de vraies brebis : ' + nSel);
  await page.click('#mv-valider'); await page.waitForSelector('#mv-message');
  check(await page.evaluate(n => DB.brebis.filter(s => s.statut === 'vendue').length === n + 4, nSel), 'après la vente : ' + nSel + ' brebis de plus « vendue »');
  const lotNouveau = await page.evaluate(() => DB.mouvementsCollectifs[DB.mouvementsCollectifs.length - 1].id);
  confirms.length = 0;
  await page.click(`.mv-annuler-lot[data-id="${lotNouveau}"] >> nth=0`);
  check(new RegExp(nSel + ' brebis restaurées').test(confirms[0]), 'la confirmation annonce ' + nSel + ' brebis restaurées : ' + confirms[0].split('\n')[2]);
  const finR = await page.evaluate(() => JSON.stringify(DB) === window.__reel);
  check(finR, 'vente puis annulation du lot : la base est IDENTIQUE à l\'octet près à l\'état de départ');
  // lot réel d'origine (hors campagne en cours : période « Toutes ») : annulation acceptée => 4 brebis « active »
  confirms.length = 0;
  await page.selectOption('#mvp-periode', 'toutes');
  await page.click(`.mv-annuler-lot[data-id="${idsR.find(x => x[1] === 'brebis')[0]}"] >> nth=0`);
  const apresReel = await page.evaluate(() => ({ vend: DB.brebis.filter(s => s.statut === 'vendue').length, act: DB.brebis.filter(s => s.statut === 'active').length, lots: DB.mouvementsCollectifs.length }));
  check(apresReel.vend === 0 && apresReel.act === actifsBrebis + 4 && apresReel.lots === 1, 'lot réel annulé : 4 brebis de nouveau actives, un seul lot restant (béliers) : ' + JSON.stringify(apresReel));
  console.log('OK 17 données réelles (lecture seule) : tableau = comptage indépendant du JSON, lots réels « Lot du 15/09 · 4 … · Natera », annulation avec nombre restauré, vente puis annulation du lot = base identique à l\'octet près.');
} else console.log('SKIP 17 : export réel absent (voir tests/README.md)');
await browser.close();
console.log('\nTOUS LES TESTS DE LA PAGE PC « MOUVEMENTS D\'ANIMAUX » SONT PASSÉS');
