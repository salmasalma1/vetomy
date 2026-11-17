// Builds a simple stand-in quadruped skeleton out of capsules, so the app
// works before the real GLB models are ready. Bone names follow docs/MODEL_SPEC.md.
// Orientation: head toward +X, Y up, animal's right side toward +Z, feet at Y = 0.
import * as THREE from 'three';

const DIMS = {
  //        trunk  withers  head   neck   tail   (metres, rough)
  horse:  { L: 1.6, H: 1.55, head: 0.60, neck: 0.80, tail: 0.50 },
  cattle: { L: 1.7, H: 1.35, head: 0.50, neck: 0.45, tail: 0.80 },
  dog:    { L: 0.70, H: 0.55, head: 0.22, neck: 0.25, tail: 0.35 },
  cat:    { L: 0.40, H: 0.25, head: 0.09, neck: 0.10, tail: 0.28 },
};

const Y = new THREE.Vector3(0, 1, 0);

function capsule(name, a, b, r, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(dir.length() - 2 * r, 0.001);
  const geo = new THREE.CapsuleGeometry(r, len, 4, 10);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(Y, dir.normalize());
  mesh.name = name;
  return mesh;
}

export function buildPlaceholder(species) {
  const d = DIMS[species] || DIMS.dog;
  const { L, H } = d;
  const mat = new THREE.MeshStandardMaterial({ color: 0xe8dcc4 });
  const g = new THREE.Group();
  g.userData.placeholder = true;
  const r = H * 0.022;
  const w = L * 0.13;
  const fx = L / 2;   // shoulder x
  const hx = -L / 2;  // hip x
  const v = (x, y, z = 0) => new THREE.Vector3(x, y, z);

  // ---- Axial skeleton ----
  const neckBase = v(fx * 0.8, H);
  const neckTop = v(fx + d.neck * 0.6, H + d.neck * 0.7);
  g.add(capsule('vertebrae_cervical', neckBase, neckTop, r * 1.3, mat));
  g.add(capsule('vertebrae_thoracic', v(fx * 0.8, H), v(0, H * 1.02), r * 1.5, mat));
  g.add(capsule('vertebrae_lumbar', v(0, H * 1.02), v(hx * 0.85, H), r * 1.4, mat));
  g.add(capsule('sacrum', v(hx * 0.85, H), v(hx * 1.1, H * 0.97), r * 1.6, mat));
  g.add(capsule('vertebrae_caudal', v(hx * 1.1, H * 0.97), v(hx * 1.1 - d.tail * 0.5, H * 0.97 - d.tail * 0.8), r * 0.8, mat));

  // Skull: stretched sphere pointing forward-down from the top of the neck
  const skullGeo = new THREE.SphereGeometry(1, 24, 16);
  const skull = new THREE.Mesh(skullGeo, mat);
  skull.name = 'skull';
  skull.scale.set(d.head * 0.5, d.head * 0.22, d.head * 0.2);
  skull.position.copy(neckTop).add(v(d.head * 0.35, -d.head * 0.2));
  skull.rotation.z = -0.6;
  g.add(skull);

  const jawA = neckTop.clone().add(v(d.head * 0.05, -d.head * 0.3));
  const jawB = neckTop.clone().add(v(d.head * 0.65, -d.head * 0.65));
  g.add(capsule('mandible', jawA, jawB, r * 0.9, mat));

  // Ribs: half-rings hanging from the thoracic spine (all named "ribs")
  const ribCount = 8;
  for (let i = 0; i < ribCount; i++) {
    const x = fx * 0.75 - (i / (ribCount - 1)) * fx * 0.85;
    const depth = H * (0.32 - Math.abs(i - 3) * 0.015);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 24, Math.PI), mat);
    ring.name = 'ribs';
    ring.scale.set(w * 1.15, depth, 1);
    ring.rotation.set(0, Math.PI / 2, Math.PI);
    ring.position.set(x, H * 0.99, 0);
    g.add(ring);
  }

  // ---- Limbs (both sides) ----
  for (const [s, z] of [['R', w], ['L', -w]]) {
    // Forelimb
    g.add(capsule(`scapula_${s}`, v(fx * 0.72, H * 0.98, z * 0.9), v(fx * 0.95, H * 0.7, z), r * 1.6, mat));
    g.add(capsule(`humerus_${s}`, v(fx * 0.95, H * 0.7, z), v(fx * 0.82, H * 0.46, z), r * 1.4, mat));
    g.add(capsule(`radius_${s}`, v(fx * 0.82, H * 0.46, z), v(fx * 0.84, H * 0.2, z), r * 1.1, mat));
    g.add(capsule(`metacarpus_${s}`, v(fx * 0.84, H * 0.2, z), v(fx * 0.86, H * 0.03, z), r * 0.9, mat));
    // Hindlimb
    g.add(capsule(`os_coxae_${s}`, v(hx * 0.75, H * 1.0, z * 0.6), v(hx * 1.05, H * 0.8, z), r * 1.7, mat));
    g.add(capsule(`femur_${s}`, v(hx * 0.95, H * 0.8, z), v(hx * 0.72, H * 0.52, z), r * 1.5, mat));
    g.add(capsule(`tibia_${s}`, v(hx * 0.72, H * 0.52, z), v(hx * 0.95, H * 0.24, z), r * 1.2, mat));
    g.add(capsule(`metatarsus_${s}`, v(hx * 0.95, H * 0.24, z), v(hx * 0.92, H * 0.03, z), r * 0.9, mat));
  }

  return g;
}
