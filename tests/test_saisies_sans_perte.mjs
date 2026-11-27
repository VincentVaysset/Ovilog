/* Saisies sans perte (chantier du 27/11, point 1) : séance d'échographies MOBILE de 180 bips, rejouée 20 fois, avec des réceptions de synchro
   glissées au hasard entre le bip et « Enregistrer » (une réception remplace les fiches de DB par des copies neuves : c'est ce que fait la fusion
   des instantanés reçus), des re-bips de correction (« Modifier » remplace la MÊME écho), une brebis inconnue créée au bip et des « Passer ».
   Attendu à chaque séance : 0 perte (chaque brebis enregistrée a son écho, avec le dernier résultat choisi, en base ET dans le stockage local),
   compteurs de l'écran = données enregistrées, contrôle de fin de séance vide. Avec le code d'avant le correctif, des échos disparaissaient.
   Jeu synthétique, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.clock.setFixedTime(new Date('2026-11-26T09:00:00'));
const erreurs = []; page.on('pageerror', e => erreurs.push(e.message));
page.on('dialog', d => d.accept());
await page.goto(URL_APP, { waitUntil: 'load' });
await page.waitForTimeout(300);

const SEANCES = 20, BIPS = 180, REBIP = process.env.OVILOG_SANS_REBIP ? 0 : 0.12;   // OVILOG_SANS_REBIP : pour montrer la perte avec le code d'avant (qui n'a pas « Modifier »)
for (let s = 0; s < SEANCES; s++) {
  const graine = 1000 + s * 7919;
  const r = await page.evaluate(({ graine, BIPS, REBIP }) => {
    let x = graine; const hasard = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
    const eid = n => '250000012' + '9' + '3' + String(n).padStart(5, '0');
    const fiche = (e, i) => ({ id: 'f' + i, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] });
    try { localStorage.clear(); } catch (e) { /* ignoré */ }
    DB = migrateData({});
    DB.campagneDebut = 2027; DB.campagneDateDemarrage = '2026-09-29'; DB.campagneInitialisee = true;
    DB.brebis = Array.from({ length: 190 }, (_, i) => fiche(eid(100 + i), i)); DB.beliers = []; DB.agnelles = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
    saveData(DB);
    resetEchoRapideSession(); render('echo-rapide');
    document.querySelector('#echo-comptage [data-val="' + (graine % 2 ? 'exact' : 'aucun') + '"]').click();
    document.getElementById('btn-start-echo-session').click();
    // réception de synchro : copies neuves des fiches, par le chemin réel (setRecordsArrayForSync) ou remplacement brut de la liste (écran qui doit relire la fiche par son id)
    let brut = 0;
    const synchro = () => window.__appliquerSynchro(() => { const copies = DB.brebis.map(b => JSON.parse(JSON.stringify(b))); if (hasard() < 0.5) { DB.brebis = copies; brut++; } else (window.__recevoirFiches || ((c, a) => { DB[c] = a; }))('brebis', copies); });   // sans __recevoirFiches (code d'avant le correctif) : remplacement brut
    const attendu = {};   // eid -> dernier résultat enregistré
    const bipees = [];
    let inconnue = false, modifs = 0, passes = 0, synchros = 0;
    for (let k = 0; k < BIPS; k++) {
      let n = 100 + Math.floor(hasard() * 190), e = eid(n);
      const rebip = Object.keys(attendu).length > 5 && hasard() < REBIP;
      if (rebip) e = Object.keys(attendu)[Math.floor(hasard() * Object.keys(attendu).length)];
      else if (attendu[e]) continue;
      if (!inconnue && !rebip && k >= 60) { e = '250000012955555'; inconnue = true; }
      const champ = document.getElementById('scan-echo');
      champ.value = e; champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      bipees.push(e);
      if (document.getElementById('btn-create-unknown')) { document.getElementById('btn-create-unknown').click(); if (hasard() < 0.7) { synchro(); synchros++; } }
      if (hasard() < 0.35) { synchro(); synchros++; }
      if (rebip) {
        const m = document.getElementById('btn-modifier-echo');
        if (!m) return { erreur: 're-bip sans bouton « Modifier » : ' + e };
        m.click(); modifs++;
      }
      if (!rebip && hasard() < 0.05) { document.getElementById('btn-passer-echo').click(); passes++; continue; }
      const stades = [...document.querySelectorAll('.stade-opt')];
      const choix = stades[Math.floor(hasard() * stades.length)];
      if (!choix) return { erreur: 'pas de résultat proposé pour ' + e };
      choix.click();
      const nb = document.querySelector('#nombre-agneaux-block:not(.hidden) .tab-btn');
      if (nb) nb.click();
      if (hasard() < 0.35) { synchro(); synchros++; }
      document.getElementById('btn-valider-echo').click();
      const q = document.getElementById('qc-oui'); if (q) q.click();
      attendu[e] = choix.dataset.val;
      if (hasard() < 0.2) { synchro(); synchros++; }
    }
    // contrôle : base ET stockage local
    const stocke = JSON.parse(localStorage.getItem(DB_KEY) || '{}');
    const pertes = [], mauvais = [];
    Object.keys(attendu).forEach(e => {
      [['base', DB.brebis], ['stockage', stocke.brebis || []]].forEach(([ou, liste]) => {
        const f = liste.find(b => cleanEid(b.eid) === cleanEid(e));
        const echos = f ? (f.echographies || []).filter(x => x.date === '2026-11-26') : [];
        if (echos.length !== 1) pertes.push(ou + ':' + e.slice(-5) + ':' + echos.length);
        else if ((echos[0].stade || echos[0].special) !== attendu[e]) mauvais.push(ou + ':' + e.slice(-5));
      });
    });
    const nbV = Object.values(attendu).filter(v => v === 'Vide').length;
    const ecran = [document.getElementById('echo-n-pleines').textContent, document.getElementById('echo-n-vides').textContent].map(Number);
    return { pertes, mauvais, ecran, donnees: [Object.keys(attendu).length - nbV, nbV], modifs, passes, synchros, enreg: Object.keys(attendu).length, finSeance: typeof controleFinSeanceEcho === 'function' ? controleFinSeanceEcho().manquantes.length : -1 };
  }, { graine, BIPS, REBIP });
  check(!r.erreur, 'séance ' + (s + 1) + ' : ' + r.erreur);
  check(!r.pertes.length, 'séance ' + (s + 1) + ' (graine ' + graine + ') : ' + r.pertes.length + ' écho(s) perdue(s) sur ' + r.enreg + ' : ' + r.pertes.slice(0, 8).join(', '));
  check(!r.mauvais.length, 'séance ' + (s + 1) + ' : résultat modifié non gardé : ' + r.mauvais.join(', '));
  check(JSON.stringify(r.ecran) === JSON.stringify(r.donnees), 'séance ' + (s + 1) + ' : compteurs de l\'écran ' + JSON.stringify(r.ecran) + ' ≠ données ' + JSON.stringify(r.donnees));
  check(r.finSeance === 0, 'séance ' + (s + 1) + ' : contrôle de fin de séance : ' + r.finSeance);
  check((r.modifs > 3 || !REBIP) && r.synchros > 50, 'séance ' + (s + 1) + ' : scénario trop pauvre ' + JSON.stringify(r));
  if (s === 0) console.log('séance 1 : ' + r.enreg + ' échos, ' + r.modifs + ' corrections, ' + r.passes + ' passées, ' + r.synchros + ' synchros');
}
// MISES BAS rapides (mobile) : 20 séances de 60 mises bas, réceptions de synchro au hasard entre le bip et « Enregistrer » : 0 perte, compteur = base
for (let s = 0; s < SEANCES; s++) {
  const graine = 5000 + s * 104729;
  const r = await page.evaluate(({ graine }) => {
    let x = graine; const hasard = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
    const eid = n => '250000012' + '9' + '3' + String(n).padStart(5, '0');
    try { localStorage.clear(); } catch (e) { /* ignoré */ }
    DB = migrateData({}); DB.campagneDebut = 2027; DB.campagneDateDemarrage = '2026-09-29'; DB.campagneInitialisee = true;
    DB.brebis = Array.from({ length: 80 }, (_, i) => ({ id: 'm' + i, eid: eid(100 + i), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }));
    DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
    saveData(DB); resetMisebasRapideSession(); render('misebas-rapide');
    const synchro = () => window.__appliquerSynchro(() => { const c = DB.brebis.map(b => JSON.parse(JSON.stringify(b))); if (hasard() < 0.5) DB.brebis = c; else window.__recevoirFiches('brebis', c); });
    const faites = []; let synchros = 0;
    for (let k = 0; k < 60; k++) {
      const e = eid(100 + k);
      const champ = document.getElementById('scan-misebas');
      champ.value = e; champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      if (!document.getElementById('mb-formulaire')) return { erreur: 'formulaire absent pour ' + e };
      if (hasard() < 0.4) { synchro(); synchros++; }
      document.querySelector('.sexe-opt-rapide[data-id="0"][data-val="' + (hasard() < 0.5 ? 'Mâle' : 'Femelle') + '"]').click();
      if (hasard() < 0.4) { synchro(); synchros++; }
      document.getElementById('btn-valider-misebas').click();
      const q = document.getElementById('qc-oui'); if (q) q.click();
      if (document.getElementById('saisie-non-enregistree')) return { erreur: 'échec d\'écriture inattendu pour ' + e };
      faites.push(e);
      if (hasard() < 0.3) { synchro(); synchros++; }
    }
    const stocke = JSON.parse(localStorage.getItem(DB_KEY) || '{}');
    const pertes = [];
    faites.forEach(e => [['base', DB.brebis], ['stockage', stocke.brebis || []]].forEach(([ou, l]) => { const f = l.find(b => b.eid === e); if (!f || (f.agnelages || []).filter(a => a.campagne === 2027).length !== 1) pertes.push(ou + ':' + e.slice(-5)); }));
    return { pertes, faites: faites.length, compteur: nbMisesBasSeance(), synchros, fin: controleFinSeanceMisebas() };
  }, { graine });
  check(!r.erreur, 'mises bas, séance ' + (s + 1) + ' : ' + r.erreur);
  check(!r.pertes.length, 'mises bas, séance ' + (s + 1) + ' (graine ' + graine + ') : ' + r.pertes.length + ' perte(s) : ' + r.pertes.slice(0, 8).join(', '));
  check(r.compteur === r.faites && !r.fin.manquantes.length && !r.fin.sansResultat.length && r.synchros > 20, 'mises bas, séance ' + (s + 1) + ' : compteur ' + r.compteur + ' / ' + r.faites + ', fin de séance ' + JSON.stringify([r.fin.manquantes.length, r.fin.sansResultat.length]));
  if (s === 0) console.log('mises bas, séance 1 : ' + r.faites + ' mises bas, ' + r.synchros + ' synchros');
}

