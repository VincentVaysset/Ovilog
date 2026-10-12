/* Harnais commun des tests de PREMIÈRE CONNEXION (faux backend Firestore local + faux SDK, comptes jetables, aucune donnée réelle) :
   démarre le faux backend, ouvre des appareils (PC ou mobile) avec un réseau pilotable, lit le serveur et son journal d'écritures. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, LIB_DIR } from './config.mjs';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';

export async function demarrerHarnais() {
  const backendProc = spawn('node', [LIB_DIR + '/fake_firebase_backend.mjs'], { stdio: ['ignore', 'pipe', 'pipe'] });
  backendProc.stderr.on('data', d => process.stderr.write('[backend] ' + d));
  let nettoye = false;
  const h = { appareils: [] };
  h.cleanup = async () => { if (nettoye) return; nettoye = true; try { backendProc.kill(); } catch (e) {} };
  process.on('exit', () => { try { backendProc.kill(); } catch (e) {} });
  process.on('uncaughtException', e => { console.error('UNCAUGHT:', e); h.cleanup(); process.exit(1); });
  process.on('unhandledRejection', e => { console.error('UNHANDLED REJECTION:', e); h.cleanup(); process.exit(1); });
  const port = await new Promise((resolve, reject) => {
    let buf = '';
    backendProc.stdout.on('data', d => { buf += d.toString(); const m = buf.match(/FAKE_FIREBASE_PORT=(\d+)/); if (m) resolve(Number(m[1])); });
    backendProc.on('exit', code => reject(new Error('fake backend exited early, code ' + code)));
    setTimeout(() => reject(new Error('timeout')), 5000);
  });
  const bundle = readFileSync(LIB_DIR + '/fake_firebase_bundle.mjs', 'utf8').replace('__FAKE_FIREBASE_PORT__', String(port));
  const browser = await chromium.launch(LAUNCH);
  h.port = port;
  h.browser = browser;
  h.check = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };
  h.dormir = ms => new Promise(r => setTimeout(r, ms));

  // Ouvre un appareil. opts.desktop : PC (sinon mobile) ; opts.reseau : état initial du réseau simulé ({ coupe, delaiLectureMs }) ;
  // opts.avantChargement(page) : script d'init (ex. données locales posées AVANT le premier affichage).
  h.ouvrir = async (opts = {}) => {
    const ctx = await browser.newContext(opts.contexte || {});
    const page = await ctx.newPage();
    await page.addInitScript(({ d, r }) => { window.electronAPI = d ? { isDesktop: true, version: '1.0.test' } : undefined; window.__fakeReseau = r || {}; }, { d: !!opts.desktop, r: opts.reseau || {} });
    await page.route('**/vendor/firebase.bundle.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: bundle }));
    const dev = { ctx, page, uid: null, erreurs: [], dialogues: [] };
    page.on('pageerror', e => { dev.erreurs.push(e.message); });
    page.on('dialog', d => { dev.dialogues.push(d.message()); d.accept(); });
    page.on('response', async r => {
      if (r.url().endsWith('/auth/signup') || r.url().endsWith('/auth/login')) { try { if (r.ok()) dev.uid = (await r.json()).uid; } catch (e) {} }
    });
    await page.goto(URL_APP, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    h.appareils.push(dev);
    return dev;
  };
  h.reseau = (dev, etat) => dev.page.evaluate(e => { window.__fakeReseau = Object.assign(window.__fakeReseau || {}, e); }, etat);
  h.attendre = async (dev, fn, { timeout = 20000, interval = 100, label = 'condition', arg } = {}) => {
    const debut = Date.now();
    while (Date.now() - debut < timeout) {
      if (await dev.page.evaluate(fn, arg)) return true;
      await dev.page.waitForTimeout(interval);
    }
    throw new Error('TIMEOUT en attendant : ' + label);
  };
  h.attendreServeur = async (uid, col, pred, label, timeout = 20000) => {
    const debut = Date.now();
    while (Date.now() - debut < timeout) {
      if (pred(await h.serveur(uid, col))) return true;
      await h.dormir(100);
    }
    throw new Error('TIMEOUT côté serveur en attendant : ' + label);
  };
  h.serveur = async (uid, col) => (await fetch('http://127.0.0.1:' + port + '/snapshot?uid=' + uid + '&col=' + col)).json();
  h.journal = async uid => (await fetch('http://127.0.0.1:' + port + '/journal?uid=' + uid)).json();
  h.ecrireServeur = async (uid, ops) => { const r = await fetch('http://127.0.0.1:' + port + '/batch', { method: 'POST', body: JSON.stringify({ uid, ops, clientId: 'test-direct' }) }); if (!r.ok) throw new Error('écriture serveur directe refusée : ' + r.status); };
  h.clientId = dev => dev.page.evaluate(() => window.__fakeClientId);

  h.inscrire = async (dev, email, mdp) => { await dev.page.evaluate(async ({ e, p }) => { await window.OvilogSync.signup(e, p); }, { e: email, p: mdp }); };
  h.connecter = async (dev, email, mdp) => { await dev.page.evaluate(async ({ e, p }) => { await window.OvilogSync.login(e, p); }, { e: email, p: mdp }); };
  h.fin = async () => { for (const d of h.appareils) { try { await d.ctx.close(); } catch (e) {} } await browser.close(); await h.cleanup(); };
  return h;
}

// Pose, sur l'appareil donné, le jeu du compte existant puis attend que le serveur le détienne ENTIÈREMENT (meta + brebis + journal du lot).
export async function peuplerCompte(h, dev) {
  await dev.page.evaluate(() => {
    const eid = n => '25001629919' + String(n).padStart(5, '0');
    const fiche = (id, e, extra) => Object.assign({ id, eid: e, statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], notes: [], mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }], controleLaitier: [], modesRepro: [] }, extra || {});
    DB.campagneDebut = 2026; DB.campagneInitialisee = true;
    DB.exploitation = Object.assign(DB.exploitation || {}, { nom: 'GAEC du Compte' });
    DB.acheteurs = ['Natera']; DB.causesMortalite = ['Maladie'];
    DB.brebis = [fiche('b1', eid(1), { numeroCourtTravailSieol: '17' }), fiche('b2', eid(2), { numeroCourtTravailSieol: '23' }), fiche('b3', eid(3))];
    DB.beliers = []; DB.agnelles = [];
    creerLotReproductionJournalise({ id: 'LC', nom: 'IA du 15-06-2027', mode: 'IA', cible: 'Brebis', dateCreation: '2027-06-15', dateEvenement: '2027-06-15', campagneMisesBas: 2027 }, [1, 2, 3].map(eid));
    saveData(DB);
  });
  const uid = dev.uid;
  await h.attendreServeur(uid, 'meta', r => r.exists && r.data && (r.data.lots || []).some(l => l.id === 'LC') && (r.data.acheteurs || []).includes('Natera') && r.data.registreCollectionMigree20260930 === true, 'meta (lot LC, acheteurs, migration du registre terminée)');
  await h.attendreServeur(uid, 'brebis', r => Object.keys(r.docs).length === 3, '3 brebis sur le serveur');
  await h.attendreServeur(uid, 'evenementsLots', r => Object.keys(r.docs).length >= 1, 'journal du lot sur le serveur');
}
