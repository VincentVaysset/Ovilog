/* Lecture, côté test, du compte tel que l'appli le voit : document principal (meta) + listes du compte rangées par versions (lot 4, livraison 3 :
   collection listesCompte, un document par liste, reconstitué par la page avec recordVersListeCompte / materialiserFicheV). */
export async function metaEtListes(page, backendUrl, uid) {
  const meta = (await (await fetch(backendUrl + '/getdoc?uid=' + uid + '&col=meta&id=main')).json()).data;
  const docs = (await (await fetch(backendUrl + '/snapshot?uid=' + uid + '&col=listesCompte')).json()).docs || {};
  if (!meta) return meta;
  const listes = await page.evaluate(d => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, recordVersListeCompte(materialiserFicheV(v))]).filter(([, v]) => v !== undefined)), docs);
  return Object.assign({}, meta, listes);
}
