#!/usr/bin/env python3
"""
Génère un fichier JSON compact des délais d'attente lait/viande ANMV pour les
ovins, à partir de la base de données publique des médicaments vétérinaires
autorisés en France (data.gouv.fr).

Deux modes :
  --mode explore  : n'écrit rien, affiche juste la structure des fichiers
                    source (utile pour ajuster le filtrage sans deviner).
  --mode build     : fait le vrai travail et écrit le JSON de sortie.

Ce script est fait pour tourner dans le workflow GitHub Actions
`.github/workflows/update-anmv-data.yml` (le réseau data.gouv.fr n'est pas
joignable depuis le bac à sable de développement) — mais il tourne tout
aussi bien en local si besoin.
"""
import argparse
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET

DATASET_API_URL = (
    "https://www.data.gouv.fr/api/1/datasets/"
    "base-de-donnees-publique-des-medicaments-veterinaires-autorises-en-france-1/"
)
OUTPUT_PATH = "www_anmv_ovins.json"


def http_get(url, dest=None):
    req = urllib.request.Request(url, headers={"User-Agent": "ovilog-anmv-import/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = resp.read()
    if dest:
        with open(dest, "wb") as f:
            f.write(data)
    return data


def fetch_dataset_resources():
    raw = http_get(DATASET_API_URL)
    meta = json.loads(raw)
    resources = meta.get("resources", [])
    return resources


def dump_tag_tree(elem, max_depth=4, depth=0, seen=None, limit_children=6):
    """Affiche récursivement les noms de balises + un échantillon de texte,
    sans jamais charger tout le document (appelé sur un élément déjà en
    mémoire, typiquement un seul enregistrement)."""
    if seen is None:
        seen = set()
    indent = "  " * depth
    text = (elem.text or "").strip()
    attribs = dict(elem.attrib)
    line = f"{indent}<{elem.tag}"
    if attribs:
        line += " " + " ".join(f'{k}="{v}"' for k, v in attribs.items())
    line += ">"
    if text:
        line += f" {text[:80]!r}"
    print(line)
    if depth >= max_depth:
        return
    for i, child in enumerate(elem):
        if i >= limit_children:
            print(f"{indent}  ... ({len(elem) - limit_children} autres enfants '{elem[0].tag if len(elem) else ''}' omis)")
            break
        dump_tag_tree(child, max_depth=max_depth, depth=depth + 1, seen=seen, limit_children=limit_children)


def explore_xml(path, sample_count=2):
    print(f"\n--- Exploration de {path} ---")
    depth = 0
    tag_counts = {}
    printed_by_tag = {}
    root = None
    for event, elem in ET.iterparse(path, events=("start", "end")):
        if event == "start":
            if depth == 0:
                root = elem
                print(f"Balise racine : <{elem.tag}>")
            depth += 1
            continue
        depth -= 1
        if depth != 1:
            continue
        tag_counts[elem.tag] = tag_counts.get(elem.tag, 0) + 1
        shown = printed_by_tag.get(elem.tag, 0)
        if shown < sample_count:
            print(f"\nÉchantillon '<{elem.tag}>' #{shown + 1} :")
            dump_tag_tree(elem, max_depth=5)
            printed_by_tag[elem.tag] = shown + 1
        elem.clear()
        if root is not None:
            root.clear()  # libère la mémoire des frères déjà traités

    print("\nBalises de niveau 1 rencontrées au total (nom: occurrences) :")
    for tag, n in sorted(tag_counts.items(), key=lambda x: -x[1])[:10]:
        print(f"  {tag}: {n}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["explore", "build"], required=True)
    parser.add_argument("--xml-path", default="/tmp/anmv_main.xml")
    parser.add_argument("--dict-path", default="/tmp/anmv_dict.xml")
    args = parser.parse_args()

    print("Récupération de la liste des ressources du jeu de données...")
    resources = fetch_dataset_resources()
    print(f"{len(resources)} ressource(s) trouvée(s) :")
    for r in resources:
        print(f"  - title={r.get('title')!r} format={r.get('format')!r} url={r.get('url')}")

    if args.mode == "explore":
        # On télécharge tout ce qui ressemble à du XML pour inspection.
        xml_resources = [r for r in resources if (r.get("format") or "").lower() == "xml"]
        if not xml_resources:
            print("Aucune ressource au format XML trouvée — vérifie la liste ci-dessus à la main.")
            return
        for r in xml_resources:
            title = r.get("title") or "sans_titre"
            safe = re.sub(r"[^a-zA-Z0-9_.-]", "_", title)[:60]
            dest = f"/tmp/{safe}.xml"
            print(f"\nTéléchargement de {title!r} -> {dest}")
            try:
                http_get(r["url"], dest=dest)
            except Exception as e:
                print(f"  échec du téléchargement : {e}")
                continue
            explore_xml(dest)
        return

    # --- mode build : implémenté une fois la structure connue (voir explore) ---
    print("Mode build pas encore finalisé — lance d'abord --mode explore.")
    sys.exit(1)


if __name__ == "__main__":
    main()
