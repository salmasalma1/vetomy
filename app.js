import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildPlaceholder } from './placeholder.js';

// ------------------------------------------------------------------
// Config
// ------------------------------------------------------------------
const SPECIES = [
  { id: 'horse',  en: 'Horse',  ar: 'الحصان', latin: 'Equus caballus',   emoji: '🐴' },
  { id: 'cattle', en: 'Cattle', ar: 'الأبقار', latin: 'Bos taurus',       emoji: '🐄' },
  { id: 'dog',    en: 'Dog',    ar: 'الكلب',  latin: 'Canis familiaris', emoji: '🐶' },
  { id: 'cat',    en: 'Cat',    ar: 'القطة',  latin: 'Felis catus',      emoji: '🐱' },
];

const REGIONS = [
  { id: 'head',     en: 'Head',           color: '#ff8a65' },
  { id: 'trunk',    en: 'Spine & thorax', color: '#7c5cff' },
  { id: 'forelimb', en: 'Forelimb',       color: '#3ddc97' },
  { id: 'hindlimb', en: 'Hindlimb',       color: '#ffd66b' },
  { id: 'other',    en: 'Other',          color: '#a39cbf' },
];

const COLORS = { bone: 0xefe3cf, selected: 0x7c5cff, hover: 0xff8a65 };

// ------------------------------------------------------------------
// State
// ------------------------------------------------------------------
const state = {
  species: 'horse',
  data: {},
  model: null,
  ground: null,
  bones: [],               // [{ mesh, key, side, region, origPos, offset }]
  selected: null,
  hovered: null,
  ghost: true,
  hiddenRegions: new Set(),
  explode: 0,
  search: '',
  tab: 'regions',
  loadToken: 0,
  camAnim: null,
  frame: { center: new THREE.Vector3(), dist: 5 },
};

// ------------------------------------------------------------------
// DOM
// ------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const stage = $('stage');
const tooltip = $('tooltip');
const infoPanel = $('info-panel');

// ------------------------------------------------------------------
// Three.js setup
// ------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotateSpeed = 1.2;

scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b0e6, 1.4));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.7);
keyLight.position.set(3, 6, 4);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xc9bcff, 0.6);
fillLight.position.set(-4, 2, -3);
scene.add(fillLight);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// Soft round "floor" shadow under the animal
function makeGround() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(90, 70, 170, 0.22)');
  grad.addColorStop(0.6, 'rgba(90, 70, 170, 0.08)');
  grad.addColorStop(1, 'rgba(90, 70, 170, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -1;
  return mesh;
}
state.ground = makeGround();
scene.add(state.ground);

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
// "femur_L", "Femur_R.001", "femur L001" -> "femur"
function boneKey(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/\.?\d{3}$/, '')
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

const info = (key) => (key && key !== '_meta' ? state.data[key] : null);
const species = () => SPECIES.find((s) => s.id === state.species);
const regionOf = (id) => REGIONS.find((r) => r.id === id) || REGIONS.at(-1);

function displayName(key) {
  return info(key)?.names?.en || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function uniqueBones() {
  const seen = new Map();
  for (const b of state.bones) if (!seen.has(b.key)) seen.set(b.key, b);
  return [...seen.values()];
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ------------------------------------------------------------------
// Loading
// ------------------------------------------------------------------
const loader = new GLTFLoader();

async function loadData() {
  try {
    state.data = await (await fetch('data/bones.json')).json();
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
  $('model-meta').textContent = 'Loading…';

  let root;
  let isPlaceholder = false;
  try {
    root = (await loader.loadAsync(`models/${id}.glb`)).scene;
  } catch {
    console.info(`models/${id}.glb not found, using the placeholder skeleton.`);
    root = buildPlaceholder(id);
    isPlaceholder = true;
  }
  if (token !== state.loadToken) return;

  if (state.model) {
    scene.remove(state.model);
    disposeModel(state.model);
  }
  state.model = root;
  scene.add(root);
  prepareModel(root);

  $('placeholder-badge').classList.toggle('hidden', !isPlaceholder);
  $('explode').value = 0;
  state.explode = 0;
  $('explode-val').textContent = '0%';
  setView('three', false);
  renderAll();

  const s = species();
  toast(`${s.emoji} ${s.en} loaded · ${uniqueBones().length} bones to explore`);
}

function disposeModel(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry?.dispose();
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.dispose());
  });
}

