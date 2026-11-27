/* Saisies sans perte, suite (chantier du 27/11, point 1) : les écrans à formulaire — notes et contrôles de la fiche brebis, note d'un agneau,
   Carnet sanitaire (brebis et agneaux), tri des agnelles (Garder / Écarter), sur MOBILE ; Lots (Affecter), mouvement collectif et Carnet sur PC.
   20 séances par appareil, avec des réceptions de synchro glissées au hasard entre l'ouverture du formulaire et « Enregistrer » (copies neuves
   des fiches et des lots, par le chemin réel ou par un remplacement brut qui laisse l'écran avec des objets orphelins).
   Attendu à chaque séance : 0 perte (chaque saisie est dans la base ET dans le stockage de l'appareil, une seule fois), compteurs d'après les
   données. Puis : stockage qui refuse l'écriture = message bloquant « … NON enregistrée », « Réessayer » enregistre UNE fois.
   Jeu synthétique, aucune donnée réelle. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP } from './lib/config.mjs';
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }
const browser = await chromium.launch(LAUNCH);
const SEANCES = 20;

// Jeu commun : 40 brebis, chacune une mise bas de la campagne avec deux agneaux (une femelle bouclée à trier, un mâle sans n° une fois sur quatre)
const preparer = graine => {
  try { localStorage.clear(); } catch (e) { /* ignoré */ }
  const eid = n => '250000012' + '9' + '3' + String(n).padStart(5, '0');
  DB = migrateData({});
  DB.campagneDebut = 2027; DB.campagneDateDemarrage = '2026-09-29'; DB.campagneInitialisee = true;
  DB.exploitation = Object.assign(DB.exploitation || {}, { indicatifMarquage: '000456', typeSuivi: 'cls' });
  DB.produits = { vaccins: [], antibiotiques: ['Produit A'], antiparasitaires: [], antiinflammatoires: [], autres: [] };
  DB.produitsInfo = { 'Produit A': { delaiLait: 3, delaiViande: 10, surOrdonnance: false } };
  DB.brebis = Array.from({ length: 40 }, (_, i) => ({
    id: 'f' + i, eid: eid(100 + i), statut: 'active', createdAt: 1, echographies: [], sanitaire: [], notes: [], controleLaitier: [], modesRepro: [], videesDefinitives: [],
    mouvements: [{ type: 'Entrée', cause: 'Achat', date: '2024-01-01' }],
    agnelages: [{ date: '2026-11-0' + (1 + (i % 8)), campagne: 2027, codeRepro: 'MN', lambs: [
      { sexe: 'Femelle', eid: '2500000456' + String(70000 + i).padStart(5, '0'), adopte: false },
      Object.assign({ sexe: 'Mâle', adopte: false }, i % 4 ? { eid: '2500000456' + String(71000 + i).padStart(5, '0') } : {})
    ] }]
  }));
  DB.beliers = []; DB.agnelles = []; DB.lots = []; DB.evenementsLots = []; DB.registre = { brebis: {}, beliers: {}, agnelles: {} };
  saveData(DB);
  let x = graine;
  window.__hasard = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
  window.__synchros = 0;
  // réception de synchro : copies neuves des fiches et des lots ; la moitié par remplacement brut (objets de l'écran orphelins)
  window.__synchro = () => window.__appliquerSynchro(() => {
    window.__synchros++;
    const brut = window.__hasard() < 0.5;
    ['brebis', 'agnelles'].forEach(c => { const copies = (DB[c] || []).map(b => JSON.parse(JSON.stringify(b))); if (brut) DB[c] = copies; else window.__recevoirFiches(c, copies); });
    DB.lots = (DB.lots || []).map(l => JSON.parse(JSON.stringify(l)));
  });
  window.__peutEtre = p => { if (window.__hasard() < p) window.__synchro(); };
};
// Contrôle : chaque saisie attendue est dans la base ET le stockage, une seule fois
const controler = attendu => {
  const stocke = JSON.parse(localStorage.getItem(DB_KEY) || '{}');
  const pertes = [];
  const agneau = (b, e) => { for (const s of (b.brebis || [])) for (const ag of (s.agnelages || [])) for (const l of (ag.lambs || [])) if (l.eid === e || (l.ref && l.ref === e)) return l; return null; };
  const agneauSansN = (b, mere) => { const s = (b.brebis || []).find(f => f.eid === mere); return s && s.agnelages[0].lambs.find(l => !l.eid); };
  [['base', DB], ['stockage', stocke]].forEach(([ou, b]) => {
    attendu.notes.forEach(([e, t]) => { const f = b.brebis.find(s => s.eid === e); const n = f ? (f.notes || []).filter(x => x.texte === t).length : 0; if (n !== 1) pertes.push(ou + ' note ' + t + ' ×' + n); });
    Object.entries(attendu.controles).forEach(([k, q]) => { const [e, c] = k.split('|'); const f = b.brebis.find(s => s.eid === e); const l = f ? (f.controleLaitier || []).filter(x => x.controle === +c && x.campagne === 2027) : []; if (l.length !== 1 || l[0].quantite !== q) pertes.push(ou + ' contrôle ' + k + ' ' + JSON.stringify(l)); });
    attendu.notesAgneau.forEach(([e, t]) => { const l = agneau(b, e); const n = l ? (l.notes || []).filter(x => x.texte === t).length : 0; if (n !== 1) pertes.push(ou + ' note agneau ' + t + ' ×' + n); });
    attendu.soins.forEach(([cle, date]) => {
      const l = cle.startsWith('sansn:') ? agneauSansN(b, cle.slice(6)) : (b.brebis.find(s => s.eid === cle) || (b.agnelles || []).find(a => a.eid === cle) || agneau(b, cle));   // une agnelle gardée au tri a sa fiche d'agnelle
      const n = l ? (l.sanitaire || []).filter(x => x.date === date && x.produit === 'Produit A').length : 0;
      if (n !== 1) pertes.push(ou + ' soin ' + cle.slice(-5) + ' ' + date + ' ×' + n);
    });
    attendu.gardees.forEach(e => { const n = (b.agnelles || []).filter(a => a.eid === e).length; const l = agneau(b, e); if (n !== 1 || !l || l.triStatut !== 'gardée') pertes.push(ou + ' gardée ' + e.slice(-5) + ' ×' + n); });
    attendu.ecartees.forEach(e => { const l = agneau(b, e); if (!l || l.triStatut !== 'écartée') pertes.push(ou + ' écartée ' + e.slice(-5)); });
    attendu.lots.forEach(([lotId, e]) => { const l = (b.lots || []).find(x => x.id === lotId); if (!l || !(l.membres || []).some(m => cleanEid(m) === cleanEid(e))) pertes.push(ou + ' lot ' + e.slice(-5)); });
    attendu.morts.forEach(e => { const l = agneau(b, e); const n = l ? (l.mouvements || []).filter(m => m.type === 'Mort' && m.collectifId).length : 0; if (n !== 1) pertes.push(ou + ' mort ' + e.slice(-5) + ' ×' + n); });
  });
  return pertes;
};

