/* Refonte Paramètres, partie 5 : Sauvegarde. « Mes données » (ligne « Dernière sauvegarde vérifiée le … » alimentée AUTOMATIQUEMENT par chaque export ; sur PC : « exportée le … (contrôlée avant
   téléchargement) » ; échec affiché clairement ; Exporter / Importer) ; « Application » (version installée UNE seule fois, Vérifier les mises à jour, bandeau « version prête à installer »
   avec « Redémarrer et installer » sur PC) ; bloc « Maintenance » replié (doublons du registre, nettoyage, diagnostic Bluetooth sur mobile) ; plus de « Tester la sauvegarde » ni de « Partager le
   fichier » ni de ❔. Les exports Android relus (SAF) sont couverts par test_export_saf. saveData REMPLACÉ. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const browser = await chromium.launch(LAUNCH);
const box = (page, sel) => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }; }, sel);
const visible = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0 && (!e.checkVisibility || e.checkVisibility()); }, sel);

for (const bureau of [true, false]) {
  const nom = bureau ? 'PC' : 'mobile';
  const ctx = await browser.newContext({ viewport: bureau ? { width: 1500, height: 1100 } : { width: 420, height: 1800 }, acceptDownloads: true });
  const page = await ctx.newPage();
  if (bureau) await page.addInitScript(() => {
    window.__maj = { status: 'not-available' }; window.__installs = 0;
    window.electronAPI = { isDesktop: true, version: '1.0.204', checkForUpdates: async () => { window.__cb && window.__cb(window.__maj); }, onUpdateStatus: cb => { window.__cb = cb; }, getUpdateStatus: async () => window.__maj, installUpdateNow: () => { window.__installs++; } };
  });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  const alertes = [];
  page.on('dialog', d => { if (d.type() === 'alert') alertes.push(d.message()); d.accept(); });
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.evaluate(() => {
    localStorage.removeItem('ovilog_derniere_sauvegarde');
    window.__saves = 0; DB = migrateData({}); saveData = function () { window.__saves++; return true; };
    DB.campagneDebut = 2026; DB.campagneInitialisee = true; DB.brebis = [{ id: 'b1', eid: '250 016299100001', statut: 'active', mouvements: [], sanitaire: [], echographies: [], notes: [], agnelages: [] }];
    prmMaintenanceOuvert = false; parametresTab = 'sauvegarde'; parametresRubrique = 'sauvegarde'; render('parametres');
  });
  // ---- structure
  eq(await page.evaluate(() => [...document.querySelectorAll('#card-mes-donnees .prm-titre, #card-application .prm-titre')].map(e => e.textContent)), ['Mes données', 'Application'], nom + ' : cartes Mes données et Application');
  const bd = await box(page, '#card-mes-donnees'), ba = await box(page, '#card-application');
  if (bureau) check(bd.x < ba.x && Math.abs(bd.y - ba.y) < 4, 'PC : Mes données à gauche, Application à droite');
  else check(bd.x === ba.x && bd.y < ba.y, 'mobile : une colonne');
  check(await page.evaluate(() => !document.getElementById('btn-test-sauvegarde') && !document.getElementById('btn-partager-test') && !document.getElementById('version-footer') && !document.getElementById('app').textContent.includes('❔')), nom + ' : plus de « Tester la sauvegarde », de « Partager le fichier », de pied de version ni de ❔');
  eq(await page.evaluate(() => document.getElementById('app').textContent.split('1.0.204').length - 1), bureau ? 1 : 0, nom + ' : version affichée UNE seule fois' + (bureau ? '' : ' (mobile de test : version de développement)'));
  if (!bureau) check(await page.evaluate(() => (document.getElementById('app').textContent.match(/Version installée/g) || []).length === 1), 'mobile : « Version installée » une seule fois');
  eq(await page.evaluate(() => [...document.querySelectorAll('#card-mes-donnees .btn')].map(b => b.textContent + (b.classList.contains('btn-primary') ? '*' : ''))), ['Exporter mes données*', 'Importer une sauvegarde'], nom + ' : boutons');
  check(await page.evaluate(() => document.querySelector('#card-mes-donnees details') && !document.querySelector('#card-mes-donnees details').open && /réimporte-les/.test(document.querySelector('#card-mes-donnees details').textContent)), nom + ' : conseil de réimport derrière « En savoir plus »');
  eq(await page.evaluate(() => document.getElementById('prm-etat-sauvegarde').textContent.trim()), 'Aucune sauvegarde vérifiée sur cet appareil', nom + ' : avant tout export');
  // ---- maintenance repliée
  check(await page.evaluate(() => { const d = document.getElementById('prm-maintenance'); return !!d && !d.open; }) && !(await visible(page, '#btn-dd-analyser')), nom + ' : Maintenance repliée par défaut');
  await page.click('#prm-maintenance > summary'); await page.waitForTimeout(100);
  check(await visible(page, '#btn-dd-analyser') && await visible(page, '#btn-nettoyer-registre'), nom + ' : dépliée : doublons + nettoyage');
  check(await visible(page, '#btn-goto-diag-bluetooth') === !bureau, nom + ' : diagnostic Bluetooth dans Maintenance, sur mobile seulement');
  if (!bureau) { await page.click('#btn-goto-diag-bluetooth'); eq(await page.evaluate(() => currentView), 'diag-bluetooth', 'mobile : le diagnostic s\'ouvre'); await page.click('#btn-back'); eq(await page.evaluate(() => parametresRubrique), 'sauvegarde', 'mobile : retour du diagnostic sur la rubrique Sauvegarde'); }
  console.log('OK ' + nom + ' : structure, version une seule fois, plus de test/partage, Maintenance repliée (doublons, nettoyage, diagnostic mobile).');

  // ---- export : navigateur / PC = téléchargement contrôlé avant l'export
  await page.evaluate(() => { parametresTab = 'sauvegarde'; parametresRubrique = 'sauvegarde'; render('parametres'); });
  const dl = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
  await page.click('#btn-export');
  const telechargement = await dl;
  await page.waitForFunction(() => /exportée le|vérifiée le/.test(document.getElementById('prm-etat-sauvegarde').textContent), null, { timeout: 10000 });
  const ligne = await page.evaluate(() => document.getElementById('prm-etat-sauvegarde').textContent.trim());
  check(telechargement && /^troupeau-sauvegarde-\d{4}-\d\d-\d\d\.json$/.test(telechargement.suggestedFilename()), nom + ' : fichier téléchargé : ' + (telechargement && telechargement.suggestedFilename()));
  check(/^Dernière sauvegarde exportée le \d\d-\d\d-\d{4} \(contrôlée avant téléchargement\)$/.test(ligne), nom + ' : ligne honnête hors Android : ' + ligne);
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('ovilog_derniere_sauvegarde')).mode === 'telechargement'), nom + ' : mémorisée sur l\'appareil');
  // contrôle qui échoue : rien n'est téléchargé, échec affiché
  await page.evaluate(() => { window.__cs = compteursSauvegarde; compteursSauvegarde = (d) => d === DB ? { brebis: 1, beliers: 0, agnelles: 0 } : { brebis: 2, beliers: 0, agnelles: 0 }; });
  let aTelecharge = false; page.once('download', () => { aTelecharge = true; });
  alertes.length = 0; await page.click('#btn-export'); await page.waitForTimeout(500);
  const ligne2 = await page.evaluate(() => document.getElementById('prm-etat-sauvegarde').textContent.replace(/\s+/g, ' ').trim());
  check(!aTelecharge && /Dernier export échoué le \d\d-\d\d-\d{4} : les compteurs/.test(ligne2) && /Dernière sauvegarde exportée le/.test(ligne2) && /Export non effectué/.test(alertes[0] || ''), nom + ' : contrôle en échec = rien téléchargé, échec affiché clairement (dernière réussite conservée) : ' + ligne2);
  await page.evaluate(() => { compteursSauvegarde = window.__cs; });
  await page.click('#btn-export'); await page.waitForFunction(() => !/échoué/.test(document.getElementById('prm-etat-sauvegarde').textContent), null, { timeout: 8000 });
  console.log('OK ' + nom + ' : export contrôlé avant téléchargement, ligne « exportée le … », échec clair sans téléchargement, réussite suivante efface l\'échec.');
  // ---- écran d'arrivée mobile : résumé
  if (!bureau) {
    await page.evaluate(() => { parametresRubrique = null; render('parametres'); });
    check(/^Dernière sauvegarde exportée le \d\d-\d\d-\d{4}/.test(await page.evaluate(() => document.querySelector('.prm-rub[data-rub="sauvegarde"] .prm-rub-resume').textContent)), 'mobile : résumé de la rubrique Sauvegarde');
  }
  // ---- application : mise à jour (PC)
  if (bureau) {
    await page.evaluate(() => { parametresTab = 'sauvegarde'; render('parametres'); });
    await page.waitForTimeout(200);
    check(!(await visible(page, '#update-pret')), 'PC : pas de bandeau sans mise à jour prête');
    await page.evaluate(() => { window.__maj = { status: 'downloaded', version: '1.0.205' }; });
    await page.click('#btn-check-update'); await page.waitForTimeout(150);
    check(await visible(page, '#update-pret') && /Version 1\.0\.205 prête à installer/.test(await page.evaluate(() => document.getElementById('update-pret').textContent)) && await page.evaluate(() => document.getElementById('btn-update-pret').textContent) === 'Redémarrer et installer', 'PC : bandeau « version prête à installer » + « Redémarrer et installer »');
    await page.click('#btn-update-pret'); eq(await page.evaluate(() => window.__installs), 1, 'PC : « Redémarrer et installer » déclenche l\'installation');
    await page.evaluate(() => { window.__maj = { status: 'not-available' }; });
    await page.click('#btn-check-update'); await page.waitForTimeout(150);
    check(!(await visible(page, '#update-pret')) && /à jour/.test(await page.evaluate(() => document.getElementById('update-check-status').textContent)), 'PC : à jour -> bandeau masqué');
    console.log('OK PC : Application (version, vérification, bandeau « prête à installer », installation).');
  }
  await ctx.close();
}
await browser.close();
console.log('\nTOUS LES TESTS DE PARAMÈTRES > SAUVEGARDE SONT PASSÉS');
