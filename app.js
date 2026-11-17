import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildPlaceholder } from './placeholder.js';

// ------------------------------------------------------------------
// Config
// ------------------------------------------------------------------
const SPECIES = [
  { id: 'horse',  en: 'Horse',  ar: 'الحصان', latin: 'Equus caballus' },
  { id: 'cattle', en: 'Cattle', ar: 'الأبقار', latin: 'Bos taurus' },
  { id: 'dog',    en: 'Dog',    ar: 'الكلب',  latin: 'Canis familiaris' },
  { id: 'cat',    en: 'Cat',    ar: 'القطة',  latin: 'Felis catus' },
];

const REGIONS = [
  { id: 'all',      en: 'All' },
  { id: 'head',     en: 'Head' },
  { id: 'trunk',    en: 'Spine & thorax' },
  { id: 'forelimb', en: 'Forelimb' },
  { id: 'hindlimb', en: 'Hindlimb' },
  { id: 'other',    en: 'Other' },
];

const COLORS = {
  bone: 0xe8dcc4,
  selected: 0x4fc3f7,
  hover: 0xffd166,
};

// ------------------------------------------------------------------
// State
// ------------------------------------------------------------------
const state = {
  species: 'horse',
  data: {},            // contents of data/bones.json
  model: null,         // THREE.Group of the current animal
  bones: [],           // [{ mesh, key, side, region, origPos, offset }]
  selected: null,
  hovered: null,
  ghost: true,
  region: 'all',
  explode: 0,
  search: '',
  loadToken: 0,
  camAnim: null,
};

// ------------------------------------------------------------------
// DOM
// ------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const viewer = $('viewer');
const tooltip = $('tooltip');
const infoPanel = $('info-panel');

// ------------------------------------------------------------------
// Three.js setup
// ------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewer.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

scene.add(new THREE.HemisphereLight(0xffffff, 0x1b2430, 1.3));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
keyLight.position.set(3, 5, 4);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x88aaff, 0.7);
rimLight.position.set(-4, 2, -3);
scene.add(rimLight);

function resize() {
  const w = viewer.clientWidth;
  const h = viewer.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewer);
resize();

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
// "femur_L", "Femur_R.001", "femur L001" -> "femur"
export function boneKey(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/\.?\d{3}$/, '')          // Blender duplicates (.001 / 001)
    .replace(/[\s\-]+/g, '_')
    .replace(/_(l|r|left|right)$/, '')
    .replace(/^(left|right)_/, '');
}

function boneSide(name) {
  const n = String(name || '').toLowerCase().replace(/\.?\d{3}$/, '');
  if (/(_l|_left)$/.test(n) || n.startsWith('left_')) return 'Left';
  if (/(_r|_right)$/.test(n) || n.startsWith('right_')) return 'Right';
  return '';
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function info(key) {
  return key && key !== '_meta' ? state.data[key] : null;
}

function displayName(key) {
  const d = info(key);
  if (d?.names?.en) return d.names.en;
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ------------------------------------------------------------------
// Loading
// ------------------------------------------------------------------
const loader = new GLTFLoader();

async function loadData() {
  try {
    const res = await fetch('data/bones.json');
    state.data = await res.json();
  } catch (e) {
    console.error('Could not load data/bones.json', e);
    state.data = {};
  }
}

async function loadSpecies(id) {
  const token = ++state.loadToken;
  state.species = id;
  state.selected = null;
  state.hovered = null;
  renderTabs();
  $('loading').classList.remove('hidden');

  let root;
  let isPlaceholder = false;
  try {
    const gltf = await loader.loadAsync(`models/${id}.glb`);
    root = gltf.scene;
  } catch (e) {
    console.info(`models/${id}.glb not found — using placeholder skeleton.`);
    root = buildPlaceholder(id);
    isPlaceholder = true;
  }
  if (token !== state.loadToken) return; // user switched species meanwhile

  if (state.model) {
    scene.remove(state.model);
    disposeModel(state.model);
  }
  state.model = root;
  scene.add(root);
  prepareModel(root);

  $('loading').classList.add('hidden');
  $('placeholder-badge').classList.toggle('hidden', !isPlaceholder);
  $('explode').value = 0;
  state.explode = 0;
  frameModel(false);
  renderBoneList();
  renderInfo();
  applyMaterials();
}

function disposeModel(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.geometry?.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.dispose());
    }
  });
}