// ======================================================================== MOBILE
{
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.clock.setFixedTime(new Date('2026-11-26T09:00:00'));
  const erreurs = []; page.on('pageerror', e => erreurs.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  let total = 0, totalSynchros = 0;
  for (let s = 0; s < SEANCES; s++) {
    const r = await page.evaluate(({ graine, prep, ctl }) => {
      eval('(' + prep + ')')(graine);
      const controlerF = eval('(' + ctl + ')');
      const h = window.__hasard;
      const att = { notes: [], controles: {}, notesAgneau: [], soins: [], gardees: [], ecartees: [], lots: [], morts: [] };
      const brebis = () => DB.brebis[Math.floor(h() * DB.brebis.length)];
      for (let k = 0; k < 40; k++) {
        const op = h();
        if (op < 0.25) {          // note brebis
          const f = brebis(), t = 'N' + k + '-' + Math.floor(h() * 1e6);
          render('add-note', f.id); window.__peutEtre(0.6);
          document.getElementById('f-texte').value = t; window.__peutEtre(0.4);
          document.getElementById('btn-save-note').click();
          att.notes.push([f.eid, t]);
        } else if (op < 0.45) {   // contrôle laitier (même n° = remplacé)
          const f = brebis(), c = 1 + Math.floor(h() * 3), q = 500 + Math.floor(h() * 2000);
          render('add-controle', f.id); window.__peutEtre(0.6);
          document.querySelector('.ctrl-opt[data-val="' + c + '"]').click();
          document.getElementById('f-quantite').value = String(q); window.__peutEtre(0.4);
          document.getElementById('btn-save-controle').click();
          att.controles[f.eid + '|' + c] = q;
        } else if (op < 0.6) {    // note d'un agneau bouclé
          const f = brebis(), l = f.agnelages[0].lambs[0], t = 'A' + k + '-' + Math.floor(h() * 1e6);
          currentAgneauEid = l.eid; render('add-note-agneau'); window.__peutEtre(0.6);
          document.getElementById('f-texte').value = t;
          document.getElementById('btn-save-note').click();
          att.notesAgneau.push([l.eid, t]);
        } else if (op < 0.8) {    // Carnet : un soin pour 1 à 3 animaux (brebis, agneau bouclé, agneau sans n°), une date par soin
          const date = '2026-11-' + String(10 + (k % 15)).padStart(2, '0');
          if (att.soins.some(x => x[1] === date)) continue;
          carnetSanitaireEtat = null; carnetOnglet = 'nouveau'; render('sanitaire');
          const sel = (id, v) => { const e = document.getElementById(id); if (v !== undefined) e.value = v; else e.selectedIndex = 1; e.dispatchEvent(new Event('change', { bubbles: true })); e.dispatchEvent(new Event('input', { bubbles: true })); };
          sel('cs-produit', 'Produit A'); sel('cs-dose', '2'); sel('cs-voie'); sel('cs-date', date);
          document.getElementById('cs-suivant').click();
          const cartes = [...document.querySelectorAll('#cs-cards .sheep-item')];
          const n = 1 + Math.floor(h() * 3), choisies = new Set();
          while (choisies.size < n) choisies.add(cartes[Math.floor(h() * cartes.length)].dataset.eid);
          choisies.forEach(e => document.querySelector('#cs-cards .sheep-item[data-eid="' + e + '"]').click());
          // agneau sans n° : clé de position « sansn:<fiche>:… » ou référence interne « AG-… » ; attendu = la mère
          const versAttendu = e => e.startsWith('sansn:') ? 'sansn:' + DB.brebis.find(b => b.id === e.split(':')[1]).eid
            : e.startsWith('AG-') ? 'sansn:' + DB.brebis.find(b => b.agnelages.some(a => a.lambs.some(l => l.ref === e))).eid : e;
          const attendus = [...choisies].map(versAttendu);
          window.__peutEtre(0.7);
          document.getElementById('cs-enregistrer').click();
          attendus.forEach(e => att.soins.push([e, date]));
        } else {                  // tri des agnelles : Garder ou Écarter
          triMobileScan = null; triMobileToast = null; render('agnelles');
          const g = [...document.querySelectorAll('.btn-garder')], e = [...document.querySelectorAll('.btn-ecarter')];
          if (!g.length) continue;
          const i = Math.floor(h() * g.length), garder = h() < 0.6, eidA = g[i].dataset.eid;
          window.__peutEtre(0.7);
          (garder ? g : e)[i].click();
          (garder ? att.gardees : att.ecartees).push(eidA);
        }
        if (document.getElementById('saisie-non-enregistree')) return { erreur: 'message « NON enregistrée » sans raison (op ' + k + ')' };
      }
      const pertes = controlerF(att);
      return { pertes, n: att.notes.length + Object.keys(att.controles).length + att.notesAgneau.length + att.soins.length + att.gardees.length + att.ecartees.length, synchros: window.__synchros };
    }, { graine: 3000 + s * 7919, prep: preparer.toString(), ctl: controler.toString() });
    check(!r.erreur, 'mobile séance ' + (s + 1) + ' : ' + r.erreur);
    check(!r.pertes.length, 'mobile séance ' + (s + 1) + ' : ' + r.pertes.length + ' perte(s) : ' + r.pertes.slice(0, 8).join(' ; '));
    total += r.n; totalSynchros += r.synchros;
  }
  check(!erreurs.length, 'mobile : erreurs JS : ' + erreurs.slice(0, 3).join(' | '));
  console.log('OK mobile : ' + SEANCES + ' séances, ' + total + ' saisies (notes, contrôles, notes d\'agneau, soins, tri) avec ' + totalSynchros + ' synchros glissées : 0 perte.');

  // Stockage qui refuse l'écriture : message bloquant, puis « Réessayer » enregistre UNE fois
  const r2 = await page.evaluate(({ prep }) => {
    eval('(' + prep + ')')(5);
    const f = DB.brebis[3];
    render('add-note', f.id);
    document.getElementById('f-texte').value = 'Note refusée';
    const vrai = Storage.prototype.setItem; let refus = true;
    Storage.prototype.setItem = function (k, v) { if (refus && k === DB_KEY) throw new Error('QuotaExceededError'); return vrai.call(this, k, v); };
    document.getElementById('btn-save-note').click();
    const alerte = !!document.getElementById('saisie-non-enregistree'), titre = (document.getElementById('sne-titre') || {}).textContent || '';
    const resteFormulaire = !!document.getElementById('btn-save-note');
    refus = false;
    document.getElementById('sne-reessayer').click();
    Storage.prototype.setItem = vrai;
    const st = JSON.parse(localStorage.getItem(DB_KEY));
    return { alerte, titre, resteFormulaire, n: st.brebis.find(b => b.id === f.id).notes.filter(x => x.texte === 'Note refusée').length, ecran: currentView };
  }, { prep: preparer.toString() });
  check(r2.alerte && /NON enregistrée/.test(r2.titre), 'stockage refusé : message bloquant « NON enregistrée » : ' + JSON.stringify(r2));
  check(r2.resteFormulaire, 'stockage refusé : on reste sur le formulaire (aucune confirmation)');
  check(r2.n === 1 && r2.ecran === 'detail', '« Réessayer » : la note est enregistrée UNE fois et la fiche s\'ouvre : ' + JSON.stringify(r2));
  console.log('OK mobile : stockage qui refuse l\'écriture = message bloquant, « Réessayer » enregistre une seule fois.');
}

// ======================================================================== PC
{
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  await ctx.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test', refocus: () => {} }; });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-11-26T09:00:00'));
  const erreurs = []; page.on('pageerror', e => erreurs.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(URL_APP, { waitUntil: 'load' }); await page.waitForTimeout(300);
  let total = 0, totalSynchros = 0;
  for (let s = 0; s < SEANCES; s++) {
    const r = await page.evaluate(({ graine, prep, ctl }) => {
      eval('(' + prep + ')')(graine);
      const controlerF = eval('(' + ctl + ')');
      const h = window.__hasard;
      const att = { notes: [], controles: {}, notesAgneau: [], soins: [], gardees: [], ecartees: [], lots: [], morts: [] };
      DB.lots = [{ id: 'lot-test', nom: 'Lot test', type: 'recherche', cible: 'Brebis', membres: [], dateCreation: '2026-11-20' }]; saveData(DB);
      for (let k = 0; k < 30; k++) {
        const op = h();
        if (op < 0.4) {           // Lots : cocher 1 à 3 brebis puis « Affecter »
          lotsPcEtat = null; currentLotId = 'lot-test'; render('edit-lot');
          const lignes = [...document.querySelectorAll('#lt-table tr.clic')].filter(tr => !(DB.lots[0].membres || []).some(m => cleanEid(m) === cleanEid(tr.dataset.eid)));
          if (!lignes.length) continue;
          const choisies = new Set(); const n = Math.min(lignes.length, 1 + Math.floor(h() * 3));
          while (choisies.size < n) choisies.add(lignes[Math.floor(h() * lignes.length)].dataset.eid);
          choisies.forEach(e => document.querySelector('#lt-table tr.clic[data-eid="' + e + '"]').click());
          window.__peutEtre(0.7);
          document.getElementById('lt-affecter').click();
          choisies.forEach(e => att.lots.push(['lot-test', e]));
        } else if (op < 0.7) {    // mouvement collectif : mort de 1 ou 2 agneaux bouclés
          mvPcEtat = null; render('inventaire');
          document.querySelector('.mv-cat[data-cat="agneaux"]').click();
          document.querySelector('.mv-type[data-val="Mort"]').click();
          const lignes = [...document.querySelectorAll('#mv-table tr.clic')];
          if (!lignes.length) continue;
          const choisies = new Set(); const n = Math.min(lignes.length, 1 + Math.floor(h() * 2));
          while (choisies.size < n) choisies.add(lignes[Math.floor(h() * lignes.length)].dataset.id);
          choisies.forEach(id => document.querySelector('#mv-table tr.clic[data-id="' + id + '"]').click());
          window.__peutEtre(0.7);
          document.getElementById('mv-valider').click();
          choisies.forEach(id => att.morts.push(id));
        } else {                  // Carnet PC : un soin pour 1 ou 2 brebis
          const date = '2026-11-' + String(10 + (k % 15)).padStart(2, '0');
          if (att.soins.some(x => x[1] === date)) continue;
          carnetSanitaireEtat = null; carnetOnglet = 'nouveau'; render('sanitaire');
          const sel = (id, v) => { const e = document.getElementById(id); if (v !== undefined) e.value = v; else e.selectedIndex = 1; e.dispatchEvent(new Event('change', { bubbles: true })); e.dispatchEvent(new Event('input', { bubbles: true })); };
          sel('cs-produit', 'Produit A'); sel('cs-dose', '2'); sel('cs-voie'); sel('cs-date', date);
          document.getElementById('cs-suivant').click();
          const lignes = [...document.querySelectorAll('#cs-table tr.clic')].filter(tr => DB.brebis.some(b => b.eid === tr.dataset.eid));
          const choisies = new Set(); const n = 1 + Math.floor(h() * 2);
          while (choisies.size < n) choisies.add(lignes[Math.floor(h() * lignes.length)].dataset.eid);
          choisies.forEach(e => document.querySelector('#cs-table tr.clic[data-eid="' + e + '"]').click());
          window.__peutEtre(0.7);
          document.getElementById('cs-enregistrer').click();
          choisies.forEach(e => att.soins.push([e, date]));
        }
        if (document.getElementById('saisie-non-enregistree')) return { erreur: 'message « NON enregistrée » sans raison (op ' + k + ')' };
      }
      const pertes = controlerF(att);
      return { pertes, n: att.lots.length + att.morts.length + att.soins.length, synchros: window.__synchros };
    }, { graine: 9000 + s * 6271, prep: preparer.toString(), ctl: controler.toString() });
    check(!r.erreur, 'PC séance ' + (s + 1) + ' : ' + r.erreur);
    check(!r.pertes.length, 'PC séance ' + (s + 1) + ' : ' + r.pertes.length + ' perte(s) : ' + r.pertes.slice(0, 8).join(' ; '));
    total += r.n; totalSynchros += r.synchros;
  }
  check(!erreurs.length, 'PC : erreurs JS : ' + erreurs.slice(0, 3).join(' | '));
  console.log('OK PC : ' + SEANCES + ' séances, ' + total + ' saisies (lots, mouvements collectifs, soins) avec ' + totalSynchros + ' synchros glissées : 0 perte.');
}
await browser.close();
console.log('TOUS LES TESTS « SAISIES SANS PERTE · FORMULAIRES » SONT PASSÉS (jeu synthétique, aucune donnée réelle)');
