#!/usr/bin/env python3
"""
Génère un fichier JSON compact des délais d'attente lait/viande ANMV pour les
ovins, à partir de la base de données publique des médicaments vétérinaires
autorisés en France (data.gouv.fr).

On utilise la variante XML "V1" du jeu de données (fichiers directement en
.xml, sans archive) : un fichier principal (~44 Mo) listant les spécialités,
et un fichier "Données de Référence" servant de dictionnaire pour décoder les
codes (espèces, unités...).

Deux modes :
  --mode explore  : n'écrit rien, affiche la structure des fichiers source
                    (XSD + échantillons de données) pour ajuster le filtrage
                    sans deviner.
  --mode build     : fait le vrai travail et écrit le JSON de sortie.

Ce script est fait pour tourner dans le workflow GitHub Actions
`.github/workflows/update-anmv-data.yml` (le réseau data.gouv.fr / anses.fr
n'est pas joignable depuis le bac à sable de développement) — mais il tourne
tout aussi bien en local si besoin.
"""
import argparse
import json
import sys
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET

DATASET_API_URL = (
    "https://www.data.gouv.fr/api/1/datasets/"
    "base-de-donnees-publique-des-medicaments-veterinaires-autorises-en-france-1/"
)
OUTPUT_PATH = "www_anmv_ovins.json"

MAIN_XML_PATH = "/tmp/anmv_main_v1.xml"
DICT_XML_PATH = "/tmp/anmv_dict_v1.xml"


def http_get(url, dest=None, max_bytes=None):
    req = urllib.request.Request(url, headers={"User-Agent": "ovilog-anmv-import/1.0"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = resp.read(max_bytes) if max_bytes else resp.read()
    if dest:
        with open(dest, "wb") as f:
            f.write(data)
    return data


def fetch_dataset_resources():
    raw = http_get(DATASET_API_URL)
    meta = json.loads(raw)
    return meta.get("resources", [])


def find_resource(resources, title_substrings):
    """Trouve la ressource dont le titre contient tous les fragments donnés
    (comparaison insensible à la casse)."""
    for r in resources:
        title = (r.get("title") or "").lower()
        if all(s.lower() in title for s in title_substrings):
            return r
    return None


def dump_tag_tree(elem, max_depth=6, depth=0, limit_children=8):
    indent = "  " * depth
    text = (elem.text or "").strip()
    attribs = dict(elem.attrib)
    line = f"{indent}<{elem.tag}"
    if attribs:
        line += " " + " ".join(f'{k}="{v}"' for k, v in attribs.items())
    line += ">"
    if text:
        line += f" {text[:100]!r}"
    print(line)
    if depth >= max_depth:
        return
    for i, child in enumerate(elem):
        if i >= limit_children:
            print(f"{indent}  ... ({len(elem) - limit_children} autres enfants omis)")
            break
        dump_tag_tree(child, max_depth=max_depth, depth=depth + 1, limit_children=limit_children)


def explore_xml(path, label, sample_count=2):
    print(f"\n--- Exploration de {label} ({path}) ---")
    depth = 0
    tag_counts = {}
    printed_by_tag = {}
    for event, elem in ET.iterparse(path, events=("start", "end")):
        if event == "start":
            if depth == 0:
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
            dump_tag_tree(elem)
            printed_by_tag[elem.tag] = shown + 1
        elem.clear()

    print("\nBalises de niveau 1 rencontrées au total (nom: occurrences) :")
    for tag, n in sorted(tag_counts.items(), key=lambda x: -x[1])[:15]:
        print(f"  {tag}: {n}")


def explore(resources):
    xsd_main = find_resource(resources, ["xsd", "v1"]) or find_resource(resources, ["description de la base", "v1"])
    xsd_dict = find_resource(resources, ["xsd", "reference", "v1"]) or find_resource(resources, ["description des donn", "v1"])
    xml_main = find_resource(resources, ["base de donn", "xml v1"])
    xml_dict = find_resource(resources, ["donn", "reference", "xml v1"]) or find_resource(resources, ["référence", "xml v1"])

    for label, res in [("XSD principal", xsd_main), ("XSD dictionnaire", xsd_dict)]:
        if not res:
            print(f"[!] Ressource {label} introuvable automatiquement.")
            continue
        print(f"\n=== {label} : {res['title']} ({res['url']}) ===")
        try:
            content = http_get(res["url"]).decode("utf-8", errors="replace")
            print(content[:8000])
            if len(content) > 8000:
                print(f"... ({len(content) - 8000} caractères supplémentaires tronqués)")
        except Exception as e:
            print(f"  échec : {e}")

    for label, res, dest in [
        ("XML principal V1", xml_main, MAIN_XML_PATH),
        ("XML dictionnaire V1", xml_dict, DICT_XML_PATH),
    ]:
        if not res:
            print(f"[!] Ressource {label} introuvable automatiquement — vérifie la liste ci-dessus.")
            continue
        print(f"\nTéléchargement de {label} ({res['url']}) -> {dest}")
        try:
            http_get(res["url"], dest=dest)
        except Exception as e:
            print(f"  échec du téléchargement : {e}")
            continue
        try:
            explore_xml(dest, label, sample_count=3)
        except Exception as e:
            print(f"  échec de l'exploration : {e}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["explore", "build"], required=True)
    args = parser.parse_args()

    print("Récupération de la liste des ressources du jeu de données...")
    resources = fetch_dataset_resources()
    print(f"{len(resources)} ressource(s) trouvée(s) :")
    for r in resources:
        print(f"  - title={r.get('title')!r} format={r.get('format')!r} url={r.get('url')}")

    if args.mode == "explore":
        explore(resources)
        return

    print("Mode build pas encore finalisé — lance d'abord --mode explore.")
    sys.exit(1)


if __name__ == "__main__":
    main()
