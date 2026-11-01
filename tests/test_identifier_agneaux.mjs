/* Identifier les agneaux (mobile) : agneaux nés sans n° retrouvés par le n° de la MÈRE, boucle tapée (n° suivant proposé) ou bippée, « Enregistrer et suivant ».
   Vieille boucle tapée = alerte ambre, jamais un blocage ; n° déjà porté par un animal = blocage ; soin déjà fait gardé ; bandeau « Annuler » = fiche exacte d'avant ;
   tuile « Agneaux sans n° » de l'écran Mises-bas seulement s'il y en a ; PC : rien. saveData REMPLACÉ ; jeu synthétique (indicatif 000456), aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
import { readFileSync } from 'fs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const preparer = () => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
  const fiche = (n, id) => ({ id, eid: '250000045' + n, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
  DB.brebis = [fiche('669002', 'b1'), fiche('670118', 'b2'), fiche('670193', 'b3'), fiche('668415', 'b4')];
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  const soin = { id: 'S-x', date: '2026-11-04', type: 'Traitement', produit: 'Produit A', intervenant: 'Éleveur' };
  DB.brebis[0].agnelages = [{ date: '2026-11-05', campagne: 2026, codeRepro: 'MN', saisieA: 3, lambs: [{ sexe: 'Mâle', adopte: false, sanitaire: [soin] }, { sexe: 'Femelle', adopte: false }, { sexe: 'Mort-né', adopte: false }] }];
  DB.brebis[1].agnelages = [{ date: '2026-11-03', campagne: 2026, codeRepro: 'MN', saisieA: 1, lambs: [{ sexe: 'Femelle', adopte: false }, { sexe: 'Mâle', adopte: false, statutFinal: 'mort' }] }];
  DB.brebis[2].agnelages = [{ date: '2026-11-02', campagne: 2026, codeRepro: 'MN', saisieA: 2, lambs: [{ sexe: 'Mâle', adopte: false, eid: '250000045671012', mouvements: [{ type: 'Entrée', cause: 'Naissance', date: '2026-11-02' }] }] }];
};

// ================================================================ PC : rien
{
  const p = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
  await p.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.evaluate(preparer);
  await p.evaluate(() => { resetMisebasRapideSession(); render('misebas-rapide'); });
  check(await p.evaluate(() => !document.getElementById('mb-tuile-ident')), 'PC : pas de tuile « Agneaux sans n° »');
  await p.evaluate(() => render('identifier-agneaux'));
  eq(await p.evaluate(() => currentView), 'misebas-rapide', 'PC : écran réservé au mobile, retour aux mises bas');
  await p.context().close();
  console.log('OK PC : ni tuile ni écran.');
}

// ================================================================ mobile
const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
p.on('dialog', d => { throw new Error('boîte native inattendue : ' + d.message()); });
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
await p.evaluate(preparer);

// 1. calcul : ni mort-né, ni sorti, ni bouclé ; portées les plus vieilles en haut ; filtre par n° de la mère
eq(await p.evaluate(() => agneauxSansNumero().length), 3, 'agneaux sans n° : mort-né, agneau sorti et agneau bouclé exclus');
eq(await p.evaluate(() => porteesAIdentifier('').map(x => x.sheep.id)), ['b2', 'b1'], 'portées : la plus vieille en haut');
eq(await p.evaluate(() => [porteesAIdentifier('69002').map(x => x.sheep.id), porteesAIdentifier('701').map(x => x.sheep.id), porteesAIdentifier('99999').length]), [['b1'], ['b2'], 0], 'filtre par n° de la mère');

// 2. tuile de l'écran Mises-bas
await p.evaluate(() => { resetMisebasRapideSession(); render('misebas-rapide'); });
check(await p.textContent('#mb-tuile-ident').then(t => /3/.test(t) && /sans n°/i.test(t)), 'tuile « Agneaux sans n° · 3 »');
await p.click('#mb-tuile-ident');
eq(await p.evaluate(() => currentView), 'identifier-agneaux', 'la tuile ouvre « Identifier les agneaux »');
check(/function vueDeSaisieEnCours\(vue\) \{\s*return [^;]*'identifier-agneaux'/.test(readFileSync(new URL('../www/index.html', import.meta.url), 'utf8')), 'écran de saisie : jamais reconstruit par la synchro (vueDeSaisieEnCours)');

// 3. n° de la mère tapé + Entrée : une seule portée → ouverte ; deux agneaux : aucun choisi d'office
await p.fill('#id-q', '69002'); await p.press('#id-q', 'Enter');
await p.waitForSelector('#id-mere');
eq(await p.evaluate(() => [document.querySelectorAll('.id-agneau[data-li]').length, document.querySelectorAll('.id-agneau.sel').length, document.getElementById('btn-id-enregistrer').disabled]), [2, 0, true], 'portée de deux : aucun agneau choisi, Enregistrer inactif');
check(await p.evaluate(() => /1 soin déjà fait/.test(document.querySelector('.id-agneau[data-li="0"]').textContent)), 'le soin déjà fait est signalé');

// 4. Mâle : n° suivant proposé, enregistré, soin gardé, mouvement d'entrée
await p.click('.id-agneau[data-li="0"]');
eq(await p.inputValue('#id-eid'), '71013', 'n° suivant proposé (plus grand de la campagne + 1)');
await p.click('#btn-id-enregistrer');
eq(await p.evaluate(() => { const l = DB.brebis[0].agnelages[0].lambs[0]; return [l.eid, (l.sanitaire || []).map(s => s.id), (l.mouvements || []).map(m => m.type + '/' + m.cause + '/' + m.date)]; }),
  ['250000045671013', ['S-x'], ['Entrée/Naissance/2026-11-05']], 'agneau identifié : n°, soin gardé, entrée Naissance datée de la mise bas');
check(await p.evaluate(() => /71013 identifié/.test(document.getElementById('id-snack').textContent)), 'bandeau « n°… identifié · Annuler »');
eq(await p.evaluate(() => [!!document.getElementById('id-mere'), document.querySelectorAll('.id-agneau[data-li]').length]), [true, 1], 'reste sur la portée : la femelle à identifier');

// 5. la femelle, seule restante : choisie d'office ; n° d'une brebis de l'inventaire = blocage
eq(await p.evaluate(() => document.querySelectorAll('.id-agneau.sel').length), 1, 'un seul agneau restant : choisi d\'office');
await p.fill('#id-eid', '68415');
check(await p.evaluate(() => getComputedStyle(document.getElementById('id-apercu')).color !== '' && /déjà/i.test(document.getElementById('id-apercu').textContent)), 'aperçu : n° déjà porté');
await p.click('#btn-id-enregistrer');
eq(await p.evaluate(() => [DB.brebis[0].agnelages[0].lambs[1].eid || '', /déjà/i.test(document.getElementById('id-apercu').textContent + document.getElementById('id-erreur').textContent)]), ['', true], 'n° d\'une brebis de l\'inventaire : bloqué, rien écrit');

// 6. vieille boucle (en 4) tapée : alerte ambre, enregistrée quand même ; portée finie → retour au départ
await p.fill('#id-eid', '41207');
check(await p.evaluate(() => /chiffre d'année/i.test(document.getElementById('id-apercu').textContent)), 'vieille boucle : alerte sur le chiffre d\'année');
await p.click('#btn-id-enregistrer');
eq(await p.evaluate(() => DB.brebis[0].agnelages[0].lambs[1].eid), '250000045641207', 'vieille boucle : enregistrée (jamais bloquée)');
eq(await p.evaluate(() => [!!document.getElementById('id-q'), document.getElementById('id-q').value, document.getElementById('id-restants').textContent]), [true, '', '1'], 'portée finie : retour au départ, champ vidé, 1 restant');

// 7. Annuler (bandeau) : fiche exacte d'avant, portée rouverte sur cet agneau
const avant = await p.evaluate(() => JSON.stringify({ sexe: 'Femelle', adopte: false }));
await p.click('#id-snack-annuler');
eq(await p.evaluate(() => JSON.stringify(DB.brebis[0].agnelages[0].lambs[1])), avant, 'Annuler : fiche exacte d\'avant');
eq(await p.evaluate(() => [!!document.getElementById('id-mere'), document.querySelectorAll('.id-agneau.sel').length]), [true, 1], 'Annuler : portée rouverte, agneau choisi');

// 8. bip dans la case : rempli, jamais enregistré seul ; EID bippé (15 chiffres) sans alerte d'année
await p.evaluate(() => { document.getElementById('id-eid').value = ''; document.getElementById('id-eid').focus(); onEidScanned('250000045651111'); });
eq(await p.evaluate(() => [document.getElementById('id-eid').value, DB.brebis[0].agnelages[0].lambs[1].eid || '', /chiffre d'année/i.test(document.getElementById('id-apercu').textContent)]), ['250000045651111', '', false], 'bip : case remplie, rien enregistré seul, pas d\'alerte d\'année');
await p.click('#btn-id-enregistrer');
eq(await p.evaluate(() => DB.brebis[0].agnelages[0].lambs[1].eid), '250000045651111', 'EID bippé enregistré tel quel');

// 9. dernière portée : mère bippée sur le départ, puis plus rien → tuile absente
await p.evaluate(() => onEidScanned('250000045670118'));
await p.waitForSelector('#id-mere');
await p.fill('#id-eid', '71014'); await p.click('#btn-id-enregistrer');
check(await p.evaluate(() => !!document.getElementById('id-fini')), 'tous identifiés : message de fin');
await p.evaluate(() => { resetMisebasRapideSession(); render('misebas-rapide'); });
check(await p.evaluate(() => !document.getElementById('mb-tuile-ident')), 'plus d\'agneau sans n° : plus de tuile');
await p.context().close();
await browser.close();
console.log('\nTOUS LES TESTS « IDENTIFIER LES AGNEAUX » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
