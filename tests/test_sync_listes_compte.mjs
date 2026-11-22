/* Listes du COMPTE rangées par versions (lot 4, livraison 3) : deux appareils hors réseau puis reconnectés, faux backend Firestore local, comptes
   jetables, aucune donnée réelle.
   1. Deux relevés du tank LE MÊME JOUR : un seul relevé (par date), la saisie arrivée la dernière au serveur s'affiche, l'autre gardée, conflit.
   2. Cause de mortalité ajoutée sur un appareil, une autre renommée sur l'autre : les deux changements gardés, aucun conflit.
   3. Calendrier : un évènement ajouté de chaque côté : les deux gardés. Produits : un vaccin ajouté de chaque côté : les deux gardés.
   4. Le document principal du compte (meta) ne reçoit plus ces listes : elles vivent dans users/{uid}/listesCompte. */
import { demarrerHarnais } from './lib/harnais_sync.mjs';

const h = await demarrerHarnais();
const { check } = h;
const eq = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), msg + ' : ' + JSON.stringify(a) + ' attendu ' + JSON.stringify(b));
const MDP = 'AuditTest12345!';
const mail = 'sync-listes-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '@ovilog-audit-jetable.test';
const listes = async uid => { const r = await h.serveur(uid, 'listesCompte'); const page = h.appareils.find(d => !d.page.isClosed()).page;
  return page.evaluate(docs => Object.fromEntries(Object.entries(docs).map(([k, v]) => [k, recordVersListeCompte(materialiserFicheV(v))])), r.docs || {}); };
const attendreListes = async (uid, pred, label) => { const d = Date.now(); let l; while (Date.now() - d < 25000) { l = await listes(uid); if (pred(l)) return l; await h.dormir(150); } throw new Error('TIMEOUT serveur : ' + label + ' — ' + JSON.stringify(l).slice(0, 400)); };

const pc = await h.ouvrir({ desktop: true });
await h.inscrire(pc, mail, MDP);
await h.attendre(pc, () => window.OvilogSync.getState().loggedIn, { label: 'PC connecté' });
const uid = pc.uid;
await h.attendreServeur(uid, 'meta', r => r.exists && r.data.schemaDonnees === 3, 'compte neuf rangé d\'office (format 3)');
await pc.page.evaluate(() => {
  DB.campagneDebut = 2027; DB.campagneInitialisee = true;
  DB.laitTank = [{ date: '2026-11-19', quantite: 300 }];
  DB.causesMortalite = ['Maladie', 'Accident'];
  DB.journal = [{ type: 'Tonte', date: '2026-11-05', note: '' }];
  DB.produits.vaccins = ['Vaccin A'];
  saveData(DB);
});
await attendreListes(uid, l => l.laitTank && l.laitTank.length === 1 && (l.causesMortalite || []).length === 2 && (l.journal || []).length === 1 && l.produits && l.produits.vaccins.length === 1, 'listes du compte sur le serveur');
await h.attendreCalme(uid);
const meta = (await h.serveur(uid, 'meta')).data;
check(!('laitTank' in meta) && !('causesMortalite' in meta) && !('journal' in meta), 'les listes du compte ne sont plus dans le document principal');
const tel = await h.ouvrir();
await h.connecter(tel, mail, MDP);
await h.attendre(tel, () => (DB.laitTank || []).length === 1 && DB.causesMortalite.join() === 'Maladie,Accident' && DB.journal.length === 1 && DB.produits.vaccins[0] === 'Vaccin A', { timeout: 30000, label: 'le téléphone reçoit les listes du compte' });
await h.attendreCalme(uid);

// hors réseau des deux côtés
await h.reseau(pc, { coupe: true }); await h.reseau(tel, { coupe: true });
await pc.page.evaluate(() => {
  DB.laitTank.push({ date: '2026-11-21', quantite: 300 });                          // relevé du jour
  DB.causesMortalite.push('Prédateur');                                               // cause ajoutée
  DB.journal.push({ type: 'Parage', date: '2026-11-21', note: 'PC' });
  DB.produits.vaccins.push('Vaccin B');
  saveData(DB);
});
await tel.page.evaluate(() => {
  DB.laitTank.push({ date: '2026-11-21', quantite: 320 });                          // même jour, autre litrage
  DB.causesMortalite = DB.causesMortalite.map(c => c === 'Maladie' ? 'Maladie grave' : c);   // cause renommée
  DB.journal.push({ type: 'Vermifuge', date: '2026-11-22', note: 'Téléphone' });
  DB.produits.vaccins.push('Vaccin C');
  saveData(DB);
});
await h.dormir(400);
await h.reseau(pc, { coupe: false });
await attendreListes(uid, l => l.laitTank.length === 2 && l.causesMortalite.includes('Prédateur'), 'les saisies du PC arrivent');
await h.reseau(tel, { coupe: false });                                               // le téléphone arrive après : son relevé est le plus récent
const fin = await attendreListes(uid, l => l.causesMortalite.includes('Maladie grave') && l.journal.length === 3 && l.produits.vaccins.length === 3 && l.laitTank.find(x => x.date === '2026-11-21').quantite === 320, 'les saisies du téléphone arrivent');
await h.attendreCalme(uid);
eq(fin.laitTank.map(x => x.date + ':' + x.quantite), ['2026-11-19:300', '2026-11-21:320'], 'tank : UN relevé par jour, le plus récent à l\'heure serveur');
eq(fin.causesMortalite.slice().sort(), ['Accident', 'Maladie grave', 'Prédateur'], 'cause ajoutée ET cause renommée : les deux gardées');
eq(fin.journal.map(e => e.type).sort(), ['Parage', 'Tonte', 'Vermifuge'], 'calendrier : les deux évènements gardés');
eq(fin.produits.vaccins.slice().sort(), ['Vaccin A', 'Vaccin B', 'Vaccin C'], 'produits : les deux vaccins gardés');
for (const dev of [pc, tel]) {
  await h.attendre(dev, () => DB.laitTank.length === 2 && DB.laitTank.find(x => x.date === '2026-11-21').quantite === 320 && DB.causesMortalite.length === 3 && DB.journal.length === 3 && DB.produits.vaccins.length === 3, { label: 'appareil à jour des listes' });
  const conf = await dev.page.evaluate(() => window.OvilogSync.conflits().map(c => c.id + ':' + c.versions.map(v => v.d.quantite).sort().join('/')));
  eq(conf, ['laitTank:300/320'], 'un seul conflit : le relevé du tank du même jour (les deux litrages gardés)');
}
// l'éleveur garde le relevé du PC (300 L) : conflit levé des deux côtés
await pc.page.evaluate(() => render('conflits-synchro'));
check(/Relevé du tank/.test(await pc.page.textContent('.cf-carte')) && /Quantité \(L\)/.test(await pc.page.textContent('.cf-carte')), 'écran : « Relevé du tank », quantité en litres');
await pc.page.evaluate(() => [...document.querySelectorAll('.cf-version')].find(v => /300/.test(v.textContent)).querySelector('.cf-garder').click());
await attendreListes(uid, l => l.laitTank.find(x => x.date === '2026-11-21').quantite === 300, 'le choix part au serveur');
await h.attendre(tel, () => window.OvilogSync.conflits().length === 0 && DB.laitTank.find(x => x.date === '2026-11-21').quantite === 300, { label: 'le téléphone reçoit le choix' });
console.log('OK listes du compte : tank par date (conflit, choix), cause ajoutée / renommée, calendrier, produits ; meta ne les porte plus.');
await h.fin();
console.log('test_sync_listes_compte : OK');
