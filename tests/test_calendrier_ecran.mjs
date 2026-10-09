/* Refonte Calendrier, parties C1 + C2 : mise en page PC et mobile. PC : le mois à gauche (cases blanches à bord fin, aujourd'hui entouré en vert, flèches rondes, « Aujourd'hui »), « Nouvel évènement »
   et « Évènements du mois » à droite — sous le mois et CÔTE À CÔTE si la fenêtre est étroite ; nom de l'évènement dans la case (étiquette verte ; ambrée pour les évènements automatiques), les 2 premiers
   puis « +N » ; clic sur un jour = date du formulaire préremplie sans perdre ce qui est déjà saisi ; liste du mois (date, type, note ; « automatique » en lecture seule) ; clic sur un évènement = modification
   dans le formulaire, suppression avec confirmation ; types en étiquettes avec « + Autre type » (même liste « Types de journal »). Mobile : une colonne (mois, Nouvel évènement, Évènements du mois), point sous le
   jour, initiales des jours. Saisie au clavier réel. Horloge figée au 15-10-2026. saveData REMPLACÉ. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const box = (page, sel) => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }, sel);

async function ouvrir(bureau, largeur) {
  const ctx = await browser.newContext({ viewport: bureau ? { width: largeur || 1500, height: 1100 } : { width: 420, height: 1600 } });
  const page = await ctx.newPage();
  if (bureau) await page.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  await page.clock.setFixedTime(new Date('2026-10-15T09:00:00'));
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  let reponse = true; const confirms = [];
  page.on('dialog', d => { if (d.type() === 'confirm') { confirms.push(d.message()); reponse ? d.accept() : d.dismiss(); } else d.accept(); });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__saves = 0; DB = migrateData({}); saveData = function () { window.__saves++; return true; };
    DB.campagneDebut = 2026; DB.campagneInitialisee = true; DB.campagneDateDemarrage = '2026-10-01'; DB.brebis = [];
    DB.typesJournal = ['Lutte', 'Tonte', 'Vermifuge collectif', 'Visite vétérinaire', 'Début traite'];
    DB.journal = [
      { type: 'Visite vétérinaire', date: '2026-10-07', note: '' }, { type: 'Tonte', date: '2026-10-15', note: 'lot des agnelles de 2025' },
      { type: 'Vermifuge collectif', date: '2026-10-15', note: '' }, { type: 'Lutte', date: '2026-10-15', note: 'x' }, { type: 'Début traite', date: '2026-10-28', note: '' },
      { type: 'Tonte', date: '2026-09-20', note: 'mois précédent' }];
    DB.lots = [{ id: 'lot1', type: 'reproduction', mode: 'IA', nom: 'Lot IA octobre', dateEvenement: '2026-10-20', membres: [] }];
    calendrierMoisAffiche = null; calendrierJourSelectionne = null; calendrierEdition = null; render('journal');
  });
  return { page, confirms, setReponse: v => { reponse = v; } };
}

// ================================================================ PC
{
  const { page, confirms, setReponse } = await ouvrir(true);
  const derives = await page.evaluate(() => evenementsCalendrierDerives().filter(e => e.date.startsWith('2026-10')).map(e => e.label));
  // ---- 1. mise en page
  const m = await box(page, '#cal-mois'), n = await box(page, '#cal-nouvel'), l = await box(page, '#cal-liste');
  check(m.x < n.x && m.w > n.w && Math.abs(n.y - m.y) < 4 && n.y < l.y && n.x === l.x, 'PC large : mois à gauche (plus large), Nouvel évènement et Évènements du mois à droite, empilés : ' + JSON.stringify([m, n, l]));
  eq(await page.evaluate(() => document.querySelector('.cal-titre').textContent), 'Octobre 2026', 'titre du mois');
  eq(await page.evaluate(() => [...document.querySelectorAll('.cal-entete')].map(e => e.textContent)), ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'], 'jours de la semaine (PC)');
  check(await page.evaluate(() => !document.getElementById('app').textContent.includes('❔') && !document.getElementById('new-journal-type') && !document.getElementById('add-journal-type') && !document.getElementById('calendrier-jour-detail')), 'plus de champ « Ajouter un nouveau type », ni de détail du jour, ni de ❔');
  check(await page.evaluate(() => { const c = document.querySelector('.cal-jour:not(.cal-jour-today)'), t = document.querySelector('.cal-jour-today'); const cs = getComputedStyle(c), ts = getComputedStyle(t); return cs.backgroundColor === 'rgb(255, 255, 255)' && cs.borderTopWidth === '1px' && t.dataset.date === '2026-10-15' && ts.borderTopColor === 'rgb(60, 138, 85)' && parseFloat(ts.borderTopWidth) >= 2; }), 'cases blanches à bord fin ; aujourd\'hui (15) entouré en vert');
  // ---- 2. noms dans les cases
  const cell = (d) => page.evaluate(x => { const b = document.querySelector(`.cal-jour[data-date="${x}"]`); return { etiq: [...b.querySelectorAll('.cal-etiq')].map(e => e.textContent + (e.classList.contains('cal-etiq-auto') ? '(auto)' : '')), plus: (b.querySelector('.cal-plus') || {}).textContent || null, point: !!b.querySelector('.cal-point') }; }, d);
  eq(await cell('2026-10-07'), { etiq: ['Visite vétérinaire'], plus: null, point: false }, 'case du 07 : le nom, plus de point');
  eq(await cell('2026-10-15'), { etiq: ['Tonte', 'Vermifuge collectif'], plus: '+1', point: false }, 'case du 15 (3 évènements) : 2 noms puis +1');
  eq((await cell('2026-10-20')).etiq, ['Lutte IA — Lot IA octobre(auto)'], 'évènement automatique : étiquette ambrée');
  eq(await cell('2026-10-01'), { etiq: [], plus: null, point: false }, 'jour sans évènement : rien');
  check(await page.evaluate(() => getComputedStyle(document.querySelector('.cal-etiq')).backgroundColor === 'rgb(225, 243, 230)'), 'étiquette verte');
  // ---- 3. liste du mois
  const lignes = await page.evaluate(() => [...document.querySelectorAll('#cal-liste .cal-ev')].map(r => [r.querySelector('.cal-ev-date').textContent, r.querySelector('b').textContent, (r.querySelector('.cal-ev-note') || r.querySelector('.cal-badge-auto')).textContent, r.tagName]));
  const attendu = [['07-10', 'Visite vétérinaire', 'sans note', 'BUTTON'], ['15-10', 'Tonte', 'lot des agnelles de 2025', 'BUTTON'], ['15-10', 'Vermifuge collectif', 'sans note', 'BUTTON'], ['15-10', 'Lutte', 'x', 'BUTTON']];
  eq(lignes.slice(0, 4), attendu, 'Évènements du mois : date, type, note (les 4 premiers)');
  const autos = lignes.filter(r => r[3] === 'DIV');
  eq(autos.map(r => r[1]), derives, 'évènements automatiques de la liste = fonction de données');
  check(autos.every(r => r[2] === 'automatique'), 'marqués « automatique », non cliquables (div)');
  eq(await page.evaluate(() => document.querySelector('#cal-liste .prm-note').textContent), (lignes.length) + ' évènements', 'compteur du mois');
  check(!lignes.some(r => r[1] === 'Tonte' && r[2] === 'mois précédent'), 'aucun évènement d\'un autre mois');
  console.log('OK PC (1) : mise en page, cases blanches, aujourd\'hui en vert, noms dans les cases (+N, automatiques ambrées), liste du mois.');

  // ---- 4. clic sur un jour : date préremplie, rien de perdu
  await page.click('#f-journal-note'); await page.keyboard.type('note en cours', { delay: 20 });
  await page.click('#cal-nouvel .chip:text-is("Lutte")');
  await page.click('.cal-jour[data-date="2026-10-09"]');
  eq(await page.evaluate(() => [document.getElementById('f-journal-date').value, document.getElementById('f-journal-note').value, document.querySelector('#journal-type-list .chip.selected').textContent, document.querySelector('.cal-jour-sel').dataset.date]), ['2026-10-09', 'note en cours', 'Lutte', '2026-10-09'], 'clic sur un jour : date préremplie, note et type conservés, jour entouré');
  // ---- 5. + Autre type
  eq(await page.evaluate(() => [...document.querySelectorAll('#journal-type-list .chip')].map(c => c.textContent).slice(-2)), ['Début traite', '+ Autre type'], 'dernière étiquette « + Autre type »');
  await page.click('#btn-autre-type');
  check(await page.evaluate(() => !!document.getElementById('liste-ajout-input')), 'fenêtre d\'ajout à la volée');
  await page.keyboard.type('Pesée des agneaux', { delay: 20 }); await page.keyboard.press('Enter');
  eq(await page.evaluate(() => [DB.typesJournal.includes('Pesée des agneaux'), document.querySelector('#journal-type-list .chip.selected').textContent, document.getElementById('f-journal-note').value, window.__saves]), [true, 'Pesée des agneaux', 'note en cours', 1], '« + Autre type » : type ajouté à la liste, sélectionné, note conservée, une écriture');
  // ---- 6. enregistrer un nouvel évènement
  await page.click('#btn-save-journal'); await page.waitForTimeout(100);
  eq(await page.evaluate(() => DB.journal[DB.journal.length - 1]), { type: 'Pesée des agneaux', date: '2026-10-09', note: 'note en cours' }, 'évènement créé');
  eq(await cell('2026-10-09'), { etiq: ['Pesée des agneaux'], plus: null, point: false }, 'le nom apparaît dans la case du 09');
  // ---- 7. modifier
  await page.click('#cal-liste .cal-ev-ouvrir:has-text("Pesée des agneaux")');
  eq(await page.evaluate(() => [document.getElementById('cal-form-titre').textContent, document.getElementById('f-journal-date').value, document.getElementById('f-journal-note').value, document.querySelector('#journal-type-list .chip.selected').textContent]), ["Modifier l'évènement", '2026-10-09', 'note en cours', 'Pesée des agneaux'], 'clic sur un évènement : formulaire en modification');
  check(await page.evaluate(() => ['btn-annuler-journal', 'btn-del-journal-form'].every(i => !!document.getElementById(i))), 'boutons Annuler et Supprimer');
  await page.fill('#f-journal-note', ''); await page.click('#f-journal-note'); await page.keyboard.type('à 50 kg', { delay: 20 });
  await page.click('#cal-nouvel .chip:text-is("Tonte")');
  await page.focus('#f-journal-date'); await page.fill('#f-journal-date', '2026-10-12');
  const nAvant = await page.evaluate(() => DB.journal.length);
  await page.click('#btn-save-journal'); await page.waitForTimeout(100);
  eq(await page.evaluate(() => [DB.journal.length, DB.journal[DB.journal.length - 1]]), [nAvant, { type: 'Tonte', date: '2026-10-12', note: 'à 50 kg' }], 'évènement modifié (pas de doublon)');
  eq(await page.evaluate(() => document.getElementById('cal-form-titre').textContent), 'Nouvel évènement', 'retour au formulaire de création');
  // ---- 8. supprimer avec confirmation
  await page.click('#cal-liste .cal-ev-ouvrir:has-text("à 50 kg")');
  setReponse(false); confirms.length = 0; await page.click('#btn-del-journal-form');
  check(confirms.length === 1 && /Supprimer cet évènement du calendrier/.test(confirms[0]) && await page.evaluate(() => DB.journal.length) === nAvant, 'suppression refusée : rien supprimé');
  setReponse(true); await page.click('#btn-del-journal-form'); await page.waitForTimeout(100);
  eq(await page.evaluate(() => [DB.journal.length, DB.journal.some(e => e.note === 'à 50 kg')]), [nAvant - 1, false], 'suppression acceptée');
  // annuler
  await page.click('#cal-liste .cal-ev-ouvrir:has-text("lot des agnelles")'); await page.click('#btn-annuler-journal');
  eq(await page.evaluate(() => document.getElementById('cal-form-titre').textContent), 'Nouvel évènement', 'Annuler ferme la modification');
  // ---- 9. navigation
  await page.click('#btn-mois-prec');
  eq(await page.evaluate(() => document.querySelector('.cal-titre').textContent), 'Septembre 2026', 'mois précédent');
  check((await page.evaluate(() => [...document.querySelectorAll('#cal-liste .cal-ev b')].map(b => b.textContent))).includes('Tonte'), 'liste du mois précédent');
  await page.click('#btn-mois-suiv'); await page.click('#btn-mois-suiv');
  eq(await page.evaluate(() => document.querySelector('.cal-titre').textContent), 'Novembre 2026', 'mois suivant');
  await page.click('#btn-aujourdhui');
  eq(await page.evaluate(() => [document.querySelector('.cal-titre').textContent, document.querySelector('.cal-jour-sel').dataset.date]), ['Octobre 2026', '2026-10-15'], '« Aujourd\'hui »');
  // ---- 10. validation
  await page.click('#btn-save-journal');
  check(/Choisis ou ajoute un type/.test(await page.evaluate(() => document.getElementById('journal-err').textContent)), 'type obligatoire');
  console.log('OK PC (2) : clic sur un jour, + Autre type, création, modification, suppression avec confirmation, navigation, Aujourd\'hui.');
  await page.context().close();
}
// ---- PC étroit : les 2 cartes passent sous le mois, côte à côte
{
  const { page } = await ouvrir(true, 1100);
  const m = await box(page, '#cal-mois'), n = await box(page, '#cal-nouvel'), l = await box(page, '#cal-liste');
  check(n.y >= m.y + m.h && Math.abs(n.y - l.y) < 4 && n.x < l.x && (l.x + l.w) - n.x >= m.w - 8 && n.w > 250 && l.w > 250, 'fenêtre étroite : les 2 cartes sous le mois, côte à côte sur toute la largeur : ' + JSON.stringify([m, n, l]));
  console.log('OK PC étroit : les 2 cartes passent sous le mois côte à côte.');
  await page.context().close();
}
// ================================================================ MOBILE
{
  const { page } = await ouvrir(false);
  eq(await page.evaluate(() => [...document.querySelectorAll('.cal-entete')].map(e => e.textContent)), ['L', 'M', 'M', 'J', 'V', 'S', 'D'], 'mobile : initiales des jours');
  const m = await box(page, '#cal-mois'), n = await box(page, '#cal-nouvel'), l = await box(page, '#cal-liste');
  check(m.x === n.x && n.x === l.x && m.y < n.y && n.y < l.y, 'mobile : une colonne, dans l\'ordre mois, Nouvel évènement, Évènements du mois : ' + JSON.stringify([m, n, l]));
  const c15 = await page.evaluate(() => { const b = document.querySelector('.cal-jour[data-date="2026-10-15"]'); return { etiq: b.querySelectorAll('.cal-etiq').length, point: !!b.querySelector('.cal-point') }; });
  eq(c15, { etiq: 0, point: true }, 'mobile : un point sous le jour, pas de noms dans la case');
  check(await page.evaluate(() => !document.querySelector('.cal-jour[data-date="2026-10-01"] .cal-point')), 'mobile : pas de point sans évènement');
  eq(await page.evaluate(() => [...document.querySelectorAll('#cal-liste .cal-ev')].length > 4), true, 'mobile : les noms se lisent dans Évènements du mois');
  eq(await page.evaluate(() => [...document.querySelectorAll('#journal-type-list .chip')].map(c => c.textContent).pop()), '+ Autre type', 'mobile : « + Autre type »');
  await page.click('.cal-jour[data-date="2026-10-22"]');
  eq(await page.evaluate(() => document.getElementById('f-journal-date').value), '2026-10-22', 'mobile : clic sur un jour = date du formulaire');
  await page.click('#cal-liste .cal-ev-ouvrir:has-text("Visite vétérinaire")');
  eq(await page.evaluate(() => [document.getElementById('cal-form-titre').textContent, document.getElementById('f-journal-date').value]), ["Modifier l'évènement", '2026-10-07'], 'mobile : modification d\'un évènement');
  console.log('OK mobile : une colonne, point sous le jour, liste, + Autre type, modification.');
  await page.context().close();
}
await browser.close();
console.log('\nTOUS LES TESTS DU CALENDRIER SONT PASSÉS');
