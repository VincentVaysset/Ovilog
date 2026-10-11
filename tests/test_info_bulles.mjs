/* Chantier « bulles ? » : plus aucune bulle « ? » (❔) sur les écrans traités ; une ligne d'information courte (classe .info, 13 px, #5e5b47) seulement là où elle évite une erreur de saisie,
   un effet inattendu ou une perte de données ; les cases « Mort-né » gardent leur comportement (le champ EID disparaît). Les textes supprimés sont conservés dans docs/manuel_aides_ecrans.md.
   Un groupe d'écrans par section ; la dernière section vérifie que le code n'a plus aucun infoBulleHtml. Jeu SYNTHÉTIQUE, saveData REMPLACÉ, aucune écriture, aucune donnée réelle. */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);

function jeu() {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  const fiche = (id, e, o) => Object.assign({ id, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.brebis = [fiche('P1', eid(8, 1), { numeroCourtTravailSieol: '8001' }), fiche('P2', eid(8, 2), { numeroCourtTravailSieol: '8002' })];
  DB.beliers = []; DB.agnelles = []; DB.lots = [{ id: '1700000000001', nom: 'Brebis doubles', dateCreation: '2026-10-01', membres: [eid(8, 1), eid(8, 2)] }]; DB.registre = { brebis: {}, beliers: {}, agnelles: {} }; DB.mouvementsCollectifs = [];
  window.__avant = JSON.stringify(DB); window.__saves = 0;
}
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 } })).newPage();
await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
await page.evaluate(jeu);
// état d'un écran : bulles restantes, lignes d'information (texte, taille, couleur, nombre de lignes)
const etat = () => page.evaluate(() => ({
  bulles: document.querySelectorAll('#app .info-bulle-btn').length, pictos: document.getElementById('app').textContent.includes('❔'),
  infos: [...document.querySelectorAll('#app .info')].map(e => { const cs = getComputedStyle(e), lh = parseFloat(cs.lineHeight); return { t: e.textContent.trim(), px: cs.fontSize, c: cs.color, lignes: Math.round(e.getBoundingClientRect().height / lh) }; }) }));
const sansBulle = async (msg) => { const e = await etat(); check(e.bulles === 0 && !e.pictos, msg + ' : plus aucune bulle « ? » (' + e.bulles + ')'); return e; };
const uneInfo = (e, texte, msg) => { check(e.infos.some(i => i.t === texte && i.px === '13px' && i.c === 'rgb(94, 91, 71)' && i.lignes <= 2), msg + ' : ligne d\'information « ' + texte + ' » (13 px, #5e5b47, 2 lignes au plus) : ' + JSON.stringify(e.infos)); };

// ================================================================ groupe 1 : Ajout d'agnelage, saisie rapide d'échos, ajout d'écho, historique des échos, mise bas rapide
await page.evaluate(() => { currentSheepId = 'P1'; editContext = null; render('add-agnelage', 'P1'); });
eq((await sansBulle('Ajout d\'agnelage')).infos, [], 'Ajout d\'agnelage : aucune ligne d\'information (la bulle « Mort-né » est supprimée, texte dans le manuel)');
// case « Mort-né » : le champ EID disparaît toujours, plus aucun encart d'aide
const mn = await page.evaluate(() => { const b = document.querySelector('.sexe-opt[data-val="Mort-né"]'); const id = b.dataset.id; const bloc = () => document.querySelector(`.eid-block[data-id="${id}"]`).classList.contains('hidden'); const avant = bloc(); b.click(); return { avant, apres: bloc(), note: document.querySelectorAll('.mortne-note').length }; });
eq(mn, { avant: false, apres: true, note: 0 }, 'Ajout d\'agnelage : « Mort-né » masque le champ EID, sans encart d\'aide');
await page.evaluate(() => { resetEchoRapideSession(); render('echo-rapide'); });
eq((await sansBulle('Saisie rapide d\'échos (nouvelle session)')).infos.map(i => i.t), ['Constat avant le démarrage : choisis « à venir ».'], 'Saisie rapide d\'échos : seule la ligne « Campagne concernée » reste');
check(await page.evaluate(() => document.getElementById('app').textContent.includes('Combinaison résultat + comptage pour cette session') && !!document.getElementById('f-echo-session-combo')), 'Saisie rapide d\'échos : le champ « Combinaison résultat + comptage » reste, sans bulle');
uneInfo(await etat(), 'Constat avant le démarrage : choisis « à venir ».', 'Saisie rapide d\'échos');
await page.evaluate(() => { currentSheepId = 'P1'; render('add-echo', 'P1'); });
uneInfo(await sansBulle('Ajout d\'écho'), 'Constat avant le démarrage : choisis « à venir ».', 'Ajout d\'écho');
await page.evaluate(() => render('historique-echo'));
eq((await sansBulle('Historique des échos (mobile)')).infos, [], 'Historique des échos : aucune ligne d\'information');
await page.evaluate(() => render('misebas-rapide'));
await sansBulle('Mise bas rapide');
eq(await page.evaluate(() => document.querySelectorAll('.mortne-note-rapide').length), 0, 'Mise bas rapide : plus d\'encart « Mort-né »');
check(await page.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'groupe 1 : aucune écriture');
console.log('OK groupe 1 : agnelage, échos rapides, ajout d\'écho, historique des échos, mise bas rapide sans bulle ; une ligne d\'information (Campagne concernée).');

