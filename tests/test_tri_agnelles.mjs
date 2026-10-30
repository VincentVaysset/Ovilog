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
  window.E = (d, n) => '2500000121' + d + String(n).padStart(4, '0');
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
const cp = await page.evaluate(() => compteurTriAgnellesHtml(triAgnellesDonnees().compteur));
check(/<b>1<\/b> triées sur <b>4<\/b> femelles nées actives/.test(cp) && /width:25%/.test(cp), 'compteur (PC et mobile, une seule ligne, même calcul) : 1 sur 4, barre à 25 %');
console.log('OK 1 logique commune : blocs, compteur N/M (achetées, vendues hors total), mère / classe / lactation / naissance (« - » sans donnée), incohérence remontée sans correction, recherche par n°.');


// ================================================================ 2. page PC
await jeu();
await page.evaluate(() => { triPcEtat = null; render('agnelles'); });
await page.waitForSelector('#pc-tri-agnelles');
check(/Tri des agnelles/.test(await $t('#pc-tri-agnelles .pc-onglets')) && await page.evaluate(() => !!document.getElementById('ta-compteur') && !!document.getElementById('ta-table-atrier') && document.querySelectorAll('.tri-pc-tuiles .tuile-pc').length === 3 && document.querySelectorAll('.tri-onglet').length === 3), 'page PC : onglets Lots / Tri, 3 tuiles, compteur, 3 onglets segmentés, tableau À trier');
check(/1 triées sur 4 femelles nées actives/.test(await $t('#ta-compteur')), 'compteur PC : ' + await $t('#ta-compteur'));
const tuilesPc = await page.evaluate(() => [...document.querySelectorAll('.tri-pc-tuiles .tuile-pc')].map(t => [t.className.replace(/brd-kpi|tuile-pc/g, '').trim(), t.innerText.replace(/\s+/g, ' ').trim()]));
check(JSON.stringify(tuilesPc) === JSON.stringify([['ambre', 'À trier 2'], ['vert', 'Gardées 2 dont 1 achetée'], ['neutre', 'Écartées 1']]), 'tuiles PC : ' + JSON.stringify(tuilesPc));
const th1 = await page.evaluate(() => [...document.querySelectorAll('#ta-table-atrier th')].map(x => x.textContent).join('|'));
check(th1 === 'N°|Naissance|Portée|Mère|Origine|État|Action|Classe mère|Lactation 2026|ISOL père', 'colonnes À trier : ' + th1);
const r1 = await page.evaluate(() => [...document.querySelectorAll('#ta-table-atrier tr[data-eid]')].map(r => [...r.children].filter((c, i) => i !== 6).map(c => c.textContent.replace(/\s+/g, ' ').trim()).join('|')));
check(r1[0] === '60001|14-01-2026|Triple|n°80133|IA|À trier|1|452,0 L|—' && r1[1] === '60004|19-01-2026|Simple|n°90059|MN|À trier|—|—|—', 'lignes À trier (portée, mère, origine = code de la mise bas de la mère, classe et lactation de la mère, « — » sans donnée) : ' + JSON.stringify(r1));
check(await page.evaluate(() => document.querySelectorAll('#pc-tri-agnelles .pc-t td')[0].getBoundingClientRect().height) >= 47, 'lignes du tableau de 48 px');
check(/Incohérences à trancher/.test(await $t('#ta-incoherences')) && /n°60007/.test(await $t('#ta-incoherences')) && await page.evaluate(() => document.getElementById('ta-incoherences').classList.contains('alerte')), 'incohérence affichée en ambre, non corrigée');
// onglets : Gardées (Reconsidérer sauf achetée) et Écartées
await page.click('.tri-onglet[data-onglet="gardees"]');
check(await page.evaluate(() => !document.querySelector('.ta-reconsiderer[data-eid="' + E(5, 42) + '"]') && !!document.querySelector('.ta-reconsiderer[data-eid="' + E(6, 2) + '"]') && !!document.getElementById('ta-ajout')), 'Gardées : Reconsidérer pour une née, pas pour une achetée ; « Ajouter une agnelle » conservé');
const g2 = await page.evaluate(() => [...document.querySelectorAll('#ta-table-gardees tr[data-eid]')].map(r => [...r.children].filter((c, i) => i !== 6).map(c => c.textContent.replace(/\s+/g, ' ').trim()).join('|')));
check(g2[0] === '60002|14-01-2026|Triple|n°80133|IA|Gardée|1|452,0 L|—' && g2[1] === '50042|—|—|—|—|Achetéeentrée le 10-09-2026|—|—|—', 'Gardées (née : portée, mère, origine ; achetée : « — » et date d\'entrée) : ' + JSON.stringify(g2));
await page.click('.tri-onglet[data-onglet="ecartees"]');
check(await page.evaluate(() => !!document.querySelector('.ta-reconsiderer[data-eid="' + E(6, 5) + '"]')), 'Écartées : Reconsidérer');
await page.click('.tri-onglet[data-onglet="aTrier"]');
// saisie d'un n° : Entrée SÉLECTIONNE la ligne (dans son onglet) sans rien valider ; pas de sélection avant Entrée
await page.fill('#ta-q', '60004');
check(await page.evaluate(() => document.querySelectorAll('#pc-tri-agnelles tr.sel').length) === 0, 'la frappe seule ne sélectionne rien');
await page.press('#ta-q', 'Enter');
check(await page.evaluate(() => document.querySelectorAll('#pc-tri-agnelles tr.sel').length) === 1 && await page.evaluate(() => document.querySelector('#pc-tri-agnelles tr.sel').dataset.eid === E(6, 4)), 'Entrée : la ligne est mise en évidence');
check(await page.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'rien n\'est validé par la sélection');
await page.fill('#ta-q', '60002'); await page.press('#ta-q', 'Enter');
check(/Gardées/.test(await $t('.tri-onglet.active')) && await page.evaluate(() => document.querySelector('#pc-tri-agnelles tr.sel').dataset.eid === E(6, 2)), 'une gardée trouvée ouvre son onglet et sélectionne sa ligne');
await page.fill('#ta-q', '99999'); await page.press('#ta-q', 'Enter'); check(/Aucune agnelle correspondante/.test(await $t('#ta-q-err')), 'n° inconnu : message');
await page.fill('#ta-q', ''); await page.press('#ta-q', 'Enter');
await page.click('.tri-onglet[data-onglet="aTrier"]');
// Garder : sans confirmation, fiche d'agnelle créée, compteur à jour, bandeau Annuler
confirms.length = 0;
await page.click('.ta-garder[data-eid="' + await page.evaluate(() => E(6, 1)) + '"]');
check(confirms.length === 0, 'Garder : aucune confirmation (action réversible)');
const g = await page.evaluate(() => { const a = DB.agnelles.find(x => x.eid === E(6, 1)); const l = findLambByEid(E(6, 1)); return { fiche: !!a, mere: a && a.motherEid === E(8, 133), mv: a && a.mouvements.map(m => m.type).join(), tri: l.triStatut, saves: window.__saves }; });
check(g.fiche && g.mere && g.mv === 'Naissance,Entrée' && g.tri === 'gardée' && g.saves === 1, 'Garder : fiche d\'agnelle (Naissance + Entrée), agneau marqué gardé, une écriture : ' + JSON.stringify(g));
check(/2 triées sur 4 femelles nées actives/.test(await $t('#ta-compteur')) && /n°60001 gardée/.test(await $t('#tri-toast')), 'compteur mis à jour (2 sur 4), bandeau : ' + await $t('#tri-toast'));
await page.click('#tri-toast-annuler');
check(await page.evaluate(() => !DB.agnelles.some(x => x.eid === E(6, 1)) && !findLambByEid(E(6, 1)).triStatut) && /1 triées sur 4/.test(await $t('#ta-compteur')), 'Annuler : retour à trier, fiche supprimée, compteur 1 sur 4');
// Écarter : sans confirmation + Annuler
await page.click('.ta-ecarter[data-eid="' + await page.evaluate(() => E(6, 4)) + '"]');
check(confirms.length === 0 && await page.evaluate(() => findLambByEid(E(6, 4)).triStatut) === 'écartée' && /À trier\s*1/.test(await page.evaluate(() => document.querySelector('.tri-pc-tuiles').innerText.replace(/\s+/g, ' '))), 'Écarter : sans confirmation, tuile À trier à 1');
await page.click('#tri-toast-annuler'); check(await page.evaluate(() => findLambByEid(E(6, 4)).triStatut) === undefined, 'Annuler l\'écartement');
// Reconsidérer une écartée / une gardée (un geste ; confirmation seulement si la fiche porte des saisies)
await page.click('.tri-onglet[data-onglet="ecartees"]');
await page.click('.ta-reconsiderer[data-eid="' + await page.evaluate(() => E(6, 5)) + '"]');
check(await page.evaluate(() => findLambByEid(E(6, 5)).triStatut) === undefined && /remise à trier/.test(await $t('#tri-toast')), 'Reconsidérer une écartée : remise à trier, bandeau');
await page.click('#tri-toast-annuler'); check(await page.evaluate(() => findLambByEid(E(6, 5)).triStatut) === 'écartée', 'Annuler : de nouveau écartée');
await page.click('.tri-onglet[data-onglet="gardees"]');
confirms.length = 0; await page.click('.ta-reconsiderer[data-eid="' + await page.evaluate(() => E(6, 2)) + '"]');
check(confirms.length === 0 && await page.evaluate(() => !DB.agnelles.some(a => a.id === 'ag2') && !findLambByEid(E(6, 2)).triStatut), 'Reconsidérer une gardée sans saisie : un geste, fiche retirée, agnelle à trier');
await page.click('#tri-toast-annuler'); check(await page.evaluate(() => DB.agnelles.some(a => a.id === 'ag2') && findLambByEid(E(6, 2)).triStatut === 'gardée'), 'Annuler : la gardée est restaurée');
await page.evaluate(() => { DB.agnelles.find(a => a.id === 'ag2').notes = [{ date: '2026-09-18', texte: 'à surveiller' }]; render('agnelles'); });
reponse = false; confirms.length = 0; await page.click('.ta-reconsiderer[data-eid="' + await page.evaluate(() => E(6, 2)) + '"]');
check(confirms.length === 1 && await page.evaluate(() => DB.agnelles.some(a => a.id === 'ag2')), 'fiche avec saisies : confirmation conservée, refus = rien');
reponse = true; await page.click('.ta-reconsiderer[data-eid="' + await page.evaluate(() => E(6, 2)) + '"]');
check(await page.evaluate(() => !DB.agnelles.some(a => a.id === 'ag2')), 'accord : fiche retirée'); await page.click('#tri-toast-annuler');
// mère, ajout manuel, onglet Lots, exports (suivent l'onglet affiché), arrivée avec surbrillance
await page.click('.tri-onglet[data-onglet="aTrier"]');
await page.click('.ta-mere >> nth=0');
check(await page.evaluate(() => currentView) === 'detail', 'le lien « mère » ouvre sa fiche');
await page.evaluate(() => { render('agnelles'); });
await page.click('.tri-onglet[data-onglet="gardees"]');
await page.click('#ta-ajout'); check(await page.evaluate(() => currentView) === 'add-agnelle', '« Ajouter une agnelle » conservé');
await page.evaluate(() => { triPcEtat = null; render('agnelles'); });
await page.evaluate(() => { window.__xl = []; window.__noms = []; buildXlsxWorkbook = async (f) => { window.__xl.push(f); return new Uint8Array([1]); }; saveOrShareBinaryFile = async (nom) => { window.__noms.push(nom); }; });
await page.click('#ta-export'); await page.waitForTimeout(100);
check(await page.evaluate(() => window.__noms[0]) === 'agnelles-a-trier_2026-10-03.xlsx' && await page.evaluate(() => window.__xl[0][0].rows[0].join()) === 'N°,Naissance,Portée,Mère,Origine,État,Classe mère,Lactation N-1 (L),ISOL père' && await page.evaluate(() => window.__xl[0][0].rows.length) === 3, 'Export Excel de l\'onglet À trier : en-têtes, 2 lignes');
await page.click('.tri-onglet[data-onglet="gardees"]'); await page.click('#ta-export'); await page.waitForTimeout(100);
check(await page.evaluate(() => window.__noms[1]) === 'agnelles-triees_2026-10-03.xlsx' && await page.evaluate(() => window.__xl[1][0].rows[0].join()) === 'N°,Naissance,Portée,Mère,Origine,État,Entrée le,Classe mère,Lactation N-1 (L),ISOL père', 'Export Excel de l\'onglet Gardées (colonne « Entrée le » en plus)');
await page.evaluate(() => { pendingHighlightLambEid = E(5, 42); render('agnelles'); });
check(await page.evaluate(() => document.querySelector('#pc-tri-agnelles tr.sel') && document.querySelector('#pc-tri-agnelles tr.sel').dataset.eid === E(5, 42)), 'arrivée depuis « Agneaux adoptés » : la ligne est sélectionnée dans son onglet');
await page.click('#ta-tab-lots'); check(await page.evaluate(() => !!document.getElementById('pc-lots')), 'onglet « Lots »');
console.log('OK 2 page PC : tuiles, onglets, colonnes (origine, portée, mère), Entrée = sélection sans validation, Garder / Écarter / Reconsidérer avec bandeau Annuler, confirmation seulement avec saisies, exports par onglet.');