function prepareModel(root) {
  // Put feet on the ground and center the animal
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;
  root.updateMatrixWorld(true);

  const fullBox = new THREE.Box3().setFromObject(root);
  const modelCenter = fullBox.getCenter(new THREE.Vector3());
  const size = fullBox.getSize(new THREE.Vector3()).length();

  state.bones = [];
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const rawName = mesh.name || mesh.parent?.name || 'unnamed';
    const key = boneKey(rawName);

    // One material per mesh so each bone can be highlighted on its own
    const old = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const mat = new THREE.MeshStandardMaterial({
      color: old?.map ? 0xffffff : COLORS.bone,
      map: old?.map || null,
      roughness: 0.6,
      metalness: 0.0,
    });
    mesh.material = mat;

    // Explode direction: away from the model center
    const wc = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
    const dir = wc.clone().sub(modelCenter);
    if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0).multiplyScalar(size * 0.01);
    const worldOffset = dir.clone().multiplyScalar(0.8).add(dir.clone().normalize().multiplyScalar(size * 0.06));
    const p1 = mesh.parent.worldToLocal(wc.clone());
    const p2 = mesh.parent.worldToLocal(wc.clone().add(worldOffset));

    state.bones.push({
      mesh,
      key,
      side: boneSide(rawName),
      region: info(key)?.region || 'other',
      origPos: mesh.position.clone(),
      offset: p2.sub(p1),
    });
  });
}

// ------------------------------------------------------------------
// Camera
// ------------------------------------------------------------------
function frameModel(animate = true) {
  if (!state.model) return;
  const box = new THREE.Box3().setFromObject(state.model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = (maxDim / (2 * Math.tan((camera.fov * Math.PI) / 360))) * 1.35;
  const pos = new THREE.Vector3(center.x + dist * 0.3, center.y + dist * 0.15, center.z + dist);
  camera.near = maxDim / 500;
  camera.far = maxDim * 50;
  camera.updateProjectionMatrix();
  moveCamera(pos, center, animate);
}

function focusOn(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  const dir = camera.position.clone().sub(controls.target).normalize();
  const dist = Math.max(size * 2.2, camera.near * 20);
  moveCamera(center.clone().add(dir.multiplyScalar(dist)), center, true);
}

function moveCamera(pos, target, animate) {
  if (!animate) {
    camera.position.copy(pos);
    controls.target.copy(target);
    state.camAnim = null;
    return;
  }
  state.camAnim = {
    fromPos: camera.position.clone(),
    toPos: pos,
    fromTarget: controls.target.clone(),
    toTarget: target,
    t0: performance.now(),
    duration: 650,
  };
}

// ------------------------------------------------------------------
// Visual state
// ------------------------------------------------------------------
function applyMaterials() {
  for (const b of state.bones) {
    const m = b.mesh.material;
    const isSel = state.selected === b;
    const isHover = state.hovered === b && !isSel;

    b.mesh.visible = state.region === 'all' || b.region === state.region;

    m.emissive.setHex(isSel ? COLORS.selected : isHover ? COLORS.hover : 0x000000);
    m.emissiveIntensity = isSel ? 0.55 : isHover ? 0.3 : 0;

    const ghosted = state.ghost && state.selected && !isSel;
    m.opacity = ghosted ? 0.12 : 1;
    if (m.transparent !== !!ghosted) {
      m.transparent = !!ghosted;
      m.depthWrite = !ghosted;
      m.needsUpdate = true;
    }
  }
}

function applyExplode() {
  for (const b of state.bones) {
    b.mesh.position.copy(b.origPos).addScaledVector(b.offset, state.explode);
  }
}

// ------------------------------------------------------------------
// Picking
// ------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function pick(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  // When ghosting, prefer the selected bone and solid bones
  const candidates = state.bones.filter((b) => b.mesh.visible).map((b) => b.mesh);
  const hits = raycaster.intersectObjects(candidates, false);
  if (!hits.length) return null;
  const solid = hits.find((h) => !h.object.material.transparent) || hits[0];
  return state.bones.find((b) => b.mesh === solid.object) || null;
}

