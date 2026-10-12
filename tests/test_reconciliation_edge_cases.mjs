/* 3 scénarios explicitement demandés avant de commiter le correctif du point
   3 (réconciliation au démarrage via sync.lastSynced persisté) :

   A. Premier lancement après mise à jour (sync.lastSynced absent en
      localStorage sur un appareil déjà appairé) : aucune poussée massive,
      la référence doit s'initialiser depuis l'état cloud reçu au premier
      instantané.
   B. Reproduction exacte de l'incident réel (bascule "Changement de
      campagne", 457/419 constaté) : un appareil resté hors-ligne AVANT une
      correction manuelle du cloud (ex: 462 fiches, dont des doublons déjà
      connus de sa référence persistée) se reconnecte APRÈS que le cloud a
      été corrigé (ex: 433 fiches) -- il ne doit RIEN repousser des fiches
      qu'il croit encore exister, et doit converger vers l'état cloud
      corrigé.
   C. Une modification locale faite hors-ligne (une échographie) est bien
      repoussée à la reconnexion, SANS écraser un changement distant fait
      entre-temps sur un AUTRE champ de la même fiche par un autre appareil.

   Même faux backend Firestore local que le reste de ce chantier -- aucune
   donnée réelle, aucun réseau externe. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, LIB_DIR, EXPORT_ORIGINAL, EXPORT_CORRIGE, lireExport, exportPresent } from './lib/config.mjs';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';

const scratchDir = LIB_DIR;
const backendProc = spawn('node', [scratchDir + '/fake_firebase_backend.mjs'], { stdio: ['ignore', 'pipe', 'pipe'] });
backendProc.stderr.on('data', d => process.stderr.write('[backend] ' + d));
let cleanedUp = false;
function cleanup() { if (cleanedUp) return; cleanedUp = true; try { backendProc.kill(); } catch (e) {} }
process.on('exit', cleanup);
process.on('uncaughtException', e => { console.error('UNCAUGHT:', e); cleanup(); process.exit(1); });
process.on('unhandledRejection', e => { console.error('UNHANDLED REJECTION:', e); cleanup(); process.exit(1); });

const fakePort = await new Promise((resolve, reject) => {
  let buf = '';
  backendProc.stdout.on('data', d => {
    buf += d.toString();
    const m = buf.match(/FAKE_FIREBASE_PORT=(\d+)/);
    if (m) resolve(Number(m[1]));
  });
  backendProc.on('exit', code => reject(new Error('fake backend exited early, code ' + code)));
  setTimeout(() => reject(new Error('timeout')), 5000);
});
const fakeBundleSrc = readFileSync(scratchDir + '/fake_firebase_bundle.mjs', 'utf8').replace('__FAKE_FIREBASE_PORT__', String(fakePort));

const browser = await chromium.launch(LAUNCH);

async function newDevicePage() {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route('**/vendor/firebase.bundle.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: fakeBundleSrc }));
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  return { ctx, page };
}
async function waitFor(page, fn, { timeout = 20000, interval = 200, label = 'condition' } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await page.evaluate(fn)) return true;
    await page.waitForTimeout(interval);
  }
  throw new Error('TIMEOUT en attendant : ' + label);
}
function brebisVide(id, eid, notes) {
  return { id, eid, statut: 'active', createdAt: 1, notes: notes || 'v1', echographies: [], agnelages: [], sanitaire: [], mouvements: [], controleLaitier: [], modesRepro: [] };
}
async function getUidViaFetchInterception(page) {
  return await page.evaluate(async () => {
    return await new Promise(resolve => {
      const origFetch = window.fetch;
      window.fetch = function (url, opts) {
        if (typeof url === 'string' && url.includes('/batch') && opts && opts.body) {
          try { resolve(JSON.parse(opts.body).uid); } catch (e) {}
        }
        return origFetch.apply(this, arguments);
      };
      DB.brebis[0].notes = 'touch-' + Date.now();
      saveData(DB);
      setTimeout(() => resolve(null), 800);
    });
  });
}

