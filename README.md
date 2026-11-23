# Vetomy

**Interactive 3D comparative veterinary osteology, in the browser.**

Vetomy lets veterinary students study the skeletons of six domestic species side by side. Select any bone to see its English and NAV Latin names, its landmarks and articulations, how it differs between species, and 3D scans of real specimens of the same bone.

**Live site:** https://salmasalma1.github.io/vetomy/

---

## Species

| Species | Latin name | Skeleton in the app |
|---|---|---|
| Horse | *Equus caballus* | Fully split, 91 selectable bones |
| Cattle | *Bos taurus* | Full skeleton through the Sketchfab viewer |
| Sheep | *Ovis* | Fully split, sternal costal cartilages reconstructed |
| Camel | *Camelus* | Fully split, sternal costal cartilages reconstructed |
| Dog | *Canis familiaris* | Single model with 20 numbered bones and a matching list |
| Cat | *Felis catus* | Fully split |

## Features

- **Selectable skeletons.** Every bone can be picked, down to individual vertebrae and phalanges. Left and right bones are separate.
- **Bone panel.** English and NAV names, bone type, description, landmarks, articulations and comparative notes for every species.
- **Landmark points.** Numbered points on the bone surface, each with its NAV name and a short definition.
- **Real specimens.** Scans of real bones open in a viewer next to the model. On the horse, each bone also lists real specimens of the same bone from cattle, sheep, camelids, dog and cat.
- **Species comparison.** The same bone from several species side by side, at the same size or at true scale.
- **Study tools.** Ghost mode, exploded view, region filters (head, spine and thorax, forelimb, hindlimb) and standard anatomical camera views.
- **Search.** Find bones by English or Latin name.
- **Any device.** Works on desktop and mobile, in dark and light themes. No installation and no account.

## Examples

### Studying a bone

1. Open the live site and choose **Horse**.
2. Press <kbd>/</kbd>, type `humerus` and press <kbd>Enter</kbd>.
3. The panel shows the names (*Humerus*), the landmarks and the joints it forms. The numbered points on the model mark structures such as the greater tubercle (*Tuberculum majus*) and the deltoid tuberosity.
4. Under **Across species**, read how the humerus of cattle, dog and cat differs from the horse's.
5. Under **Real specimen**, open a scan of a real horse humerus, then a cattle or dog humerus from the sections below it.
6. Press <kbd>Esc</kbd> to close the scan and clear the selection.

### Seeing how bones fit together

- Choose **Forelimb** in the region filters to hide everything else.
- Drag the **Explode** slider to pull the bones apart, then back to see how they articulate.
- Turn on **Ghost** to keep the rest of the skeleton visible but transparent around the selected bone.
- Use **Lat R**, **Lat L**, **Cr** and **D** for right lateral, left lateral, cranial and dorsal views.

### Keyboard

| Key | Action |
|---|---|
| <kbd>/</kbd> | Focus the search box |
| <kbd>↑</kbd> <kbd>↓</kbd> | Move through search results |
| <kbd>Enter</kbd> | Select the highlighted bone |
| <kbd>Esc</kbd> | Close the open scan or landmark, then clear the selection |

## Run locally

There is no build step. Serve the folder with any static file server:

```bash
git clone https://github.com/salmasalma1/vetomy.git
cd vetomy
python3 -m http.server 8000
```

Then open http://localhost:8000. Three.js is loaded from a CDN, so an internet connection is needed.

## Project structure

```
vetomy/
├── index.html
├── assets/
│   ├── css/              Styles
│   ├── js/               Viewer, species comparison, translation of scan labels
│   └── icons/            Favicon and app icons
├── data/
│   ├── bones.json        Anatomical content for every bone
│   ├── specimens.json    Real specimen scans per species and bone
│   └── landmarks.json    Landmark points and their definitions
├── models/
│   ├── skeletons/        One GLB per species, one named mesh per bone
│   └── specimens/        Hosted scans of individual bones
├── docs/
│   ├── MODEL_SPEC.md     Requirements for skeleton models
│   ├── MESH_QC.md        Mesh quality report
│   └── qc/               Per-species QC tables
└── tools/
    ├── mesh-qc/          Mesh quality checker
    └── pipeline/         Scripts that split, name and export skeletons
```

