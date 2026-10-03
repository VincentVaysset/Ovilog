/* Chantier de tri, parties d, e, f : TRI DES AGNELLES -- logique commune (compteur N/M, classe et lactation de la mère, type de naissance, incohérences remontées
   sans correction), page PC, comportement mobile (carte enrichie, bip qui ouvre la carte sans rien valider, retour au scan, toast avec Annuler).
   saveData REMPLACÉ par un compteur ; jeu synthétique ; l'export réel, s'il est présent, est chargé en LECTURE SEULE (section finale). */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, EXPORT_CORRIGE, exportPresent, lireExport } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1800 } });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
let reponse = true; const confirms = [];
page.on('dialog', d => { if (d.type() === 'confirm') { confirms.push(d.message()); reponse ? d.accept() : d.dismiss(); } else d.accept(); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

const jeuSur = (pg) => pg.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  window.E = (d, n) => '2500162991' + d + String(n).padStart(4, '0');
  const f = (d, n, extra) => Object.assign({ id: 'b' + d + n, eid: E(d, n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] }, extra || {});
  const l = (n, sexe, extra) => Object.assign({ eid: sexe === 'Femelle' || extra && extra.eid ? E(6, n) : undefined, sexe, sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-01-14' }] }, extra || {});
  const A = f(8, 133, { agnelages: [{ campagne: 2025, date: '2026-01-14', codeRepro: 'IA', lambs: [l(1, 'Femelle'), l(2, 'Femelle', { triStatut: 'gardée' }), l(3, 'Mâle')] }] });
  const B = f(9, 59, { agnelages: [{ campagne: 2025, date: '2026-01-19', codeRepro: 'MN', lambs: [l(4, 'Femelle')] }, { campagne: 2024, date: '2025-01-05', codeRepro: 'MN', lambs: [l(5, 'Femelle', { triStatut: 'écartée' })] }] });
  const C = f(0, 33, { agnelages: [{ campagne: 2025, date: '2026-01-25', codeRepro: 'MN', lambs: [l(6, 'Femelle', { statutFinal: 'vendu' }), l(7, 'Femelle', { triStatut: 'gardée' }), l(8, 'Femelle', { triStatut: 'gardée', statutFinal: 'vendu' })] }] });
  DB.brebis = [A, B, C];
  DB.lactationModele = [{ eid: E(8, 133), campagne: 2025, lactationTotale: 452, classeParQuart: '1' }];
  DB.agnelles = [{ id: 'ag2', eid: E(6, 2), origine: 'née', motherEid: E(8, 133), dateEntree: '2026-09-01', mouvements: [{ type: 'Naissance', date: '2026-01-14' }, { type: 'Entrée', date: '2026-09-01' }], sanitaire: [] },
    { id: 'ag3', eid: E(5, 42), origine: 'achetée', dateEntree: '2026-09-10', mouvements: [{ type: 'Entrée', date: '2026-09-10' }], sanitaire: [] }];
  window.__avant = JSON.stringify(DB);
});
const jeu = () => jeuSur(page);
const $t = sel => page.evaluate(s => document.querySelector(s) ? document.querySelector(s).textContent.replace(/\s+/g, ' ').trim() : null, sel);

// ================================================================ 1. logique commune : blocs, compteur N/M, info de la mère
await jeu();
const d = await page.evaluate(() => { const r = triAgnellesDonnees(); const m = x => [x.numero, x.mereNumero, x.classeMere, x.lactMere, x.naissance]; return { aTrier: r.aTrier.map(m), gardees: r.gardees.map(x => [x.numero, x.origine, x.mereNumero, x.classeMere, x.lactMere, x.naissance]), ecartees: r.ecartees.map(m), c: r.compteur }; });
check(JSON.stringify(d.aTrier) === JSON.stringify([['60001', '80133', 1, 452, 'Triple'], ['60004', '90059', null, null, 'Simple']]), 'À trier : femelles nées, sans décision, ni vendues ni mortes ; mère, classe, lactation N-1, type de naissance (« - » = null) : ' + JSON.stringify(d.aTrier));
check(JSON.stringify(d.ecartees) === JSON.stringify([['60005', '90059', null, null, 'Simple']]), 'Écartées : ' + JSON.stringify(d.ecartees));
check(JSON.stringify(d.gardees) === JSON.stringify([['60002', 'Née', '80133', 1, 452, 'Triple'], ['50042', 'Achetée', null, null, null, null]]), 'Triées / achetées : ' + JSON.stringify(d.gardees));
check(JSON.stringify(d.c) === JSON.stringify({ N: 1, M: 4, aTrier: 2, ecartees: 1, achetees: 1, pct: 25 }), 'compteur : N = 1 gardée née ; M = 2 à trier + 1 gardée + 1 écartée = 4 (la vendue, la gardée vendue et l\'achetée n\'y sont pas) : ' + JSON.stringify(d.c));
const inc = await page.evaluate(() => incoherencesTriAgnelles().map(x => [x.type, x.numero, x.mere]));
check(JSON.stringify(inc) === JSON.stringify([['gardée sans fiche d\'agnelle', '60007', '00033']]), 'incohérence remontée (gardée sans fiche, hors vendue) : ' + JSON.stringify(inc));
check(await page.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'rien n\'est corrigé ni écrit par ces calculs');
const rech = await page.evaluate(() => ['60004', '60002', '60005', '50042', '99999'].map(q => { const r = trouverAgnelleTriParNumero(q); return r ? r.bloc : null; }));
check(JSON.stringify(rech) === '["aTrier","gardees","ecartees","gardees",null]', 'recherche par n° : bloc de l\'agnelle : ' + JSON.stringify(rech));
const cp = await page.evaluate(() => ({ pc: compteurTriAgnellesHtml(triAgnellesDonnees().compteur, 'pc'), mob: compteurTriAgnellesHtml(triAgnellesDonnees().compteur, 'mobile') }));
check(/<b[^>]*>1<\/b> triées sur <b[^>]*>4<\/b> femelles nées actives/.test(cp.pc) && /width:25%/.test(cp.pc) && /à trier 2|À trier 2 · écartées 1 · achetées 1 en plus \(hors total\)/.test(cp.pc) && /<b[^>]*>1<\/b> triées sur <b[^>]*>4<\/b>/.test(cp.mob) && /achetées 1 \(hors total\)/.test(cp.mob), 'compteur PC et mobile : même calcul, barre à 25 %');
console.log('OK 1 logique commune : blocs, compteur N/M (achetées, vendues hors total), mère / classe / lactation / naissance (« - » sans donnée), incohérence remontée sans correction, recherche par n°.');


// ================================================================ 2. page PC
await jeu();
await page.evaluate(() => { triPcEtat = null; render('agnelles'); });
await page.waitForSelector('#pc-tri-agnelles');
check(/Tri des agnelles/.test(await $t('#pc-tri-agnelles .pc-seg2')) && await page.evaluate(() => !!document.getElementById('ta-compteur') && !!document.getElementById('ta-table-atrier') && !!document.getElementById('ta-table-gardees') && !!document.getElementById('ta-table-ecartees')), 'page PC : onglets, compteur, 3 blocs');
check(/1 triées sur 4 femelles nées actives/.test(await $t('#ta-compteur')) && /À trier 2 · écartées 1 · achetées 1 en plus \(hors total\)/.test(await $t('#ta-compteur')), 'compteur PC : ' + await $t('#ta-compteur'));
const th1 = await page.evaluate(() => [...document.querySelectorAll('#ta-table-atrier th')].map(x => x.textContent).join('|'));
check(th1 === 'N°|Née le|Mère|Naissance|Classe mère|Lactation mère N-1 (2026)|Tri', 'colonnes À trier : ' + th1);
const r1 = await page.evaluate(() => [...document.querySelectorAll('#ta-table-atrier tr[data-eid]')].map(r => [...r.children].slice(0, 6).map(c => c.textContent.replace(/\s+/g, ' ').trim()).join('|')));
check(r1[0] === '60001|14-01-2026|n°80133 · 8 ans|Triple|1|452,0 L' && r1[1] === '60004|19-01-2026|n°90059 · 7 ans|Simple|-|-', 'lignes À trier (classe et lactation de la mère, « - » sans donnée) : ' + JSON.stringify(r1));
check(await page.evaluate(() => !document.querySelector('.ta-reconsiderer-g[data-id="ag3"]')), 'une achetée n\'a pas « Reconsidérer »');
check(/Incohérences à trancher/.test(await $t('#ta-incoherences')) && /n°60007/.test(await $t('#ta-incoherences')), 'incohérence affichée, non corrigée');
// sélection par n° : met en évidence, ne valide rien
await page.fill('#ta-q', '60004');
check(await page.evaluate(() => document.querySelectorAll('#pc-tri-agnelles tr.sel').length) === 1 && await page.evaluate(() => document.querySelector('#pc-tri-agnelles tr.sel').dataset.eid === E(6, 4)), 'saisie du n° : la ligne est mise en évidence');
check(await page.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'rien n\'est validé par la sélection');
await page.fill('#ta-q', '99999'); check(/Aucune agnelle correspondante/.test(await $t('#ta-q + div, #pc-tri-agnelles .card')) , 'n° inconnu : message');
await page.fill('#ta-q', '');
// Garder : sans confirmation, fiche d'agnelle créée, compteur à jour, Annuler
confirms.length = 0;
await page.click('.ta-garder[data-eid="' + await page.evaluate(() => E(6, 1)) + '"]');
check(confirms.length === 0, 'Garder : aucune confirmation (action réversible)');
const g = await page.evaluate(() => { const a = DB.agnelles.find(x => x.eid === E(6, 1)); const l = findLambByEid(E(6, 1)); return { fiche: !!a, mere: a && a.motherEid === E(8, 133), mv: a && a.mouvements.map(m => m.type).join(), tri: l.triStatut, saves: window.__saves }; });
check(g.fiche && g.mere && g.mv === 'Naissance,Entrée' && g.tri === 'gardée' && g.saves === 1, 'Garder : fiche d\'agnelle (Naissance + Entrée), agneau marqué gardé, une écriture : ' + JSON.stringify(g));
check(/2 triées sur 4 femelles nées actives/.test(await $t('#ta-compteur')) && /n°60001 gardée/.test(await $t('#ta-message')), 'compteur mis à jour (2 sur 4), message de confirmation : ' + await $t('#ta-compteur'));
await page.click('#ta-annuler');
check(await page.evaluate(() => !DB.agnelles.some(x => x.eid === E(6, 1)) && !findLambByEid(E(6, 1)).triStatut) && /1 triées sur 4/.test(await $t('#ta-compteur')), 'Annuler : retour à trier, fiche supprimée, compteur 1 sur 4');
// Écarter : sans confirmation + Annuler
await page.click('.ta-ecarter[data-eid="' + await page.evaluate(() => E(6, 4)) + '"]');
check(confirms.length === 0 && await page.evaluate(() => findLambByEid(E(6, 4)).triStatut) === 'écartée' && /À trier 1 · écartées 2/.test(await $t('#ta-compteur')), 'Écarter : sans confirmation, compteur : ' + await $t('#ta-compteur'));
await page.click('#ta-annuler'); check(await page.evaluate(() => findLambByEid(E(6, 4)).triStatut) === undefined, 'Annuler l\'écartement');
// Reconsidérer une écartée / revenir sur le tri d'une gardée (confirmation)
await page.click('.ta-reconsiderer-e[data-eid="' + await page.evaluate(() => E(6, 5)) + '"]');
check(await page.evaluate(() => findLambByEid(E(6, 5)).triStatut) === undefined && /À trier 3/.test(await $t('#ta-compteur')), 'Reconsidérer une écartée : remise à trier');
reponse = false; confirms.length = 0;
await page.click('.ta-reconsiderer-g[data-id="ag2"]');
check(confirms.length === 1 && await page.evaluate(() => DB.agnelles.some(a => a.id === 'ag2')), 'Reconsidérer une gardée : confirmation, refus = rien');
reponse = true; await page.click('.ta-reconsiderer-g[data-id="ag2"]');
check(await page.evaluate(() => !DB.agnelles.some(a => a.id === 'ag2') && !findLambByEid(E(6, 2)).triStatut), 'accord : fiche supprimée, agneau remis à trier');
// mère, ajout manuel, onglet Lots, export, arrivée avec surbrillance
await page.click('.ta-mere >> nth=0');
check(await page.evaluate(() => currentView) === 'detail', 'le lien « mère » ouvre sa fiche');
await page.evaluate(() => { render('agnelles'); });
await page.click('#ta-ajout'); check(await page.evaluate(() => currentView) === 'add-agnelle', '« + Ajouter manuellement (achetée ou autre) » conservé');
await page.evaluate(() => { render('agnelles'); });
await page.evaluate(() => { window.__xl = []; buildXlsxWorkbook = async (f) => { window.__xl.push(f); return new Uint8Array([1]); }; saveOrShareBinaryFile = async (nom) => { window.__xlNom = nom; }; });
await page.click('#ta-export'); await page.waitForTimeout(100);
check(/^agnelles-triees_2026-10-03\.xlsx$/.test(await page.evaluate(() => window.__xlNom)) && await page.evaluate(() => window.__xl[0][0].rows[0].join()) === 'N°,Origine,Née / entrée le,Mère,Naissance,Classe mère,Lactation mère N-1 (L)' && await page.evaluate(() => window.__xl[0][0].rows.length) === 2, 'Export Excel de la liste des gardées (1 achetée restante) : en-têtes');
await page.evaluate(() => { pendingHighlightLambEid = E(5, 42); render('agnelles'); });
check(await page.evaluate(() => document.querySelector('#pc-tri-agnelles tr.sel') && document.querySelector('#pc-tri-agnelles tr.sel').dataset.eid === E(5, 42)), 'arrivée depuis « Agneaux adoptés » : la ligne est surlignée');
await page.click('#ta-tab-lots'); check(await page.evaluate(() => !!document.getElementById('pc-lots')), 'onglet « Lots »');
console.log('OK 2 page PC : compteur, colonnes, sélection par n° sans validation, Garder / Écarter sans confirmation avec Annuler, Reconsidérer (confirmation pour une gardée), mère, ajout manuel, export, surbrillance.');


// ================================================================ 3. mobile : carte enrichie, compteur, comportement au bip
const ctxM = await browser.newContext({ viewport: { width: 420, height: 900 } });
const mob = await ctxM.newPage();
await mob.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
mob.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
mob.on('dialog', d => { if (d.type() === 'confirm') { confirms.push(d.message()); reponse ? d.accept() : d.dismiss(); } else d.accept(); });
await mob.goto(URL_APP, { waitUntil: 'load' }); await mob.waitForTimeout(300);
await jeuSur(mob);
const $m = sel => mob.evaluate(s => document.querySelector(s) ? document.querySelector(s).textContent.replace(/\s+/g, ' ').trim() : null, sel);
const ouvrirM = async () => { await mob.evaluate(() => { triMobileScan = null; triMobileToast = null; render('agnelles'); }); await mob.waitForSelector('#scan-tri'); };
const scanner = async v => { await mob.fill('#scan-tri', v); await mob.press('#scan-tri', 'Enter'); };
await ouvrirM();
check(/1 triées sur 4 femelles nées actives/.test(await $m('#ta-compteur')) && /À trier 2 · écartées 1 · achetées 1 \(hors total\)/.test(await $m('#ta-compteur')) && await mob.evaluate(() => document.querySelector('#ta-compteur i').style.width) === '25%', 'mobile : compteur « N triées sur M » + barre + détail (même calcul que le PC) : ' + await $m('#ta-compteur'));
const tuiles = await mob.evaluate(() => [...document.querySelectorAll('#candidate-0, #candidate-1')].map(c => c.textContent.replace(/\s+/g, ' ').trim()));
check(/Classe de la mère1Lactation 2026452,0 L/.test(tuiles[0]) && /Classe de la mère-Lactation 2026-/.test(tuiles[1]), 'carte « À trier » enrichie : classe de la mère et « Lactation 2026 » (« - » sans donnée) : ' + tuiles.join(' // '));
check(await mob.evaluate(() => !!document.querySelector('.btn-garder') && !!document.querySelector('.btn-ecarter') && !!document.querySelector('.btn-voir-mere')), 'boutons existants conservés : Garder (trier), Écarter, Voir la fiche de la mère');
// bip d'une agnelle à trier : sa carte s'ouvre SEULE, mise en évidence, rien de validé
await scanner(await mob.evaluate(() => E(6, 4)));
check(await mob.evaluate(() => document.querySelectorAll('[id^="candidate-"]').length) === 1 && await mob.evaluate(() => document.querySelector('[id^="candidate-"]').classList.contains('scan-highlight')) && /n°60004/.test(await $m('[id^="candidate-"]')), 'le bip ouvre directement la carte de n°60004, seule, mise en évidence');
check(await mob.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'rien n\'est validé par le bip');
check(/1 triées sur 4/.test(await $m('#ta-compteur')), 'compteur inchangé');
// Garder : retour au champ de scan vide et focalisé, toast, compteur à jour, bouton Annuler
confirms.length = 0;
await mob.click('.btn-garder');
check(confirms.length === 0 && /n°60004 gardée/.test(await $m('#tri-toast')) && /2 triées sur 4/.test(await $m('#ta-compteur')) && await mob.evaluate(() => document.getElementById('scan-tri').value) === '', 'après Garder : toast « n°60004 gardée », compteur 2 sur 4, champ de scan vide, aucune confirmation');
check(await mob.evaluate(() => document.activeElement && document.activeElement.id) === 'scan-tri', 'le champ de scan est focalisé (prêt pour la suivante)');
check(await mob.evaluate(() => document.querySelectorAll('[id^="candidate-"]').length) === 1, 'la liste des agnelles à trier est de nouveau affichée (1 restante)');
await mob.click('#tri-toast-annuler');
check(await mob.evaluate(() => !DB.agnelles.some(a => a.eid === E(6, 4)) && !findLambByEid(E(6, 4)).triStatut) && /1 triées sur 4/.test(await $m('#ta-compteur')), 'toast « Annuler » : tri annulé, compteur 1 sur 4');
// Écarter : pas de confirmation, toast avec Annuler
await scanner(await mob.evaluate(() => E(6, 1))); await mob.click('.btn-ecarter');
check(confirms.length === 0 && /n°60001 écartée/.test(await $m('#tri-toast')) && await mob.evaluate(() => findLambByEid(E(6, 1)).triStatut) === 'écartée', 'Écarter : sans confirmation, toast avec Annuler');
await mob.click('#tri-toast-annuler'); check(await mob.evaluate(() => findLambByEid(E(6, 1)).triStatut) === undefined, 'Annuler l\'écartement');
// agnelle déjà triée : carte avec son état + Reconsidérer, compteur inchangé
await scanner(await mob.evaluate(() => E(6, 2)));
check(/Gardée le 01-09-2026/.test(await $m('#scan-carte')) && await mob.evaluate(() => !!document.querySelector('#scan-carte .btn-annuler-tri')) && /1 triées sur 4/.test(await $m('#ta-compteur')), 'agnelle déjà gardée scannée : « Gardée le 01-09-2026 » + Reconsidérer, compteur inchangé');
reponse = false; confirms.length = 0; await mob.click('#scan-carte .btn-annuler-tri');
check(confirms.length === 1 && await mob.evaluate(() => DB.agnelles.some(a => a.id === 'ag2')), 'Reconsidérer une gardée : confirmation, refus = rien');
reponse = true;
await mob.click('#btn-fermer-scan'); check(await mob.evaluate(() => !document.getElementById('scan-carte')), 'Retour au scan sans rien valider');
await scanner(await mob.evaluate(() => E(6, 5)));
check(/Écartée/.test(await $m('#scan-carte')) && /1 triées sur 4/.test(await $m('#ta-compteur')), 'agnelle écartée scannée : carte « Écartée »');
await mob.click('.btn-reconsiderer-scan');
check(await mob.evaluate(() => findLambByEid(E(6, 5)).triStatut) === undefined && /remise à trier/.test(await $m('#tri-toast')), 'Reconsidérer une écartée : remise à trier, retour au scan');
await scanner(await mob.evaluate(() => E(5, 42)));
check(/Achetée · entrée le 10-09-2026/.test(await $m('#scan-carte')) && await mob.evaluate(() => !document.querySelector('#scan-carte .btn-annuler-tri')), 'achetée scannée : carte « Achetée », pas de Reconsidérer');
await mob.click('#btn-fermer-scan');
await scanner('999999999999999');
check(/Aucune agnelle correspondante/.test(await $m('#scan-err')), 'EID inconnu : message');
// le toast disparaît seul (≈ 6 s)
await ouvrirM(); await scanner(await mob.evaluate(() => E(6, 4))); await mob.click('.btn-ecarter');
check(!!await mob.evaluate(() => document.getElementById('tri-toast')), 'toast affiché');
await mob.waitForTimeout(6400);
check(await mob.evaluate(() => !document.getElementById('tri-toast')), 'le toast disparaît après quelques secondes (l\'action reste réversible par « Reconsidérer »)');
console.log('OK 3 mobile : compteur, carte enrichie (classe, lactation, « - »), le bip ouvre la carte seule sans rien valider, retour au scan focalisé + toast avec Annuler, agnelle déjà triée (état + Reconsidérer), écartée, achetée.');

await browser.close();
console.log('\nTOUS LES TESTS DU TRI DES AGNELLES SONT PASSÉS');