// ================================================================ groupe 2 : lots et échos (Nouveau lot de recherche, Nouveau lot de réforme, Recherche en bergerie)
const CRIT = 'Dans un groupe : « ou » ; entre groupes : « et ». Sans critère, aucune brebis n\'est présélectionnée.';
await page.evaluate(() => render('add-lot'));
{ const e = await sansBulle('Nouveau lot de recherche'); eq(e.infos.map(i => i.t), [CRIT], 'Nouveau lot de recherche : une seule ligne, sous « Critères d\'échographie »'); uneInfo(e, CRIT, 'Nouveau lot de recherche'); }
await page.evaluate(() => render('add-lot-reforme'));
{ const e = await sansBulle('Nouveau lot de réforme'); eq(e.infos.map(i => i.t), [CRIT], 'Nouveau lot de réforme : plus de bulle de tête, une seule ligne sous les critères'); }
await page.evaluate(() => { currentLotId = '1700000000001'; render('lot-search'); });
{ const e = await sansBulle('Recherche en bergerie'); eq(e.infos.map(i => i.t), ['Les coches restent sur cet appareil : elles ne sont pas synchronisées.'], 'Recherche en bergerie : une seule ligne'); uneInfo(e, 'Les coches restent sur cet appareil : elles ne sont pas synchronisées.', 'Recherche en bergerie'); }
check(await page.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'groupe 2 : aucune écriture');
console.log('OK groupe 2 : lots de recherche et de réforme, recherche en bergerie sans bulle ; lignes d\'information (critères, coches sur l\'appareil).');

// ================================================================ groupe 3 : sanitaire (Ordonnances, Sous délai, Contrôle de lot, Gérer les produits, Traitements collectifs)
await page.evaluate(() => {
  DB.brebis.forEach(b => b.sanitaire.push({ date: '2026-09-01', type: 'Traitement', sousType: 'Antiparasitaire', produit: 'Test', collectif: true }));   // anciennes saisies (collectif sans identifiant) : 2 animaux
  window.__avant = JSON.stringify(DB);
});
await page.evaluate(() => render('ordonnances'));
eq((await sansBulle('Ordonnances')).infos, [], 'Ordonnances : aucune ligne d\'information (texte dans le manuel)');
await page.evaluate(() => render('sous-delai'));
{ const T = 'Un produit sans délai renseigné n\'apparaît jamais ici.'; const e = await sansBulle('Sous délai d\'attente'); eq(e.infos.map(i => i.t), [T], 'Sous délai d\'attente : une seule ligne'); uneInfo(e, T, 'Sous délai d\'attente'); }
await page.evaluate(() => render('controle-lot-delai'));
{ const T = 'Rien n\'est enregistré : simple aide-mémoire pendant la traite.'; const e = await sansBulle('Contrôle de lot'); eq(e.infos.map(i => i.t), [T], 'Contrôle de lot : une seule ligne'); uneInfo(e, T, 'Contrôle de lot'); }
await page.evaluate(() => render('gerer-produits'));
eq((await sansBulle('Gérer les produits')).infos, [], 'Gérer les produits : aucune ligne d\'information (texte dans le manuel)');
await page.evaluate(() => render('traitements-collectifs'));
{ const T = 'Supprimer un traitement l\'enlève d\'un coup de toutes les fiches concernées : vérifie le nombre d\'animaux et les dates.'; const e = await sansBulle('Traitements collectifs'); eq(e.infos.map(i => i.t), [T], 'Traitements collectifs : une seule ligne en haut (« Anciennes saisies » fusionnée avec elle)'); uneInfo(e, T, 'Traitements collectifs');
  check(await page.evaluate(() => document.getElementById('app').textContent.includes('Anciennes saisies (sans identifiant)')), 'Traitements collectifs : le titre « Anciennes saisies (sans identifiant) » reste, sans bulle'); }
check(await page.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'groupe 3 : aucune écriture');
console.log('OK groupe 3 : ordonnances, sous délai, contrôle de lot, produits, traitements collectifs sans bulle ; lignes d\'information (sans délai, rien enregistré, suppression).');

