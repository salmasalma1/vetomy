# Mesh QC: dog


## Dog — 0 pass, 0 warning, 1 fail

> Source: AI-generated source (Tripo) with fused bones; split by geometric cuts. No clean original exists. Checks here are on the published mesh only.

| Bone | Side | Region | Status | Defects | Suggested correction | Manual check |
|---|---|---|---|---|---|---|
| skeleton | — | Trunk | **FAIL** | 57290 open edges (holes); 12 non-manifold edges; 23 edges with inconsistent winding (inverted normals); 3184 separate pieces in one bone | Inspect; cap cut surfaces or replace the source model; Re-export with topology-preserving simplification; Re-orient faces consistently; Check for stray fragments | Yes |
