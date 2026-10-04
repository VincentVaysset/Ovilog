/* BALAYAGE « on peut saisir » des écrans PC ET MOBILE refaits d'après une maquette, fenêtres de saisie (modales) comprises : pour CHAQUE champ de saisie (texte, nombre, recherche, zone de texte), avec de
   VRAIES frappes clavier (pas de remplissage programmatique) à une taille d'écran d'ordinateur portable (PC 1366 × 768, mobile 420 × 900) :
   - le champ est actif (ni désactivé ni en lecture seule) et n'est pas masqué par un autre élément (test du point central) ;
   - un clic puis une frappe y inscrivent bien le caractère, et le champ GARDE le focus (aucun redessin n'avale la saisie) ;
   - un redessin de l'écran en cours de frappe (écho de synchro) ne fait perdre NI la valeur NI le focus (voir restaurerSaisieApresRedessin).
   Les champs de date, listes et cases à cocher sont vérifiés pour l'activité et la visibilité seulement.
   saveData REMPLACÉ ; jeu synthétique, plus l'export réel en LECTURE SEULE s'il est présent. */
import { chromium } from 'playwright';
import { LAUNCH, URL_APP, EXPORT_CORRIGE, exportPresent, lireExport } from './lib/config.mjs';
const browser = await chromium.launch(LAUNCH);
const erreursPage = [];
async function nouvellePage(mobile) {
  const pg = await (await browser.newContext({ viewport: mobile ? { width: 420, height: 900 } : { width: 1366, height: 768 } })).newPage();
  await pg.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
  if (!mobile) await pg.addInitScript(() => { window.electronAPI = { isDesktop: true, version: '1.0.test' }; });
  pg.on('pageerror', e => erreursPage.push(e.message));
  pg.on('dialog', d => d.accept());
  await pg.goto(URL_APP, { waitUntil: 'load' });
  await pg.waitForTimeout(300);
  return pg;
}


const reel = exportPresent(EXPORT_CORRIGE) ? JSON.stringify(lireExport(EXPORT_CORRIGE)) : null;
const ZONES = '#app input, #app textarea, #app select, .modal-overlay input, .modal-overlay textarea, .modal-overlay select';
const EXCLUS = "['checkbox', 'radio', 'hidden', 'file', 'button', 'submit'].includes(el.type)";