## Contributing content

All content is plain JSON in `data/`. Changes appear on the site after the next deploy.

### Adding or editing a bone

Each bone in `data/bones.json` is keyed by the same name its mesh uses in the skeleton files (`scapula`, `humerus`, `vertebra_t5` and so on):

```json
"scapula": {
  "region": "forelimb",
  "names": { "en": "Scapula", "nav": "Scapula" },
  "type": "Flat bone",
  "description": "Flat bone of the shoulder. It is attached to the trunk by muscles only (synsarcosis).",
  "landmarks": ["Spine of scapula", "Supraspinous fossa", "Glenoid cavity"],
  "articulations": ["Humerus (shoulder joint)"],
  "species": {
    "horse": "No acromion; the spine has a tuber at its middle. Large scapular cartilage.",
    "dog": "Acromion present. The spine divides the bone into two nearly equal fossae."
  }
}
```

### Adding a real specimen

Add an entry to `data/specimens.json` under the species and the bone key. Use `uid` for a Sketchfab model, or `file` for a scan hosted in `models/specimens/`. Add `credit` for any scan that is not from the default source in `_meta`:

```json
"dog": {
  "femur": [
    {
      "title": "Femur",
      "uid": "d0d5ca5c9fb9475a870c655ea8538bb2",
      "credit": "vetanatMunich (Veterinary Anatomy, LMU Munich)"
    }
  ]
}
```

A specimen added to any species also appears on the horse page for the same bone. If the scan is not from the named species, say so in the title, for example `"Humerus (guanaco, Lama guanicoe)"`. Record every new scan in [`CREDITS.md`](CREDITS.md).

### Defining a landmark

Landmark definitions in `data/landmarks.json` are keyed by bone and by the landmark name in **lower case**:

```json
"definitions": {
  "humerus": {
    "greater tubercle": {
      "nav": "Tuberculum majus",
      "description": "Large eminence on the lateral side of the proximal end. Insertion of the supraspinatus and infraspinatus."
    }
  }
}
```

### Placing landmark points

1. Open the site with `?edit` at the end of the address, for example `http://localhost:8000/?edit`.
2. Select a bone, click its surface and name the point. Points on a left bone are mirrored to the right bone automatically.
3. Click **Export JSON** and replace `data/landmarks.json` with the downloaded file.

## Adding a skeleton

1. Export a binary glTF named after the species (for example `goat.glb`) into `models/skeletons/`. Every bone must be a separate mesh named as described in [`docs/MODEL_SPEC.md`](docs/MODEL_SPEC.md), for example `femur_L`, `vertebra_t5` or `phalanges_fore_R`.
2. Check the model's license before using it, and add it to [`CREDITS.md`](CREDITS.md).
3. Run the quality check and fix every failure before publishing:

```bash
pip install numpy scipy
python3 tools/mesh-qc/run_qc.py goat models/skeletons/goat.glb --report docs/qc --strict
```

Each bone is reported as **PASS**, **WARNING** (needs a visual check) or **FAIL** (must not be published). With `--strict` the command exits with an error if any bone fails. Example report row:

| Bone | Side | Region | Status | Defects | Suggested correction |
|---|---|---|---|---|---|
| sternum | — | Trunk | **WARNING** | 15 folded edges vs 6 in source | Re-export with topology-preserving simplification |

The scripts used to split, name and export the current skeletons are in [`tools/pipeline`](tools/pipeline).

## Deployment

The site is static and is served by GitHub Pages from the `main` branch. Every push to `main` deploys in about a minute.

After changing `style.css` or `app.js`, bump the `?v=` version in `index.html` and in `assets/js/app.js` (its imports and `ASSET_V`) so browsers load the new files instead of cached copies.

## Accuracy

The anatomical content is reviewed against standard veterinary anatomy textbooks and the *Nomina Anatomica Veterinaria*. Reconstructed parts that are not in the original scans, such as costal cartilages, are labelled as reconstructions. Report errors through the repository's issues.

## Credits and licenses

Every 3D model and scan is used under its own license or with its authors' permission. Scans shown through the Sketchfab viewer are embedded only and are not downloaded or modified. See [`CREDITS.md`](CREDITS.md) for the full list.
