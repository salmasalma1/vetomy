# Skeleton processing pipeline

Scripts used to turn downloaded skeleton models into the split, named GLBs in `models/skeletons`.
They were run from a scratch folder, so paths inside them are absolute; adjust before reuse.
Source models are not stored here (large, and some are licensed for display only).

1. `comps_any.py <name>`: weld vertices and split the source into connected pieces (one piece per bone in clean scans).
2. `*class.py`: name every piece (vertebrae in order, limb bones by position, left/right).
3. `export_*.py`: reorient (+X head, +Y up, +Z right), scale to metres, simplify with `simplify_policy.py`
   (meshoptimizer, topology-preserving, per piece, max 0.15% deviation; pieces of 3,000 faces or fewer untouched),
   and write the GLB with credit in `asset.extras`.
4. `cartilage.py`: reconstructed costal cartilages for the sternal ribs (sheep, camel). Not part of any scan.
5. Run `tools/mesh-qc/run_qc.py` before publishing. Do not publish a model with FAIL.

`meshopt.py` needs `libmeshopt.so`, built from https://github.com/zeux/meshoptimizer:
`g++ -O2 -shared -fPIC -o libmeshopt.so meshoptimizer/src/*.cpp`
