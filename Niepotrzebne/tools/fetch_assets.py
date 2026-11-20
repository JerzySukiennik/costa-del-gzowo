# Riverside: downloads the CC0 Poly Haven assets listed below into assets/ (skips files that already exist).
import concurrent.futures as cf
import json
import os
import sys
import urllib.request

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "assets")
UA = {"User-Agent": "asset-fetch/1.0"}

HDRIS = {"kloofendal_48d_partly_cloudy_puresky": "4k"}

TEXTURES = {
    "asphalt_02": "2k",
    "dirty_concrete": "2k",
    "brushed_concrete": "2k",
    "concrete_wall_008": "1k",
    "concrete_floor_worn_001": "2k",
    "leafy_grass": "1k",
    "forrest_ground_01": "1k",
    "brown_mud_leaves_01": "1k",
    "ganges_river_pebbles": "1k",
    "coast_sand_01": "1k",
    "gravel_floor_02": "1k",
    "gravel_road": "1k",
    "seaside_rock": "1k",
    "palm_bark": "1k",
    "bark_willow": "1k",
    "green_metal_rust": "1k",
    "rusty_metal_02": "1k",
    "fabric_leather_01": "1k",
    "denim_fabric": "1k",
}

MODELS = {
    "jacaranda_tree": "1k",
    "island_tree_02": "1k",
    "searsia_lucida": "1k",
    "shrub_02": "1k",
    "shrub_03": "1k",
    "shrub_04": "1k",
    "wild_rooibos_bush": "1k",
    "fern_02": "1k",
    "nettle_plant": "1k",
    "weed_plant_02": "1k",
    "pachira_aquatica_01": "1k",
    "calathea_orbifolia_01": "1k",
    "anthurium_botany_01": "1k",
    "rock_moss_set_01": "1k",
    "rock_moss_set_02": "1k",
    "rock_07": "1k",
    "rock_09": "1k",
    "boulder_01": "1k",
    "dead_tree_trunk": "1k",
    "dry_branches_medium_01": "1k",
    "tree_stump_01": "1k",
    "concrete_road_barrier": "1k",
    "concrete_road_barrier_02": "1k",
    "old_tyre": "1k",
    "metal_trash_can": "1k",
    "lateral_sea_marker": "1k",
    "Barrel_01": "1k",
    "cement_bag": "1k",
    "trashbag": "1k",
    "utility_box_01": "1k",
}


def api(path):
    req = urllib.request.Request("https://api.polyhaven.com/" + path, headers=UA)
    return json.load(urllib.request.urlopen(req, timeout=60))


def grab(job):
    url, dest = job
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return 0
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    req = urllib.request.Request(url, headers=UA)
    data = urllib.request.urlopen(req, timeout=300).read()
    with open(dest + ".part", "wb") as f:
        f.write(data)
    os.replace(dest + ".part", dest)
    return len(data)


def plan():
    jobs = []
    for name, res in HDRIS.items():
        f = api("files/" + name)
        jobs.append((f["hdri"][res]["hdr"]["url"], os.path.join(ROOT, "hdri", name + "_" + res + ".hdr")))
    for name, res in TEXTURES.items():
        f = api("files/" + name)
        for key, short in (("Diffuse", "diff"), ("nor_gl", "nor"), ("arm", "arm")):
            if key in f:
                jobs.append((f[key][res]["jpg"]["url"], os.path.join(ROOT, "textures", name, short + ".jpg")))
    for name, res in MODELS.items():
        f = api("files/" + name)
        g = f["gltf"][res]["gltf"]
        base = os.path.join(os.path.dirname(ROOT), "Niepotrzebne", "raw", "models", name)
        jobs.append((g["url"], os.path.join(base, name + ".gltf")))
        for rel, inc in g.get("include", {}).items():
            jobs.append((inc["url"], os.path.join(base, rel)))
    return jobs


if __name__ == "__main__":
    jobs = plan()
    total = 0
    with cf.ThreadPoolExecutor(8) as ex:
        for n in ex.map(grab, jobs):
            total += n
    print(len(jobs), "files,", round(total / 1e6, 1), "MB downloaded")
    if "--list" in sys.argv:
        for _, dest in jobs:
            print(os.path.relpath(dest, ROOT), os.path.getsize(dest))
