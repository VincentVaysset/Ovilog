/* Vérifier mères et agneaux (Chantier de tri › Créer une liste, mobile et PC) : le groupe = la liste bipée ; en vérification, agneau bipé →
   sa mère est-elle dans le groupe ; brebis bipée → ses agneaux sont-ils dans le groupe. Campagne en cours seulement, ni mort-nés ni sortis ;
   agneau adopté = la mère qui l'élève ; bilan (attendus, retrouvés, restants) ; rien n'est écrit sur les fiches. saveData REMPLACÉ ; jeu
   synthétique (indicatif 000456), aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const E = n => '2500000456' + n;
const prep = () => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
  const E = n => '2500000456' + n;
  const fiche = (n, id) => ({ id, eid: E(n), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] });
  DB.brebis = [fiche('60101', 'b1'), fiche('60102', 'b2'), fiche('60103', 'b3')];
  const mb = (lambs, campagne) => ({ date: '2026-11-05', campagne: campagne || 2026, codeRepro: 'MN', lambs });
  // b1 : 2 agneaux (dont 1 adopté par b3), + 1 mort-né ; b2 : 1 agneau + 1 sans n° ; b3 : 1 agneau vendu ; b2 : agneau d'une ancienne campagne
  DB.brebis[0].agnelages = [mb([{ sexe: 'Mâle', eid: E('71001') }, { sexe: 'Femelle', eid: E('71002'), adopte: true, adoptiveEid: E('60103') }, { sexe: 'Mort-né' }])];
  DB.brebis[1].agnelages = [mb([{ sexe: 'Mâle', eid: E('61009') }], 2025), mb([{ sexe: 'Femelle', eid: E('71003') }, { sexe: 'Mâle' }])];
  DB.brebis[2].agnelages = [mb([{ sexe: 'Mâle', eid: E('71004'), statutFinal: 'vendu' }])];
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  DB.listeSerie = []; DB.listeSerieVerif = [];
};

for (const mobile of [true, false]) {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1400, height: 900 } });
  if (!mobile) await ctx.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test', refocus: () => {} }; });
  const p = await ctx.newPage();
  const T = mobile ? 'mobile' : 'PC';
  await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  p.on('dialog', d => d.accept());
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(prep);
  const avant = await p.evaluate(() => JSON.stringify(DB.brebis));
  await p.evaluate(() => { listeSerieVerif = false; render('liste-serie'); });
  const biper = async (id, v) => { await p.fill('#' + id, v); await p.press('#' + id, 'Enter'); };
  // 1. le groupe : b1 et b2 (une au n° complet, une aux 5 derniers chiffres)
  await biper('scan-liste-serie', E('60101'));
  await biper('scan-liste-serie', '60102');
  await biper('scan-liste-serie', E('71001'));
  check(await p.evaluate(() => /Agneau/.test(document.getElementById('liste-serie-rows').textContent)), T + ' : un agneau bipé dans la liste est reconnu');
  await p.click('#btn-verif-meres-agneaux');
  await p.waitForSelector('#scan-verif');
  const res = () => p.evaluate(() => { const r = document.getElementById('verif-resultat'); return { ton: r.classList.contains('ok') ? 'ok' : r.classList.contains('alerte') ? 'alerte' : 'neutre', texte: r.textContent.replace(/\s+/g, ' ').trim() }; });
  const bilan = () => p.evaluate(() => document.getElementById('verif-bilan').textContent.replace(/\s+/g, ' ').trim());
  // b1 : 71001 (b2 : 71003 + 1 sans n°) ; 71002 adopté par b3 (hors groupe) ; mort-né et ancienne campagne exclus
  check(/2 mères · 2 agneaux attendus · 1 retrouvé · 1 reste/.test(await bilan()) && /dont 1 sans n°/.test(await bilan()), T + ' : bilan de départ : ' + await bilan());
  // 2. agneau bipé : mère dans le groupe / pas dans le groupe / adopté = mère qui l'élève
  await biper('scan-verif', E('71003'));
  let r = await res();
  check(r.ton === 'ok' && /Agneau n°71003 · mère n°60102/.test(r.texte), T + ' : mère dans le groupe : ' + r.texte);
  check(/2 mères · 2 agneaux attendus · 2 retrouvés · 0 reste/.test(await bilan()), T + ' : bilan à jour : ' + await bilan());
  await biper('scan-verif', '71002');
  r = await res();
  check(r.ton === 'alerte' && /mère n°60103 \(adopté\)/.test(r.texte) && /PAS dans le groupe/.test(r.texte), T + ' : adopté : mère qui l\'élève, hors groupe : ' + r.texte);
  await biper('scan-verif', E('71003'));
  check(/Déjà vérifié/.test((await res()).texte), T + ' : déjà vérifié');
  await biper('scan-verif', E('71004'));
  check((await res()).ton === 'neutre' && /ne compte pas/.test((await res()).texte), T + ' : agneau vendu : ne compte pas');
  await biper('scan-verif', '99999');
  check(/N° inconnu/.test((await res()).texte), T + ' : n° inconnu');
  // 3. sens inverse : le groupe contient l'agneau 71001 → brebis bipée : ses agneaux
  await biper('scan-verif', '60101');
  r = await res();
  check(r.ton === 'ok' && /Brebis n°60101 · dans le groupe/.test(r.texte) && /1 agneau sur 1 dans le groupe/.test(r.texte), T + ' : brebis bipée : ses agneaux dans le groupe : ' + r.texte);
  await biper('scan-verif', '60102');
  r = await res();
  check(r.ton === 'alerte' && /Aucun de ses agneaux dans le groupe · n°71003/.test(r.texte) && /1 sans n°/.test(r.texte), T + ' : brebis dont les agneaux manquent : ' + r.texte);
  // 4. restants, recommencer, retour ; rien écrit sur les fiches
  await p.click('#btn-verif-effacer');
  check(/1 retrouvé · 1 reste/.test(await bilan()), T + ' : recommencer la vérification : ' + await bilan());
  await p.click('#btn-verif-restants');
  check(await p.evaluate(() => /n°71003/.test(document.getElementById('verif-restants').textContent)), T + ' : restants listés');
  await p.click('#btn-verif-retour');
  check(await p.evaluate(() => !!document.getElementById('scan-liste-serie')), T + ' : retour à la liste');
  eq(await p.evaluate(() => JSON.stringify(DB.brebis)), avant, T + ' : rien n\'est écrit sur les fiches');
  await ctx.close();
}
await browser.close();
console.log('OK test_meres_agneaux');