function balayage(pg) {
  const jeu = () => pg.evaluate(j => {
    if (j) DB = migrateData(JSON.parse(j)); else {
      DB = migrateData({});
      const f = (d, n, extra) => Object.assign({ id: 'b' + d + n, eid: '2500162991' + d + String(n).padStart(4, '0'), statut: 'active', createdAt: 1, echographies: [], agnelages: [], sanitaire: [], mouvements: [{ type: 'Entrée', date: '2024-01-01' }], controleLaitier: [], modesRepro: [], videesDefinitives: [] }, extra || {});
      DB.brebis = [f(8, 133, { agnelages: [{ campagne: 2025, date: '2026-01-14', codeRepro: 'IA', lambs: [{ eid: '2500162996' + '0001', sexe: 'Femelle', sanitaire: [], mouvements: [] }] }] }), f(9, 59), f(9, 69)]; DB.beliers = []; DB.agnelles = [{ id: 'ag9', eid: '250016299550042', origine: 'achetée', dateEntree: '2026-09-10', mouvements: [{ type: 'Entrée', date: '2026-09-10' }], sanitaire: [] }];
    }
    DB.campagneDebut = 2026; DB.campagneDateDemarrage = '2026-10-01'; DB.campagneInitialisee = true; DB.acheteurs = DB.acheteurs && DB.acheteurs.length ? DB.acheteurs : ['Acheteur A'];
    document.querySelectorAll('.modal-overlay').forEach(o => o.remove());
    window.__saves = 0; saveData = function () { window.__saves++; };
  }, reel);
  const liste = `(() => { const modale = document.querySelector('.modal-overlay'); return [...document.querySelectorAll(modale ? '.modal-overlay input, .modal-overlay textarea, .modal-overlay select' : '${ZONES}')].filter(el => !el.closest('.hidden') && el.getBoundingClientRect().width > 0 && !${EXCLUS}); })()`;
  const ouvrir = (etat) => pg.evaluate(async ([e, l]) => { const fn = new Function('return (async () => {' + e + '})()'); await fn(); await new Promise(r => setTimeout(r, 80)); return eval(l).length; }, [etat, liste]);

  async function simples(libelle, etat) {
    await jeu(); let n;
    try { n = await ouvrir(etat); } catch (e) { return { libelle, n: 0, ko: [], ignore: 'état non ouvrable : ' + String(e.message).slice(0, 70) }; }
    const ko = []; let teste = 0;
    for (let i = 0; i < n; i++) {
      await jeu(); try { await ouvrir(etat); } catch (e) { break; }
      const info = await pg.evaluate(([i, l]) => {
        const el = eval(l)[i]; if (!el) return null;
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect(), top = document.elementFromPoint(r.left + Math.min(r.width / 2, 40), r.top + r.height / 2);
        el.setAttribute('data-sweep', '1');
        return { avant: el.value.length, intentionnel: !!el.closest('#lt-edition') || el.id === 'f-campagne-annee' || /^mv-(acheteur|nouvel-acheteur|cause|nouvelle-cause)$/.test(el.id), id: el.id || '', nom: el.getAttribute('placeholder') || el.name || el.id || el.tagName, tag: el.tagName, type: el.type, disabled: el.disabled, readOnly: el.readOnly, libre: top === el || (top && el.contains(top)), masquePar: top ? (top.id || top.tagName + '.' + String(top.className).slice(0, 30)) : 'rien', w: Math.round(r.width), h: Math.round(r.height) };
      }, [i, liste]);
      if (!info) continue; teste++;
      const nom = (info.id || info.nom) + ' [' + info.type + ']';
      if (info.disabled) { if (!info.intentionnel) ko.push(nom + ' : désactivé'); continue; }
      if (info.readOnly) { ko.push(nom + ' : en lecture seule'); continue; }
      if (!info.libre) { ko.push(nom + ' : masqué par ' + info.masquePar); continue; }
      if (info.w < 24 || info.h < 14) { ko.push(nom + ' : trop petit (' + info.w + 'x' + info.h + ')'); continue; }
      if (info.tag === 'SELECT' || ['date', 'month', 'time', 'datetime-local', 'range', 'color'].includes(info.type)) continue;
      const car = info.type === 'number' ? '7' : 'x';
      try {
        await pg.click('[data-sweep="1"]', { timeout: 3000 });
        await pg.keyboard.type(car, { delay: 30 });
        await pg.waitForTimeout(250);
        const apres = await pg.evaluate(id => { const el = (id ? document.getElementById(id) : null) || document.querySelector('[data-sweep="1"]'); const a = document.activeElement; return { v: el ? el.value : null, foc: !!(el && a === el) }; }, info.id);
        const inscrite = v => v !== null && v.includes(car) && v.length >= info.avant + 1;
        if (apres.v === null) { ko.push(nom + ' : le champ a disparu pendant la frappe'); continue; }
        if (!inscrite(apres.v)) { ko.push(nom + ' : la frappe n\'est pas inscrite (valeur « ' + apres.v + ' »)'); continue; }
        if (!apres.foc) { ko.push(nom + ' : le champ perd le focus après une frappe'); continue; }
        if (info.id) {
          await pg.evaluate(() => { if (typeof window.__redessinSynchro === 'function') window.__redessinSynchro(); else render(currentView); });
          await pg.waitForTimeout(250);
          const r2 = await pg.evaluate(id => { const el = document.getElementById(id), a = document.activeElement; return { v: el ? el.value : null, foc: !!(el && a === el) }; }, info.id);
          if (!inscrite(r2.v)) ko.push(nom + ' : la valeur saisie est perdue par un redessin de synchro (valeur « ' + r2.v + ' »)');
          else if (!r2.foc) ko.push(nom + ' : le focus est perdu par un redessin de synchro');
        }
      } catch (e) { ko.push(nom + ' : impossible de cliquer / saisir (' + String(e.message).split('\n')[0].slice(0, 70) + ')'); }
    }
    return { libelle, n: teste, ko };
  }

  // Enchaînement : taper dans un champ puis CLIQUER dans le suivant (saisie non validée dans le premier)
  async function chainage(libelle, etat) {
    await jeu(); try { await ouvrir(etat); } catch (e) { return { libelle, n: 0, ko: [] }; }
    const sel = `(() => ${liste}.filter(el => el.getBoundingClientRect().width > 24 && !el.disabled && !el.readOnly && ['text', 'number', 'search', 'tel', 'email', 'textarea', 'date', ''].includes(el.type)))()`;
    const nb = await pg.evaluate(`${sel}.length`);
    await pg.evaluate(`window.__sel2 = ${JSON.stringify(sel)}`);
    const ko = []; let teste = 0;
    for (let i = 0; i + 1 < nb; i++) {
      await jeu(); try { await ouvrir(etat); } catch (e) { break; }
      const ids = await pg.evaluate(`(() => { const l = ${sel}; const a = l[${i}], b = l[${i + 1}]; if (!a || !b) return null; a.scrollIntoView({ block: 'center' }); a.setAttribute('data-sweep', 'A'); b.setAttribute('data-sweep', 'B'); return [a.id || a.placeholder || a.type, b.id || b.placeholder || b.type, a.id, b.id, a.type, b.type]; })()`);
      if (!ids) continue; teste++;
      const carA = ids[4] === 'date' ? '01012027' : ids[4] === 'number' ? '1' : 'a', carB = ids[5] === 'date' ? '02022027' : ids[5] === 'number' ? '2' : 'b';
      try {
        // A : frappe (dates : saisie directe de la valeur, comme un choix au calendrier) ; B est retrouvé À CE MOMENT (le redessin éventuel a pu le remplacer, comme pour l'utilisateur qui clique sur ce qu'il voit)
        if (ids[4] === 'date') await pg.fill('[data-sweep="A"]', '2027-01-01'); else { await pg.click('[data-sweep="A"]', { timeout: 3000 }); await pg.keyboard.type(carA, { delay: 20 }); }
        await pg.evaluate(([i]) => { document.querySelectorAll('[data-sweep]').forEach(e => e.removeAttribute('data-sweep')); const l = eval(window.__sel2); const b = l[i + 1]; if (b) { b.scrollIntoView({ block: 'center' }); b.setAttribute('data-sweep', 'B'); } }, [i]).catch(() => {});
        if (ids[5] === 'date') await pg.fill('[data-sweep="B"]', '2027-02-02'); else { await pg.click('[data-sweep="B"]', { timeout: 3000 }); await pg.keyboard.type(carB, { delay: 20 }); }
        await pg.waitForTimeout(500);
        const r = await pg.evaluate(([ia, ib]) => { const a = ia ? document.getElementById(ia) : document.querySelector('[data-sweep="A"]'), b = ib ? document.getElementById(ib) : document.querySelector('[data-sweep="B"]'); return { a: a ? a.value : null, b: b ? b.value : null, focB: !!(b && document.activeElement === b) }; }, [ids[2], ids[3]]);
        const nom = ids[0] + ' → ' + ids[1];
        if (r.b === null || (ids[5] === 'date' ? !r.b : !r.b.includes(carB))) ko.push(nom + ' : après une saisie dans le 1er champ, le clic dans le 2e ne permet pas de saisir (valeur « ' + r.b + ' »)');
        else if (!r.focB) ko.push(nom + ' : le 2e champ perd le focus');
        else if (r.a !== null && (ids[4] === 'date' ? !r.a : !String(r.a).includes(carA))) ko.push(nom + ' : la saisie du 1er champ a été perdue (valeur « ' + r.a + ' »)');
      } catch (e) { ko.push(ids[0] + ' → ' + ids[1] + ' : clic / saisie impossible (' + String(e.message).split('\n')[0].slice(0, 70) + ')'); }
    }
    return { libelle, n: teste, ko };
  }
  return { jeu, simples, chainage };
}

