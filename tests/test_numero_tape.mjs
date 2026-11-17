/* N° TAPÉ au clavier : une règle pour toute l'appli (resoudreNumeroTape).
   0. 11 chiffres et plus : EID exact ou n° national ; 1. n° exact (n° d'ordre, n° de travail, complet ; zéros de tête ignorés) ;
   n° exact : une bête = d'office, n° partagé (n° d'ordre de deux brebis) = à choisir ;
   2. 4 chiffres au plus : MORCEAU de n° = toujours à choisir, même pour une seule bête ;
   3. sinon numérotation de l'élevage proposée (jamais d'office).
   Affichage (numeroAnimal) : « 590 » (n° de travail), sinon « n°80008 » (n° d'ordre) ; liste à cocher, messages, fiches.
   Jeu SYNTHÉTIQUE (indicatif 000456), aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
p.on('dialog', d => d.accept());
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
await p.evaluate(() => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
  const mk = (id, ordre, court, long) => ({ id, eid: '2500000456' + ordre, numeroCourtTravailSieol: court || '', numeroLongTravailSieol: long || '', statut: 'active', createdAt: 1, echographies: [], sanitaire: [], notes: [], mouvements: [], modesRepro: [], agnelages: [], controleLaitier: [] });
  DB.brebis = [mk('a', '51090', '590'), mk('b', '20043', '543', '250043'), mk('c', '80008', ''), mk('d', '51777', '777'), mk('e', '51778', '778'), mk('f', '91234', ''), mk('g', '51090', '55090')];
  DB.brebis[6].eid = '2500000999' + '51090';   // même n° d'ordre que « a », autre élevage d'origine
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
});
const r = await p.evaluate(() => {
  const t = v => { const x = resoudreNumeroTape(DB.brebis, v); return x.statut + ':' + (x.item ? x.item.id : (x.candidats || []).map(c => c.id).join(',')) + (x.ordre ? '>' + x.ordre : ''); };
  return ['590', '0590', '55090', '51090', '250000045651090', '00045651090', '543', '250043', '1090', '77', '9123', '808', '80008', '12345', '99', ''].map(t);
});
eq(r, ['trouve:a', 'trouve:a', 'trouve:g', 'ambigu:a,g', 'trouve:a', 'trouve:a', 'trouve:b', 'trouve:b', 'partiel:a,g', 'partiel:d,e', 'partiel:f', 'propose:c>80008', 'trouve:c', 'absent:', 'absent:', 'absent:'],
  'règle des n° tapés');
// écrans anciens : une proposition devient « à choisir », jamais d'office
eq(await p.evaluate(() => { const x = trouverUnParEidOuNumero(DB.brebis, '808'); return [x.statut, x.ordre, x.candidats.length]; }), ['ambigu', '80008', 1], 'proposition = à choisir');
eq(await p.evaluate(() => chercherBrebisMiseBas('808').statut), 'ambigu', 'mise bas : proposition à choisir, pas de plantage');
eq(await p.evaluate(() => chercherBrebisMiseBas('9123').statut), 'ambigu', 'mise bas : morceau de n° à choisir, jamais d\'office');
eq(await p.evaluate(() => [numeroAnimal(DB.brebis[0]), numeroAnimal(DB.brebis[2].eid), numeroAnimal('250000045699999')]), ['590', 'n°80008', 'n°99999'], 'affichage : n° de travail, sinon n° d\'ordre');

// liste à cocher (composant commun des lots) : 590 trouve la brebis, n° de travail affiché
await p.evaluate(() => { const box = document.createElement('div'); box.id = 'pk'; document.getElementById('app').appendChild(box); window.__sel = new Set(); renderSelectionPicker(box, DB.brebis, window.__sel, {}); });
const nums = await p.$$eval('#pk .sp-num', ns => ns.map(n => n.textContent.replace(/\s+/g, ' ').trim()));
check(nums.includes('590') && nums.includes('n°80008') && nums.includes('55090'), 'n° de travail sinon n° d\'ordre : ' + JSON.stringify(nums));
await p.fill('#pk .sp-filtre', '590');
eq(await p.$$eval('#pk .sp-check', cs => cs.map(c => c.dataset.id)), ['a'], 'filtre « 590 » : la brebis au n° de travail 590');
// bip en série : 590 tapé + Entrée coche la brebis ; 808 propose la n°80008
await p.click('#pk .sp-mode-btn[data-mode="bip"]');
await p.fill('#pk .sp-scan', '590'); await p.press('#pk .sp-scan', 'Enter'); await p.waitForTimeout(100);
eq(await p.evaluate(() => [...window.__sel]), ['a'], '590 tapé : cochée d\'office');
check(/^590 ajoutée/.test(await p.textContent('#pk .sp-scan-feedback')), 'message avec le n° de travail');
await p.fill('#pk .sp-scan', '9123'); await p.press('#pk .sp-scan', 'Enter'); await p.waitForTimeout(100);
eq(await p.evaluate(() => [...window.__sel]), ['a'], 'morceau « 9123 » : rien d\'office');
check(/Aucun n° ne vaut exactement « 9123 »/.test(await p.textContent('#pk .sp-scan-feedback')), 'morceau : choix demandé');
await p.fill('#pk .sp-scan', '808'); await p.press('#pk .sp-scan', 'Enter'); await p.waitForTimeout(100);
eq(await p.evaluate(() => [...window.__sel]), ['a'], '808 : rien d\'office');
check(/sans doute la n°80008/.test(await p.textContent('#pk .sp-scan-feedback')), 'numérotation proposée');
await p.click('#pk .eid-candidate-chip'); await p.waitForTimeout(100);
eq(await p.evaluate(() => [...window.__sel].sort()), ['a', 'c'], 'proposition touchée = cochée');

// écrans : fiche brebis, Brebis à régulariser
await p.evaluate(() => { currentSheepId = 'a'; render('detail'); }); await p.waitForTimeout(200);
eq(await p.textContent('#page-title'), 'Brebis 590', 'fiche : titre au n° de travail');
await p.evaluate(() => { currentSheepId = 'c'; render('detail'); }); await p.waitForTimeout(200);
eq(await p.textContent('#page-title'), 'Brebis n°80008', 'fiche : titre au n° d\'ordre sans n° de travail');
const reg = await p.evaluate(() => bilanARegulariserData());
check(JSON.stringify(reg).includes('"affiche":"590"') && JSON.stringify(reg).includes('"affiche":"n°80008"'), 'Brebis à régulariser : n° affiché');
await browser.close();
console.log('OK test_numero_tape');
