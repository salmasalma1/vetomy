# Mesh QC: horse


## Horse — 84 pass, 7 warning, 0 fail

> Source: Original split before this QC existed; source comparison not available. Checks here are on the published mesh only.

| Bone | Side | Region | Status | Defects | Suggested correction | Manual check |
|---|---|---|---|---|---|---|
| skull | — | Head | **WARNING** | 4 edges with inconsistent winding (inverted normals) | Re-orient faces consistently | Yes |
| ribs | Left | Trunk | **WARNING** | 6 open edges (holes); 9 non-manifold edges; 20 edges with inconsistent winding (inverted normals); 59 folded edges (spikes/torn sheets) | Inspect; cap cut surfaces or replace the source model; Re-export with topology-preserving simplification; Re-orient faces consistently; Inspect | Yes |
| ribs | Right | Trunk | **WARNING** | 6 open edges (holes); 10 non-manifold edges; 19 edges with inconsistent winding (inverted normals); 37 folded edges (spikes/torn sheets) | Inspect; cap cut surfaces or replace the source model; Re-export with topology-preserving simplification; Re-orient faces consistently; Inspect | Yes |
| vertebra_t14 | — | Trunk | **WARNING** | 4 folded edges (spikes/torn sheets) | Inspect | Yes |
| vertebra_t18 | — | Trunk | **WARNING** | 4 folded edges (spikes/torn sheets) | Inspect | Yes |
| vertebra_t2 | — | Trunk | **WARNING** | 6 folded edges (spikes/torn sheets) | Inspect | Yes |
| vertebra_t4 | — | Trunk | **WARNING** | 4 folded edges (spikes/torn sheets) | Inspect | Yes |
| carpus | Left | Forelimb | **PASS** | — | — | No |
| carpus | Right | Forelimb | **PASS** | — | — | No |
| humerus | Left | Forelimb | **PASS** | — | — | No |
| humerus | Right | Forelimb | **PASS** | — | — | No |
| metacarpus | Left | Forelimb | **PASS** | — | — | No |
| metacarpus | Right | Forelimb | **PASS** | — | — | No |
| phalanx_distal_fore | Left | Forelimb | **PASS** | — | — | No |
| phalanx_distal_fore | Right | Forelimb | **PASS** | — | — | No |
| phalanx_middle_fore | Left | Forelimb | **PASS** | — | — | No |
| phalanx_middle_fore | Right | Forelimb | **PASS** | — | — | No |
| phalanx_proximal_fore | Left | Forelimb | **PASS** | — | — | No |
| phalanx_proximal_fore | Right | Forelimb | **PASS** | — | — | No |
| radius | Left | Forelimb | **PASS** | — | — | No |
| radius | Right | Forelimb | **PASS** | — | — | No |
| scapula | Left | Forelimb | **PASS** | — | — | No |
| scapula | Right | Forelimb | **PASS** | — | — | No |
| mandible | — | Head | **PASS** | — | — | No |
| teeth | — | Head | **PASS** | — | — | No |
| femur | Left | Hindlimb | **PASS** | — | — | No |
| femur | Right | Hindlimb | **PASS** | — | — | No |
| fibula | Left | Hindlimb | **PASS** | — | — | No |
| fibula | Right | Hindlimb | **PASS** | — | — | No |
| metatarsus | Left | Hindlimb | **PASS** | — | — | No |
| metatarsus | Right | Hindlimb | **PASS** | — | — | No |
| os_coxae | — | Hindlimb | **PASS** | — | — | No |
| patella | Left | Hindlimb | **PASS** | — | — | No |
| patella | Right | Hindlimb | **PASS** | — | — | No |
| phalanx_distal_hind | Left | Hindlimb | **PASS** | — | — | No |
| phalanx_distal_hind | Right | Hindlimb | **PASS** | — | — | No |
| phalanx_middle_hind | Left | Hindlimb | **PASS** | — | — | No |
| phalanx_middle_hind | Right | Hindlimb | **PASS** | — | — | No |
| phalanx_proximal_hind | Left | Hindlimb | **PASS** | — | — | No |
| phalanx_proximal_hind | Right | Hindlimb | **PASS** | — | — | No |
| tarsus | Left | Hindlimb | **PASS** | — | — | No |
| tarsus | Right | Hindlimb | **PASS** | — | — | No |
| tibia | Left | Hindlimb | **PASS** | — | — | No |
| tibia | Right | Hindlimb | **PASS** | — | — | No |
| atlas | — | Trunk | **PASS** | — | — | No |
| axis | — | Trunk | **PASS** | — | — | No |
| sacrum | — | Trunk | **PASS** | — | — | No |
| sternum | — | Trunk | **PASS** | — | — | No |
| vertebra_c3 | — | Trunk | **PASS** | — | — | No |
| vertebra_c4 | — | Trunk | **PASS** | — | — | No |
| vertebra_c5 | — | Trunk | **PASS** | — | — | No |
| vertebra_c6 | — | Trunk | **PASS** | — | — | No |
| vertebra_c7 | — | Trunk | **PASS** | — | — | No |
| vertebra_cd1 | — | Trunk | **PASS** | — | — | No |
| vertebra_cd10 | — | Trunk | **PASS** | — | — | No |
| vertebra_cd11 | — | Trunk | **PASS** | — | — | No |
| vertebra_cd12 | — | Trunk | **PASS** | — | — | No |
| vertebra_cd13 | — | Trunk | **PASS** | — | — | No |
| vertebra_cd14 | — | Trunk | **PASS** | — | — | No |
| vertebra_cd15 | — | Trunk | **PASS** | — | — | No |
| vertebra_cd16 | — | Trunk | **PASS** | — | — | No |
| vertebra_cd17 | — | Trunk | **PASS** | — | — | No |
| vertebra_cd18 | — | Trunk | **PASS** | — | — | No |
| vertebra_cd2 | — | Trunk | **PASS** | — | — | No |
| vertebra_cd3 | — | Trunk | **PASS** | — | — | No |
| vertebra_cd4 | — | Trunk | **PASS** | — | — | No |
| vertebra_cd5 | — | Trunk | **PASS** | — | — | No |
| vertebra_cd6 | — | Trunk | **PASS** | — | — | No |
| vertebra_cd7 | — | Trunk | **PASS** | — | — | No |
| vertebra_cd8 | — | Trunk | **PASS** | — | — | No |
| vertebra_cd9 | — | Trunk | **PASS** | — | — | No |
| vertebra_l1 | — | Trunk | **PASS** | — | — | No |
| vertebra_l2 | — | Trunk | **PASS** | — | — | No |
| vertebra_l3 | — | Trunk | **PASS** | — | — | No |
| vertebra_l4 | — | Trunk | **PASS** | — | — | No |
| vertebra_l5 | — | Trunk | **PASS** | — | — | No |
| vertebra_l6 | — | Trunk | **PASS** | — | — | No |
| vertebra_t1 | — | Trunk | **PASS** | — | — | No |
| vertebra_t10 | — | Trunk | **PASS** | — | — | No |
| vertebra_t11 | — | Trunk | **PASS** | — | — | No |
| vertebra_t12 | — | Trunk | **PASS** | — | — | No |
| vertebra_t13 | — | Trunk | **PASS** | — | — | No |
| vertebra_t15 | — | Trunk | **PASS** | — | — | No |
| vertebra_t16 | — | Trunk | **PASS** | — | — | No |
| vertebra_t17 | — | Trunk | **PASS** | — | — | No |
| vertebra_t3 | — | Trunk | **PASS** | — | — | No |
| vertebra_t5 | — | Trunk | **PASS** | — | — | No |
| vertebra_t6 | — | Trunk | **PASS** | — | — | No |
| vertebra_t7 | — | Trunk | **PASS** | — | — | No |
| vertebra_t8 | — | Trunk | **PASS** | — | — | No |
| vertebra_t9 | — | Trunk | **PASS** | — | — | No |