function prepareModel(root) {
  // Feet on the ground, centered
  const box = new THREE.Box3().setFromObject(root);
  const c = box.getCenter(new THREE.Vector3());
  root.position.x -= c.x;
  root.position.z -= c.z;
  root.position.y -= box.min.y;
  root.updateMatrixWorld(true);

  const full = new THREE.Box3().setFromObject(root);
  const modelCenter = full.getCenter(new THREE.Vector3());
  const sizeV = full.getSize(new THREE.Vector3());
  const size = sizeV.length();

  // Ground shadow
  state.ground.scale.set(sizeV.x * 1.4, sizeV.x * 1.4, 1);
  state.ground.position.set(0, 0.001, 0);

  // Camera framing info
  const maxDim = Math.max(sizeV.x, sizeV.y, sizeV.z);
  state.frame.center.copy(modelCenter);
  state.frame.dist = (maxDim / (2 * Math.tan((camera.fov * Math.PI) / 360))) * 1.45;
  camera.near = maxDim / 500;
  camera.far = maxDim * 60;
  camera.updateProjectionMatrix();

  state.bones = [];
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const rawName = mesh.name || mesh.parent?.name || 'unnamed';
    const key = boneKey(rawName);

    const old = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    mesh.material = new THREE.MeshStandardMaterial({
      color: old?.map ? 0xffffff : COLORS.bone,
      map: old?.map || null,
      roughness: 0.55,
      metalness: 0,
    });

    const wc = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
    const dir = wc.clone().sub(modelCenter);
    if (dir.lengthSq() < 1e-8) dir.set(0, size * 0.01, 0);
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
const VIEWS = {
  three:   new THREE.Vector3(0.45, 0.3, 1).normalize(),
  right:   new THREE.Vector3(0, 0.05, 1).normalize(),   // animal's right side faces +Z
  left:    new THREE.Vector3(0, 0.05, -1).normalize(),
  cranial: new THREE.Vector3(1, 0.08, 0).normalize(),   // head points to +X
  dorsal:  new THREE.Vector3(0.001, 1, 0.02).normalize(),
};

function setView(name, animate = true) {
  const { center, dist } = state.frame;
  const pos = center.clone().addScaledVector(VIEWS[name], dist);
  moveCamera(pos, center.clone(), animate);
  document.querySelectorAll('.rail [data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
}

function focusOn(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  const dir = camera.position.clone().sub(controls.target).normalize();
  const dist = Math.max(size * 2.4, state.frame.dist * 0.18);
  moveCamera(center.clone().addScaledVector(dir, dist), center, true);
  document.querySelectorAll('.rail [data-view]').forEach((b) => b.classList.remove('active'));
}

function moveCamera(pos, target, animate) {
  if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    camera.position.copy(pos);
    controls.target.copy(target);
    state.camAnim = null;
    return;
  }
  state.camAnim = {
    fromPos: camera.position.clone(), toPos: pos,
    fromTarget: controls.target.clone(), toTarget: target,
    t0: performance.now(), duration: 700,
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

    b.mesh.visible = !state.hiddenRegions.has(b.region);

    m.emissive.setHex(isSel ? COLORS.selected : isHover ? COLORS.hover : 0x000000);
    m.emissiveIntensity = isSel ? 0.6 : isHover ? 0.35 : 0;

    const ghosted = !!(state.ghost && state.selected && !isSel);
    m.opacity = ghosted ? 0.1 : 1;
    if (m.transparent !== ghosted) {
      m.transparent = ghosted;
      m.depthWrite = !ghosted;
      m.needsUpdate = true;
    }
  }
}

function applyExplode() {
  for (const b of state.bones) b.mesh.position.copy(b.origPos).addScaledVector(b.offset, state.explode);
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
  const meshes = state.bones.filter((b) => b.mesh.visible).map((b) => b.mesh);
  const hits = raycaster.intersectObjects(meshes, false);
  if (!hits.length) return null;
  const hit = hits.find((h) => !h.object.material.transparent) || hits[0];
  return state.bones.find((b) => b.mesh === hit.object) || null;
}

let downPos = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downPos = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downPos) return;
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  downPos = null;
  if (moved > 5) return; // that was a drag
  select(pick(e), false);
});

