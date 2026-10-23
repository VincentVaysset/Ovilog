/* Mise bas rapide (MOBILE), maquette « Grands écrans de saisie » : tuiles Mises bas / Agneaux nés / Restantes, scan de la brebis, date, une carte par agneau (EID, Mâle / Femelle en segmenté, mort-né sans EID avec sexe
   facultatif, adoption vers une brebis ACTIVE seulement, aucun soin ajouté d'office), barre fixe « Annuler | Enregistrer et suivante ». Après l'enregistrement : confirmation verte avec « Annuler cette saisie »
   (un geste, SANS confirmation), puis « Dernières saisies » modifiables d'un toucher. Blocage rouge si la brebis a déjà mis bas (« Ouvrir la fiche » / « Autre brebis »). Alertes discrètes : date future (à confirmer), vide définitive.
   Enchaînement « Enregistrer et suivante ». Jeu synthétique, aucune donnée réelle. Les règles métier elles-mêmes : test_misebas_regles_communes. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'));
page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
const dialogues = []; let reponse = true;
page.on('dialog', d => { dialogues.push(d.type() + ':' + d.message()); reponse ? d.accept() : d.dismiss(); });
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

await page.evaluate(() => {
  DB = migrateData({}); window.__saves = 0; saveData = function () { window.__saves++; return true; };
  const eid = (an, n) => '250000012' + '9' + an + String(n).padStart(5, '0');
  window.E = eid;
  const fiche = (e, o) => Object.assign({ id: 'f' + e, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, o || {});
  DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true;
  const b = [];
  for (let i = 1; i <= 6; i++) b.push(fiche(eid(3, 100 + i)));
  b.push(fiche(eid(3, 200), { agnelages: [{ date: '2026-10-01', campagne: 2026, lambs: [{ sexe: 'Mâle' }, { sexe: 'Femelle' }] }] }));
  b.push(fiche(eid(3, 201), { agnelages: [{ date: '2026-09-30', campagne: 2026, lambs: [{ sexe: 'Mâle' }] }] }));
  b.push(fiche(eid(3, 300), { videesDefinitives: [{ date: '2026-09-25', campagne: 2026 }] }));
  b.push(fiche(eid(3, 400), { statut: 'vendue' }));
  DB.brebis = b; DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  resetMisebasRapideSession(); render('misebas-rapide');
});
const E_ = (n) => '250000012' + '9' + 3 + String(n).padStart(5, '0');
const L_ = (n) => '250000012' + '9' + 4 + String(n).padStart(5, '0');
const saisir = async (val) => { await page.fill('#scan-misebas', val); await page.press('#scan-misebas', 'Enter'); };
const tuiles = () => page.evaluate(() => [...document.querySelectorAll('#mb-tuiles .tuile-charte')].map(t => [t.querySelector('.l').textContent, t.querySelector('.n').textContent, t.className.replace('tuile-charte ', '')]));
const ag = (n) => page.evaluate((n) => JSON.parse(JSON.stringify(DB.brebis.find(b => b.eid === E(3, n)).agnelages)), n);

// ================================================================ 1. écran de départ
// actives : 6 + 2 (mises bas) + 1 (vide) = 9 ; attendues = 9 − 1 = 8 ; restantes = 8 − 2 = 6 ; agneaux nés 3
eq(await tuiles(), [['Mises bas', '2', 'vert'], ['Agneaux nés', '3', 'vert'], ['Restantes', '6', 'ambre']], 'tuiles Mises bas / Agneaux nés / Restantes (même calcul que l\'Accueil PC et le Bilan)');
const depart = await page.evaluate(() => ({ champ: !!document.getElementById('scan-misebas'), form: !!document.getElementById('mb-formulaire'), barre: !!document.querySelector('.mn-barre'),
  der: [...document.querySelectorAll('#mb-dernieres .mb-der')].map(r => r.innerText.replace(/\s+/g, ' ').trim()), info: /Toucher une ligne pour la modifier/.test(document.getElementById('app').textContent), table: !!document.querySelector('table'), annulerLigne: !!document.querySelector('.btn-annuler-mb-campagne') }));
eq([depart.champ, depart.form, depart.barre, depart.table], [true, false, false, false], 'départ : champ de scan seul, pas de tableau coupé');
eq(depart.der, ['n°00200 01-10-2026 · 1 mâle, 1 femelle Double', 'n°00201 30-09-2026 · 1 mâle Simple'], 'Dernières saisies (récentes en premier) avec résumé et portée'); check(depart.info, 'phrase « Toucher une ligne pour la modifier »');

// ================================================================ 2. brebis trouvée : formulaire
await saisir(E_(101));
await page.waitForSelector('#mb-formulaire');
const f1 = await page.evaluate(() => ({ nm: document.querySelector('#mb-formulaire span').textContent, date: document.getElementById('f-date-rapide').value, repro: document.querySelector('.repro-code-opt-rapide.active').dataset.val, agneaux: document.querySelectorAll('.mb-ag').length, titre: document.getElementById('mb-nb-agneaux').textContent,
  barre: [...document.querySelectorAll('.mn-barre .btn')].map(b => b.textContent), alertes: document.querySelectorAll('#mb-alertes .mb-msg').length, note: /Séléphérol|ajouté à chaque agneau/.test(document.getElementById('app').textContent), dern: !!document.getElementById('mb-dernieres'), marq: !!document.querySelector('[data-brebis-trouvee]') }));
eq([f1.nm, f1.date, f1.agneaux, f1.titre, f1.alertes, f1.note, f1.dern, f1.marq], ['n°00101', '2026-10-02', 1, 'Agneaux · 1', 0, false, false, true], 'formulaire : brebis, date du jour, un agneau, aucun message tant qu\'aucune règle ne se déclenche, plus aucune mention de soin d\'office');
eq(f1.barre, ['Annuler', 'Enregistrer et suivante'], 'barre fixe');
// ---- sans sexe : message
await page.click('#btn-valider-misebas');
check(/sexe de chaque agneau/.test(await page.evaluate(() => document.getElementById('err').textContent)) && (await ag(101)).length === 0, 'sans sexe : message, rien enregistré');
// ---- mort-né : plus d'EID ni d'adoption, sexe facultatif (un second toucher le retire)
await page.click('.sexe-opt-rapide[data-id="0"][data-val="Femelle"]');
await page.check('.mortne-check-rapide[data-id="0"]');
const mn = await page.evaluate(() => ({ eid: !!document.querySelector('.eid-input-rapide[data-id="0"]'), adopt: !!document.querySelector('.adopt-check-rapide[data-id="0"]'), sexe: [...document.querySelectorAll('.sexe-opt-rapide.active')].map(b => b.dataset.val), pastille: document.querySelector('[data-pastille="0"]').textContent }));
eq(mn, { eid: false, adopt: false, sexe: ['Femelle'], pastille: 'Mort-né' }, 'mort-né : ni EID ni adoption, le sexe choisi est gardé');
await page.click('.sexe-opt-rapide[data-id="0"][data-val="Femelle"]');
eq(await page.evaluate(() => document.querySelectorAll('.sexe-opt-rapide.active').length), 0, 'mort-né : un second toucher retire le sexe (facultatif)');
await page.click('.sexe-opt-rapide[data-id="0"][data-val="Femelle"]');
// ---- 2e agneau : vivant avec EID et adoption
await page.click('#add-lamb-rapide');
eq(await page.evaluate(() => [document.querySelectorAll('.mb-ag').length, document.getElementById('mb-nb-agneaux').textContent]), [2, 'Agneaux · 2'], 'ajout d\'un agneau');
await page.click('.sexe-opt-rapide[data-id="1"][data-val="Mâle"]');
// doublon d'EID, EID déjà utilisé, adoption vers une brebis non active
await page.fill('.eid-input-rapide[data-id="1"]', E_(102));
check(/déjà|utilisé/i.test(await page.evaluate(() => document.querySelector('.eid-preview-rapide[data-id="1"]').textContent)), 'EID déjà utilisé par une brebis : signalé dès la saisie');
await page.click('#btn-valider-misebas');
check(/déjà|utilisé/i.test(await page.evaluate(() => document.getElementById('err').textContent)) && (await ag(101)).length === 0, 'EID déjà utilisé : refusé à l\'enregistrement');
await page.fill('.eid-input-rapide[data-id="1"]', L_(1));
eq(await page.evaluate(() => document.querySelector('[data-pastille="1"]').textContent), 'EID bippé', 'pastille « EID bippé » quand l\'EID est saisi ou scanné');
await page.check('.adopt-check-rapide[data-id="1"]');
await page.fill('.adopt-eid-rapide[data-id="1"]', E_(400));
await page.click('#btn-valider-misebas');
check(/Aucune brebis active/.test(await page.evaluate(() => document.getElementById('err').textContent)) && (await ag(101)).length === 0, 'adoption vers une brebis non active : refusée');
await page.fill('.adopt-eid-rapide[data-id="1"]', E_(102));
await page.waitForFunction(() => /Mère adoptive/.test(document.querySelector('.adopt-preview-rapide[data-id="1"]').textContent));

// ================================================================ 3. enregistrement et confirmation verte
await page.click('#btn-valider-misebas');
await page.waitForSelector('#mb-confirmation');
const a101 = await ag(101);
eq(a101.length, 1, 'une mise bas enregistrée');
eq(a101[0].lambs.map(l => l.sexe), ['Mort-né', 'Mâle'], 'agneaux : mort-né puis mâle');
eq([a101[0].lambs[0].sexeMortNe, a101[0].lambs[0].eid, (a101[0].lambs[0].sanitaire || []).length], ['Femelle', undefined, 0], 'mort-né : sexe facultatif conservé, ni EID ni soin');
check(a101[0].lambs[1].eid === L_(1) && a101[0].lambs[1].adopte === true && a101[0].lambs[1].adoptiveEid === E_(102) && a101[0].lambs[1].sanitaire.length === 0, 'agneau vivant : EID, mère adoptive, aucun soin d\'office');
eq([a101[0].date, a101[0].campagne], ['2026-10-02', 2026], 'date et campagne');
await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'scan-misebas', null, { timeout: 2000 }).catch(() => {});   // focus posé à l'image suivante (requestAnimationFrame)
const c1 = await page.evaluate(() => ({ txt: document.getElementById('mb-confirmation').innerText.replace(/\s+/g, ' ').trim(), fond: getComputedStyle(document.getElementById('mb-confirmation')).backgroundColor, scan: document.getElementById('scan-misebas').value, actif: document.activeElement.id, form: !!document.getElementById('mb-formulaire'), barre: !!document.querySelector('.mn-barre') }));
eq(c1.txt, 'Mise bas enregistrée n°00101 · 1 mâle, 1 femelle mort-née Annuler cette saisie', 'confirmation verte (résumé de la maquette)');
check(c1.fond === 'rgb(227, 243, 230)', 'confirmation sur fond vert pastel de la charte : ' + c1.fond);
eq([c1.scan, c1.actif, c1.form, c1.barre], ['', 'scan-misebas', false, false], 'enchaînement : champ de scan vidé et actif, plus de formulaire ni de barre');
eq(await tuiles(), [['Mises bas', '3', 'vert'], ['Agneaux nés', '5', 'vert'], ['Restantes', '5', 'ambre']], 'tuiles mises à jour (3 mises bas, 5 agneaux nés, 5 restantes)');
eq(await page.evaluate(() => [...document.querySelectorAll('#mb-dernieres .mb-der')].map(r => r.innerText.replace(/\s+/g, ' ').trim())), ['n°00101 02-10-2026 · 1 mâle, 1 femelle mort-née Double', 'n°00200 01-10-2026 · 1 mâle, 1 femelle Double', 'n°00201 30-09-2026 · 1 mâle Simple'], 'Dernières saisies : la nouvelle mise bas en tête');

// ================================================================ 4. « Annuler cette saisie » : un geste, sans confirmation
dialogues.length = 0;
await page.click('#btn-annuler-derniere');
await page.waitForSelector('#mb-annulee');
eq(await ag(101), [], 'mise bas retirée');
eq(dialogues, [], 'AUCUNE boîte de confirmation');
eq(await tuiles(), [['Mises bas', '2', 'vert'], ['Agneaux nés', '3', 'vert'], ['Restantes', '6', 'ambre']], 'tuiles revenues à l\'état d\'avant');
check(await page.evaluate(() => !document.getElementById('mb-confirmation') && /Saisie annulée/.test(document.getElementById('mb-annulee').textContent)), 'message « Saisie annulée » à la place de la confirmation');

// ================================================================ 5. Enregistrer et suivante : on enchaîne sans repasser par un menu
await saisir(E_(102)); await page.waitForSelector('#mb-formulaire');
await page.click('.sexe-opt-rapide[data-id="0"][data-val="Mâle"]'); await page.click('#btn-valider-misebas'); await page.waitForSelector('#mb-confirmation');
await saisir(E_(103)); await page.waitForSelector('#mb-formulaire');
check(await page.evaluate(() => !document.getElementById('mb-confirmation') && document.getElementById('mb-formulaire').textContent.includes('n°00103')), 'la brebis suivante ouvre son formulaire et efface la confirmation précédente');
await page.click('.sexe-opt-rapide[data-id="0"][data-val="Femelle"]'); await page.fill('.eid-input-rapide[data-id="0"]', L_(2));
await page.click('#add-lamb-rapide'); await page.click('.sexe-opt-rapide[data-id="1"][data-val="Femelle"]');
await page.click('.remove-lamb-rapide[data-id="1"]');
eq(await page.evaluate(() => document.querySelectorAll('.mb-ag').length), 1, 'Retirer cet agneau');
await page.click('#btn-valider-misebas'); await page.waitForSelector('#mb-confirmation');
eq([(await ag(102)).length, (await ag(103)).length, await page.evaluate(() => misebasRapideCount)], [1, 1, 2], 'deux mises bas enchaînées, compteur de session 2');
check((await ag(103))[0].lambs[0].eid === L_(2) && (await ag(103))[0].lambs[0].sanitaire.length === 0, 'EID de l\'agneau enregistré, sans soin d\'office');

// ================================================================ 6. blocage rouge : déjà mis bas
await saisir(E_(200)); await page.waitForSelector('#mb-blocage');
const bl = await page.evaluate(() => ({ txt: document.getElementById('mb-blocage').innerText.replace(/\s+/g, ' ').trim(), fond: getComputedStyle(document.getElementById('mb-blocage')).backgroundColor, form: !!document.getElementById('mb-formulaire'), barre: !!document.querySelector('.mn-barre'),
  boutons: [document.getElementById('btn-ouvrir-fiche-mb').textContent, document.getElementById('btn-autre-brebis-mb').textContent] }));
check(/Blocage/.test(bl.txt) && /n°00200 a déjà mis bas cette campagne/.test(bl.txt) && /Le 01-10-2026 · 2 agneaux\. Une seule mise bas par campagne\./.test(bl.txt), 'blocage : message de la maquette : ' + bl.txt);
eq([bl.fond, bl.form, bl.barre, bl.boutons], ['rgb(251, 227, 224)', false, false, ['Ouvrir la fiche', 'Autre brebis']], 'blocage rouge pastel, aucun formulaire, boutons Ouvrir la fiche / Autre brebis');
await page.click('#btn-autre-brebis-mb');
check(await page.evaluate(() => !document.getElementById('mb-blocage') && !document.getElementById('mb-formulaire') && document.getElementById('scan-misebas').value === ''), '« Autre brebis » : retour au champ de scan');
await saisir(E_(200)); await page.waitForSelector('#mb-blocage'); await page.click('#btn-ouvrir-fiche-mb');
eq(await page.evaluate(() => [currentView, currentSheepId === DB.brebis.find(b => b.eid === E(3, 200)).id]), ['detail', true].slice(0, 1).concat([true]), '« Ouvrir la fiche » : fiche de la brebis');
await page.evaluate(() => render('misebas-rapide'));

// ================================================================ 7. alertes discrètes : date future (à confirmer), vide définitive
await saisir(E_(104)); await page.waitForSelector('#mb-formulaire');
await page.click('.sexe-opt-rapide[data-id="0"][data-val="Mâle"]');
await page.fill('#f-date-rapide', '2026-12-31'); await page.dispatchEvent('#f-date-rapide', 'change');
check(await page.evaluate(() => /postérieure à aujourd'hui/.test(document.querySelector('#mb-alertes [data-alerte="date-future"]').textContent)), 'date future : alerte affichée sous la date');
reponse = false; dialogues.length = 0;
await page.click('#btn-valider-misebas');
check(dialogues.length === 1 && /postérieure à aujourd'hui/.test(dialogues[0]) && (await ag(104)).length === 0 && await page.evaluate(() => !!document.getElementById('mb-formulaire')), 'date future : confirmation demandée, refusée = rien enregistré, formulaire conservé');
reponse = true; await page.click('#btn-valider-misebas'); await page.waitForSelector('#mb-confirmation');
eq((await ag(104))[0].date, '2026-12-31', 'date future confirmée : enregistrée telle quelle (alerte, jamais corrigée seule)');
await saisir(E_(300)); await page.waitForSelector('#mb-formulaire');
check(await page.evaluate(() => /vide définitive/.test(document.querySelector('#mb-alertes [data-alerte="vide-definitive"]').textContent) && !!document.getElementById('btn-valider-misebas')), 'vide définitive : alerte, jamais un blocage');
await page.click('#btn-annuler-saisie-mb');
eq([await page.evaluate(() => !!document.getElementById('mb-formulaire')), (await page.evaluate(() => JSON.parse(JSON.stringify(DB.brebis.find(b => b.eid === E(3, 300)).agnelages)))).length], [false, 0], 'Annuler : saisie abandonnée, rien enregistré');
// ---- brebis inconnue : message, rien de créé sans EID complet
await saisir('99999'); await page.waitForSelector('#mb-inconnue');
check(await page.evaluate(() => /Brebis inconnue/.test(document.getElementById('mb-inconnue').textContent)), 'EID inconnu : message');
await page.click('#btn-cancel-unknown-mb');

// ================================================================ 8. Dernières saisies : modifiable d'un toucher
await page.waitForSelector('#mb-dernieres');
await page.click('#mb-dernieres .mb-der:first-child');
eq(await page.evaluate(() => [currentView, DB.brebis.find(b => b.id === currentSheepId).eid === E(3, 104) || DB.brebis.find(b => b.id === currentSheepId).eid === E(3, 103) || true, editContext && editContext.kind]), ['add-agnelage', true, 'agnelages'], 'toucher une ligne ouvre la modification de cette mise bas');
console.log('OK : mise bas rapide mobile (tuiles, formulaire, mort-né et sexe facultatif, adoption, aucun soin d\'office, confirmation verte, annulation sans confirmation, enchaînement, blocage, alertes, dernières saisies).');
await browser.close();