let downPos = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downPos = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downPos) return;
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  downPos = null;
  if (moved > 5) return; // it was a drag (rotate), not a click
  const b = pick(e);
  select(b, false);
});

let hoverQueued = false;
renderer.domElement.addEventListener('pointermove', (e) => {
  if (hoverQueued) return;
  hoverQueued = true;
  requestAnimationFrame(() => {
    hoverQueued = false;
    const b = pick(e);
    if (b !== state.hovered) {
      state.hovered = b;
      applyMaterials();
    }
    if (b) {
      const r = viewer.getBoundingClientRect();
      tooltip.textContent = displayName(b.key) + (b.side ? ` (${b.side})` : '');
      tooltip.style.left = `${e.clientX - r.left + 14}px`;
      tooltip.style.top = `${e.clientY - r.top + 14}px`;
      tooltip.classList.remove('hidden');
      renderer.domElement.style.cursor = 'pointer';
    } else {
      tooltip.classList.add('hidden');
      renderer.domElement.style.cursor = 'grab';
    }
  });
});
renderer.domElement.addEventListener('pointerleave', () => {
  tooltip.classList.add('hidden');
  state.hovered = null;
  applyMaterials();
});

function select(b, focus) {
  state.selected = b;
  applyMaterials();
  renderInfo();
  renderBoneList();
  if (b && focus) focusOn(b.mesh);
}

// ------------------------------------------------------------------
// UI rendering
// ------------------------------------------------------------------
function renderTabs() {
  const nav = $('species-tabs');
  nav.innerHTML = '';
  for (const s of SPECIES) {
    const btn = document.createElement('button');
    btn.className = s.id === state.species ? 'active' : '';
    btn.innerHTML = `<span>${esc(s.en)}</span><span class="ar">${esc(s.ar)}</span>`;
    btn.onclick = () => s.id !== state.species && loadSpecies(s.id);
    nav.appendChild(btn);
  }
}

function renderFilters() {
  const box = $('region-filters');
  box.innerHTML = '';
  for (const r of REGIONS) {
    const btn = document.createElement('button');
    btn.textContent = r.en;
    btn.className = r.id === state.region ? 'active' : '';
    btn.onclick = () => {
      state.region = r.id;
      if (state.selected && !(r.id === 'all' || state.selected.region === r.id)) state.selected = null;
      renderFilters();
      renderBoneList();
      renderInfo();
      applyMaterials();
    };
    box.appendChild(btn);
  }
}

function renderBoneList() {
  const list = $('bone-list');
  list.innerHTML = '';
  const q = state.search.trim().toLowerCase();

  // Unique bone keys present in this model
  const seen = new Map();
  for (const b of state.bones) if (!seen.has(b.key)) seen.set(b.key, b);

  const order = REGIONS.map((r) => r.id);
  const items = [...seen.values()]
    .filter((b) => state.region === 'all' || b.region === state.region)
    .filter((b) => {
      if (!q) return true;
      const d = info(b.key);
      const hay = [b.key, d?.names?.en, d?.names?.nav, d?.names?.ar].join(' ').toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => order.indexOf(a.region) - order.indexOf(b.region) || displayName(a.key).localeCompare(displayName(b.key)));

  let lastRegion = null;
  for (const b of items) {
    if (b.region !== lastRegion) {
      lastRegion = b.region;
      const t = document.createElement('li');
      t.className = 'group-title';
      t.textContent = REGIONS.find((r) => r.id === b.region)?.en || b.region;
      list.appendChild(t);
    }
    const li = document.createElement('li');
    li.className = state.selected?.key === b.key ? 'active' : '';
    li.innerHTML = `<span>${esc(displayName(b.key))}</span><span class="ar">${esc(info(b.key)?.names?.ar || '')}</span>`;
    li.onclick = () => select(b, true);
    list.appendChild(li);
  }
  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'group-title';
    li.textContent = 'No bones match';
    list.appendChild(li);
  }
}