let hoverQueued = false;
renderer.domElement.addEventListener('pointermove', (e) => {
  if (hoverQueued || e.pointerType === 'touch') return;
  hoverQueued = true;
  requestAnimationFrame(() => {
    hoverQueued = false;
    const b = pick(e);
    if (b !== state.hovered) {
      state.hovered = b;
      applyMaterials();
    }
    if (b) {
      tooltip.textContent = displayName(b.key) + (b.side ? ` · ${b.side}` : '');
      tooltip.style.left = `${e.clientX + 14}px`;
      tooltip.style.top = `${e.clientY + 14}px`;
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
  if (b && state.hiddenRegions.has(b.region)) state.hiddenRegions.delete(b.region);
  applyMaterials();
  renderInfo();
  renderBoneList();
  renderRegions();
  if (b && focus) focusOn(b.mesh);
}

// ------------------------------------------------------------------
// UI
// ------------------------------------------------------------------
function renderAll() {
  renderTabs();
  renderRegions();
  renderBoneList();
  renderInfo();
  renderCounts();
  applyMaterials();
}

function renderTabs() {
  const nav = $('species-tabs');
  nav.innerHTML = '';
  for (const s of SPECIES) {
    const btn = document.createElement('button');
    btn.className = s.id === state.species ? 'active' : '';
    btn.setAttribute('aria-pressed', s.id === state.species);
    btn.innerHTML = `<span class="emoji">${s.emoji}</span>
      <span class="labels"><span>${esc(s.en)}</span><span class="ar">${esc(s.ar)}</span></span>`;
    btn.onclick = () => s.id !== state.species && loadSpecies(s.id);
    nav.appendChild(btn);
  }
}

function renderCounts() {
  const all = uniqueBones();
  const visible = all.filter((b) => !state.hiddenRegions.has(b.region));
  const s = species();
  $('bone-count').textContent = all.length;
  $('model-meta').textContent = `${all.length} bones · ${s.en} (${s.latin})`;
  $('visible-count').textContent = `${visible.length} of ${all.length} visible`;
  $('toggle-all').textContent = state.hiddenRegions.size ? 'Show all' : 'Hide all';
}

function renderRegions() {
  const list = $('region-list');
  list.innerHTML = '';
  const all = uniqueBones();
  for (const r of REGIONS) {
    const n = all.filter((b) => b.region === r.id).length;
    if (!n) continue;
    const on = !state.hiddenRegions.has(r.id);
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="swatch" style="background:${r.color}"></span>
      <span class="name">${esc(r.en)}</span>
      <span class="num">${n}</span>
      <button class="switch" role="switch" aria-checked="${on}" aria-label="Show ${esc(r.en)}"></button>`;
    li.querySelector('.switch').onclick = () => {
      if (on) state.hiddenRegions.add(r.id); else state.hiddenRegions.delete(r.id);
      if (state.selected && state.hiddenRegions.has(state.selected.region)) {
        state.selected = null;
        renderInfo();
      }
      renderRegions();
      renderBoneList();
      renderCounts();
      applyMaterials();
    };
    list.appendChild(li);
  }
  renderCounts();
}

function renderBoneList() {
  const list = $('bone-list');
  list.innerHTML = '';
  const q = state.search.trim().toLowerCase();
  const order = REGIONS.map((r) => r.id);

  const items = uniqueBones()
    .filter((b) => {
      if (!q) return true;
      const d = info(b.key);
      return [b.key, d?.names?.en, d?.names?.nav, d?.names?.ar].join(' ').toLowerCase().includes(q);
    })
    .sort((a, b) => order.indexOf(a.region) - order.indexOf(b.region)
      || displayName(a.key).localeCompare(displayName(b.key)));

  let last = null;
  for (const b of items) {
    if (b.region !== last) {
      last = b.region;
      const g = document.createElement('li');
      g.className = 'group';
      g.textContent = regionOf(b.region).en;
      list.appendChild(g);
    }
    const li = document.createElement('li');
    li.className = state.selected?.key === b.key ? 'active' : '';
    li.innerHTML = `<span>${esc(displayName(b.key))}</span><span class="ar">${esc(info(b.key)?.names?.ar || '')}</span>`;
    li.onclick = () => select(b, true);
    list.appendChild(li);
  }
  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'empty-row';
    li.textContent = q ? `No bone matches “${state.search}”. Try the Latin name?` : 'No bones in this model yet.';
    list.appendChild(li);
  }
}

function renderInfo() {
  const b = state.selected;
  if (!b) {
    infoPanel.classList.add('hidden');
    return;
  }
  infoPanel.classList.remove('hidden');
  const d = info(b.key);
  const s = species();
  const region = regionOf(b.region);

  if (!d) {
    infoPanel.innerHTML = `
      <button class="close" aria-label="Close">✕</button>
      <h2>${esc(displayName(b.key))}</h2>
      <div class="tags"><span class="tag">${s.emoji} ${esc(s.en)}</span>${b.side ? `<span class="tag">${b.side}</span>` : ''}</div>
      <div class="missing">No details for <strong>${esc(b.key)}</strong> yet. Add an entry with this key to <code>data/bones.json</code>.</div>`;
  } else {
    const list = (arr) => (arr?.length ? `<ul>${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p>—</p>');
    const compare = SPECIES.map((sp) => `
      <div class="row ${sp.id === state.species ? 'current' : ''}">
        <span class="emoji">${sp.emoji}</span>
        <div><strong>${esc(sp.en)}</strong><span>${esc(d.species?.[sp.id] || 'No notes yet.')}</span></div>
      </div>`).join('');

    infoPanel.innerHTML = `
      <button class="close" aria-label="Close">✕</button>
      <h2>${esc(d.names?.en || displayName(b.key))}</h2>
      <div class="nav">${esc(d.names?.nav || '')}</div>
      <div class="ar-name" dir="rtl">${esc(d.names?.ar || '')}</div>
      <div class="tags">
        <span class="tag hot">${s.emoji} ${esc(s.en)}</span>
        ${b.side ? `<span class="tag">${b.side}</span>` : ''}
        ${d.type ? `<span class="tag">${esc(d.type)}</span>` : ''}
        <span class="tag">${esc(region.en)}</span>
      </div>
      <h3>What it is</h3>
      <p>${esc(d.description || '—')}</p>
      <h3>Landmarks</h3>
      ${list(d.landmarks)}
      <h3>Articulates with</h3>
      ${list(d.articulations)}
      <h3>Across species</h3>
      <div class="compare">${compare}</div>
      <p class="disclaimer">${esc(state.data._meta?.disclaimer || '')}</p>`;
  }
  infoPanel.querySelector('.close').onclick = () => select(null);
  infoPanel.scrollTop = 0;
}

function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll('#panel-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $('region-list').classList.toggle('hidden', tab !== 'regions');
  $('bone-list').classList.toggle('hidden', tab !== 'bones');
}

// ------------------------------------------------------------------
// Controls
// ------------------------------------------------------------------
document.querySelectorAll('#panel-tabs button').forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));

$('search').addEventListener('input', (e) => {
  state.search = e.target.value;
  setTab('bones');
  renderBoneList();
});
$('search').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const first = $('bone-list').querySelector('li:not(.group):not(.empty-row)');
  first?.click();
});

$('explode').addEventListener('input', (e) => {
  state.explode = e.target.value / 100;
  $('explode-val').textContent = `${e.target.value}%`;
  applyExplode();
});

$('ghost-btn').addEventListener('click', (e) => {
  state.ghost = !state.ghost;
  e.currentTarget.classList.toggle('on', state.ghost);
  e.currentTarget.setAttribute('aria-pressed', state.ghost);
  applyMaterials();
});

$('toggle-all').addEventListener('click', () => {
  if (state.hiddenRegions.size) state.hiddenRegions.clear();
  else {
    REGIONS.forEach((r) => state.hiddenRegions.add(r.id));
    state.selected = null;
    renderInfo();
  }
  renderRegions();
  renderBoneList();
  applyMaterials();
});

document.querySelectorAll('.rail [data-view]').forEach((b) => (b.onclick = () => setView(b.dataset.view)));

$('spin-btn').addEventListener('click', (e) => {
  controls.autoRotate = !controls.autoRotate;
  e.currentTarget.classList.toggle('active', controls.autoRotate);
});

$('reset-btn').addEventListener('click', () => {
  state.hiddenRegions.clear();
  state.explode = 0;
  $('explode').value = 0;
  $('explode-val').textContent = '0%';
  applyExplode();
  select(null);
  setView('three');
  toast('Back to square one ✨');
});

// Theme
const savedTheme = (() => { try { return localStorage.getItem('vetomy-theme'); } catch { return null; } })();
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
const syncThemeIcon = () => ($('theme-btn').textContent = document.documentElement.dataset.theme === 'dark' ? '☀️' : '🌙');
syncThemeIcon();
$('theme-btn').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('vetomy-theme', next); } catch {}
  syncThemeIcon();
});

// Keyboard
window.addEventListener('keydown', (e) => {
  const typing = document.activeElement?.tagName === 'INPUT';
  if (e.key === '/' && !typing) {
    e.preventDefault();
    $('search').focus();
  } else if (e.key === 'Escape') {
    if (typing) document.activeElement.blur();
    select(null);
  }
});

// ------------------------------------------------------------------
// Loop
// ------------------------------------------------------------------
function tick(now) {
  const a = state.camAnim;
  if (a) {
    const t = Math.min((now - a.t0) / a.duration, 1);
    const k = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(a.fromPos, a.toPos, k);
    controls.target.lerpVectors(a.fromTarget, a.toTarget, k);
    if (t >= 1) state.camAnim = null;
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

(async function init() {
  renderTabs();
  await loadData();
  await loadSpecies(state.species);
  requestAnimationFrame(tick);
})();
