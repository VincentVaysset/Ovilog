/* Clavier Ovilog (mobile) : s'ouvre seulement au TOUCHER d'un champ de chiffres (jamais à l'arrivée sur l'écran, ni par un focus de l'appli, ni à la souris) ;
   chiffres seuls pour les n° et les entiers, virgule pour TB / TP / doses ; texte et dates : jamais ; touches = frappe (événement input) ; « OK » = Entrée pour une
   recherche ; « Suivant » / « Terminé » pour une saisie ; Effacer, ⌫, Fermer ; toucher ailleurs le range ; barre « Enregistrer » au-dessus de lui, bulle masquée ;
   PC : jamais. saveData REMPLACÉ ; jeu synthétique (indicatif 000456), aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const preparer = () => {
  DB = migrateData({}); saveData = () => true;
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456' });
  const fiche = (n, id) => ({ id, eid: '250000045' + n, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] });
  DB.brebis = [fiche('669002', 'b1'), fiche('670118', 'b2')];
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
};
const ouvert = p => p.evaluate(() => !!document.querySelector('#clavier-ovilog.ouvert'));
const touche = (p, k) => p.tap(`#clavier-ovilog .k[data-k="${k}"]`);

// ================================================================ mobile tactile
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
await p.clock.setFixedTime(new Date('2026-11-20T09:00:00'));
p.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
p.on('dialog', d => d.accept());
await p.goto(URL_APP, { waitUntil: 'load' }); await p.waitForTimeout(300);
await p.evaluate(preparer);
await p.evaluate(() => { resetMisebasRapideSession(); render('misebas-rapide'); });
await p.waitForTimeout(150);

// 1. arrivée sur l'écran (champ de scan qui a le curseur) : pas de clavier
check(!(await ouvert(p)), 'arrivée sur l\'écran : clavier fermé (le focus de l\'appli ne l\'ouvre pas)');
// le clavier du téléphone est coupé AVANT tout toucher : le curseur posé d'office par l'appli ne peut plus l'ouvrir (Android)
eq(await p.evaluate(() => document.getElementById('scan-misebas').getAttribute('inputmode')), 'none', 'arrivée sur l\'écran : champ de scan déjà « sans clavier du téléphone »');
eq(await p.evaluate(async () => { render('list'); await Promise.resolve(); const a = document.getElementById('scan-open').getAttribute('inputmode'); resetMisebasRapideSession(); render('misebas-rapide'); await Promise.resolve(); return a; }), 'none', 'liste des brebis : champ de recherche déjà « sans clavier du téléphone »');
eq(await p.evaluate(() => { const d = document.createElement('div'); d.innerHTML = '<input type="text" class="note-x" placeholder="Note">'; document.getElementById('app').appendChild(d); return new Promise(r => setTimeout(() => r(d.firstChild.getAttribute('inputmode')), 0)); }), null, 'champ de texte : clavier du téléphone gardé');
await p.evaluate(() => document.getElementById('scan-misebas').focus());
check(!(await ouvert(p)), 'focus posé par l\'appli : clavier fermé');

// 2. toucher le champ de recherche : clavier chiffres, OK = Entrée
await p.tap('#scan-misebas');
check(await ouvert(p), 'toucher le champ : clavier ouvert');
eq(await p.evaluate(() => [document.getElementById('scan-misebas').getAttribute('inputmode'), [...document.querySelectorAll('#clavier-ovilog .k')].map(b => b.dataset.k)]),
  ['none', ['1', '2', '3', 'del', '4', '5', '6', 'ok', '7', '8', '9', 'vider', '0', 'fermer']], 'clavier du téléphone coupé ; touches chiffres, Effacer, Fermer, OK');
eq(await p.evaluate(() => document.querySelector('#clavier-ovilog .k[data-k="ok"]').textContent), 'OK', 'recherche : touche « OK »');
for (const k of ['6', '9', '0', '0', '3', 'del', '2']) await touche(p, k);
eq(await p.inputValue('#scan-misebas'), '69002', 'touches : chiffres et ⌫');
check(await p.evaluate(() => document.activeElement && document.activeElement.id === 'scan-misebas'), 'le champ garde le curseur pendant la frappe');
check(await p.evaluate(() => { const b = document.getElementById('bulle-contact'); return !b || b.offsetParent === null || getComputedStyle(b).display === 'none'; }), 'bulle d\'aide masquée clavier ouvert');
await touche(p, 'ok');
await p.waitForSelector('#f-date-rapide');
check(!(await ouvert(p)), 'OK : la brebis s\'ouvre (Entrée), le clavier se range');

// 3. n° de l'agneau : Suivant / Terminé, barre au-dessus du clavier
await p.click('#add-lamb-rapide');
await p.tap('.eid-input-rapide[data-id="0"]');
check(await ouvert(p), 'n° de l\'agneau : clavier ouvert');
eq(await p.evaluate(() => document.querySelector('#clavier-ovilog .k[data-k="ok"]').textContent), 'Suivant', 'saisie avec un champ chiffré après : « Suivant »');
await touche(p, 'vider'); for (const k of ['7', '1', '0', '4', '4']) await touche(p, k);
eq(await p.inputValue('.eid-input-rapide[data-id="0"]'), '71044', 'Effacer puis chiffres');
const barre = await p.evaluate(() => { const b = document.querySelector('.mn-barre').getBoundingClientRect(), c = document.getElementById('clavier-ovilog').getBoundingClientRect(); return { visible: b.height > 0, auDessus: b.bottom <= c.top + 1 }; });
check(barre.visible && barre.auDessus, 'barre « Enregistrer » visible au-dessus du clavier : ' + JSON.stringify(barre));
await touche(p, 'ok');
check(await p.evaluate(() => document.activeElement && document.activeElement.matches('.eid-input-rapide[data-id="1"]')) && await ouvert(p), 'Suivant : champ chiffré suivant, clavier toujours ouvert');
eq(await p.evaluate(() => document.querySelector('#clavier-ovilog .k[data-k="ok"]').textContent), 'Terminé', 'dernier champ chiffré : « Terminé »');
await touche(p, 'ok');
check(!(await ouvert(p)), 'Terminé : clavier rangé');

// 4. Fermer, toucher ailleurs
await p.tap('.eid-input-rapide[data-id="1"]'); check(await ouvert(p), 'rouvert au toucher');
await touche(p, 'fermer'); check(!(await ouvert(p)), 'Fermer : rangé');
await p.tap('.eid-input-rapide[data-id="1"]'); check(await ouvert(p), 'rouvert');
await p.tap('#f-date-rapide');
check(!(await ouvert(p)), 'toucher un autre champ (date) : clavier rangé');

// 5. bip du lecteur : jamais de clavier
await p.evaluate(() => { document.querySelector('.eid-input-rapide[data-id="1"]').focus(); onEidScanned('250000045671050'); });
check(!(await ouvert(p)), 'bip du lecteur : pas de clavier');

// 6. virgule (TB) et champ texte (note)
const types = await p.evaluate(() => {
  const mk = (h) => { const d = document.createElement('div'); d.innerHTML = h; document.getElementById('app').appendChild(d); return d.firstChild; };
  return [typeClavierChamp(mk('<input type="number" id="qs-tb">')), typeClavierChamp(mk('<input type="number" id="qs-cellules">')), typeClavierChamp(mk('<input type="number" step="0.1" inputmode="decimal" id="f-lait-qte">')),
    typeClavierChamp(mk('<input type="text" id="cs-dose-texte">')), typeClavierChamp(mk('<input type="date" id="x-date">')), typeClavierChamp(mk('<input type="text" id="le-q">'))];
});
eq(types, ['decimal', 'entier', 'entier', null, null, null], 'TB virgule ; cellules et litrage du tank entiers ; texte, date, nom de lot : clavier habituel');
await p.evaluate(() => { const i = document.getElementById('qs-tb'); i.style.display = 'block'; });
await p.tap('#qs-tb');
check(await ouvert(p), 'TB : clavier ouvert');
check(await p.evaluate(() => !!document.querySelector('#clavier-ovilog .k[data-k=","]') && !document.querySelector('#clavier-ovilog .k[data-k="vider"]')), 'TB : touche virgule à la place d\'Effacer');
for (const k of ['7', '1', ',', '4', ',']) await touche(p, k);
eq(await p.inputValue('#qs-tb'), '71.4', 'TB : 71,4 (une seule virgule ; champ nombre)');
await touche(p, 'fermer');

// 6 bis. liste des brebis : le champ de recherche (scan-open) a le clavier, OK = Entrée ; champs reconnus à leur libellé
await p.evaluate(() => render('list')); await p.waitForTimeout(150);
await p.tap('#scan-open');
check(await ouvert(p), 'liste des brebis : clavier Ovilog sur le champ de recherche');
eq(await p.evaluate(() => document.querySelector('#clavier-ovilog .k[data-k="ok"]').textContent), 'OK', 'liste des brebis : « OK »');
await touche(p, 'fermer');
eq(await p.evaluate(() => { const mk = ph => { const i = document.createElement('input'); i.type = 'text'; i.placeholder = ph; document.getElementById('app').appendChild(i); return typeClavierChamp(i); };
  return [mk('Scanner ou saisir un n°'), mk('Rechercher un numéro…'), mk('N° ou EID de la mère adoptive'), mk("Nom du lot ou n° d'animal"), mk('Note')]; }),
  ['entier', 'entier', 'entier', null, null], 'champs de n° reconnus à leur libellé ; nom de lot et note : clavier habituel');

// 7. souris (mobile) : jamais de clavier
await p.evaluate(() => { resetMisebasRapideSession(); render('misebas-rapide'); });
await p.click('#scan-misebas');
check(!(await ouvert(p)), 'clic souris : pas de clavier');
await ctx.close();

// ================================================================ PC : jamais
{
  const c2 = await browser.newContext({ viewport: { width: 1400, height: 1000 }, hasTouch: true });
  const q = await c2.newPage();
  await q.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  q.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  await q.goto(URL_APP, { waitUntil: 'load' }); await q.waitForTimeout(300);
  await q.evaluate(preparer);
  await q.evaluate(() => { resetMisebasRapideSession(); render('misebas-rapide'); });
  await q.tap('#scan-misebas');
  check(!(await ouvert(q)) && await q.evaluate(() => document.getElementById('scan-misebas').getAttribute('inputmode') !== 'none'), 'PC : jamais de clavier Ovilog');
  await c2.close();
}
await browser.close();
console.log('\nTOUS LES TESTS « CLAVIER OVILOG » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