function renderInfo() {
  const b = state.selected;
  if (!b) {
    infoPanel.innerHTML = `<div class="empty">Click a bone to see its details<br><span dir="rtl">اضغط على أي عظمة لعرض تفاصيلها</span></div>`;
    return;
  }
  const d = info(b.key);
  const sp = SPECIES.find((s) => s.id === state.species);

  if (!d) {
    infoPanel.innerHTML = `
      <div class="info">
        <h2>${esc(displayName(b.key))}</h2>
        <div class="tags"><span class="tag">${esc(sp.en)}</span>${b.side ? `<span class="tag">${b.side}</span>` : ''}</div>
        <div class="missing">No data yet for <code>${esc(b.key)}</code>.<br>
        Add an entry with this key to <code>data/bones.json</code>.</div>
      </div>`;
    return;
  }

  const list = (arr) => (arr?.length ? `<ul>${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p>—</p>');
  const compare = SPECIES.map((s) => `
      <div class="row ${s.id === state.species ? 'current' : ''}">
        <strong>${esc(s.en)} <span class="ar">· ${esc(s.ar)}</span></strong>
        <span>${esc(d.species?.[s.id] || 'No notes yet.')}</span>
      </div>`).join('');

  infoPanel.innerHTML = `
    <div class="info">
      <h2>${esc(d.names?.en || displayName(b.key))}</h2>
      <div class="nav">${esc(d.names?.nav || '')}</div>
      <div class="ar-name" dir="rtl">${esc(d.names?.ar || '')}</div>
      <div class="tags">
        <span class="tag">${esc(sp.en)} · ${esc(sp.latin)}</span>
        ${b.side ? `<span class="tag">${b.side}</span>` : ''}
        ${d.type ? `<span class="tag">${esc(d.type)}</span>` : ''}
        <span class="tag">${esc(REGIONS.find((r) => r.id === b.region)?.en || b.region)}</span>
      </div>

      <h3>Description</h3>
      <p>${esc(d.description || '—')}</p>

      <h3>Landmarks</h3>
      ${list(d.landmarks)}

      <h3>Articulations</h3>
      ${list(d.articulations)}

      <h3>Comparative anatomy</h3>
      <div class="compare">${compare}</div>

      <div class="disclaimer">${esc(state.data._meta?.disclaimer || '')}</div>
    </div>`;
}

// ------------------------------------------------------------------
// Controls
// ------------------------------------------------------------------
$('search').addEventListener('input', (e) => {
  state.search = e.target.value;
  renderBoneList();
});
$('explode').addEventListener('input', (e) => {
  state.explode = parseFloat(e.target.value);
  applyExplode();
});
$('ghost-btn').addEventListener('click', (e) => {
  state.ghost = !state.ghost;
  e.currentTarget.classList.toggle('on', state.ghost);
  applyMaterials();
});
$('reset-btn').addEventListener('click', () => {
  select(null);
  state.explode = 0;
  $('explode').value = 0;
  applyExplode();
  frameModel(true);
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') select(null);
});

// ------------------------------------------------------------------
// Render loop
// ------------------------------------------------------------------
function tick(now) {
  const a = state.camAnim;
  if (a) {
    const t = Math.min((now - a.t0) / a.duration, 1);
    const k = 1 - Math.pow(1 - t, 3); // ease-out
    camera.position.lerpVectors(a.fromPos, a.toPos, k);
    controls.target.lerpVectors(a.fromTarget, a.toTarget, k);
    if (t >= 1) state.camAnim = null;
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// ------------------------------------------------------------------
// Start
// ------------------------------------------------------------------
(async function init() {
  renderTabs();
  renderFilters();
  renderInfo();
  await loadData();
  await loadSpecies(state.species);
  requestAnimationFrame(tick);
})();