const ETATS_PC = [
  ['Mouvements d\'animaux', "mvPcEtat = null; render('inventaire');"],
  ['Mouvements d\'animaux · Vente', "mvPcEtat = null; render('inventaire'); document.querySelector('.mv-type[data-val=\"Vente\"]').click();"],
  ['Mouvements d\'animaux · Morte', "mvPcEtat = null; render('inventaire'); document.querySelector('.mv-type[data-val=\"Morte\"]').click();"],
  ['Carnet sanitaire', "render('sanitaire');"],
  ['Produits et délais', "render('produits-delais');"],
  ['Produits et délais · fiche produit (fenêtre)', "ouvrirFicheProduitModal({ categorieKey: 'antibiotiques' });"],
  ['Carnet · nouveau produit (fenêtre)', "ouvrirModalNouveauProduitSanitaire({});"],
  ['Traitements sur 12 mois', "render('traitements-12-mois');"],
  ['Soins sans indicateur bio', "render('soins-sans-bio');"],
  ['Sous délai d\'attente', "render('sous-delai');"],
  ['Ordonnances', "render('ordonnances');"],
  ['Nouvelle ordonnance', "editContext = null; render('add-ordonnance');"],
  ['Chantier de tri · Lots (étape 1)', "lotsPcEtat = null; render('lots');"],
  ['Chantier de tri · Lots (recherche)', "lotsPcEtat = null; render('lots'); document.querySelector('#lt-type .opt-btn[data-val=\"recherche\"]').click();"],
  ['Chantier de tri · étape 2 Échographies', "lotsPcEtat = null; render('lots'); document.querySelector('#lt-type .opt-btn[data-val=\"recherche\"]').click(); document.getElementById('lt-creer').click(); lotsPcEtat.onglet = 'echos'; renderLotsPc();"],
  ['Chantier de tri · étape 2 Mises bas', "lotsPcEtat = null; render('lots'); document.getElementById('lt-creer').click(); lotsPcEtat.onglet = 'misesbas'; renderLotsPc(); lotsPcEtat.F.mbMode = 'entre'; renderLotsPc();"],
  ['Chantier de tri · étape 2 Contrôles', "lotsPcEtat = null; render('lots'); document.getElementById('lt-creer').click(); lotsPcEtat.onglet = 'controles'; renderLotsPc();"],
  ['Chantier de tri · étape 2 Lactations', "lotsPcEtat = null; render('lots'); document.getElementById('lt-creer').click(); lotsPcEtat.onglet = 'lactations'; renderLotsPc();"],
  ['Chantier de tri · étape 2 Réussite IA', "lotsPcEtat = null; render('lots'); document.getElementById('lt-creer').click(); lotsPcEtat.onglet = 'ia'; renderLotsPc();"],
  ['Chantier de tri · étape 2 Agnelles', "lotsPcEtat = null; render('lots'); document.querySelector('#lt-cible .opt-btn[data-val=\"Agnelles\"]').click(); document.getElementById('lt-creer').click();"],
  ['Chantier de tri · Tri des agnelles', "triPcEtat = null; render('agnelles');"],
  ['Tri des agnelles · vente d\'une agnelle (fenêtre)', "showVendreAgnelleModal(DB.agnelles[0], () => {});"],
  ['Contrôle laitier', "render('controle-laitier');"],
  ['Registre d\'élevage', "render('registre');"],
  ['Bilan de campagne', "render('bilan-campagne');"],
  ['Saisie du résumé de campagne', "render('saisie-resume-campagne');"],
  ['Paramètres · Exploitation', "parametresTab = 'exploitation'; render('parametres');"],
  ['Paramètres · Listes', "parametresTab = 'listes'; render('parametres');"],
  ['Paramètres · Campagne', "parametresTab = 'campagne'; render('parametres');"],
  ['Paramètres · Sauvegarde', "parametresTab = 'sauvegarde'; render('parametres');"],
  ['Brebis (liste)', "render('list');"],
  ['Qualité du lait', "render('qualite');"]
];
const ETATS_MOBILE = [
  ['Mobile · Lots (liste)', "render('lots');"],
  ['Mobile · Nouveau lot', "render('add-lot');"],
  ['Mobile · Nouveau lot de réforme', "render('add-lot-reforme');"],
  ['Mobile · Modifier un lot de recherche', "DB.lots = [{ id: 'L1', nom: 'Brebis doubles', dateCreation: '2026-10-01', membres: [DB.brebis[1].eid] }]; currentLotId = 'L1'; render('edit-lot');"],
  ['Mobile · Chercher en bergerie', "DB.lots = [{ id: 'L1', nom: 'Brebis doubles', dateCreation: '2026-10-01', membres: [DB.brebis[1].eid] }]; currentLotId = 'L1'; render('lot-search');"],
  ['Mobile · Lot de reproduction (détail)', "creerLotReproductionJournalise({ id: 'LR', nom: 'IA du 15-06-2027', mode: 'IA', cible: 'Brebis', dateCreation: '2026-10-02', dateEvenement: '2027-06-15', campagne: 2026, campagneMisesBas: 2027 }, [DB.brebis[1].eid]); currentLotId = 'LR'; render('lot-repro-detail');"],
  ['Mobile · Lot de reproduction (retrait, fenêtre)', "creerLotReproductionJournalise({ id: 'LR', nom: 'IA du 15-06-2027', mode: 'IA', cible: 'Brebis', dateCreation: '2026-10-02', dateEvenement: '2027-06-15', campagne: 2026, campagneMisesBas: 2027 }, [DB.brebis[1].eid]); currentLotId = 'LR'; render('lot-repro-detail'); document.querySelector('.btn-retirer-lot').click();"],
  ['Mobile · Tri des agnelles', "triMobileScan = null; render('agnelles');"],
  ['Mobile · Tri des agnelles (carte scannée)', "triMobileScan = { eid: findLambByEid(DB.brebis[0].agnelages[0].lambs[0].eid).eid, bloc: 'aTrier' }; render('agnelles');"],
  ['Mobile · Créer une liste', "render('liste-serie');"],
  ['Mobile · Ajouter une agnelle', "editingAgnelleId = null; addAgnelleOrigin = 'agnelles'; render('add-agnelle');"],
  ['Mobile · Carnet sanitaire', "render('sanitaire');"],
  ['Mobile · Traitements sur 12 mois', "render('traitements-12-mois');"],
  ['Mobile · Mouvement collectif', "render('mouvement-groupe');"],
  ['Mobile · Inventaire', "render('inventaire');"],
  ['Mobile · Contrôle laitier', "render('controle-laitier');"],
  ['Mobile · Brebis (liste)', "render('list');"]
];