// ============================================================
// SCÉNARIO A -- premier lancement après mise à jour : sync.lastSynced
// n'a jamais été persisté pour ce compte sur cet appareil, alors qu'il est
// déjà appairé (BOOTSTRAP_FLAG_KEY déjà posé) et déjà synchronisé avec le
// cloud AVANT cette mise à jour. Ne doit déclencher AUCUNE poussée massive.
// ============================================================
{
  const emailA = 'scenario-a-' + Date.now() + '@ovilog-audit-jetable.test';
  const pw = 'AuditTest12345!';
  const d1 = await newDevicePage();
  await d1.page.evaluate(async ({ email, pw }) => { await window.OvilogSync.signup(email, pw); }, { email: emailA, pw });
  await waitFor(d1.page, () => window.OvilogSync.getState().loggedIn, { label: 'scénario A : device connecté' });

  await d1.page.evaluate((recs) => {
    DB.campagneDebut = 2026; DB.campagneInitialisee = true;
    DB.brebis = recs; DB.beliers = []; DB.agnelles = [];
    DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
    saveData(DB);
  }, [brebisVide('s1', '250016299960001'), brebisVide('s2', '250016299960002'), brebisVide('s3', '250016299960003')]);
  await d1.page.waitForTimeout(500); // laisse le push initial (bootstrapDevice, cloud vide) se confirmer

  const uid = await getUidViaFetchInterception(d1.page);
  if (!uid) throw new Error('FAIL (infra test) : impossible de déterminer l\'uid du compte de test (scénario A).');
  await d1.page.waitForTimeout(300);

  const versionAvant = await fetch('http://127.0.0.1:' + fakePort + '/snapshot?uid=' + uid + '&col=brebis').then(r => r.json());
  const refPersisteeAvant = await d1.page.evaluate(uid => localStorage.getItem('ovilog_sync_last_synced_' + uid), uid);
  if (!refPersisteeAvant) throw new Error('FAIL (infra test) : la référence aurait déjà dû être persistée après le premier push (scénario A, étape de préparation).');

  // Simule "1er lancement après mise à jour" : cette clé n'a JAMAIS existé
  // sur un appareil qui utilisait une version antérieure de l'appli (déjà
  // appairé, déjà synchronisé, mais sans cette persistance qui vient d'être
  // ajoutée par ce chantier).
  await d1.page.evaluate(uid => localStorage.removeItem('ovilog_sync_last_synced_' + uid), uid);

  // Instrumente le fetch AVANT la reconnexion pour compter les VRAIS appels
  // /batch (poussées) déclenchés par cette reconnexion -- doit rester à 0.
  await d1.page.evaluate(() => {
    window.__batchCallsPendantReconnexion = 0;
    const origFetch = window.fetch;
    window.fetch = function (url, opts) {
      if (typeof url === 'string' && url.includes('/batch')) window.__batchCallsPendantReconnexion++;
      return origFetch.apply(this, arguments);
    };
  });
  await d1.page.evaluate(async ({ email, pw }) => {
    window.OvilogSync.logout();
    await new Promise(r => setTimeout(r, 200));
    await window.OvilogSync.login(email, pw);
  }, { email: emailA, pw });
  await waitFor(d1.page, () => window.OvilogSync.getState().loggedIn, { label: 'scénario A : reconnecté' });
  await waitFor(d1.page, () => DB.brebis.length === 3, { label: 'scénario A : instantané initial reçu après reconnexion' });
  await d1.page.waitForTimeout(1500); // laisse le temps à une éventuelle (mauvaise) poussée de se produire

  const appelsBatch = await d1.page.evaluate(() => window.__batchCallsPendantReconnexion);
  if (appelsBatch !== 0) {
    throw new Error('FAIL SCÉNARIO A : aucune poussée ne doit se produire au 1er lancement après mise à jour (référence jamais persistée), obtenu ' + appelsBatch + ' appel(s) /batch.');
  }
  console.log('OK SCÉNARIO A : 1er lancement après mise à jour (référence jamais persistée) -- AUCUNE poussée massive déclenchée.');

  const versionApres = await fetch('http://127.0.0.1:' + fakePort + '/snapshot?uid=' + uid + '&col=brebis').then(r => r.json());
  if (versionApres.version !== versionAvant.version) {
    throw new Error('FAIL SCÉNARIO A : le cloud ne doit subir AUCUNE écriture lors de cette reconnexion, version avant=' + versionAvant.version + ', après=' + versionApres.version);
  }
  console.log('OK SCÉNARIO A : le cloud est resté rigoureusement inchangé (aucune écriture) lors de cette reconnexion.');

  const refPersisteeApres = await d1.page.evaluate(uid => {
    const raw = localStorage.getItem('ovilog_sync_last_synced_' + uid);
    return raw ? JSON.parse(raw) : null;
  }, uid);
  if (!refPersisteeApres || Object.keys(refPersisteeApres.brebis || {}).length !== 3) {
    throw new Error('FAIL SCÉNARIO A : la référence doit être réinitialisée depuis l\'état cloud reçu (3 brebis), jamais depuis un état vide, obtenu ' + JSON.stringify(refPersisteeApres));
  }
  console.log('OK SCÉNARIO A : la référence (sync.lastSynced persisté) est bien réinitialisée depuis le VRAI état cloud reçu au premier instantané -- "tout est déjà synchronisé", jamais depuis un état vide.');

  await d1.ctx.close();
}

