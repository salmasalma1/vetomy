# Mesh QC

Checks every bone in a published skeleton before it is accepted.

```
python3 run_qc.py <species> <model.glb> [--report DIR] [--strict]
```

For each bone it reports open edges (holes), non-manifold edges, inconsistent winding, degenerate and sliver triangles, folded edges (spikes or torn sheets) and stray fragments. When the original scan is available (`VETOMY_SOURCES`), it also compares surface area, volume, bounding box, piece count and surface deviation against the source, and only flags changes beyond what the processing step should cause.

Statuses: **PASS** acceptable, **WARNING** needs a visual check, **FAIL** must not be published. The tool reports only; it never edits geometry.

Requires Python 3 with numpy and scipy.
