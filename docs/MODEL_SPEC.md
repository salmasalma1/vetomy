# 3D Model Specification

Requirements for skeleton models used by Vetomy. Following them lets a new model work in the app without any code changes.

## Delivery

| Requirement | Value |
|---|---|
| Format | Binary glTF (`.glb`) |
| File names | `horse.glb`, `cattle.glb`, `dog.glb`, `cat.glb` |
| Location | `models/skeletons/` |
| Orientation | Standing; head toward **+X**, **Y up**, feet on the ground plane |
| Scale | Real-world size in **metres** |
| File size | Under 20 MB per species |
| Materials | Optional; the app applies a uniform bone material |

## Naming rules

- Every selectable bone is a **separate object** with a name from the tables below.
- Bilateral bones take a side suffix: `_L` (left) or `_R` (right), e.g. `femur_L`.
- Midline bones have no suffix, e.g. `skull`, `sacrum`.
- Groups that are not split (vertebrae, carpals, phalanges…) are one object with the group name.
- Use **the same names in every species**. Omit bones a species does not have.
- Several objects may share a name (e.g. each rib named `ribs`); Blender's `.001` suffixes are ignored by the app.

### Head — `head`

| Object name | Structure |
|---|---|
| `skull` | Cranium (all skull bones except the mandible) |
| `mandible` | Mandibula |
| `hyoid` | Apparatus hyoideus *(optional)* |

### Vertebral column and thorax — `trunk`

| Object name | Structure |
|---|---|
| `vertebrae_cervical` | Vertebrae cervicales (or split `atlas`, `axis` and the rest grouped) |
| `vertebrae_thoracic` | Vertebrae thoracicae |
| `vertebrae_lumbar` | Vertebrae lumbales |
| `sacrum` | Os sacrum |
| `vertebrae_caudal` | Vertebrae caudales |
| `ribs` | Costae |
| `sternum` | Sternum |

### Forelimb — `forelimb` (add `_L` / `_R`)

| Object name | Structure |
|---|---|
| `scapula` | Scapula |
| `clavicle` | Clavicula *(cat, if present)* |
| `humerus` | Humerus |
| `radius` | Radius |
| `ulna` | Ulna (if fused and inseparable, leave it as part of `radius`) |
| `carpus` | Ossa carpi |
| `metacarpus` | Ossa metacarpalia |
| `phalanges_fore` | Phalanges of the forelimb |
| `sesamoids_fore` | Ossa sesamoidea *(optional)* |

### Hindlimb — `hindlimb` (add `_L` / `_R`)

| Object name | Structure |
|---|---|
| `os_coxae` | Os coxae |
| `femur` | Os femoris |
| `patella` | Patella |
| `tibia` | Tibia |
| `fibula` | Fibula (if separate) |
| `tarsus` | Ossa tarsi |
| `metatarsus` | Ossa metatarsalia |
| `phalanges_hind` | Phalanges of the hindlimb |

## Preparing a model in Blender

**Splitting a single-mesh model**
1. Select the model and press `Tab` to enter Edit Mode.
2. If the bones are not touching: `P` → **By Loose Parts**.
3. If bones are fused (common in CT-derived meshes): enable X-ray (`Alt+Z`), select one bone with Lasso/Box Select or `L` (Select Linked), then `P` → **Selection**.
4. Rename each object in the Outliner.

**Before export**
1. Set Scene Units to **Metric**, Unit Scale `1.0`.
2. Select all objects → `Ctrl+A` → **All Transforms**.
3. If the file is too large, add a **Decimate** modifier and apply it.

**Export**
File → Export → glTF 2.0 → Format: **glTF Binary (.glb)**, with *Apply Modifiers* enabled.

## Licensing

Record the source URL, author and license of every external model in `CREDITS.md`. Use only models whose license allows modification (e.g. CC BY, CC BY-SA). Avoid **ND** (No Derivatives) licenses, because splitting a model counts as modifying it.
