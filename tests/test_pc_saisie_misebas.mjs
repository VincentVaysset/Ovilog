/* Page PC « Saisie de mises bas » (écran PC simulé) : indicateurs de la campagne, saisie du n° de la brebis (pas de bip
   sur PC), compteurs Mâles / Femelles / Mort-nés, Repro déduite et modifiable, contrôles (blocage : déjà une mise bas,
   brebis inconnue ; alerte : date future à confirmer, vide définitive signalée jamais corrigée), « restantes attendues » =
   (actives − vides définitives) − mises bas, annulation d'une mise bas, avancement. Le mobile garde son gabarit
   (voir test_mobile_ecrans_reference). Jeu synthétique, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';

const browser = await chromium.launch(LAUNCH);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1200 } });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));   // horloge figée : les âges lus dans l'EID ne dépendent pas de l'année du jour
await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
let reponseConfirm = true; const confirms = [];
page.on('dialog', d => { if (d.type() === 'confirm') { confirms.push(d.message()); reponseConfirm ? d.accept() : d.dismiss(); } else d.accept(); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

await page.evaluate(() => {
  DB = migrateData({});
  window.__saves = 0;
  const o = saveData; saveData = function (...a) { window.__saves++; return o.apply(this, a); };
  const eid = (an, n) => '250016299' + '9' + an + String(n).padStart(5, '0');
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  window.E = eid;
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  const b = [];
  for (let i = 1; i <= 6; i++) b.push(fiche(eid(3, 100 + i)));                                   // 6 brebis à régulariser (3 ans)
  b.push(fiche(eid(3, 200), { agnelages: [{ date: '2026-11-10', campagne: 2026, lambs: [{ sexe: 'Mâle' }] }] }));
  b.push(fiche(eid(3, 201), { agnelages: [{ date: '2099-12-31', campagne: 2026, lambs: [{ sexe: 'Femelle' }, { sexe: 'Mort-né' }] }] }));   // date future
  b.push(fiche(eid(3, 300), { videesDefinitives: [{ date: '2026-12-05', campagne: 2026 }] }));      // vide définitive
  b.push(fiche(eid(3, 400), { statut: 'vendue' }));                                                  // non active
  DB.brebis = b; DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  window.ouvrirSaisie = () => { resetMisebasRapideSession(); render('misebas-rapide'); };
});
const kpis = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#pc-saisie-misebas .pc-kpis .brd-kpi')].map(k => [k.querySelector('.brd-kpi-l').textContent, [k.querySelector('.brd-kpi-v').textContent.trim(), (k.querySelector('.brd-kpi-s') || { textContent: '' }).textContent.trim()]])));
const saisir = async (val) => { await page.fill('#scan-misebas', val); await page.press('#scan-misebas', 'Enter'); };

// ================================================================ 1. indicateurs
await page.evaluate(() => ouvrirSaisie());
await page.waitForSelector('#pc-saisie-misebas');
let k = await kpis();
// actives : 6 + 2 (mises bas) + 1 (vide) = 9 ; à mettre bas = 9 − 1 vide = 8 ; restantes = 8 − 2 = 6
check(k['Mises bas'][0] === '2' && /campagne 2027/.test(k['Mises bas'][1]), 'mises bas 2 : ' + JSON.stringify(k['Mises bas']));
check(k['Agneaux nés'][0] === '3' && /prolificité 1,50/.test(k['Agneaux nés'][1]), 'agneaux nés 3, prolificité 1,50 : ' + JSON.stringify(k['Agneaux nés']));
check(k['Mâles'][0] === '1' && k['Femelles'][0] === '1' && k['Morts-nés'][0] === '1', 'mâles / femelles / morts-nés 1 / 1 / 1');
check(k['Restantes attendues'][0] === '6' && /sur 8 à mettre bas/.test(k['Restantes attendues'][1]), 'restantes attendues 6 sur 8 (9 actives − 1 vide − 2 mises bas) : ' + JSON.stringify(k['Restantes attendues']));
const cohe = await page.evaluate(() => { const c = campagneBilanChiffres(DB.brebis.filter(s => (s.statut || 'active') === 'active')); return [c.misesBasRestantes, c.troupeauAMettreBas]; });
check(JSON.stringify(cohe) === '[6,8]', 'même calcul que le bilan de campagne : ' + cohe);
const texte = await page.evaluate(() => document.getElementById('pc-saisie-misebas').textContent);
check(!/bip|Scanner|scanner/i.test(texte), 'aucune mention de bip ni de scan sur PC : on saisit un numéro');
check(/Saisir le n° de la brebis \(court ou EID complet\)/.test(texte), 'consigne : saisir le n°');
check(await page.evaluate(() => !document.getElementById('lamb-list-rapide') && !!document.querySelector('.btn-annuler-mb-campagne') && /Total \(2 mises bas\)/.test(document.getElementById('mb-totaux').textContent)), 'tableau des mises bas de la campagne et ligne de totaux');
const rowsTxt = await page.evaluate(() => [...document.querySelectorAll('#pc-saisie-misebas table.brd-t tr')].slice(1, 3).map(r => r.textContent.replace(/\s+/g, ' ').trim()));
check(rowsTxt.some(t => /31-12-2099 date à vérifier/.test(t)), 'mise bas à date future : « date à vérifier » sans correction : ' + JSON.stringify(rowsTxt));
console.log('OK 1 indicateurs : 2 mises bas, 3 agneaux (prolificité 1,50), restantes attendues 6 sur 8 = calcul du bilan de campagne ; aucune mention de bip ; date future signalée.');

// ================================================================ 2. saisie : numéro, compteurs, repro
await saisir('00101');
await page.waitForSelector('#f-date-rapide');
const bar = await page.evaluate(() => document.getElementById('pc-brebis-trouvee').textContent.replace(/\s+/g, ' '));
check(/n°00101 · 3 ans · brebis/.test(bar) && /à régulariser, pas de mise bas cette campagne/.test(bar), 'brebis trouvée par son n° : ' + bar);
check(await page.evaluate(() => window.__saves) === 0, 'rien n\'est enregistré tant qu\'on ne valide pas');
const clic = async (sx, delta, fois) => { for (let i = 0; i < (fois || 1); i++) await page.click(`.pc-st-btn[data-sexe="${sx}"][data-delta="${delta}"]`); };
await clic('Mâle', 1, 2); await clic('Femelle', 1); await clic('Mâle', -1);
let cpt = await page.evaluate(() => ({ m: document.getElementById('pc-n-Mâle').textContent, f: document.getElementById('pc-n-Femelle').textContent, mn: document.getElementById('pc-n-Mort-né').textContent, portee: document.getElementById('pc-portee').textContent, cartes: document.querySelectorAll('#lamb-list-rapide .card').length }));
check(cpt.m === '1' && cpt.f === '1' && cpt.mn === '0' && cpt.portee === 'Portée double · 2 agneaux' && cpt.cartes === 2, 'compteurs 1 / 1 / 0, portée double, 2 cartes de détail : ' + JSON.stringify(cpt));
await clic('Mort-né', -1);   // rien à retirer : reste à 0
check(await page.evaluate(() => document.getElementById('pc-n-Mort-né').textContent) === '0', 'on ne descend pas sous 0');
// repro : déduite (MN par défaut), modifiable
const repro = await page.evaluate(() => ({ sel: [...document.querySelectorAll('.repro-code-opt-rapide.selected')].map(b => b.dataset.val), chip: document.getElementById('pc-repro-chip').textContent }));
check(repro.sel.join() === 'MN' && repro.chip === 'déduit, modifiable', 'repro déduite MN : ' + JSON.stringify(repro));
await page.click('.repro-code-opt-rapide[data-val="IA"]');
check(await page.evaluate(() => document.getElementById('pc-repro-chip').textContent) === 'choisi à la main', 'repro modifiée à la main');
console.log('OK 2 brebis trouvée par son n° (3 ans, à régulariser) ; compteurs Mâles / Femelles pilotent les agneaux (portée double) ; Repro déduite puis modifiée ; rien d\'enregistré avant validation.');

// ================================================================ 3. date future : alerte à confirmer
const futur = '2099-01-15';
await page.fill('#f-date-rapide', futur);
await page.dispatchEvent('#f-date-rapide', 'change');
reponseConfirm = false; confirms.length = 0;
await page.click('#btn-valider-misebas');
await page.waitForTimeout(200);
check(confirms.length === 1 && /postérieure à aujourd'hui/.test(confirms[0]) && await page.evaluate(() => window.__saves) === 0 && await page.evaluate(() => DB.brebis.find(b => b.eid === E(3, 101)).agnelages.length) === 0, 'date future : confirmation demandée, refus = rien enregistré : ' + confirms[0]);
console.log('OK 3 date future : alerte à confirmer, refus = rien enregistré.');

// ================================================================ 4. validation
await page.fill('#f-date-rapide', '2026-11-15');
await page.dispatchEvent('#f-date-rapide', 'change');
await page.click('.repro-code-opt-rapide[data-val="IA"]');
reponseConfirm = true; confirms.length = 0;
await page.click('#btn-valider-misebas');
await page.waitForFunction(() => window.__saves >= 1 && !document.getElementById('f-date-rapide'));
const ag = await page.evaluate(() => JSON.parse(JSON.stringify(DB.brebis.find(b => b.eid === E(3, 101)).agnelages)));
check(ag.length === 1 && ag[0].campagne === 2026 && ag[0].date === '2026-11-15' && ag[0].codeRepro === 'IA' && ag[0].codeSieolRepro === 1, 'agnelage : campagne 2026, date, repro IA : ' + JSON.stringify(ag[0]).slice(0, 200));
check(ag[0].lambs.map(l => l.sexe).join() === 'Mâle,Femelle' && ag[0].lambs.every(l => l.eid === '' && l.sanitaire.length === 1 && l.sanitaire[0].produit === 'Séléphérol' && l.sanitaire[0].dose === '2 cc' && l.sanitaire[0].date === '2026-11-15'), 'agneaux : Mâle + Femelle, Séléphérol 2 cc comme sur mobile : ' + JSON.stringify(ag[0].lambs));
k = await kpis();
check(k['Mises bas'][0] === '3' && k['Agneaux nés'][0] === '5' && k['Restantes attendues'][0] === '5', 'indicateurs mis à jour : 3 mises bas, 5 agneaux, 5 restantes : ' + JSON.stringify(k));
check(await page.evaluate(() => /1 mise bas saisie dans cette session/.test(document.querySelector('.brd-sub').textContent)), 'compteur de session');
const ligneNouvelle = await page.evaluate(() => [...document.querySelectorAll('#pc-saisie-misebas table.brd-t tr')].some(r => /15-11-2026/.test(r.textContent)));
check(ligneNouvelle, 'la mise bas apparaît dans le tableau');
const av = await page.evaluate(() => document.querySelector('#pc-saisie-misebas .pc-legend').parentElement.textContent.replace(/\s+/g, ' '));
check(/3 mises bas sur 8 brebis à mettre bas \(37,5 %\)/.test(av) && /Portées : 1 simple, 2 doubles/.test(av), 'avancement : ' + av);
console.log('OK 4 validation : agnelage enregistré (campagne, date, repro IA, 2 agneaux, Séléphérol 2 cc) ; indicateurs, tableau et avancement mis à jour.');

// ================================================================ 5. contrôles : déjà une mise bas, inconnue, vide définitive
await saisir('00200');
const dej = await page.evaluate(() => ({ bar: document.getElementById('pc-brebis-trouvee').textContent.replace(/\s+/g, ' '), form: !!document.getElementById('f-date-rapide'), edit: !!document.getElementById('btn-edit-existing-agnelage-rapide') }));
check(/a déjà une mise bas le 10-11-2026 : une seule par campagne/.test(dej.bar) && !dej.form && dej.edit, 'blocage : déjà une mise bas : ' + JSON.stringify(dej));
await saisir('99999');
check(await page.evaluate(() => /Brebis inconnue/.test(document.getElementById('pc-saisie-misebas').textContent) && !document.getElementById('f-date-rapide')), 'brebis inconnue : blocage, rien n\'est créé sans accord');
await page.click('#btn-cancel-unknown-mb');
const nBrebis = await page.evaluate(() => DB.brebis.length);
check(nBrebis === 10, 'aucune fiche créée : ' + nBrebis);
await saisir('00300');
await page.waitForSelector('#f-date-rapide');
check(/marquée vide définitive cette campagne.*jamais corrigée seule/.test(await page.evaluate(() => document.getElementById('pc-brebis-trouvee').textContent)), 'vide définitive : alerte, pas de blocage');
await clic('Femelle', 1);
await page.click('#btn-valider-misebas');
await page.waitForFunction(() => DB.brebis.find(b => b.eid === E(3, 300)).agnelages.length === 1);
const inco = await page.evaluate(() => ({ vd: DB.brebis.find(b => b.eid === E(3, 300)).videesDefinitives.length, inco: bilanARegulariserData().groupes.incoherentes.length }));
check(inco.vd === 1 && inco.inco === 1, 'incohérence créée (vide définitive ET mise bas), signalée dans Brebis à régulariser, vide définitive NON corrigée : ' + JSON.stringify(inco));
console.log('OK 5 contrôles : déjà une mise bas (blocage, bouton de modification), brebis inconnue (blocage), vide définitive (alerte -> incohérence signalée, jamais corrigée seule).');

// ================================================================ 6. annuler : saisie en cours et mise bas enregistrée
await saisir('00102');
await page.waitForSelector('#f-date-rapide');
await clic('Mâle', 1);
const avantAnnul = await page.evaluate(() => window.__saves);
await page.click('#btn-annuler-saisie-pc');
check(await page.evaluate(() => !document.getElementById('f-date-rapide')) && await page.evaluate(() => window.__saves) === avantAnnul && await page.evaluate(() => DB.brebis.find(b => b.eid === E(3, 102)).agnelages.length) === 0, 'Annuler : saisie abandonnée, rien enregistré');
reponseConfirm = true; confirms.length = 0;
const nAvant = await page.evaluate(() => misebasCampagneRows().length);
await page.click('.btn-annuler-mb-campagne >> nth=0');
await page.waitForFunction((n) => misebasCampagneRows().length === n - 1, nAvant);
check(/Annuler la mise bas enregistrée/.test(confirms[0]), 'annuler une mise bas : confirmation demandée : ' + confirms[0]);
console.log('OK 6 annulation : saisie en cours abandonnée sans rien écrire ; annuler une mise bas enregistrée demande confirmation.');
await browser.close();
console.log('\nTOUS LES TESTS DE LA PAGE PC « SAISIE DE MISES BAS » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
