# Vetomy

**Interactive 3D comparative anatomy for veterinary students.**

Vetomy is a browser-based anatomy atlas for domestic animals. Students can explore 3D models, select any structure, and read its details: its English name and Latin name from the *Nomina Anatomica Veterinaria* (NAV), key landmarks, articulations, and how the structure differs across species.

The first release covers the **skeletal system** of four species. Muscles, nerves, vessels and viscera are planned for later releases.

| Species | Scientific name |
|---|---|
| Horse | *Equus caballus* |
| Cattle | *Bos taurus* |
| Dog | *Canis familiaris* |
| Cat | *Felis catus* |

---

## Features

- **Interactive 3D viewer**: rotate, zoom and pan around each skeleton.
- **Click to explore**: selecting a bone highlights it and opens its details.
- **Standard terminology**: English and NAV Latin names for every structure.
- **Comparative anatomy**: each bone's details include notes for all four species, and one click opens the same bone in another species.
- **Real specimens**: for many bones, open a high-resolution 3D scan of a real specimen inside the app.
- **Ghost mode**: fades the surrounding bones so the selected one stands out.
- **Exploded view**: separates the bones to show how they fit together.
- **Region toggles**: show or hide the head, vertebral column and thorax, forelimb and hindlimb.
- **Anatomical camera views**: three-quarter, right and left lateral, cranial and dorsal, plus auto-rotate.
- **Search**: by English or Latin name, with keyboard navigation (press `/` to focus).
- **Light and dark themes**.
- **Responsive**: works on desktop and mobile browsers.

---

## Getting started

Vetomy is a static site with no build step and no dependencies to install. Three.js is loaded from a CDN, so an internet connection is required.

Browsers block local file loading when `index.html` is opened directly, so serve the folder with any local web server:

```bash
# Option 1: Python
python -m http.server 8000

# Option 2: Node.js
npx serve .
```

Then open `http://localhost:8000`.

In VS Code, you can also use the **Live Server** extension: right-click `index.html` and choose **Open with Live Server**.

---

## Project structure

```
vetomy/
├── index.html          # Page layout
├── style.css           # Styles
├── app.js              # Viewer, selection, search, filters and info panel
├── placeholder.js      # Simple stand-in skeleton, shown until a real model is added
├── data/
│   ├── bones.json      # Anatomical content for every structure
│   └── specimens.json  # Links from bones to real specimen scans
├── models/             # 3D models: horse.glb, cattle.glb, dog.glb, cat.glb
└── docs/
    └── MODEL_SPEC.md   # Naming and export requirements for 3D models
```

---

## Adding 3D models

Place a binary glTF file named after the species in `models/` (for example `models/horse.glb`) and reload the page. The app loads it automatically in place of the placeholder skeleton.

Each bone must be a separate, named object so it can be selected. Bilateral bones use `_L` / `_R` suffixes (`femur_L`, `femur_R`). The full naming convention, orientation, scale and export settings are in [`docs/MODEL_SPEC.md`](docs/MODEL_SPEC.md).

---

## Content format

All anatomical content lives in `data/bones.json`. Each key matches a bone name from the model, without its side suffix:

```json
"femur": {
  "region": "hindlimb",
  "names": { "en": "Femur", "nav": "Os femoris" },
  "type": "Long bone",
  "description": "The bone of the thigh, between the hip and the stifle.",
  "landmarks": ["Head", "Neck", "Greater trochanter"],
  "articulations": ["Os coxae (hip joint)", "Tibia and patella (stifle joint)"],
  "species": {
    "horse": "Third trochanter present.",
    "cattle": "No third trochanter.",
    "dog": "Fabellae behind the condyles.",
    "cat": "Straight, slender shaft."
  }
}
```

`region` is one of `head`, `trunk`, `forelimb` or `hindlimb`. A bone in the model with no matching entry still works: the panel shows a notice that its content is missing.

---

## Roadmap

- [ ] Final 3D skeleton models for all four species
- [ ] Complete osteology content, reviewed against standard veterinary anatomy references
- [ ] Side-by-side comparison view of the same bone across species
- [ ] Clinical notes: common fractures and pathologies for each bone
- [ ] Muscular, nervous, circulatory and visceral systems
- [ ] Additional species: sheep, goat, camel, pig
- [ ] Quiz mode modelled on practical identification exams

---

## Content accuracy

Vetomy is an educational tool under active development. Anatomical content is being reviewed and may contain errors. Always confirm details against standard veterinary anatomy textbooks and the NAV.

## Third-party assets

3D models and scans from external sources are used under their respective terms. See [`CREDITS.md`](CREDITS.md).
