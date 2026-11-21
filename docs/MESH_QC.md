# Mesh quality report

Generated with `tools/mesh-qc`. Per-species tables: [`docs/qc`](qc/).

## Summary

| Species | Pass | Warning | Fail | Source comparison |
|---|---|---|---|---|
| Horse | 84 | 7 | 0 | Not available |
| Cat | 80 | 0 | 0 | Yes |
| Dog | 0 | 0 | 32 | Not possible (AI-generated, fused source) |
| Sheep | 61 | 8 | 0 | Yes |
| Camel | 76 | 1 | 0 | Yes |

## Root causes found

| Defect | Species | Origin | Evidence |
|---|---|---|---|
| Spiky, torn scapulae; holes and folded sheets across all bones | Sheep, camel | Processing: vertex-clustering decimation (`work/decimate.py`) collapsed the two faces of thin bones into each other | Source scans were closed (sheep 8 open edges, camel 4); published meshes had 23,656 and 19,616 non-manifold edges |
| Cut-off bones, open edges, stray fragments | Dog | Source: AI-generated mesh (Tripo) with fused bones; processing: geometric cuts and fragment removal | No clean original exists; 19,991 open edges after splitting |
| None | Cat | — | Published mesh identical to source |
| Minor open edges and folds in the rib groups | Horse | Inherited from the original split | 12 open edges, 21 non-manifold edges in 91 meshes |

Rendering (Three.js `GLTFLoader`, `MeshStandardMaterial`) does not modify geometry and was not a cause.

## Repairs

Sheep and camel were re-exported from the original scans. The segmentation (one source piece per bone) was already correct and was kept unchanged. Vertex clustering was replaced with topology-preserving quadric simplification (meshoptimizer), run per connected piece with a maximum deviation of 0.15% of the piece's size. Pieces of 3,000 faces or fewer are published exactly as scanned. No geometry was invented and no fragments were deleted.