// ============================================================
// SCÉNARIO B -- reproduction exacte de l'incident réel : un appareil resté
// hors-ligne AVANT une correction manuelle du cloud se reconnecte APRÈS
// cette correction. Son état local (et sa référence persistée, identique
// puisqu'il était synchronisé AVANT de passer hors-ligne) contiennent encore
// les fiches en doublon que la correction manuelle a supprimées côté cloud.
// Il ne doit RIEN repousser de ces fiches, et doit converger vers l'état
// cloud corrigé.
// ============================================================
{
  const emailB = 'scenario-b-' + Date.now() + '@ovilog-audit-jetable.test';
  const pw = 'AuditTest12345!';
  const d1 = await newDevicePage();
  await d1.page.evaluate(async ({ email, pw }) => { await window.OvilogSync.signup(email, pw); }, { email: emailB, pw });
  await waitFor(d1.page, () => window.OvilogSync.getState().loggedIn, { label: 'scénario B : device connecté' });

  // État "corrompu" (analogue au 457/462 réel) : 5 fiches saines + 3 fiches
  // en doublon (même EID pattern qu'un vrai incident de bascule), toutes
  // réellement synchronisées avant l'incident -- device ET cloud d'accord.
  const fichesAvecDoublons = [
    brebisVide('sain-1', '250016299970001'), brebisVide('sain-2', '250016299970002'),
    brebisVide('sain-3', '250016299970003'), brebisVide('sain-4', '250016299970004'),
    brebisVide('sain-5', '250016299970005'),
    brebisVide('doublon-1', '250016299970006'), brebisVide('doublon-2', '250016299970007'),
    brebisVide('doublon-3', '250016299970008')
  ];
  await d1.page.evaluate((recs) => {
    DB.campagneDebut = 2026; DB.campagneInitialisee = true;
    DB.brebis = recs; DB.beliers = []; DB.agnelles = [];
    DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
    saveData(DB);
  }, fichesAvecDoublons);
  await d1.page.waitForTimeout(500);
  const uid = await getUidViaFetchInterception(d1.page);
  if (!uid) throw new Error('FAIL (infra test) : impossible de déterminer l\'uid du compte de test (scénario B).');
  await d1.page.waitForTimeout(300);

  const cloudAvantCorrection = await fetch('http://127.0.0.1:' + fakePort + '/snapshot?uid=' + uid + '&col=brebis').then(r => r.json());
  if (Object.keys(cloudAvantCorrection.docs).length !== 8) throw new Error('FAIL (infra test) : le cloud doit contenir les 8 fiches (avec doublons) avant la correction manuelle.');

  // Le device passe hors-ligne (déconnexion -- ses écouteurs s'arrêtent,
  // exactement comme une appli fermée ou un téléphone sans réseau prolongé).
  await d1.page.evaluate(() => window.OvilogSync.logout());
  await d1.page.waitForTimeout(200);

  // Pendant ce temps, une correction manuelle (identique à celle réellement
  // appliquée dans ce chantier via la console Firebase) supprime les 3
  // doublons directement côté cloud -- SANS passer par ce device.
  for (const id of ['doublon-1', 'doublon-2', 'doublon-3']) {
    const r = await fetch('http://127.0.0.1:' + fakePort + '/batch', {
      method: 'POST',
      body: JSON.stringify({ uid, ops: [{ type: 'delete', path: 'users/' + uid + '/brebis/' + id }] })
    });
    if (!r.ok) throw new Error('FAIL (infra test) : suppression manuelle du doublon ' + id + ' a échoué.');
  }
  const cloudApresCorrection = await fetch('http://127.0.0.1:' + fakePort + '/snapshot?uid=' + uid + '&col=brebis').then(r => r.json());
  if (Object.keys(cloudApresCorrection.docs).length !== 5) throw new Error('FAIL (infra test) : le cloud doit contenir exactement 5 fiches après la correction manuelle.');
  console.log('OK (infra) : correction manuelle appliquée côté cloud (8 -> 5 fiches), device resté hors-ligne pendant ce temps (n\'en sait rien).');

  // Le device (toujours avec sa référence persistée -- 8 fiches, identiques
  // à ce qu'il avait avant de passer hors-ligne) se reconnecte.
  await d1.page.evaluate(() => {
    window.__batchCallsReconnexionB = 0;
    const origFetch = window.fetch;
    window.fetch = function (url, opts) {
      if (typeof url === 'string' && url.includes('/batch')) {
        window.__batchCallsReconnexionB++;
        try { window.__dernierBatchBody = JSON.parse(opts.body); } catch (e) {}
      }
      return origFetch.apply(this, arguments);
    };
  });
  await d1.page.evaluate(async ({ email, pw }) => { await window.OvilogSync.login(email, pw); }, { email: emailB, pw });
  await waitFor(d1.page, () => window.OvilogSync.getState().loggedIn, { label: 'scénario B : reconnecté' });
  await waitFor(d1.page, () => DB.brebis.length === 5, { timeout: 15000, label: 'scénario B : le device converge vers les 5 fiches du cloud corrigé' });
  await d1.page.waitForTimeout(1000); // laisse le temps à une éventuelle (mauvaise) re-poussée des doublons

  const appelsBatchB = await d1.page.evaluate(() => window.__batchCallsReconnexionB);
  if (appelsBatchB !== 0) {
    const corps = await d1.page.evaluate(() => window.__dernierBatchBody);
    throw new Error('FAIL SCÉNARIO B : le device ne doit RIEN repousser des fiches en doublon qu\'il croit encore exister, obtenu ' + appelsBatchB + ' appel(s) /batch -- dernier corps : ' + JSON.stringify(corps));
  }
  console.log('OK SCÉNARIO B : le device (référence persistée = ancien état AVEC doublons) ne repousse RIEN à la reconnexion -- aucun appel /batch.');

  const cloudFinal = await fetch('http://127.0.0.1:' + fakePort + '/snapshot?uid=' + uid + '&col=brebis').then(r => r.json());
  if (Object.keys(cloudFinal.docs).length !== 5 || 'doublon-1' in cloudFinal.docs) {
    throw new Error('FAIL SCÉNARIO B : le cloud doit rester à 5 fiches corrigées, sans qu\'aucun doublon ne réapparaisse, obtenu ' + JSON.stringify(Object.keys(cloudFinal.docs)));
  }
  console.log('OK SCÉNARIO B : le cloud reste à 5 fiches corrigées -- aucun doublon n\'est jamais réapparu (reproduction exacte de l\'incident réel, résolue).');
  const localFinal = await d1.page.evaluate(() => DB.brebis.map(s => s.id).sort());
  if (localFinal.some(id => id.startsWith('doublon'))) {
    throw new Error('FAIL SCÉNARIO B : la vue locale du device doit converger vers l\'état cloud corrigé (sans les doublons), obtenu ' + JSON.stringify(localFinal));
  }
  console.log('OK SCÉNARIO B : la vue locale du device a bien convergé vers l\'état cloud corrigé (5 fiches, sans doublon).');

  await d1.ctx.close();
}