let total = 0; const tousKo = [];
for (const [nom, mobile, etats] of [['PC', false, ETATS_PC], ['mobile', true, ETATS_MOBILE]]) {
  const pg = await nouvellePage(mobile), b = balayage(pg);
  for (const [libelle, etat] of etats) {
    const r = await b.simples(libelle, etat), c = await b.chainage(libelle, etat);
    r.ko.push(...c.ko); total += r.n;
    console.log((r.ko.length ? 'KO ' : 'OK ') + libelle + ' : ' + r.n + ' champ(s) + ' + c.n + ' enchaînement(s) testé(s)' + (r.ignore ? ' (' + r.ignore + ')' : '') + (r.ko.length ? '\n   - ' + r.ko.join('\n   - ') : ''));
    r.ko.forEach(k => tousKo.push(nom + ' · ' + libelle + ' → ' + k));
  }
}
await browser.close();
if (erreursPage.length) console.log('Erreurs de page :', [...new Set(erreursPage)].slice(0, 5));
if (tousKo.length || erreursPage.length) { console.log('\nFAIL : ' + tousKo.length + ' champ(s) non saisissable(s) ou perdant leur saisie, ' + erreursPage.length + ' erreur(s) de page'); process.exit(1); }
console.log('\nTOUS LES CHAMPS DE SAISIE (PC ET MOBILE, FENÊTRES COMPRISES) TESTÉS (' + total + ') SE SAISISSENT AU CLAVIER');