| Species | Bone | Faces (source) | Faces (published) | Before | After |
|---|---|---|---|---|---|
| Sheep | skull | 33454 | 8362 | FAIL | PASS |
| Sheep | mandible | 73842 | 18460 | FAIL | PASS |
| Sheep | hyoid | 18694 | 13760 | FAIL | PASS |
| Sheep | atlas | 9832 | 5312 | FAIL | PASS |
| Sheep | axis | 35800 | 8950 | FAIL | PASS |
| Sheep | vertebra_c3 | 36254 | 9062 | FAIL | WARNING |
| Sheep | vertebra_c4 | 36878 | 9218 | FAIL | WARNING |
| Sheep | vertebra_c5 | 36636 | 9158 | FAIL | PASS |
| Sheep | vertebra_c6 | 36698 | 9174 | FAIL | PASS |
| Sheep | vertebra_c7 | 32352 | 8088 | FAIL | PASS |
| Sheep | vertebra_t1 | 31502 | 7874 | FAIL | WARNING |
| Sheep | vertebra_t2 | 31380 | 7844 | FAIL | PASS |
| Sheep | vertebra_t3 | 31402 | 7850 | FAIL | PASS |
| Sheep | vertebra_t4 | 31390 | 7846 | FAIL | WARNING |
| Sheep | vertebra_t5 | 30152 | 7538 | FAIL | PASS |
| Sheep | vertebra_t6 | 29890 | 7472 | FAIL | PASS |
| Sheep | vertebra_t7 | 27692 | 6922 | FAIL | PASS |
| Sheep | vertebra_t8 | 27176 | 6794 | FAIL | PASS |
| Sheep | vertebra_t9 | 9640 | 3000 | FAIL | PASS |
| Sheep | vertebra_t10 | 9528 | 3072 | FAIL | PASS |
| Sheep | vertebra_t11 | 9906 | 3404 | FAIL | PASS |
| Sheep | vertebra_t12 | 9846 | 3950 | FAIL | PASS |
| Sheep | vertebra_t13 | 9860 | 3996 | FAIL | PASS |
| Sheep | vertebra_l1 | 30568 | 7642 | FAIL | PASS |
| Sheep | vertebra_l2 | 31296 | 7824 | FAIL | PASS |
| Sheep | vertebra_l3 | 31492 | 7872 | FAIL | PASS |
| Sheep | vertebra_l4 | 31144 | 7786 | FAIL | PASS |
| Sheep | vertebra_l5 | 32126 | 8030 | FAIL | PASS |
| Sheep | vertebra_l6 | 31024 | 7756 | FAIL | PASS |
| Sheep | vertebra_cd1 | 5820 | 3000 | FAIL | PASS |
| Sheep | vertebra_cd2 | 5060 | 3000 | FAIL | PASS |
| Sheep | vertebra_cd3 | 4522 | 3042 | FAIL | PASS |
| Sheep | vertebra_cd4 | 4074 | 3060 | FAIL | PASS |
| Sheep | vertebra_cd5 | 3180 | 3000 | FAIL | PASS |
| Sheep | vertebra_cd6 | 2246 | 2246 | FAIL | PASS |
| Sheep | vertebra_cd7 | 1928 | 1928 | FAIL | PASS |
| Sheep | vertebra_cd8 | 2188 | 2188 | FAIL | PASS |
| Sheep | sacrum | 13970 | 6242 | FAIL | PASS |
| Sheep | ribs_L | 125946 | 39000 | FAIL | PASS |
| Sheep | ribs_R | 122482 | 39000 | FAIL | PASS |
| Sheep | costal_cartilage_L | 3456 | 3456 | FAIL | WARNING |
| Sheep | costal_cartilage_R | 3456 | 3456 | FAIL | WARNING |
| Sheep | sternum | 74420 | 30152 | FAIL | WARNING |
| Sheep | os_coxae | 121188 | 32206 | FAIL | WARNING |
| Sheep | scapula_L | 9912 | 3000 | FAIL | PASS |
| Sheep | scapula_R | 9914 | 3000 | FAIL | PASS |
| Sheep | humerus_L | 9070 | 3000 | FAIL | PASS |
| Sheep | humerus_R | 9366 | 3000 | FAIL | PASS |
| Sheep | radius_L | 30816 | 7704 | FAIL | PASS |
| Sheep | radius_R | 9990 | 3000 | FAIL | PASS |
| Sheep | ulna_L | 10174 | 3000 | FAIL | PASS |
| Sheep | carpus_L | 26970 | 18870 | FAIL | PASS |
| Sheep | carpus_R | 32464 | 21560 | FAIL | PASS |
| Sheep | metacarpus_L | 15314 | 6282 | FAIL | PASS |
| Sheep | metacarpus_R | 9620 | 3000 | FAIL | PASS |
| Sheep | phalanges_fore_L | 41662 | 18000 | FAIL | PASS |
| Sheep | phalanges_fore_R | 41712 | 18230 | FAIL | PASS |
| Sheep | femur_L | 9346 | 3000 | FAIL | PASS |
| Sheep | femur_R | 9096 | 3000 | FAIL | PASS |
| Sheep | patella_L | 8452 | 3444 | FAIL | PASS |
| Sheep | patella_R | 8196 | 3754 | FAIL | PASS |
| Sheep | tibia_L | 9296 | 3000 | FAIL | PASS |
| Sheep | tibia_R | 9074 | 3000 | FAIL | PASS |
| Sheep | tarsus_L | 35168 | 19662 | FAIL | PASS |
| Sheep | tarsus_R | 22636 | 11604 | FAIL | PASS |
| Sheep | metatarsus_L | 31750 | 12492 | FAIL | PASS |
| Sheep | metatarsus_R | 21686 | 10922 | FAIL | PASS |
| Sheep | phalanges_hind_L | 20308 | 9466 | FAIL | PASS |
| Sheep | phalanges_hind_R | 43186 | 18428 | FAIL | PASS |
| Camel | skull | 37692 | 9422 | FAIL | PASS |
| Camel | mandible | 21814 | 5452 | FAIL | PASS |
| Camel | hyoid | 10030 | 3000 | FAIL | PASS |
| Camel | atlas | 9910 | 5786 | FAIL | PASS |
| Camel | axis | 9292 | 4536 | FAIL | PASS |
| Camel | vertebra_c3 | 10308 | 5386 | FAIL | PASS |
| Camel | vertebra_c4 | 9934 | 5358 | FAIL | PASS |
| Camel | vertebra_c5 | 9722 | 5482 | FAIL | PASS |
| Camel | vertebra_c6 | 9814 | 5422 | FAIL | PASS |
| Camel | vertebra_c7 | 10166 | 5374 | FAIL | PASS |
| Camel | vertebra_t1 | 10180 | 3246 | FAIL | PASS |
| Camel | vertebra_t2 | 10104 | 3000 | FAIL | PASS |
| Camel | vertebra_t3 | 10292 | 3062 | FAIL | PASS |
| Camel | vertebra_t4 | 10200 | 3000 | FAIL | PASS |
| Camel | vertebra_t5 | 10584 | 3604 | FAIL | PASS |
| Camel | vertebra_t6 | 10210 | 3000 | FAIL | PASS |
| Camel | vertebra_t7 | 10118 | 3000 | FAIL | PASS |
| Camel | vertebra_t8 | 10326 | 3000 | FAIL | PASS |
| Camel | vertebra_t9 | 10222 | 3390 | FAIL | PASS |
| Camel | vertebra_t10 | 10220 | 3128 | FAIL | PASS |
| Camel | vertebra_t11 | 10286 | 3474 | FAIL | PASS |
| Camel | vertebra_t12 | 9994 | 3054 | FAIL | PASS |
| Camel | vertebra_l1 | 10540 | 3076 | FAIL | PASS |
| Camel | vertebra_l2 | 10464 | 3000 | FAIL | PASS |
| Camel | vertebra_l3 | 10422 | 3000 | FAIL | PASS |
| Camel | vertebra_l4 | 10756 | 3000 | FAIL | PASS |
| Camel | vertebra_l5 | 10574 | 3000 | FAIL | PASS |
| Camel | vertebra_l6 | 10746 | 3000 | FAIL | PASS |
| Camel | vertebra_l7 | 10040 | 3000 | FAIL | PASS |
| Camel | vertebra_cd1 | 9958 | 3584 | FAIL | PASS |
| Camel | vertebra_cd2 | 10186 | 3450 | FAIL | PASS |
| Camel | vertebra_cd3 | 9732 | 4078 | FAIL | PASS |
| Camel | vertebra_cd4 | 9454 | 4464 | FAIL | PASS |
| Camel | vertebra_cd5 | 8818 | 4284 | FAIL | PASS |
| Camel | vertebra_cd6 | 18348 | 4586 | FAIL | PASS |
| Camel | vertebra_cd7 | 9024 | 3000 | FAIL | PASS |
| Camel | vertebra_cd8 | 9116 | 3000 | FAIL | PASS |
| Camel | vertebra_cd9 | 8842 | 3000 | FAIL | PASS |
| Camel | vertebra_cd10 | 8138 | 3000 | FAIL | PASS |
| Camel | vertebra_cd11 | 7512 | 3000 | FAIL | PASS |
| Camel | vertebra_cd12 | 7694 | 3000 | FAIL | PASS |
| Camel | vertebra_cd13 | 7138 | 3000 | FAIL | PASS |
| Camel | vertebra_cd14 | 6620 | 3000 | FAIL | PASS |
| Camel | vertebra_cd15 | 6324 | 3000 | FAIL | PASS |
| Camel | vertebra_cd16 | 5422 | 3000 | FAIL | PASS |
| Camel | vertebra_cd17 | 4666 | 3000 | FAIL | PASS |
| Camel | vertebra_cd18 | 3448 | 3000 | FAIL | PASS |
| Camel | vertebra_cd19 | 2028 | 2028 | FAIL | PASS |
| Camel | sacrum | 10698 | 6660 | FAIL | PASS |
| Camel | ribs_L | 128264 | 41198 | FAIL | PASS |
| Camel | ribs_R | 128272 | 41198 | FAIL | PASS |
| Camel | sternum | 43748 | 25742 | FAIL | PASS |
| Camel | os_coxae | 10016 | 4260 | FAIL | PASS |
| Camel | scapula_L | 10110 | 3000 | FAIL | PASS |
| Camel | scapula_R | 10110 | 3000 | FAIL | PASS |
| Camel | humerus_L | 9604 | 3202 | FAIL | PASS |
| Camel | humerus_R | 9604 | 3176 | FAIL | PASS |
| Camel | radius_L | 9938 | 3000 | FAIL | PASS |
| Camel | radius_R | 9938 | 3000 | FAIL | PASS |
| Camel | carpus_L | 501790 | 125444 | FAIL | WARNING |
| Camel | carpus_R | 36054 | 19952 | FAIL | PASS |
| Camel | metacarpus_L | 9564 | 3000 | FAIL | PASS |
| Camel | metacarpus_R | 36946 | 15770 | FAIL | PASS |
| Camel | phalanges_fore_L | 54890 | 20760 | FAIL | PASS |
| Camel | phalanges_fore_R | 36984 | 12074 | FAIL | PASS |
| Camel | femur_L | 9324 | 3000 | FAIL | PASS |
| Camel | femur_R | 9322 | 3000 | FAIL | PASS |
| Camel | patella_L | 8730 | 5248 | FAIL | PASS |
| Camel | patella_R | 8730 | 5482 | FAIL | PASS |
| Camel | tibia_L | 18540 | 7788 | FAIL | PASS |
| Camel | tibia_R | 9694 | 3000 | FAIL | PASS |
| Camel | tarsus_L | 44854 | 21221 | FAIL | PASS |
| Camel | tarsus_R | 27244 | 14108 | FAIL | PASS |
| Camel | metatarsus_L | 9438 | 3000 | FAIL | PASS |
| Camel | metatarsus_R | 35724 | 15878 | FAIL | PASS |
| Camel | phalanges_hind_L | 37186 | 12674 | FAIL | PASS |
| Camel | phalanges_hind_R | 36976 | 12216 | FAIL | PASS |

## Remaining defects

- **Dog: all 32 meshes FAIL.** The source is AI-generated with fused bones and wrong vertebral and rib counts; it cannot be repaired without inventing anatomy. Replace it with the University of Edinburgh CT dog (CC BY 4.0).
- **Sheep costal cartilages:** reconstructed, not part of the scan. Positions need checking against a textbook.
- **Warnings** (small folds at process tips, a few non-manifold edges inherited near the sheep pelvis, the camel carpus) were inspected visually and do not change anatomy. They stay listed for manual review.

## Running the check

```
python3 tools/mesh-qc/run_qc.py <species> models/skeletons/<species>.glb --report docs/qc --strict
```

`--strict` exits with an error when any bone fails. Set `VETOMY_SOURCES` to the folder with the split source data to enable source comparison. The check only reports; it never edits or removes geometry, so genuine processes, crests and sesamoid bones are never stripped.