// ================================================================ 3. mobile : tuiles, compteur, cartes, bandeau Annuler, scan = sélection sans validation
const ctxM = await browser.newContext({ viewport: { width: 390, height: 900 } });
const mob = await ctxM.newPage();
await mob.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
mob.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
mob.on('dialog', d => { if (d.type() === 'confirm') { confirms.push(d.message()); reponse ? d.accept() : d.dismiss(); } else d.accept(); });
await mob.goto(URL_APP, { waitUntil: 'load' }); await mob.waitForTimeout(300);
await jeuSur(mob);
const $m = sel => mob.evaluate(s => document.querySelector(s) ? document.querySelector(s).textContent.replace(/\s+/g, ' ').trim() : null, sel);
const ouvrirM = async (onglet) => { await mob.evaluate((o) => { triMobileScan = null; triMobileToast = null; triMobileOnglet = o || 'aTrier'; render('agnelles'); }, onglet); await mob.waitForSelector('#scan-tri'); };
const scanner = async v => { await mob.fill('#scan-tri', v); await mob.press('#scan-tri', 'Enter'); };
await ouvrirM();
check(/1 triées sur 4 femelles nées actives/.test(await $m('#ta-compteur')) && await mob.evaluate(() => document.querySelector('#ta-compteur i').style.width) === '25%', 'mobile : une ligne « N triées sur M » + barre, même calcul que le PC : ' + await $m('#ta-compteur'));
const tu = await mob.evaluate(() => [...document.querySelectorAll('.tri-tuiles .tuile-charte')].map(t => [t.className.replace('tuile-charte', '').trim(), t.innerText.replace(/\s+/g, ' ').trim()]));
check(JSON.stringify(tu) === JSON.stringify([['ambre', 'À trier 2'], ['vert', 'Gardées 2 dont 1 achetée'], ['', 'Écartées 1']]), 'trois tuiles : À trier ambre, Gardées vert (nées + achetées, « dont 1 achetée »), Écartées neutre : ' + JSON.stringify(tu));
check(await mob.evaluate(() => [...document.querySelectorAll('.tri-onglet')].map(b => b.textContent).join('|')) === 'À trier|Gardées|Écartées', 'onglets segmentés');
check(await mob.evaluate(() => document.querySelectorAll('table').length === 0 && document.querySelectorAll('.carte-liste').length === 2), 'cartes (jamais de tableau) : 2 agnelles à trier');
const c1 = await mob.evaluate(() => document.querySelector('.carte-liste').textContent.replace(/\s+/g, ' ').trim());
check(/n°60001/.test(c1) && /À trier/.test(c1) && /Née le 14-01-2026 · Triple · mère n°80133 IA/.test(c1) && /Garder/.test(c1) && /Écarter/.test(c1), 'carte À trier : n°, pastille, « Née le … · Triple · mère n°… » + code d\'origine IA, Garder / Écarter : ' + c1);
// toucher une carte : sélection + carte Généalogie (mère, classe, lactation N-1), rien de validé
await mob.click('#tri-carte-' + await mob.evaluate(() => cleanEid(E(6, 1))) + ' .carte-liste-l1');
const gen = await $m('#tri-genealogie');
check(/Généalogie/.test(gen) && /Mère n°80133 · 8 ans/.test(gen) && /Voir la fiche/.test(gen) && /Classe 1 · Lactation 2026 452,0 L/.test(gen) && !/Rang de lactation/.test(gen), 'toucher une carte : Généalogie avec classe et lactation N-1, pas de rang sans cahier SIEOL : ' + gen);
check(await mob.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0), 'la sélection par toucher ne valide rien');
await mob.click('#tri-carte-' + await mob.evaluate(() => cleanEid(E(6, 4))) + ' .carte-liste-l1');
check(/Classe - · Lactation 2026 -/.test(await $m('#tri-genealogie')) && await mob.evaluate(() => document.querySelectorAll('.carte-liste.sel').length) === 1, 'une seule sélection à la fois ; « - » sans donnée');
// bip / n° tapé : l'agnelle trouvée est SÉLECTIONNÉE (cadre vert, « Trouvée »), jamais validée
await ouvrirM();
await scanner(await mob.evaluate(() => E(6, 4)));
check(await mob.evaluate(() => document.querySelectorAll('.carte-liste').length) === 1 && await mob.evaluate(() => document.querySelector('.carte-liste').classList.contains('sel')) && /n°60004/.test(await $m('.carte-liste')) && /Trouvée/.test(await $m('.carte-liste')) && /Mère n°90059/.test(await $m('#tri-genealogie')), 'le scan sélectionne n°60004 : cadre vert, « Trouvée », Généalogie');
check(await mob.evaluate(() => JSON.stringify(DB) === window.__avant && window.__saves === 0) && /1 triées sur 4/.test(await $m('#ta-compteur')), 'rien n\'est validé par le scan, compteur inchangé');
await mob.click('#btn-fermer-scan'); check(await mob.evaluate(() => document.querySelectorAll('.carte-liste').length) === 2, 'Voir toute la liste');
await scanner(await mob.evaluate(() => E(6, 4)));
// Garder : bandeau sombre « n°… gardée · Annuler », sans confirmation, compteur à jour
confirms.length = 0;
await mob.click('.btn-garder');
check(confirms.length === 0 && /n°60004 gardée/.test(await $m('#tri-toast')) && /Annuler/.test(await $m('#tri-toast')) && /2 triées sur 4/.test(await $m('#ta-compteur')) && await mob.evaluate(() => document.getElementById('scan-tri').value) === '', 'Garder : bandeau « n°60004 gardée · Annuler », compteur 2 sur 4, champ vide, aucune confirmation');
check(await mob.evaluate(() => document.activeElement && document.activeElement.id) === 'scan-tri', 'le champ est focalisé (prêt pour la suivante)');
check(await mob.evaluate(() => document.querySelectorAll('.carte-liste').length) === 1, 'la liste des agnelles à trier est de nouveau affichée (1 restante)');
await mob.click('#tri-toast-annuler');
check(await mob.evaluate(() => !DB.agnelles.some(a => a.eid === E(6, 4)) && !findLambByEid(E(6, 4)).triStatut) && /1 triées sur 4/.test(await $m('#ta-compteur')), 'Annuler : tri annulé, compteur 1 sur 4');
// Écarter : sans confirmation + Annuler
await scanner(await mob.evaluate(() => E(6, 1))); await mob.click('.btn-ecarter');
check(confirms.length === 0 && /n°60001 écartée/.test(await $m('#tri-toast')) && await mob.evaluate(() => findLambByEid(E(6, 1)).triStatut) === 'écartée', 'Écarter : sans confirmation, bandeau avec Annuler');
await mob.click('#tri-toast-annuler'); check(await mob.evaluate(() => findLambByEid(E(6, 1)).triStatut) === undefined, 'Annuler l\'écartement');
// agnelle déjà gardée : onglet Gardées, « Trouvée », Reconsidérer sans confirmation (fiche sans saisie) + Annuler
await scanner(await mob.evaluate(() => E(6, 2)));
check(/Gardées/.test(await $m('.tri-onglet.active')) && /Gardée/.test(await $m('.carte-liste')) && /Trouvée/.test(await $m('.carte-liste')) && await mob.evaluate(() => !!document.querySelector('.carte-liste .btn-reconsiderer')) && /1 triées sur 4/.test(await $m('#ta-compteur')), 'gardée scannée : onglet Gardées, « Trouvée », Reconsidérer, compteur inchangé');
confirms.length = 0; await mob.click('.btn-reconsiderer');
check(confirms.length === 0 && /n°60002 remise à trier/.test(await $m('#tri-toast')) && await mob.evaluate(() => !DB.agnelles.some(a => a.id === 'ag2')), 'Reconsidérer une gardée sans saisie : UN geste, aucune confirmation, bandeau');
await mob.click('#tri-toast-annuler');
check(await mob.evaluate(() => DB.agnelles.some(a => a.id === 'ag2') && findLambByEid(E(6, 2)).triStatut === 'gardée'), 'Annuler : la gardée est restaurée');
// fiche avec saisies : la confirmation reste ; refus = rien
await mob.evaluate(() => { DB.agnelles.find(a => a.id === 'ag2').sanitaire.push({ date: '2026-09-15', produit: 'Vitamine' }); });
await ouvrirM('gardees'); reponse = false; confirms.length = 0; await mob.click('.btn-reconsiderer');
check(confirms.length === 1 && await mob.evaluate(() => DB.agnelles.some(a => a.id === 'ag2')), 'Reconsidérer une gardée dont la fiche porte des saisies : confirmation, refus = rien');
reponse = true;
// écartée : Reconsidérer + Annuler
await ouvrirM('ecartees'); await mob.click('.btn-reconsiderer');
check(await mob.evaluate(() => findLambByEid(E(6, 5)).triStatut) === undefined && /remise à trier/.test(await $m('#tri-toast')), 'Reconsidérer une écartée : remise à trier, bandeau');
await mob.click('#tri-toast-annuler'); check(await mob.evaluate(() => findLambByEid(E(6, 5)).triStatut) === 'écartée', 'Annuler : l\'écartée l\'est de nouveau');
// achetée : carte Achetée sans Reconsidérer, ouvre la fiche ; Ajouter une agnelle conservé
await scanner(await mob.evaluate(() => E(5, 42)));
check(/Achetée/.test(await $m('.carte-liste')) && /Entrée le 10-09-2026/.test(await $m('.carte-liste')) && await mob.evaluate(() => !document.querySelector('.carte-liste .btn-reconsiderer')), 'achetée scannée : carte « Achetée », pas de Reconsidérer');
await ouvrirM('gardees');
check(!!await mob.evaluate(() => document.getElementById('btn-add-agnelle')) && /Ajouter une agnelle/.test(await $m('#btn-add-agnelle')), '« Ajouter une agnelle » conservé sous la liste des gardées');
await mob.click('#tri-carte-' + await mob.evaluate(() => cleanEid(E(5, 42))) + ' .carte-liste-l1');
check(await mob.evaluate(() => currentView) === 'agnelle-detail', 'une gardée / achetée s\'ouvre sur sa fiche (Modifier, Vendre, Supprimer y sont)');
await ouvrirM();
await scanner('999999999999999');
check(/Aucune agnelle correspondante/.test(await $m('#scan-err')), 'EID inconnu : message');
// le bandeau disparaît seul (≈ 6 s)
await ouvrirM(); await mob.click('.btn-ecarter >> nth=0');
check(!!await mob.evaluate(() => document.getElementById('tri-toast')), 'bandeau affiché');
await mob.waitForTimeout(6400);
check(await mob.evaluate(() => !document.getElementById('tri-toast')), 'le bandeau disparaît après quelques secondes (l\'action reste réversible par « Reconsidérer »)');
console.log('OK 3 mobile : tuiles, ligne de compteur, onglets, cartes, Généalogie au toucher, scan = sélection sans validation, Garder / Écarter / Reconsidérer avec bandeau Annuler, confirmation seulement avec saisies.');

await browser.close();
console.log('\nTOUS LES TESTS DU TRI DES AGNELLES SONT PASSÉS');
