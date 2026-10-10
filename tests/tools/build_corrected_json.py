"""Réparation ponctuelle post-bascule du 29/09/2026 (voir tests/README.md) :
retire les 29 fiches brebis en doublon d'EID (vides), les 29 clés parasites de
registre.brebis et pose campagneDebut=2026. Ne sert qu'à régénérer le jeu de
test `troupeau_corrige.json` à partir de l'export ORIGINAL (jamais versionné).
Usage : python3 tests/tools/build_corrected_json.py export_original.json sortie.json"""
import json
import sys
from collections import defaultdict

SRC = sys.argv[1] if len(sys.argv) > 1 else 'tests/data/troupeau-sauvegarde-2026-09-29.json'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'tests/data/troupeau_corrige.json'

with open(SRC) as f:
    data = json.load(f)

brebis = data['brebis']
by_eid = defaultdict(list)
for s in brebis:
    by_eid[s['eid']].append(s)
dups = {eid: recs for eid, recs in by_eid.items() if len(recs) > 1}

remove_ids = set()
for eid, recs in dups.items():
    for s in recs:
        fields_empty = (
            len(s.get('mouvements') or []) == 0 and
            len(s.get('agnelages') or []) == 0 and
            len(s.get('echographies') or []) == 0 and
            len(s.get('sanitaire') or []) == 0 and
            len(s.get('controleLaitier') or []) == 0
        )
        if fields_empty:
            remove_ids.add(s['id'])

assert len(remove_ids) == 29, f"expected 29, got {len(remove_ids)}"

remove_eids = set(s['eid'] for s in brebis if s['id'] in remove_ids)
assert len(remove_eids) == 29

# 1) Remove the 29 empty duplicate brebis records -- nothing else in DB.brebis touched.
data['brebis'] = [s for s in brebis if s['id'] not in remove_ids]

# 2) Remove the 29 parasite keys from registre.brebis -- registre.agnelles untouched.
reg_brebis = data['registre']['brebis']
before_reg_count = len(reg_brebis)
for eid in remove_eids:
    assert eid in reg_brebis, f"expected {eid} in registre.brebis"
    del reg_brebis[eid]
assert len(reg_brebis) == before_reg_count - 29

# 3) Fix campagneDebut. Nothing else touched (campagneDateDemarrage, campagneInitialisee,
#    videesDefinitives, etc. all left exactly as they were).
assert data['campagneDebut'] == 2025
data['campagneDebut'] = 2026

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Written:", OUT)
print("removed brebis ids:", len(remove_ids))
print("removed registre.brebis keys:", 29)
print("new campagneDebut:", data['campagneDebut'])
