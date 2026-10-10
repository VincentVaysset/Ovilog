/* Soins enregistrés avec la 1.0.198, sans indicateur bio : listés (jamais modifiés d'office), aperçu avant / après, bouton « Appliquer le mode bio »
   uniquement sur clic, export visible de la sauvegarde AVANT d'écrire (échec ou annulation : rien n'est modifié), cases par soin (identique à la
   fiche = coché, différent = décoché « à vérifier »), annulation EXACTE. Les soins d'avant la 1.0.198 et les soins déjà bio ne sont pas concernés.
   saveData et la sauvegarde visible sont REMPLACÉS (rien n'est persisté ni téléchargé). Jeu synthétique. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1400 } });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
let reponse = true; const confirms = [];
page.on('dialog', d => { if (d.type() === 'confirm') { confirms.push(d.message()); reponse ? d.accept() : d.dismiss(); } else d.accept(); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);
const jeu = (bio) => page.evaluate((bio) => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; };
  window.__backups = []; window.__backupOk = { ok: true };
  sauvegardeVisibleAvantMutation = async (nom, data) => { window.__backups.push({ nom, avant: JSON.stringify(data) }); return window.__backupOk; };
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign({}, DB.exploitation, { elevageBio: !!bio });
  DB.produits = { vaccins: [], antibiotiques: ['Intramicine'], antiparasitaires: [], antiinflammatoires: [], autres: ['Séléphérol'] };
  const info = (l, v) => ({ posologie: null, delaiAttente: l, delaiLait: l, delaiViande: v, surOrdonnance: false, reserveVeterinaire: false });
  DB.produitsInfo = { Intramicine: info(7, 28), 'Séléphérol': info(0, 28) };
  const soin = (date, duree, lait, viande, o) => Object.assign({ type: 'Traitement', sousType: 'Antibiotique', produit: 'Intramicine', date, quantiteCc: 8, voie: 'Intramusculaire', dureeJours: duree, intervenant: 'Éleveur', commentaire: '', delaiLaitJours: lait, delaiViandeJours: viande }, o || {});
  const A = fiche(eid(3, 1), { id: 'A', sanitaire: [
    soin('2026-09-20', 1, 7, 28),                                                    // 1.0.198, identique à la fiche : coché
    soin('2026-09-25', 2, 14, 56),                                                   // 1.0.198, délai ≠ fiche (doublé à la main ?) : décoché, à vérifier
    { type: 'Traitement', sousType: 'Antibiotique', produit: 'Intramicine', date: '2026-08-01', quantiteCc: 8, intervenant: 'Éleveur' },   // ancien soin (avant 1.0.198) : non concerné
    soin('2026-09-10', 1, 7, 28, { bio: true, delaiLaitLegalJours: 7, delaiViandeLegalJours: 28, delaiLaitJours: 14, delaiViandeJours: 56, min48h: 'oui' })   // déjà bio : non concerné
  ] });
  A.agnelages = [{ date: '2026-09-25', campagne: 2026, lambs: [{ eid: eid(6, 801), sexe: 'Mâle', sanitaire: [{ type: 'Traitement', sousType: null, produit: 'Séléphérol', dose: '2 cc', date: '2026-09-25', commentaire: 'Injection systématique à la naissance', dureeJours: 1, delaiLaitJours: 0, delaiViandeJours: 28 }] }] }];
  DB.brebis = [A, fiche(eid(3, 2), { id: 'B' })];
  DB.beliers = []; DB.agnelles = []; DB.lots = [];
  DB.registre = { brebis: { [eid(3, 9)]: { eid: eid(3, 9), sanitaire: [soin('2026-09-15', 1, 7, 28)], mouvements: [], agnelages: [] } }, beliers: {}, agnelles: {} };
  window.E = eid;
  window.__avant = JSON.stringify(DB);
}, bio);
const $t = sel => page.evaluate(s => document.querySelector(s) ? document.querySelector(s).textContent.replace(/\s+/g, ' ').trim() : null, sel);

// ================================================================ 1. liste : seulement les soins de la 1.0.198 sans indicateur bio ; rien écrit
await jeu(true);
await page.evaluate(() => { carnetSanitaireEtat = null; render('sanitaire'); });
await page.waitForSelector('#cs-bandeau-bio');
check(/4 soins enregistrés avec la 1.0.198 sans indicateur bio/.test(await $t('#cs-bandeau-bio')) && /Rien n'est modifié sans ton clic/.test(await $t('#cs-bandeau-bio')), 'bandeau sur le carnet : 4 soins (2 de la brebis, 1 Séléphérol d\'agneau, 1 archivé) : ' + await $t('#cs-bandeau-bio'));
await page.click('#cs-voir-bio'); await page.waitForSelector('#sb-table');
check(await page.evaluate(() => document.querySelectorAll('#sb-table tr[data-i]').length) === 4, '4 lignes : l\'ancien soin (avant 1.0.198) et le soin déjà bio n\'y sont pas');
check(await page.evaluate(() => window.__saves === 0 && JSON.stringify(DB) === window.__avant && window.__backups.length === 0), 'affichage seul : rien écrit, aucune sauvegarde déclenchée');
const k = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#pc-soins-sans-bio .brd-kpi')].map(x => [x.querySelector('.brd-kpi-l').textContent, x.querySelector('.brd-kpi-v').textContent.trim()])));
check(k['Soins concernés'] === '4' && k['À vérifier'] === '1' && k['Déjà passés en bio'] === '0', 'indicateurs : 4 soins, 1 à vérifier : ' + JSON.stringify(k));
// aperçu avant / après sur le soin du 20/09 : lait 28/09 → 05/10, viande 19/10 → 16/11
const l1 = await page.evaluate(() => [...document.querySelectorAll('#sb-table tr[data-i]')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));
const s1 = l1.find(t => /20-09-2026/.test(t));
check(/7 j \/ 28 j/.test(s1) && /14 j \/ 56 j/.test(s1) && /28-09-2026 → 05-10-2026/.test(s1) && /19-10-2026 → 16-11-2026/.test(s1) && /identique à la fiche/.test(s1), 'aperçu : 7/28 → 14/56 ; reprise 28/09 → 05/10 ; vente 19/10 → 16/11 : ' + s1);
const s2 = l1.find(t => /25-09-2026/.test(t) && /Intramicine/.test(t));
check(/différent de la fiche : à vérifier/.test(s2), 'soin dont le délai diffère de la fiche : « à vérifier »');
check(l1.some(t => /archivé/.test(t)) && l1.some(t => /Agneau n°00801/.test(t) && /Séléphérol/.test(t) && /identique à la fiche/.test(t)), 'soin archivé et Séléphérol d\'agneau listés');
const cochesDefaut = await page.evaluate(() => [...document.querySelectorAll('#sb-table tr[data-i]')].map(r => r.querySelector('.sb-chk').checked));
check(cochesDefaut.filter(Boolean).length === 3 && /3 soins cochés sur 4/.test(await $t('#sb-n')), 'cochés d\'office : les 3 identiques à la fiche ; le « à vérifier » est décoché : ' + cochesDefaut);
console.log('OK 1 liste : 4 soins de la 1.0.198 sans indicateur (anciens soins et soins déjà bio exclus), aperçu avant / après, identique à la fiche = coché, différent = « à vérifier » décoché, rien écrit.');

// ================================================================ 2. confirmation refusée / sauvegarde en échec : rien n'est modifié
reponse = false; confirms.length = 0;
await page.click('#sb-appliquer');
check(await page.evaluate(() => window.__saves === 0 && window.__backups.length === 0 && JSON.stringify(DB) === window.__avant) && /3 soin\(s\)/.test(confirms[0]) && /sauvegarde complète/.test(confirms[0]), 'confirmation refusée : aucune sauvegarde, aucune écriture : ' + confirms[0]);
reponse = true;
await page.evaluate(() => { window.__backupOk = { ok: false, raison: 'disque plein' }; });
await page.click('#sb-appliquer');
await page.waitForSelector('#sb-msg .brd-alert');
check(/rien n'a été modifié/.test(await $t('#sb-msg')) && await page.evaluate(() => window.__saves === 0 && JSON.stringify(DB) === window.__avant && window.__backups.length === 1), 'sauvegarde en échec : message, rien modifié : ' + await $t('#sb-msg'));
await page.evaluate(() => { window.__backupOk = { ok: false, cancelled: true, raison: 'annulé' }; });
await page.click('#sb-appliquer');
check(/annulé/.test(await $t('#sb-msg')) && await page.evaluate(() => JSON.stringify(DB) === window.__avant), 'export annulé : rien modifié');
await page.click('#sb-rien'); await page.click('#sb-appliquer');
check(/Coche au moins un soin/.test(await $t('#sb-msg')), 'aucun soin coché : refusé');
console.log('OK 2 sécurité : confirmation refusée, sauvegarde en échec ou annulée, aucun soin coché : rien n\'est modifié.');

// ================================================================ 3. application : sauvegarde AVANT, soins cochés seulement, figés
await jeu(true);
await page.evaluate(() => { carnetSanitaireEtat = null; render('soins-sans-bio'); });
await page.waitForSelector('#sb-table');
const copieAvant = await page.evaluate(() => JSON.parse(window.__avant));
await page.click('#sb-appliquer');
await page.waitForSelector('#sb-faits');
const bk = await page.evaluate(() => window.__backups);
check(bk.length === 1 && /^ovilog_backup_\d{8}_\d{6}\.json$/.test(bk[0].nom) && bk[0].avant === (await page.evaluate(() => window.__avant)), 'sauvegarde exportée AVANT l\'écriture (contenu d\'avant) : ' + bk[0].nom);
const apres = await page.evaluate(() => ({ A: JSON.parse(JSON.stringify(DB.brebis[0].sanitaire)), lamb: JSON.parse(JSON.stringify(DB.brebis[0].agnelages[0].lambs[0].sanitaire[0])), reg: JSON.parse(JSON.stringify(Object.values(DB.registre.brebis)[0].sanitaire[0])), saves: window.__saves }));
const a1 = apres.A[0];
check(a1.bio === true && a1.delaiLaitLegalJours === 7 && a1.delaiViandeLegalJours === 28 && a1.delaiLaitJours === 14 && a1.delaiViandeJours === 56 && a1.min48h === 'oui' && a1.bioAppliqueLe === '2026-10-02', 'soin du 20/09 : bio, légal 7/28 conservé, appliqué 14/56, jour de l\'application : ' + JSON.stringify(a1));
check(JSON.stringify(apres.A[1]) === JSON.stringify(copieAvant.brebis[0].sanitaire[1]), 'soin « à vérifier » (décoché) : strictement inchangé');
check(JSON.stringify(apres.A[2]) === JSON.stringify(copieAvant.brebis[0].sanitaire[2]) && JSON.stringify(apres.A[3]) === JSON.stringify(copieAvant.brebis[0].sanitaire[3]), 'ancien soin (avant 1.0.198) et soin déjà bio : strictement inchangés');
check(apres.lamb.bio === true && apres.lamb.delaiViandeJours === 56 && apres.lamb.delaiLaitJours === 0 && apres.lamb.min48hAConfirmer === true && apres.lamb.min48h === 'a_confirmer', 'Séléphérol d\'agneau : viande 56, lait 0 + minimum 48 h bio à confirmer (défaut « autres ») : ' + JSON.stringify(apres.lamb));
check(apres.reg.bio === true && apres.reg.delaiLaitJours === 14, 'soin archivé au registre traité aussi');
check(apres.saves === 1, 'une seule écriture');
const k3 = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#pc-soins-sans-bio .brd-kpi')].map(x => [x.querySelector('.brd-kpi-l').textContent, x.querySelector('.brd-kpi-v').textContent.trim()])));
check(k3['Soins concernés'] === '1' && k3['Déjà passés en bio'] === '3', 'après application : 1 soin restant (à vérifier), 3 passés en bio : ' + JSON.stringify(k3));
console.log('OK 3 application : sauvegarde exportée avant, seuls les soins cochés modifiés et figés (légal conservé), les autres strictement inchangés.');

// ================================================================ 4. annulation exacte
reponse = true;
await page.click('#sb-annuler');
await page.waitForFunction(() => !document.getElementById('sb-faits'));
check(await page.evaluate(() => JSON.stringify(DB) === window.__avant), 'annulation : retour EXACT à l\'état d\'avant (tous les soins identiques octet pour octet)');
console.log('OK 4 annulation : retour exact aux délais d\'origine.');

// ================================================================ 5. bio non activé : rien à faire
await jeu(false);
await page.evaluate(() => { carnetSanitaireEtat = null; render('sanitaire'); });
check(await page.evaluate(() => !document.getElementById('cs-bandeau-bio')), 'bio non activé : pas de bandeau');
await page.evaluate(() => render('soins-sans-bio'));
await page.waitForSelector('#sb-pas-bio');
check(await page.evaluate(() => !document.getElementById('sb-table') && JSON.stringify(DB) === window.__avant && window.__saves === 0), 'bio non activé : message, aucune liste, rien écrit');
console.log('OK 5 bio non activé : aucun bandeau, aucune liste, rien écrit.');
await browser.close();
console.log('\nTOUS LES TESTS « SOINS SANS INDICATEUR BIO » SONT PASSÉS (jeu synthétique, saveData et sauvegarde remplacés, aucune donnée réelle)');