// ================================================================ groupe 4 : listes, scan et bilan (Mise à jour d'inventaire, Liste en série, Agnelles « À trier », Bilan de lactation)
await page.evaluate(() => { render('maj-inventaire'); window.__avant = JSON.stringify(DB); });   // l'écran initialise sa session en mémoire (sans saveData) : la comparaison repart de là
eq((await sansBulle('Mise à jour d\'inventaire')).infos, [], 'Mise à jour d\'inventaire : aucune ligne d\'information');
check(await page.evaluate(() => !!document.getElementById('scan-maj-inventaire') && document.getElementById('app').textContent.includes('Scanner une brebis')), 'Mise à jour d\'inventaire : le champ « Scanner une brebis » reste');
await page.evaluate(() => render('liste-serie'));
eq((await sansBulle('Liste en série')).infos, [], 'Liste en série : aucune ligne d\'information');
check(await page.evaluate(() => !!document.getElementById('scan-liste-serie') && document.getElementById('app').textContent.includes('Scanner un animal')), 'Liste en série : le champ « Scanner un animal » reste');
await page.evaluate(() => render('agnelles'));
eq((await sansBulle('Agnelles (tri)')).infos, [], 'Agnelles : aucune ligne d\'information');
check(await page.evaluate(() => document.getElementById('app').textContent.includes('À trier (femelles nées sur l\'exploitation)')), 'Agnelles : le titre « À trier » reste, sans bulle');
await page.evaluate(() => { bilanCampagneTab = 'lactation'; bilanLactationCampagneAffichee = 2026; render('bilan-campagne'); });
eq((await sansBulle('Bilan de lactation (mobile)')).infos, [], 'Bilan de lactation : aucune ligne d\'information (texte dans le manuel)');
check(await page.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'groupe 4 : aucune écriture');
console.log('OK groupe 4 : mise à jour d\'inventaire, liste en série, agnelles, bilan de lactation sans bulle.');

// ================================================================ groupe 5 : imports et première configuration
await page.evaluate(() => { render('premiere-configuration'); });
{ const T = 'Non suivi, CLS (simplifié) ou CLO (officiel) — modifiable dans Paramètres > Exploitation.'; const e = await sansBulle('Première configuration'); eq(e.infos.map(i => i.t), [T], 'Première configuration : un texte sous le champ « Type de suivi laitier »'); uneInfo(e, T, 'Première configuration');
  check(await page.evaluate(() => { const sel = document.getElementById('f-premconf-type-suivi'), t = document.querySelector('.info.sous-champ'); return !!sel && !!t && sel.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING; }), 'Première configuration : le texte est placé sous le champ'); }
for (const [vue, champs] of [['import-bilan-lactation', ['Fichier CSV']], ['import-controle-laitier-sieol', ['Fichier résumé', 'Fichier cahier de contrôle']], ['import-correspondance-sieol', ['Fichier modèle Ovilog']], ['import-lactation-modele', ['Fichier modèle Ovilog']], ['import-nouveaux-animaux', ['Fichier modèle Ovilog']], ['import-controle-laitier-modele', ['Fichier modèle Ovilog']]]) {
  await page.evaluate(v => render(v), vue);
  eq((await sansBulle('Import ' + vue)).infos, [], vue + ' : aucune ligne d\'information (format du fichier : texte dans le manuel)');
  check(await page.evaluate(ch => ch.every(c => [...document.querySelectorAll('#app label')].some(l => l.textContent.trim() === c)), champs), vue + ' : les champs « ' + champs.join(' », « ') + ' » restent, sans bulle');
}
// conflits d'import : une ligne d'information sous le titre « Conflits à trancher » ; « Valeurs à vérifier » sans bulle
await page.evaluate(() => { DB.resumeControleLaitier = [{ campagne: 2026, controle: 1 }]; window.__avant = JSON.stringify(DB); render('import-controle-laitier-sieol'); });
await page.selectOption('#import-cl-campagne', '2026');
await page.click('.cl-controle-opt[data-controle="1"]');
await page.setInputFiles('#import-cl-resume-file', { name: 'resume.csv', mimeType: 'text/csv', buffer: Buffer.from('num_controle;date_controle;lait_total;nb_brebis\n1;20/01/2027;1500;10\n') });
await page.waitForFunction(() => document.getElementById('app').textContent.includes('Conflits à trancher'), null, { timeout: 5000 });
{ const T = 'Rien n\'est écrasé sans ton choix ; sans réponse, la valeur actuelle est conservée.'; const e = await sansBulle('Import SIEOL : conflits'); eq(e.infos.map(i => i.t), [T], 'Conflits à trancher : une seule ligne d\'information'); uneInfo(e, T, 'Conflits à trancher');
  check(await page.evaluate(() => { const t = [...document.querySelectorAll('#app div')].find(d => /^Conflits à trancher \(\d+\)$/.test(d.textContent.trim()) && d.children.length === 0); return !!t && t.nextElementSibling && t.nextElementSibling.classList.contains('info'); }), 'Conflits à trancher : la ligne suit immédiatement le titre'); }
check(await page.evaluate(() => window.__saves === 0), 'groupe 5 : aucune écriture');
console.log('OK groupe 5 : première configuration (texte sous le champ), sept écrans d\'import sans bulle, conflits d\'import (ligne d\'information).');

await browser.close();
console.log('\nTOUS LES TESTS « BULLES ? » SONT PASSÉS.');