// ============================================================
// SCÉNARIO C -- une modification locale faite hors-ligne (une échographie)
// est bien repoussée à la reconnexion, SANS écraser un changement distant
// fait entre-temps sur un AUTRE champ de la MÊME fiche par un autre appareil.
// ============================================================
{
  const emailC = 'scenario-c-' + Date.now() + '@ovilog-audit-jetable.test';
  const pw = 'AuditTest12345!';
  const d1 = await newDevicePage();
  await d1.page.evaluate(async ({ email, pw }) => { await window.OvilogSync.signup(email, pw); }, { email: emailC, pw });
  await waitFor(d1.page, () => window.OvilogSync.getState().loggedIn, { label: 'scénario C : device 1 connecté' });
  await d1.page.evaluate((rec) => {
    DB.campagneDebut = 2026; DB.campagneInitialisee = true;
    DB.brebis = [rec]; DB.beliers = []; DB.agnelles = [];
    DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
    saveData(DB);
  }, brebisVide('partagee', '250016299980001'));
  await d1.page.waitForTimeout(500);

  const d2 = await newDevicePage();
  await d2.page.evaluate(async ({ email, pw }) => { await window.OvilogSync.login(email, pw); }, { email: emailC, pw });
  await waitFor(d2.page, () => window.OvilogSync.getState().loggedIn, { label: 'scénario C : device 2 connecté' });
  await waitFor(d2.page, () => DB.brebis.length === 1, { label: 'scénario C : device 2 reçoit la fiche partagée' });

  // Device 1 passe "hors-ligne" (coupure réseau simulée -- l'appli reste
  // ouverte, exactement comme un vrai passage en zone blanche) : bloque à la
  // fois les poussées (/batch) et les instantanés entrants (/snapshot).
  await d1.page.route('**/batch', route => route.abort());
  await d1.page.route('**/snapshot*', route => route.abort());

  // Pendant la coupure de device 1 : ajoute une échographie en LOCAL sur
  // device 1 (via saveData, comme une vraie saisie -- échoue silencieusement
  // côté réseau, journalisée + relance planifiée, voir adjustments 1/2).
  await d1.page.evaluate(() => {
    const s = DB.brebis.find(x => x.id === 'partagee');
    s.echographies.push({ stade: 'Début', date: '2026-01-15', campagne: 2026 });
    saveData(DB);
  });
  await d1.page.waitForTimeout(500);
  const enAttentePendantCoupure = await d1.page.evaluate(() => !!window.__syncEnAttente);
  if (!enAttentePendantCoupure) throw new Error('FAIL (infra test) : la synchro doit être marquée "en attente" pendant la coupure réseau simulée de device 1.');
  console.log('OK (infra) : échographie saisie localement sur device 1 pendant une coupure réseau simulée -- synchro en attente, comme attendu.');

  // Pendant ce temps, device 2 (resté en ligne) modifie un AUTRE champ de la
  // MÊME fiche : ajoute un soin sanitaire.
  await d2.page.evaluate(() => {
    const s = DB.brebis.find(x => x.id === 'partagee');
    s.sanitaire.push({ type: 'Antiparasitaire', produit: 'Dectomax', date: '2026-01-20', numeroOrdonnance: null });
    saveData(DB);
  });
  await waitFor(d1.page, () => true, { timeout: 100, label: 'pause' }).catch(() => {}); // no-op, juste une petite pause lisible

  // Rétablit le réseau de device 1 -- la relance automatique (planifiée
  // pendant la coupure) doit repousser l'échographie en attente.
  await d1.page.unroute('**/batch');
  await d1.page.unroute('**/snapshot*');
  await waitFor(d1.page, () => window.__syncEnAttente === false, { timeout: 20000, label: 'scénario C : device 1 repousse son échographie en attente après le rétablissement du réseau' });
  console.log('OK SCÉNARIO C : l\'échographie faite hors-ligne sur device 1 est bien repoussée automatiquement dès le rétablissement du réseau (sans reconnexion complète -- juste la relance planifiée).');

  // Convergence complète attendue sur LES DEUX appareils : l'échographie de
  // device 1 ET le soin sanitaire de device 2, sur la MÊME fiche, sans que
  // l'un n'ait effacé l'autre.
  await waitFor(d1.page, () => {
    const s = DB.brebis.find(x => x.id === 'partagee');
    return s && s.echographies.length === 1 && s.sanitaire.length === 1;
  }, { timeout: 15000, label: 'scénario C : device 1 voit à la fois son échographie ET le soin sanitaire de device 2' });
  await waitFor(d2.page, () => {
    const s = DB.brebis.find(x => x.id === 'partagee');
    return s && s.echographies.length === 1 && s.sanitaire.length === 1;
  }, { timeout: 15000, label: 'scénario C : device 2 voit à la fois son soin sanitaire ET l\'échographie de device 1' });
  console.log('OK SCÉNARIO C : convergence complète sur les 2 appareils -- l\'échographie (device 1, faite hors-ligne) ET le soin sanitaire (device 2, fait pendant la coupure de device 1) coexistent, aucun des deux n\'a écrasé l\'autre.');

  await d1.ctx.close();
  await d2.ctx.close();
}

cleanup();
console.log('\nTOUS LES SCÉNARIOS DEMANDÉS SONT VÉRIFIÉS (compte de test jetable, faux backend local, aucune donnée réelle, aucune bascule réelle)');
await browser.close();
