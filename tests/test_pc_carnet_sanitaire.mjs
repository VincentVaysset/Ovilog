/* Carnet sanitaire PC, parcours en 2 écrans (maquette) : écran 1 = le soin (champs obligatoires et conditionnels, délais repris de la
   fiche produit et modifiables, colonne de droite), écran 2 = les animaux (filtres multi-choix, recherche n°, millésime, statut, lot ;
   lignes cliquables ; Tout cocher sur le résultat filtré ; seuls les animaux ACTIFS ; agneaux hors parcours ; pastille « déjà sous
   délai » jamais bloquante), UN soin PAR animal, annulation du lot entier (avec confirmation), rien d'écrit avant l'enregistrement.
   saveData est REMPLACÉ par un compteur (rien n'est persisté). Jeu synthétique, aucun EID réel. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';

const browser = await chromium.launch(LAUNCH);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1300 } });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
let reponse = true; const confirms = [];
page.on('dialog', d => { if (d.type() === 'confirm') { confirms.push(d.message()); reponse ? d.accept() : d.dismiss(); } else d.accept(); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
await page.evaluate(() => {
  DB = migrateData({});
  window.__saves = 0; saveData = function () { window.__saves++; };      // rien n'est persisté
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.produits = { vaccins: ['Bravoxin 10'], antibiotiques: ['Intramicine', 'Cefalex'], antiparasitaires: ['Ivomec'], antiinflammatoires: ['Finadyne'], autres: [] };
  DB.produitsInfo = {
    Intramicine: { posologie: '8 cc', delaiAttente: 7, delaiLait: 7, delaiViande: 28, surOrdonnance: false, reserveVeterinaire: false },
    Finadyne: { posologie: '2 cc', delaiAttente: 0, delaiLait: 0, delaiViande: 5, surOrdonnance: true, reserveVeterinaire: false },
    Ivomec: { posologie: null, delaiAttente: 3, delaiLait: 3, delaiViande: 14, surOrdonnance: false, reserveVeterinaire: true },
    'Bravoxin 10': { posologie: '2 cc', delaiAttente: 0, delaiLait: 0, delaiViande: 0, surOrdonnance: false, reserveVeterinaire: false },
    Cefalex: { posologie: '5 cc', delaiAttente: 4 }                                                          // ancienne valeur : à confirmer
  };
  DB.ordonnances = [{ id: 'o1', numero: 'ORD-2026-1', date: '2026-09-15', veterinaire: 'Dr Martin', produits: [{ nom: 'Finadyne' }] }];
  DB.intervenants = ['Éleveur', 'Marie'];
  const b = [];
  for (let i = 1; i <= 3; i++) b.push(fiche(eid(3, i)));                                  // 3 brebis de 2023
  for (let i = 4; i <= 5; i++) b.push(fiche(eid(5, i)));                                  // 2 de 2025 (millésime le plus jeune : antenaises)
  b.push(fiche(eid(3, 6), { statut: 'vendue' }));                                         // inactive : jamais proposée
  b[0].sanitaire = [{ type: 'Traitement', sousType: 'Antibiotique', produit: 'Intramicine', date: '2026-09-30', quantiteCc: 8, intervenant: 'Éleveur', commentaire: '', delaiLaitJours: 7, delaiViandeJours: 28, dureeJours: 1 }];   // déjà sous délai
  DB.brebis = b;
  DB.beliers = [fiche(eid(2, 90), { statut: 'actif' })];
  DB.agnelles = [fiche(eid(6, 70))];
  b[1].agnelages = [{ date: '2026-09-25', campagne: 2026, lambs: [{ eid: eid(6, 800), sexe: 'Mâle', statut: 'vivant', sanitaire: [] }] }];
  DB.lots = [{ id: 'L1', nom: 'Lot A', membres: [eid(3, 2), eid(3, 3)] }];
  DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  window.E = eid;
  window.__avant = JSON.stringify(DB);
});
const $t = sel => page.evaluate(s => document.querySelector(s) ? document.querySelector(s).textContent.replace(/\s+/g, ' ').trim() : null, sel);
const nbSoins = () => page.evaluate(() => DB.brebis.concat(DB.beliers, DB.agnelles).reduce((s, a) => s + (a.sanitaire || []).length, 0));
const ouvrir = async () => { await page.evaluate(() => { carnetSanitairePcEtat = null; carnetDernierLot = null; render('sanitaire'); }); await page.waitForSelector('#pc-carnet'); };

// ================================================================ 1. écran 1 : le soin
await ouvrir();
check(await page.evaluate(() => document.querySelectorAll('.pc-etapes .s').length === 2 && /1 · Le soin/.test(document.querySelector('.pc-etapes').textContent)), 'parcours en 2 étapes affiché');
check(await page.evaluate(() => document.getElementById('cs-date').value === '2026-10-02' && document.getElementById('cs-faitpar').value === 'Éleveur' && document.getElementById('cs-duree').value === '1'), 'date du jour, durée 1, « Fait par » prérempli Éleveur');
check(await page.evaluate(() => !!document.querySelector('.pc-side #cs-dates') && !!document.querySelector('.pc-side #cs-fiche') && !!document.querySelector('.pc-side #cs-alertes')), 'colonne droite : dates calculées, fiche produit, alertes');
check(!/ANMV|anmv/.test(await page.evaluate(() => document.getElementById('pc-carnet').textContent)), 'aucune mention ANMV');
// Suivant à vide : toutes les erreurs
await page.click('#cs-suivant');
let err = await $t('#cs-erreurs');
for (const m of ['Choisis le produit', 'dose par animal', 'voie d\'administration', 'délai viande', 'délai lait']) check(new RegExp(m).test(err), 'erreur attendue « ' + m + ' » : ' + err);
check(await page.evaluate(() => document.querySelector('.pc-etapes .s.on').textContent.startsWith('1')) && await nbSoins() === 1 && await page.evaluate(() => window.__saves) === 0, 'toujours écran 1, rien d\'écrit');
console.log('OK 1 écran 1 : préremplissages, colonne droite, champs obligatoires signalés, rien d\'écrit.');

// ================================================================ 2. produit : délais repris, dates en direct, conditionnels
await page.selectOption('#cs-produit', 'Intramicine');
check(await page.evaluate(() => document.getElementById('cs-viande').value === '28' && document.getElementById('cs-lait').value === '7'), 'délais repris de la fiche (viande 28, lait 7)');
await page.fill('#cs-date', '2026-09-20'); await page.fill('#cs-duree', '1'); await page.fill('#cs-lait', '3'); await page.fill('#cs-viande', '10');
let dates = await $t('#cs-dates');
check((dates.match(/\d{2}-\d{2}-\d{4}/g) || []).join() === '20-09-2026,24-09-2026,01-10-2026', '20/09 + durée 1 + lait 3 → dernière 20/09, lait 24/09, viande (10) 01/10 : ' + dates);
check(await page.evaluate(() => (DB.produitsInfo.Intramicine.delaiLait === 7 && DB.produitsInfo.Intramicine.delaiViande === 28)), 'modifier les délais dans le formulaire ne modifie pas la fiche produit');
await page.fill('#cs-duree', '3');
check(((await $t('#cs-dates')).match(/\d{2}-\d{2}-\d{4}/g) || []).slice(0, 2).join() === '22-09-2026,26-09-2026', 'durée 3 jours : dernière 22/09, reprise lait 26/09');
await page.fill('#cs-lait', '0'); await page.fill('#cs-viande', '0');
check(/aucune attente/.test(await $t('#cs-dates')), 'délais 0 : « aucune attente »');
await page.fill('#cs-lait', '7'); await page.fill('#cs-viande', '28');
// pas de dose / voie : refusé ; dose ok + voie ok
await page.click('#cs-suivant');
err = await $t('#cs-erreurs');
check(/dose par animal/.test(err) && /voie/.test(err) && !/délai/.test(err) && !/produit \(nom/.test(err), 'dose et voie obligatoires pour un traitement : ' + err);
// produit sur ordonnance (Finadyne)
await page.selectOption('#cs-categorie', 'Anti-inflammatoire'); await page.selectOption('#cs-produit', 'Finadyne');
check(await page.evaluate(() => document.getElementById('cs-ord-etoile').textContent.trim() === '*') && /sur ordonnance/i.test(await $t('#cs-alertes')), 'Finadyne sur ordonnance : n° ordonnance marqué obligatoire');
await page.fill('#cs-dose', '2'); await page.selectOption('#cs-voie', { index: 1 });
await page.click('#cs-suivant');
check(/ordonnance est obligatoire/.test(await $t('#cs-erreurs')), 'ordonnance manquante : refusé');
await page.selectOption('#cs-ordonnance', 'ORD-2026-1');
check(await page.evaluate(() => document.getElementById('cs-prescripteur').value === 'Dr Martin'), 'prescripteur proposé depuis l\'ordonnance');
// réservé au vétérinaire (Ivomec)
await page.selectOption('#cs-categorie', 'Antiparasitaire'); await page.selectOption('#cs-produit', 'Ivomec');
check(await page.evaluate(() => document.getElementById('cs-veto-resp').style.display !== 'none'), 'réservé vétérinaire : champ « Vétérinaire responsable » affiché');
await page.fill('#cs-dose', '1'); await page.selectOption('#cs-voie', { index: 1 });
await page.click('#cs-suivant');
check(/vétérinaire responsable est obligatoire/.test(await $t('#cs-erreurs')) && /personne qui administre/.test(await $t('#cs-erreurs')), 'réservé vétérinaire avec « Éleveur » : personne qui administre ET vétérinaire responsable exigés : ' + await $t('#cs-erreurs'));
await page.fill('#cs-faitpar', 'Marie'); await page.fill('#cs-vetoresp', 'Dr Martin');
// produit à confirmer (Cefalex) : délais à saisir, rien d'hérité
await page.selectOption('#cs-categorie', 'Antibiotique'); await page.selectOption('#cs-produit', 'Cefalex');
check(await page.evaluate(() => document.getElementById('cs-viande').value === '' && document.getElementById('cs-lait').value === '') && /ancienne valeur à confirmer/i.test(await $t('#cs-fiche')), 'ancienne valeur : délais non préremplis, fiche signalée « à confirmer »');
// durée 0 refusée
await page.selectOption('#cs-produit', 'Intramicine'); await page.fill('#cs-dose', '8'); await page.selectOption('#cs-voie', { index: 1 });
await page.fill('#cs-duree', '0'); await page.click('#cs-suivant');
check(/durée/.test(await $t('#cs-erreurs')), 'durée 0 refusée');
// Autre : dose, voie, produit, délais facultatifs
await page.fill('#cs-duree', '1');
await page.click('.cs-type[data-val="Autre"]');
await page.click('#cs-suivant');
check(await page.evaluate(() => document.querySelector('.pc-etapes .s.on').textContent.startsWith('2')), '« Autre · Soin de plaie » : sans produit, dose, voie ni délais, passe à l\'écran 2');
check(/Soin de plaie/.test(await $t('#cs-recap')), 'récapitulatif du soin de plaie');
console.log('OK 2 règles : délais repris et modifiables sans toucher la fiche, dates en direct, délai 0, durée, ordonnance / réservé vétérinaire / fiche à confirmer, soin « Autre » avec champs facultatifs.');

// ================================================================ 3. écran 2 : filtres, sélection
await page.click('#cs-modifier');
await page.waitForSelector('#cs-date');
await page.click('.cs-type[data-val="Traitement"]');
await page.selectOption('#cs-produit', 'Intramicine');
await page.fill('#cs-date', '2026-10-02'); await page.fill('#cs-duree', '2');
await page.fill('#cs-dose', '8'); await page.selectOption('#cs-voie', { index: 1 });
await page.fill('#cs-motif', 'boiterie'); await page.fill('#cs-lot', 'LOT123');
await page.click('#cs-suivant');
await page.waitForSelector('#cs-table');
const lignes = () => page.evaluate(() => [...document.querySelectorAll('#cs-table tr.clic')].map(r => r.dataset.eid));
let l = await lignes();
const numerosOrdre = await page.evaluate(() => [...document.querySelectorAll('#cs-table tr.clic')].map(r => r.children[1].textContent.trim() + '/' + r.children[2].textContent.trim()));
check(numerosOrdre.join() === 'n°00090/Bélier,n°00001/Brebis,n°00002/Brebis,n°00003/Brebis,n°00004/Antenaise,n°00005/Antenaise,n°00070/Agnelle', 'tri de l\'écran 2 : âge décroissant (bélier 4 ans, brebis 3 ans, antenaises 1 an, agnelle 0), puis n° croissant à âge égal : ' + numerosOrdre.join());
check(l.length === 5 + 1 + 1, 'animaux actifs : 5 brebis (dont antenaises) + 1 bélier + 1 agnelle = 7, ni vendue, ni agneau : ' + l.length);
check(!(await page.evaluate(() => /vendue|Vendue/.test(document.getElementById('cs-table').textContent))) && !l.includes(await page.evaluate(() => E(3, 6))) && !l.includes(await page.evaluate(() => E(6, 800))), 'animal inactif et agneau absents');
const cats = await page.evaluate(() => [...document.querySelectorAll('.cs-cat')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
check(cats.join('|') === '✓ Brebis 3|✓ Antenaises 2|✓ Agnelles 1|✓ Béliers 1', 'catégories avec comptes : ' + cats.join('|'));
check(/déjà sous délai/.test(await $t('#cs-nsel')) === false, 'rien de sélectionné : pas de mention de délai');
const ligne0 = await page.evaluate(() => { const e = E(3, 1); return document.querySelector('tr[data-eid="' + e + '"]').textContent.replace(/\s+/g, ' ').trim(); });
check(/lait dès le 08\/10/.test(ligne0) && /viande dès le 29\/10/.test(ligne0), 'brebis déjà sous délai : pastille informative (lait dès le 08/10, viande dès le 29/10) : ' + ligne0);
// multi-choix : décocher Antenaises, Agnelles, Béliers
await page.click('.cs-cat[data-cat="antenaises"]'); await page.click('.cs-cat[data-cat="agnelles"]'); await page.click('.cs-cat[data-cat="beliers"]');
check((await lignes()).length === 3, 'seulement Brebis : 3 lignes');
await page.click('.cs-cat[data-cat="antenaises"]');
check((await lignes()).length === 5, 'Brebis + Antenaises (multi-choix) : 5 lignes');
await page.fill('#cs-q', '00004');
check((await lignes()).length === 1 && (await lignes())[0] === await page.evaluate(() => E(5, 4)), 'recherche d\'un n° : 1 ligne');
await page.fill('#cs-q', '');
await page.selectOption('#cs-millesime', '2023');
check((await lignes()).length === 3, 'millésime 2023 : 3 lignes');
await page.selectOption('#cs-millesime', '');
await page.selectOption('#cs-flot', 'L1');
check((await lignes()).length === 2, 'lot A : 2 lignes');
await page.click('#cs-reset');
check((await lignes()).length === 7 && await page.evaluate(() => document.getElementById('cs-q').value === ''), 'réinitialiser : 7 lignes');
// clic sur une ligne coche ; Tout cocher sur le résultat filtré uniquement
await page.click('.cs-cat[data-cat="agnelles"]'); await page.click('.cs-cat[data-cat="beliers"]'); await page.click('.cs-cat[data-cat="antenaises"]');
await page.click('#cs-tout');
check(/3 sélectionnés/.test(await $t('#cs-compte')) && /3 animaux sélectionnés/.test(await $t('#cs-nsel')) && /1 déjà sous délai/.test(await $t('#cs-nsel')), 'Tout cocher : 3 brebis, 1 déjà sous délai (information) : ' + await $t('#cs-nsel'));
await page.click('.cs-cat[data-cat="antenaises"]'); await page.click('.cs-cat[data-cat="beliers"]');
check(/3 sélectionnés/.test(await $t('#cs-compte')) && /5 animaux correspondants|animaux correspondants/.test(await $t('#cs-compte')), 'la sélection survit au changement de filtre : ' + await $t('#cs-compte'));
await page.click('#cs-rien');
check(/0 sélectionné/.test(await $t('#cs-compte')), 'Tout décocher sur le résultat filtré');
await page.click('tr[data-eid="' + await page.evaluate(() => E(5, 4)) + '"]');
check(/1 sélectionné/.test(await $t('#cs-compte')) && await page.evaluate(() => document.querySelector('tr.sel') !== null), 'clic sur la ligne : cochée');
await page.click('tr[data-eid="' + await page.evaluate(() => E(5, 4)) + '"]');
check(/0 sélectionné/.test(await $t('#cs-compte')), 'second clic : décochée');
check(await nbSoins() === 1 && await page.evaluate(() => window.__saves) === 0, 'rien d\'écrit pendant la sélection');
console.log('OK 3 écran 2 : 7 actifs (ni vendue ni agneau), filtres multi-choix, recherche, millésime, lot, réinitialiser, Tout cocher / décocher sur le filtré, pastille sans blocage, rien d\'écrit.');

// ================================================================ 4. enregistrement : un soin par animal, annulation du lot
await page.click('#cs-enregistrer');
check(/Sélectionne au moins un animal/.test(await $t('#cs-msg')) && await nbSoins() === 1, 'aucun animal : refusé');
await page.click('#cs-reset');
await page.click('#cs-tout');          // 5 brebis + 1 agnelle + 1 bélier
reponse = false;
await page.click('#cs-enregistrer');
check(await nbSoins() === 1 && await page.evaluate(() => window.__saves) === 0 && /7 animaux/.test(confirms[confirms.length - 1]), 'confirmation refusée : rien enregistré : ' + confirms[confirms.length - 1]);
reponse = true;
await page.click('#cs-enregistrer');
await page.waitForSelector('#cs-dernier-lot');
check(await nbSoins() === 8 && await page.evaluate(() => window.__saves) === 1, '7 soins enregistrés (un par animal), une écriture');
const soins = await page.evaluate(() => DB.brebis.concat(DB.beliers, DB.agnelles).map(a => (a.sanitaire || []).filter(s => s.collectifId).map(s => JSON.parse(JSON.stringify(s)))).flat());
check(soins.length === 7 && new Set(soins.map(s => s.collectifId)).size === 1 && soins.every(s => s.collectif === true), 'même lot (collectifId) pour les 7 soins');
const s0 = soins[0];
check(s0.produit === 'Intramicine' && s0.type === 'Traitement' && s0.sousType === 'Antibiotique' && s0.date === '2026-10-02' && s0.dureeJours === 2 && s0.quantiteCc === 8 && typeof s0.voie === 'string' && s0.voie && s0.intervenant === 'Marie' && s0.numeroOrdonnance === 'ORD-2026-1' && s0.veterinairePrescripteur === 'Dr Martin' && s0.delaiLaitJours === 7 && s0.delaiViandeJours === 28 && s0.motif === 'boiterie' && s0.lot === 'LOT123', 'contenu du soin : ' + JSON.stringify(s0));
check(!('veterinaireResponsable' in s0) && !('peremption' in s0), 'champs facultatifs vides ou sans objet (produit non réservé au vétérinaire) absents du soin');
check(await page.evaluate(() => { const objs = DB.brebis.concat(DB.beliers, DB.agnelles).flatMap(a => a.sanitaire || []).filter(s => s.collectifId); return new Set(objs).size === 7; }), 'sept objets distincts (un soin par animal, pas un objet partagé)');
check(await page.evaluate(() => DB.traitementsCollectifs.length === 1 && DB.traitementsCollectifs[0].categorie === 'multi' && DB.traitementsCollectifs[0].membres.length === 7), 'historique collectif : 1 entrée « multi » avec 7 membres');
check(await page.evaluate(() => DB.brebis[0].sanitaire.length === 2 && DB.brebis[0].sanitaire[0].date === '2026-09-30'), 'le soin déjà présent d\'une brebis n\'est pas modifié (le nouveau s\'ajoute)');
check(await page.evaluate(() => DB.brebis[1].agnelages[0].lambs[0].sanitaire.length === 0), 'les agneaux n\'ont rien reçu');
check(await page.evaluate(() => DB.brebis[5].sanitaire.length === 0), 'la brebis vendue n\'a rien reçu');
check(/7 animaux/.test(await $t('#cs-dernier-lot')) && await page.evaluate(() => document.querySelector('.pc-etapes .s.on').textContent.startsWith('1')), 'bandeau « Soin enregistré » + retour à l\'écran 1 réinitialisé');
// l'historique des traitements collectifs affiche le lot « multi »
await page.evaluate(() => render('traitements-collectifs'));
check(/Animaux/.test(await page.evaluate(() => document.getElementById('app').textContent)), 'historique : lot multi-catégories lisible');
await page.evaluate(() => render('sanitaire'));
await page.waitForSelector('#cs-dernier-lot');
// annulation : refus puis accord
reponse = false; await page.click('#cs-annuler-lot');
check(await nbSoins() === 8 && /irréversible/.test(confirms[confirms.length - 1]), 'annulation refusée : rien retiré');
reponse = true; await page.click('#cs-annuler-lot');
await page.waitForFunction(() => !document.getElementById('cs-dernier-lot'));
check(await nbSoins() === 1 && await page.evaluate(() => DB.traitementsCollectifs.length === 0 && DB.brebis[0].sanitaire.length === 1 && DB.brebis[0].sanitaire[0].date === '2026-09-30'), 'annulation du lot en un geste : les 7 soins retirés, le soin antérieur conservé, historique collectif retiré');
console.log('OK 4 enregistrement : confirmation, un soin distinct par animal, lot (collectifId), historique multi, agneaux / vendue épargnés, annulation du lot avec confirmation.');

// ================================================================ 5. un seul animal : pas de lot collectif, annulable
await ouvrir();
await page.selectOption('#cs-produit', 'Intramicine'); await page.fill('#cs-dose', '8'); await page.selectOption('#cs-voie', { index: 1 });
await page.click('#cs-suivant'); await page.waitForSelector('#cs-table');
await page.click('tr[data-eid="' + await page.evaluate(() => E(5, 5)) + '"]');
await page.click('#cs-enregistrer');
await page.waitForSelector('#cs-dernier-lot');
check(await page.evaluate(() => { const s = DB.brebis[4].sanitaire; return s.length === 1 && !s[0].collectif && !s[0].collectifId && DB.traitementsCollectifs.length === 0; }) && /1 animal /.test(await $t('#cs-dernier-lot')), 'un seul animal : soin individuel, pas d\'entrée collective');
await page.click('#cs-annuler-lot');
await page.waitForFunction(() => !document.getElementById('cs-dernier-lot'));
check(await page.evaluate(() => DB.brebis[4].sanitaire.length === 0), 'annulable aussi');
console.log('OK 5 un seul animal : soin individuel annulable.');

// ================================================================ 6. mobile non touché : redirection PC uniquement
const mob = await page.evaluate(() => { const o = isDesktopMode; window.electronAPI.isDesktop = false; render('sanitaire'); const t = document.getElementById('app').textContent; window.electronAPI.isDesktop = true; return { carnet: !!document.getElementById('pc-carnet'), t }; });
check(!mob.carnet && /Traitement collectif \(nouveau\)/.test(mob.t), 'hors PC : l\'écran Sanitaire mobile reste celui d\'origine');
console.log('OK 6 mobile : écran Sanitaire d\'origine hors PC.');
await browser.close();