// échec d'écriture (stockage refusé) : message bloquant « Écho NON enregistrée », rien de confirmé ; « Réessayer » enregistre et vérifie
await page.evaluate(() => {
  DB = migrateData({}); DB.campagneDebut = 2027; DB.campagneInitialisee = true;
  DB.brebis = ['250000012930101', '250000012930102', '250000012930103'].map((e, i) => ({ id: 'g' + i, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] }));
  DB.beliers = []; DB.agnelles = []; saveData(DB);
  resetEchoRapideSession(); render('echo-rapide'); document.getElementById('btn-start-echo-session').click();
  window.__vraiSave = saveData; let refus = 1;
  saveData = function (d) { if (refus-- > 0) return false; return window.__vraiSave(d); }; saveData.ecritStockage = true;
});
const scan = async v => { await page.fill('#scan-echo', v); await page.press('#scan-echo', 'Enter'); await page.waitForSelector('#carte-echo-brebis'); };
await scan('250000012930101'); await page.click('.stade-opt[data-val="Vide"]'); await page.click('#btn-valider-echo');
check(await page.isVisible('#saisie-non-enregistree') && /Écho NON enregistrée/.test(await page.textContent('#saisie-non-enregistree')) && !(await page.$('#echo-confirme')), 'stockage refusé : message bloquant, aucune confirmation');
await page.click('#sne-reessayer');
await page.waitForSelector('#echo-confirme');
check(await page.evaluate(() => DB.brebis[0].echographies.length === 1 && JSON.parse(localStorage.getItem(DB_KEY)).brebis[0].echographies.length === 1 && echoRapideSession.journal.some(j => j.action === 'echec')), '« Réessayer » : écho enregistrée et vérifiée, échec noté au journal');
await page.evaluate(() => { saveData = window.__vraiSave; });
// fin de séance : une écho retirée de la base derrière l'écran + une brebis bipée puis passée = liste en rouge ; « Réenregistrer » remet l'écho du journal
await scan('250000012930102'); await page.click('.stade-opt[data-val="Vide"]'); await page.click('#btn-valider-echo'); await page.waitForSelector('#echo-confirme');
await scan('250000012930103'); await page.click('#btn-passer-echo');
await page.evaluate(() => { DB.brebis[1].echographies = []; saveData(DB); });
await page.click('#btn-fin-session-echo');
await page.waitForSelector('#fin-seance-echo');
const fin = await page.evaluate(() => [document.getElementById('fse-manquantes').textContent, document.getElementById('fse-sans-resultat').textContent, getComputedStyle(document.getElementById('fse-manquantes')).color]);
check(/1 écho enregistrée absente de la base/.test(fin[0]) && /30102/.test(fin[0]) && /30103/.test(fin[1]) && /30102/.test(fin[1]) && fin[2] === 'rgb(163, 58, 49)', 'fin de séance : écho perdue et brebis bipée sans écho listées en rouge : ' + JSON.stringify(fin));
await page.click('#fse-reecrire');
await page.waitForSelector('#fin-seance-echo');
check(await page.evaluate(() => DB.brebis[1].echographies.length === 1 && DB.brebis[1].echographies[0].stade === 'Vide' && !document.getElementById('fse-manquantes') && /30103/.test(document.getElementById('fse-sans-resultat').textContent)), '« Réenregistrer » : écho remise depuis le journal ; reste la brebis passée');
await page.click('#fse-terminer');
check(await page.evaluate(() => lireJournauxSeances()[0].journal.some(j => j.action === 'fin') && !echoRapideSession.demarree), 'séance terminée, journal gardé sur l\'appareil');

check(!erreurs.length, 'aucune erreur JS : ' + erreurs.join(' | '));
await browser.close();
console.log('test_saisies_sans_perte : OK');
