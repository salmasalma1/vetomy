# Vetomy

Interactive 3D comparative anatomy for veterinary students.

Explore the skeletons of the **horse**, **cattle**, **dog** and **cat** in the browser. Select any bone to see its English and NAV Latin names, landmarks, articulations and how it differs across the four species.

**Live:** https://salmasalma1.github.io/vetomy/

## Features

- 3D skeletons with every bone selectable, down to individual vertebrae and phalanges
- Comparative notes for all four species on every bone
- Numbered landmark points on bones, each with a description
- High-resolution scans of real specimens for many bones
- Exploded view, ghost mode, region toggles and anatomical camera views
- Search by English or Latin name
- Dark and light themes, desktop and mobile

## Run locally

No build step. Serve the folder with any static server:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Project structure

```
vetomy/
├── index.html
├── assets/
│   ├── css/            Styles
│   ├── js/             Application code
│   └── icons/          Favicon and app icons
├── data/
│   ├── bones.json      Anatomical content
│   ├── specimens.json  Links from bones to real specimen scans
│   └── landmarks.json  Landmark points and descriptions
├── models/
│   ├── skeletons/      One skeleton per species (horse.glb, …)
│   └── specimens/      Scans of individual bones
└── docs/
    └── MODEL_SPEC.md   Requirements for 3D models
```

## Adding a skeleton

Export a binary glTF named after the species (for example `cattle.glb`) into `models/skeletons/`. Each bone must be a separate object named as described in [`docs/MODEL_SPEC.md`](docs/MODEL_SPEC.md).

## Placing landmarks

Open the site with `?edit` at the end of the address. Select a bone, click on its surface and name the point. Points on left bones are mirrored to the right automatically. Click **Export JSON** and replace `data/landmarks.json` with the downloaded file.

## Content

Anatomical content is a draft under review. Confirm details against standard veterinary anatomy textbooks and the NAV.

## Credits

3D models and scans are used under their respective licenses. See [`CREDITS.md`](CREDITS.md).
