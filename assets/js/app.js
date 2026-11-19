import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildPlaceholder } from './placeholder.js?v=20261120a';
import { translateEs, partLabel } from './translate-es.js?v=20261120a';

// Bump with every release so browsers never mix old and new files
const ASSET_V = '20261120a';

// ------------------------------------------------------------------
// Config
// ------------------------------------------------------------------
const SPECIES = [
  { id: 'horse',  en: 'Horse',  latin: 'Equus caballus' },
  { id: 'cattle', en: 'Cattle', latin: 'Bos taurus' },
  { id: 'dog',    en: 'Dog',    latin: 'Canis familiaris' },
  { id: 'cat',    en: 'Cat',    latin: 'Felis catus' },
];

const REGIONS = [
  { id: 'head',     en: 'Head',           color: '#c8a96b' },
  { id: 'trunk',    en: 'Spine & thorax', color: '#7fa7a0' },
  { id: 'forelimb', en: 'Forelimb',       color: '#c08f86' },
  { id: 'hindlimb', en: 'Hindlimb',       color: '#8e9cc4' },
  { id: 'other',    en: 'Other',          color: '#8f9c94' },
];

const COLORS = { bone: 0xe9dfcc, selected: 0xc8a96b, hover: 0x7fa7a0 };
// Accent colour of the selected bone follows the theme: brass at night, orange by day
const THEME_COLORS = {
  dark:  { selected: 0xc8a96b, hover: 0x7fa7a0, glow: 0.6 },
  light: { selected: 0xff5a1f, hover: 0x0a0a0a, glow: 0.75 },
};
function applyThemeColors() {
  const t = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  Object.assign(COLORS, THEME_COLORS[t]);
}

// ------------------------------------------------------------------
// State
// ------------------------------------------------------------------
const state = {
  species: 'horse',
  data: {},
  specimens: {},
  landmarks: {},
  model: null,
  ground: null,
  bones: [],               // [{ mesh, key, side, region, origPos, offset }]
  selected: null,
  hovered: null,
  ghost: true,
  hiddenRegions: new Set(),
  explode: 0,
  search: '',
  resultIndex: 0,
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

// Gallery lighting: warm key "spotlight" from above, cool fill, soft rim from behind
scene.add(new THREE.HemisphereLight(0xfff4e0, 0x22302a, 1.0));
const keyLight = new THREE.DirectionalLight(0xfff0d6, 2.2);
keyLight.position.set(2.5, 7, 4);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xa9c4d8, 0.5);
fillLight.position.set(-4, 2, 3);
scene.add(fillLight);
const rimLight = new THREE.DirectionalLight(0xffe2b0, 0.9);
rimLight.position.set(-2, 3, -5);
scene.add(rimLight);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// Soft pool of light (dark theme) or shadow (light theme) under the animal
function groundTexture() {
  const dark = document.documentElement.dataset.theme !== 'light';
  const rgb = dark ? '233, 214, 170' : '0, 0, 0';
  const a = dark ? [0.16, 0.05] : [0.14, 0.04];
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, `rgba(${rgb}, ${a[0]})`);
  grad.addColorStop(0.55, `rgba(${rgb}, ${a[1]})`);
  grad.addColorStop(1, `rgba(${rgb}, 0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
function makeGround() {
  const tex = groundTexture();
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

// Individual vertebrae (atlas, axis, vertebra_t5 …) fall back to their group's content
const VERTEBRA_GROUPS = {
  c: { key: 'vertebrae_cervical', label: 'Cervical vertebra', letter: 'C' },
  t: { key: 'vertebrae_thoracic', label: 'Thoracic vertebra', letter: 'T' },
  l: { key: 'vertebrae_lumbar', label: 'Lumbar vertebra', letter: 'L' },
  cd: { key: 'vertebrae_caudal', label: 'Caudal vertebra', letter: 'Cd' },
};
function vertebra(key) {
  if (key === 'atlas') return { group: VERTEBRA_GROUPS.c, n: 1 };
  if (key === 'axis') return { group: VERTEBRA_GROUPS.c, n: 2 };
  const m = /^vertebra_(c|t|l|cd)(\d+)$/.exec(key || '');
  return m ? { group: VERTEBRA_GROUPS[m[1]], n: +m[2] } : null;
}
// Bones that exist in both limbs (phalanx_proximal_fore / _hind) share one entry
const LIMB = { fore: { region: 'forelimb', label: 'forelimb' }, hind: { region: 'hindlimb', label: 'hindlimb' } };
const limbOf = (key) => LIMB[/_(fore|hind)$/.exec(key || '')?.[1]] || null;
const baseKey = (key) => String(key || '').replace(/_(fore|hind)$/, '');
const groupKey = (key) => vertebra(key)?.group.key || key;
const info = (key) => {
  if (!key || key === '_meta') return null;
  return state.data[key] || state.data[groupKey(key)] || (limbOf(key) && state.data[baseKey(key)]) || null;
};
const regionFor = (key) => limbOf(key)?.region || info(key)?.region || 'other';
const species = () => SPECIES.find((s) => s.id === state.species);
const regionOf = (id) => REGIONS.find((r) => r.id === id) || REGIONS.at(-1);

function displayName(key) {
  if (state.data[key]?.names?.en) return state.data[key].names.en;
  const v = vertebra(key);
  if (v) return `${v.group.label} ${v.group.letter}${v.n}`;
  const limb = limbOf(key);
  if (limb && state.data[baseKey(key)]?.names?.en) return `${state.data[baseKey(key)].names.en} (${limb.label})`;
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

async function loadJSON(path) {
  try {
    return await (await fetch(path, { cache: 'no-cache' })).json();
  } catch (e) {
    console.error(`Could not load ${path}`, e);
    return {};
  }
}

async function loadData() {
  [state.data, state.specimens, state.landmarks] = await Promise.all([
    loadJSON(`data/bones.json?v=${ASSET_V}`),
    loadJSON(`data/specimens.json?v=${ASSET_V}`),
    loadJSON(`data/landmarks.json?v=${ASSET_V}`),
  ]);
}

async function loadSpecies(id) {
  const token = ++state.loadToken;
  closeSpecimen();
  state.species = id;
  state.selected = null;
  state.hovered = null;
  renderTabs();

  let root;
  let isPlaceholder = false;
  let extras = null;
  try {
    const gltf = await loader.loadAsync(`models/skeletons/${id}.glb?v=${ASSET_V}`);
    root = gltf.scene;
    extras = gltf.asset?.extras || null;
  } catch {
    console.info(`models/skeletons/${id}.glb not found, using the placeholder skeleton.`);
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
  renderModelCredit(extras);
  const embedded = isPlaceholder && state.specimens?.[id]?._skeleton;
  if (embedded) showStageEmbed(embedded); else hideStageEmbed();
  $('explode').value = 0;
  state.explode = 0;
  $('explode-val').textContent = '0%';
  setView('three', false);
  renderAll();

  const s = species();
  toast(`${s.en} loaded, ${uniqueBones().length} bones`);
}

function renderModelCredit(extras) {
  const el = $('model-credit');
  if (!extras?.author) { el.textContent = ''; return; }
  const author = String(extras.author).replace(/\s*\(https?:[^)]*\)/, '');
  const license = String(extras.license || '').split(' ')[0].replace(/-/g, ' ').replace('CC BY 4.0', 'CC BY 4.0');
  el.innerHTML = `Model by <a href="${esc(extras.source || '#')}" target="_blank" rel="noopener">${esc(author)}</a>${license ? `, ${esc(license)}` : ''}`;
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
      side: THREE.DoubleSide,
    });

    const wc = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
    const dir = wc.clone().sub(modelCenter);
    if (dir.lengthSq() < 1e-8) dir.set(0, size * 0.01, 0);
    const worldOffset = dir.clone().multiplyScalar(0.8).add(dir.clone().normalize().multiplyScalar(size * 0.06));
    const p1 = mesh.parent.worldToLocal(wc.clone());
    const p2 = mesh.parent.worldToLocal(wc.clone().add(worldOffset));

    state.bones.push({
      mesh,
      name: String(rawName).replace(/\.?\d{3}$/, ''),
      key,
      side: boneSide(rawName),
      region: regionFor(key),
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
  document.querySelectorAll('.views [data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
}

function focusOn(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  const dir = camera.position.clone().sub(controls.target).normalize();
  const dist = Math.max(size * 2.4, state.frame.dist * 0.18);
  moveCamera(center.clone().addScaledVector(dir, dist), center, true);
  document.querySelectorAll('.views [data-view]').forEach((b) => b.classList.remove('active'));
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
    m.emissiveIntensity = isSel ? COLORS.glow : isHover ? 0.3 : 0;

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
  return pickHit(ev)?.bone || null;
}

function pickHit(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const meshes = state.bones.filter((b) => b.mesh.visible).map((b) => b.mesh);
  const hits = raycaster.intersectObjects(meshes, false);
  if (!hits.length) return null;
  const hit = hits.find((h) => !h.object.material.transparent) || hits[0];
  const bone = state.bones.find((b) => b.mesh === hit.object) || null;
  return bone ? { bone, hit } : null;
}

let downPos = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downPos = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downPos) return;
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  downPos = null;
  if (moved > 5) return; // that was a drag
  if (EDIT && state.selected) {
    const ph = pickHit(e);
    if (ph && ph.bone === state.selected) return openLmEditor(ph.hit, e);
  }
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
      tooltip.textContent = displayName(b.key) + (b.side ? ` (${b.side})` : '');
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
  closeSpecimen();
  closeLmEditor();
  state.selected = b;
  if (b && state.hiddenRegions.has(b.region)) state.hiddenRegions.delete(b.region);
  applyMaterials();
  renderInfo();
  renderRegions();
  renderLandmarks();
  if (b && focus) focusOn(b.mesh);
}

// ------------------------------------------------------------------
// UI
// ------------------------------------------------------------------
function renderAll() {
  renderLandmarks();
  renderTabs();
  renderRegions();
  renderResults();
  renderInfo();
  applyMaterials();
}

function renderTabs() {
  const nav = $('species');
  nav.innerHTML = '';
  for (const s of SPECIES) {
    const active = s.id === state.species;
    const btn = document.createElement('button');
    btn.className = active ? 'active' : '';
    btn.setAttribute('aria-pressed', active);
    btn.innerHTML = active
      ? `${esc(s.en)}<span class="latin">${esc(s.latin)}<span class="count">${uniqueBones().length || ''} ${uniqueBones().length ? 'bones' : ''}</span></span>`
      : esc(s.en);
    btn.onclick = () => !active && loadSpecies(s.id);
    nav.appendChild(btn);
  }
}

function renderCounts() {
  const all = uniqueBones();
  const visible = all.filter((b) => !state.hiddenRegions.has(b.region));
  $('visible-count').textContent = `${visible.length} of ${all.length} bones visible`;
}

function renderRegions() {
  const box = $('region-chips');
  box.innerHTML = '';
  const all = uniqueBones();
  for (const r of REGIONS) {
    const n = all.filter((b) => b.region === r.id).length;
    if (!n) continue;
    const on = !state.hiddenRegions.has(r.id);
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.setAttribute('aria-pressed', on);
    chip.innerHTML = `<span class="swatch" style="background:${r.color}"></span>${esc(r.en)}<span class="n">${n}</span>`;
    chip.onclick = () => {
      if (on) state.hiddenRegions.add(r.id); else state.hiddenRegions.delete(r.id);
      if (state.selected && state.hiddenRegions.has(state.selected.region)) {
        state.selected = null;
        renderInfo();
      }
      renderRegions();
      applyMaterials();
    };
    box.appendChild(chip);
  }
  renderCounts();
}

// Search results dropdown (also works as the full bone index when empty)
function resultItems() {
  const q = state.search.trim().toLowerCase();
  const order = REGIONS.map((r) => r.id);
  return uniqueBones()
    .filter((b) => {
      if (!q) return true;
      const d = info(b.key);
      return [b.key, d?.names?.en, d?.names?.nav].join(' ').toLowerCase().includes(q);
    })
    .sort((a, b) => order.indexOf(a.region) - order.indexOf(b.region)
      || displayName(a.key).localeCompare(displayName(b.key), 'en', { numeric: true }));
}

function renderResults() {
  const list = $('results');
  list.innerHTML = '';
  const items = resultItems();
  state.resultIndex = Math.min(state.resultIndex, Math.max(items.length - 1, 0));
  let last = null;
  items.forEach((b, i) => {
    if (b.region !== last) {
      last = b.region;
      const g = document.createElement('li');
      g.className = 'group';
      g.textContent = regionOf(b.region).en;
      list.appendChild(g);
    }
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.className = i === state.resultIndex ? 'active' : '';
    li.innerHTML = `<span>${esc(displayName(b.key))}</span><span class="latin">${esc(info(b.key)?.names?.nav || '')}</span>`;
    li.onmousedown = (e) => {
      e.preventDefault(); // keep focus logic simple
      chooseResult(b);
    };
    list.appendChild(li);
  });
  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = `No bone matches "${state.search}". Try the Latin name.`;
    list.appendChild(li);
  }
}

function chooseResult(b) {
  closeResults();
  $('search').value = '';
  state.search = '';
  $('search').blur();
  select(b, true);
}

function openResults() {
  renderResults();
  $('results').classList.remove('hidden');
}
function closeResults() {
  $('results').classList.add('hidden');
}

function renderInfo() {
  const b = state.selected;
  document.body.classList.toggle('sheet-open', !!b);
  if (!b) {
    infoPanel.classList.add('hidden');
    return;
  }
  infoPanel.classList.remove('hidden');
  const d = info(b.key);
  const s = species();
  const region = regionOf(b.region);
  const closeBtn = `<button class="icon-btn small close" aria-label="Close">
      <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
  const regionLine = `<div class="region-line"><span class="swatch" style="background:${region.color}"></span>${esc(region.en)}${b.side ? ` · ${b.side} side` : ''}</div>`;

  if (!d) {
    infoPanel.innerHTML = `${closeBtn}${regionLine}
      <h2>${esc(displayName(b.key))}</h2>
      <div class="missing">No details for <strong>${esc(b.key)}</strong> yet. Add an entry with this key to <code>data/bones.json</code>.</div>`;
  } else {
    const list = (arr) => (arr?.length ? `<ul>${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p>—</p>');
    const compare = SPECIES.map((sp) => {
      const cur = sp.id === state.species;
      return `<button class="row ${cur ? 'current' : ''}" data-species="${sp.id}" ${cur ? 'disabled' : ''}>
        <strong>${esc(sp.en)}</strong><span>${esc(d.species?.[sp.id] || 'No notes yet.')}</span></button>`;
    }).join('');

    infoPanel.innerHTML = `${closeBtn}${regionLine}
      <h2>${esc(displayName(b.key))}</h2>
      <div class="nav">${esc(d.names?.nav || '')}</div>
      <div class="tags">
        <span>${esc(s.en)}</span>
        ${d.type ? `<span>${esc(d.type)}</span>` : ''}
      </div>
      <h3>Description</h3>
      <p>${esc(d.description || '—')}</p>
      ${functionsSection(d)}
      <h3>Landmarks</h3>
      ${landmarkList(b, d.landmarks)}
      <h3>Articulates with</h3>
      ${list(d.articulations)}
      ${specimenSection(b.key)}
      ${comparisonSection(b)}
      <h3>Across species</h3>
      <div class="compare">${compare}</div>
      <p class="disclaimer">${esc(state.data._meta?.disclaimer || '')}</p>`;

    infoPanel.querySelectorAll('[data-lm]').forEach((li) => {
      li.onclick = () => openLm(+li.dataset.lm);
    });

    infoPanel.querySelectorAll('.specimen-btn').forEach((btn) => {
      btn.onclick = () => openSpecimen(specimensFor(b.key)[+btn.dataset.index], +btn.dataset.index);
    });

    infoPanel.querySelector('.compare-btn')?.addEventListener('click', () => openComparison(b));

    // Jump to the same bone in another species
    infoPanel.querySelectorAll('.compare .row[data-species]').forEach((row) => {
      row.onclick = () => openInSpecies(row.dataset.species, b.key);
    });
  }
  infoPanel.querySelector('.close').onclick = () => select(null);
  infoPanel.scrollTop = 0;
}

// Optional "Functions" and grouped "parts" sections (e.g. the bones of the skull)
function functionsSection(d) {
  if (!d.functions?.length) return '';
  return `<h3>Functions</h3><ol class="functions">${d.functions.map((f) => `<li>${esc(f)}</li>`).join('')}</ol>`;
}

// ------------------------------------------------------------------
// Real specimens (Sketchfab embeds)
// ------------------------------------------------------------------
function specimensFor(key) {
  const sp = state.specimens?.[state.species] || {};
  return sp[key] || sp[baseKey(key)] || sp[groupKey(key)] || [];
}

function specimenSection(key) {
  const list = specimensFor(key);
  if (!list.length) return '';
  const btns = list.map((sp, i) => `
    <button class="specimen-btn" data-index="${i}">
      <svg viewBox="0 0 24 24"><path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/></svg>
      <span>${esc(sp.title)}</span>
    </button>`).join('');
  return `<h3>Real specimen</h3><div class="specimens">${btns}</div>`;
}

let activeSpecimen = null;

// A small second viewer for specimen files we host ourselves
const spec = { renderer: null, scene: null, camera: null, controls: null, model: null, raf: 0, token: 0 };

function ensureSpecViewer() {
  if (spec.renderer) return;
  const wrap = $('specimen-canvas');
  spec.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  spec.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  spec.renderer.outputColorSpace = THREE.SRGBColorSpace;
  wrap.appendChild(spec.renderer.domElement);
  spec.scene = new THREE.Scene();
  spec.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x22302a, 1.3));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(2, 3, 2);
  spec.scene.add(key);
  const fill = new THREE.DirectionalLight(0xbcd2ff, 0.6);
  fill.position.set(-3, 1, -2);
  spec.scene.add(fill);
  spec.camera = new THREE.PerspectiveCamera(35, 1, 0.001, 1000);
  spec.controls = new OrbitControls(spec.camera, spec.renderer.domElement);
  spec.controls.enableDamping = true;
  spec.controls.autoRotate = true;
  spec.controls.autoRotateSpeed = 0.8;
  spec.renderer.domElement.addEventListener('pointerdown', () => (spec.controls.autoRotate = false));
  new ResizeObserver(() => {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    spec.renderer.setSize(w, h);
    spec.camera.aspect = w / h;
    spec.camera.updateProjectionMatrix();
  }).observe(wrap);
}

async function showSpecimenFile(file) {
  ensureSpecViewer();
  const token = ++spec.token;
  $('specimen-canvas').classList.remove('hidden');
  $('specimen-frame').classList.add('hidden');
  $('specimen-loading').textContent = 'Loading scan…';
  $('specimen-loading').classList.remove('hidden');
  let gltf;
  try {
    gltf = await loader.loadAsync(`${file}?v=${ASSET_V}`);
  } catch (e) {
    if (token === spec.token) $('specimen-loading').textContent = 'Could not load this scan.';
    return;
  }
  if (token !== spec.token) return;
  clearSpecimenModel();
  const model = gltf.scene;
  model.traverse((o) => {
    if (o.isMesh && !o.material?.map) {
      o.material = new THREE.MeshStandardMaterial({ color: COLORS.bone, roughness: 0.55 });
    }
  });
  const box = new THREE.Box3().setFromObject(model);
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  model.position.sub(c);
  spec.scene.add(model);
  spec.model = model;
  spec.camera.near = size / 500;
  spec.camera.far = size * 50;
  spec.camera.position.set(size * 0.55, size * 0.25, size * 0.7);
  spec.camera.updateProjectionMatrix();
  spec.controls.target.set(0, 0, 0);
  spec.controls.autoRotate = true;
  $('specimen-loading').classList.add('hidden');
  cancelAnimationFrame(spec.raf);
  const loop = () => {
    spec.controls.update();
    spec.renderer.render(spec.scene, spec.camera);
    spec.raf = requestAnimationFrame(loop);
  };
  loop();
}

function clearSpecimenModel() {
  if (!spec.model) return;
  spec.scene.remove(spec.model);
  spec.model.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry?.dispose();
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
      m?.map?.dispose();
      m?.dispose();
    });
  });
  spec.model = null;
}

function openSpecimen(sp, index) {
  if (!sp) return;
  if (activeSpecimen === COMPARE_MARK) stopComparison();
  const s = species();
  activeSpecimen = sp;
  $('specimen-title').textContent = `${s.en} ${sp.title.toLowerCase()}`;
  const credit = $('specimen-credit');

  if (sp.file) {
    sketchfabSession++;
    $('specimen-landmarks').classList.add('hidden');
    $('specimen-frame').src = 'about:blank';
    credit.textContent = `Scan by ${sp.credit || 'unknown author'}`;
    credit.href = sp.source || '#';
    showSpecimenFile(sp.file);
  } else if (/^[a-f0-9]{32}$/.test(sp.uid || '')) {
    spec.token++;
    cancelAnimationFrame(spec.raf);
    clearSpecimenModel();
    credit.textContent = `Scan: ${sp.credit || state.specimens?._meta?.source || 'Sketchfab'}`;
    credit.href = `https://sketchfab.com/3d-models/${sp.uid}`;
    $('specimen-canvas').classList.add('hidden');
    $('specimen-frame').classList.remove('hidden');
    $('specimen-loading').textContent = 'Loading high-resolution scan…';
    $('specimen-loading').classList.remove('hidden');
    showSketchfab(sp.uid, sp);
  } else {
    return;
  }
  $('specimen-view').classList.remove('hidden');
  document.body.classList.add('specimen-mode');
  closeLm();
  controls.enabled = false;
  tooltip.classList.add('hidden');
  infoPanel.querySelectorAll('.specimen-btn').forEach((b) => b.classList.toggle('active', +b.dataset.index === index));
}

// ---- Sketchfab embeds, through the official Viewer API so we can translate the landmarks
const SKETCHFAB_API = 'https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js';
let sketchfabApiPromise = null;
function loadSketchfabApi() {
  if (window.Sketchfab) return Promise.resolve(window.Sketchfab);
  sketchfabApiPromise ||= new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = SKETCHFAB_API;
    tag.onload = () => (window.Sketchfab ? resolve(window.Sketchfab) : reject(new Error('Viewer API missing')));
    tag.onerror = () => { sketchfabApiPromise = null; reject(new Error('Viewer API failed to load')); };
    document.head.appendChild(tag);
  });
  return sketchfabApiPromise;
}

function sketchfabOptions() {
  const dark = document.documentElement.dataset.theme === 'dark';
  return {
    autostart: 1, preload: 1, ui_theme: dark ? 'dark' : 'light',
    ui_infos: 0, ui_hint: 0, ui_stop: 0, ui_inspector: 0, ui_settings: 0, ui_help: 0,
    ui_vr: 0, ui_ar: 0, ui_annotations: 0, ui_fullscreen: 1, annotation_tooltip_visible: 0,
  };
}

let sketchfabSession = 0;
async function showSketchfab(uid, sp = {}) {
  const session = ++sketchfabSession;
  Object.assign(scan, { api: null, uid: null, parts: null, points: [], session: 0 });
  $('lm-undo').classList.add('hidden');
  const frame = $('specimen-frame');
  const panel = $('specimen-landmarks');
  panel.classList.add('hidden');
  panel.classList.remove('wide');
  panel.querySelector('.lm-head').innerHTML = 'Landmarks <span>translated from Spanish</span>';
  $('lm-list').innerHTML = '';
  const parts = sp.partsFrom ? state.data[sp.partsFrom]?.parts : null;
  if (parts?.length) renderSpecimenParts(parts);
  const fallback = () => {
    if (session !== sketchfabSession) return;
    frame.onload = () => $('specimen-loading').classList.add('hidden');
    frame.src = `https://sketchfab.com/models/${uid}/embed?${new URLSearchParams(sketchfabOptions())}`;
  };
  try {
    const Sketchfab = await loadSketchfabApi();
    if (session !== sketchfabSession) return;
    const client = new Sketchfab(frame);
    client.init(uid, {
      ...sketchfabOptions(),
      success(api) {
        api.start();
        api.addEventListener('viewerready', () => {
          if (session !== sketchfabSession) return;
          $('specimen-loading').classList.add('hidden');
          api.getAnnotationList((err, list) => {
            if (session !== sketchfabSession) return;
            if (!err && list?.length && !parts?.length) renderScanLandmarks(api, list);
            else if (parts?.length) {
              scan.api = api; scan.uid = uid; scan.parts = parts; scan.session = session;
              linkPartsToScan(api, parts, session);
              placeScanPoints();
              if (EDIT) enableScanEditing(api, session);
            } else detectScanParts(api, session);
          });
        });
        api.addEventListener('annotationSelect', (i) => (scan.api === api ? onScanPointSelect(i) : markScanLandmark(i)));
      },
      error: fallback,
    });
  } catch {
    fallback();
  }
}

function renderScanLandmarks(api, list) {
  const ol = $('lm-list');
  ol.innerHTML = '';
  list.forEach((a, i) => {
    const li = document.createElement('li');
    const name = translateEs(String(a.name || '').replace(/^\s*\d+[.)-]?\s*/, '')) || `Landmark ${i + 1}`;
    li.innerHTML = `<button data-i="${i}"><span class="n">${i + 1}</span><span>${esc(name)}</span></button>`;
    li.querySelector('button').onclick = () => {
      api.gotoAnnotation(i, { preventCameraAnimation: false });
      markScanLandmark(i);
    };
    ol.appendChild(li);
  });
  $('specimen-landmarks').classList.remove('hidden');
}


// ---- Numbered points on a scan, one per bone (stored in landmarks.json under "scans")
const scan = { api: null, uid: null, parts: null, points: [], session: 0 };
const normName = (t) => String(t || '').toLowerCase().replace(/\(.*?\)/g, '').trim();
const samePart = (a, b) => normName(a) === normName(b) || normName(b).startsWith(normName(a)) || normName(a).startsWith(normName(b));

function scanPointsData(uid) {
  const base = state.landmarks?.scans?.[uid] || [];
  if (!EDIT) return base;
  const draft = lmDrafts().scans?.[uid];
  return draft || base;
}

function placeScanPoints() {
  const api = scan.api, session = scan.session;
  const list = scanPointsData(scan.uid);
  scan.points = [];
  const next = (i) => {
    if (i >= list.length || session !== sketchfabSession) return markPartsWithPoints();
    const pt = list[i];
    api.createAnnotationFromScenePosition(pt.p, pt.eye, pt.target, pt.name, '', () => {
      scan.points.push(pt);
      next(i + 1);
    });
  };
  next(0);
}

function markPartsWithPoints() {
  if (!scan.parts) return;
  $('lm-list').querySelectorAll('.lm-part').forEach((b) => {
    const part = scan.parts[+b.dataset.part];
    const n = scan.points.findIndex((pt) => samePart(pt.name, part.name));
    let badge = b.querySelector('.lm-part-num');
    if (n >= 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'lm-part-num';
        b.querySelector('.lm-part-top').prepend(badge);
      }
      badge.textContent = n + 1;
    } else badge?.remove();
  });
}

function onScanPointSelect(i) {
  const pt = scan.points[i];
  if (!pt || !scan.parts) return;
  const idx = scan.parts.findIndex((p) => samePart(pt.name, p.name));
  if (idx >= 0) openSpecimenPart(idx);
  toast(pt.name);
}

function enableScanEditing(api, session) {
  $('lm-edit-hint').innerHTML = '<strong>Landmark editor</strong> Click on the scan where a bone is, then choose its name.';
  $('lm-undo').classList.remove('hidden');
  api.addEventListener('click', (info) => {
    if (session !== sketchfabSession || !info?.position3D) return;
    api.getCameraLookAt((err, cam) => {
      if (err) return;
      const rect = $('specimen-frame').getBoundingClientRect();
      const [x, y] = info.position2D || [rect.width / 2, rect.height / 2];
      lm.pending = { scan: true, uid: scan.uid, p: info.position3D, eye: cam.position, target: cam.target };
      $('lm-suggest').innerHTML = scan.parts.map((p) => `<option value="${esc(p.name)}">`).join('');
      const form = $('lm-editor');
      form.classList.remove('hidden');
      form.style.left = `${Math.min(rect.left + x + 12, window.innerWidth - 296)}px`;
      form.style.top = `${Math.min(rect.top + y + 12, window.innerHeight - 170)}px`;
      $('lm-name').value = '';
      $('lm-name').focus();
    });
  }, { pick: 'slow' });
}

function saveScanPoint(pend, name) {
  const round = (a) => (a || []).map((n) => Math.round(n * 1e5) / 1e5);
  const pt = { name, p: round(pend.p), eye: round(pend.eye), target: round(pend.target) };
  const d = lmDrafts();
  d.scans ||= {};
  const list = (d.scans[pend.uid] ||= [...(state.landmarks?.scans?.[pend.uid] || [])]);
  list.push(pt);
  saveLmDrafts(d);
  if (scan.api && scan.uid === pend.uid) {
    scan.api.createAnnotationFromScenePosition(pt.p, pt.eye, pt.target, pt.name, '', () => {
      scan.points.push(pt);
      markPartsWithPoints();
    });
  }
}

function undoScanPoint() {
  if (!scan.uid) return;
  const d = lmDrafts();
  d.scans ||= {};
  const list = (d.scans[scan.uid] ||= [...(state.landmarks?.scans?.[scan.uid] || [])]);
  if (!list.length) return;
  const removed = list.pop();
  saveLmDrafts(d);
  const i = scan.points.length - 1;
  if (scan.api && i >= 0) scan.api.removeAnnotation(i, () => {});
  scan.points.pop();
  markPartsWithPoints();
  toast(`Removed "${removed.name}"`);
}

// ---- Bones of a structure shown beside its scan (e.g. the bones of the skull)
function renderSpecimenParts(parts) {
  const panel = $('specimen-landmarks');
  panel.classList.add('wide');
  panel.querySelector('.lm-head').innerHTML = 'Bones of the skull <span>Click a bone to read about it</span>';
  const ol = $('lm-list');
  let html = '', last = null;
  parts.forEach((p, i) => {
    if (p.group && p.group !== last) {
      last = p.group;
      html += `<li class="lm-group">${esc(p.group)}</li>`;
    }
    html += `<li>
      <button class="lm-part" data-part="${i}" aria-expanded="false">
        <span class="lm-part-top">
          <span class="lm-part-name">${esc(p.name)}</span>
          ${p.kind ? `<span class="lm-part-kind">${esc(p.kind)}</span>` : ''}
        </span>
        <span class="lm-part-body">
          ${p.nav ? `<span class="lm-part-nav">${esc(p.nav)}</span>` : ''}
          <span class="lm-part-text">${esc(p.description || '')}</span>
        </span>
      </button></li>`;
  });
  ol.innerHTML = html;
  ol.querySelectorAll('.lm-part').forEach((b) => (b.onclick = () => {
    const i = +b.dataset.part;
    openSpecimenPart(i, true);
    const pi = scan.points.findIndex((pt) => samePart(pt.name, parts[i].name));
    if (pi >= 0 && scan.api) scan.api.gotoAnnotation(pi, { preventCameraAnimation: false });
    markPartsWithPoints();
  }));
  panel.classList.remove('hidden');
}

function openSpecimenPart(i, toggle = false) {
  $('lm-list').querySelectorAll('.lm-part').forEach((b) => {
    const match = +b.dataset.part === i;
    const open = match && (!toggle || b.getAttribute('aria-expanded') !== 'true');
    b.setAttribute('aria-expanded', open);
    if (open && !toggle) b.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

// If the scan's colours are named after bones, clicking a colour opens that bone in the list
function linkPartsToScan(api, parts, session) {
  api.getMaterialList((err, mats) => {
    if (err || session !== sketchfabSession) return;
    console.info('[Vetomy] scan materials:', (mats || []).map((m) => m.name));
    const norm = (t) => String(t || '').toLowerCase().replace(/\(.*?\)/g, '').trim();
    const byMaterial = new Map();
    (mats || []).forEach((m) => {
      const label = norm(partLabel(m.name));
      if (!label) return;
      const i = parts.findIndex((p) => norm(p.name) === label || norm(p.name).startsWith(label) || label.startsWith(norm(p.name)));
      if (i >= 0) byMaterial.set(m.name, i);
    });
    if (!byMaterial.size) return;
    api.addEventListener('click', (info) => {
      const i = byMaterial.get(info?.material?.name);
      if (i === undefined) return;
      openSpecimenPart(i);
      toast(parts[i].name);
    }, { pick: 'slow' });
  });
}

// Some scans colour each bone with its own named material (e.g. the Zurich skull).
// If the names are meaningful, list them and label whatever part is clicked.
function detectScanParts(api, session) {
  api.getMaterialList((err, mats) => {
    if (err || session !== sketchfabSession) return;
    console.info('[Vetomy] scan materials:', (mats || []).map((m) => m.name));
    const parts = [...new Map((mats || [])
      .map((m) => [m.name, partLabel(m.name)])
      .filter(([, label]) => label)
    ).entries()];
    if (parts.length < 2) return;
    const labels = new Map(parts);
    const ol = $('lm-list');
    ol.innerHTML = parts
      .map(([raw, label], i) => `<li><button data-raw="${esc(raw)}"><span class="n">${i + 1}</span><span>${esc(label)}</span></button></li>`)
      .join('');
    $('specimen-landmarks').querySelector('.lm-head').innerHTML = 'Parts <span>Click a coloured area on the scan</span>';
    $('specimen-landmarks').classList.remove('hidden');
    api.addEventListener('click', (info) => {
      const raw = info?.material?.name;
      if (!raw || !labels.has(raw)) return;
      ol.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.raw === raw));
      toast(labels.get(raw));
    }, { pick: 'slow' });
  });
}

function markScanLandmark(i) {
  $('lm-list').querySelectorAll('button').forEach((b) => b.classList.toggle('active', +b.dataset.i === i));
}

function closeSpecimen() {
  if (!activeSpecimen) return;
  if (activeSpecimen === COMPARE_MARK) stopComparison();
  activeSpecimen = null;
  spec.token++;
  cancelAnimationFrame(spec.raf);
  clearSpecimenModel();
  sketchfabSession++;
  $('specimen-view').classList.add('hidden');
  $('specimen-landmarks').classList.add('hidden');
  $('specimen-frame').onload = null;
  $('specimen-frame').src = 'about:blank';
  document.body.classList.remove('specimen-mode');
  controls.enabled = true;
  renderLandmarks();
  infoPanel.querySelectorAll('.specimen-btn').forEach((b) => b.classList.remove('active'));
}

$('specimen-back').addEventListener('click', closeSpecimen);

// ------------------------------------------------------------------
// Comparison: the same bone side by side in every species we have a split model for
// ------------------------------------------------------------------
const COMPARE_SPECIES = ['horse', 'dog', 'cat'];
const COMPARE_MARK = { compare: true };
const speciesModels = new Map();
const cmp = { items: [], yaw: 0.6, pitch: 0.15, spin: true, trueScale: false, raf: 0, token: 0, drag: null, labels: null, tools: null, bone: null };

function speciesModel(id) {
  if (!speciesModels.has(id)) {
    speciesModels.set(id, loader.loadAsync(`models/skeletons/${id}.glb?v=${ASSET_V}`)
      .then((g) => { g.scene.updateMatrixWorld(true); return g.scene; })
      .catch(() => null));
  }
  return speciesModels.get(id);
}

// Which mesh names count as "the same bone" in another model, best match first
function compareCandidates(key) {
  if (key === 'radius' || key === 'ulna') return [['radius', 'ulna']];
  const ph = /^(phalanx_(proximal|middle|distal)|phalanges)_(fore|hind)$/.exec(key);
  if (ph) {
    const l = ph[3];
    return [[key], [`phalanges_${l}`], [`phalanx_proximal_${l}`, `phalanx_middle_${l}`, `phalanx_distal_${l}`]];
  }
  if (vertebra(key)) return [[key], [groupKey(key)]];
  return [[key]];
}

function findBoneMeshes(root, key, side) {
  const meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  let found = [];
  let exact = false;
  if (/^vertebrae_/.test(key)) {
    found = meshes.filter((o) => boneKey(o.name) === key || groupKey(boneKey(o.name)) === key);
    exact = found.length > 0;
  } else {
    const lists = compareCandidates(key);
    for (let i = 0; i < lists.length && !found.length; i++) {
      found = meshes.filter((o) => lists[i].includes(boneKey(o.name)));
      exact = i === 0;
    }
  }
  if (side) {
    const same = found.filter((o) => boneSide(o.name) === side);
    if (same.length) found = same;
  }
  return { meshes: found, exact };
}

function comparisonSection(b) {
  const names = COMPARE_SPECIES.map((id) => SPECIES.find((x) => x.id === id)?.en).filter(Boolean);
  if (!names.length) return '';
  const list = names.join(', ').replace(/, ([^,]*)$/, ' and $1');
  return `<h3>Comparison</h3><div class="specimens">
    <button class="specimen-btn compare-btn">
      <svg viewBox="0 0 24 24"><rect x="3" y="5" width="7" height="14" rx="2"/><rect x="14" y="5" width="7" height="14" rx="2"/></svg>
      <span>${esc(displayName(b.key))} in the ${esc(list.toLowerCase())}</span>
    </button></div>`;
}

function ensureCompareUi() {
  if (cmp.labels) return;
  const frame = document.querySelector('.specimen-frame');
  cmp.labels = document.createElement('div');
  cmp.labels.className = 'compare-labels hidden';
  frame.appendChild(cmp.labels);
  cmp.tools = document.createElement('div');
  cmp.tools.className = 'compare-tools hidden';
  cmp.tools.innerHTML = `<button data-scale="same" class="on">Same size</button><button data-scale="true">True scale</button>`;
  frame.appendChild(cmp.tools);
  cmp.tools.querySelectorAll('button').forEach((btn) => {
    btn.onclick = () => {
      cmp.trueScale = btn.dataset.scale === 'true';
      cmp.tools.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === btn));
      layoutComparison();
    };
  });
  const el = spec.renderer.domElement;
  el.addEventListener('pointerdown', (e) => {
    if (activeSpecimen !== COMPARE_MARK) return;
    cmp.drag = { x: e.clientX, y: e.clientY, yaw: cmp.yaw, pitch: cmp.pitch };
    cmp.spin = false;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (!cmp.drag) return;
    cmp.yaw = cmp.drag.yaw + (e.clientX - cmp.drag.x) * 0.01;
    cmp.pitch = Math.max(-1.2, Math.min(1.2, cmp.drag.pitch + (e.clientY - cmp.drag.y) * 0.01));
  });
  el.addEventListener('pointerup', () => (cmp.drag = null));
}

async function openComparison(b) {
  ensureSpecViewer();
  ensureCompareUi();
  const token = ++cmp.token;
  sketchfabSession++;
  spec.token++;
  cancelAnimationFrame(spec.raf);
  clearSpecimenModel();
  stopComparison(true);
  activeSpecimen = COMPARE_MARK;
  cmp.bone = b;
  $('specimen-title').textContent = `${displayName(b.key)} across species`;
  document.querySelector('.specimen-kicker').textContent = 'Comparison';
  const credit = $('specimen-credit');
  credit.textContent = 'Models credited in CREDITS.md';
  credit.href = 'https://github.com/salmasalma1/vetomy/blob/main/CREDITS.md';
  $('specimen-landmarks').classList.add('hidden');
  $('specimen-frame').classList.add('hidden');
  $('specimen-frame').src = 'about:blank';
  $('specimen-canvas').classList.remove('hidden');
  $('specimen-loading').textContent = 'Loading the other skeletons…';
  $('specimen-loading').classList.remove('hidden');
  $('specimen-view').classList.remove('hidden');
  document.body.classList.add('specimen-mode');
  closeLm();
  controls.enabled = false;
  spec.controls.enabled = false;
  spec.controls.autoRotate = false;
  tooltip.classList.add('hidden');

  const order = [state.species, ...COMPARE_SPECIES.filter((id) => id !== state.species)].filter((id) => COMPARE_SPECIES.includes(id));
  const roots = await Promise.all(order.map(speciesModel));
  if (token !== cmp.token || activeSpecimen !== COMPARE_MARK) return;

  const material = new THREE.MeshStandardMaterial({ color: COLORS.bone, roughness: 0.55, side: THREE.DoubleSide });
  const missing = [];
  order.forEach((id, i) => {
    const sp = SPECIES.find((x) => x.id === id);
    const root = roots[i];
    const { meshes, exact } = root ? findBoneMeshes(root, b.key, b.side) : { meshes: [] };
    if (!meshes.length) { missing.push(sp.en); return; }
    const inner = new THREE.Group();
    meshes.forEach((o) => {
      const m = new THREE.Mesh(o.geometry, material);
      m.applyMatrix4(o.matrixWorld);
      inner.add(m);
    });
    const box = new THREE.Box3().setFromObject(inner);
    const c = box.getCenter(new THREE.Vector3());
    inner.position.sub(c);
    const holder = new THREE.Group();
    const pivot = new THREE.Group();
    pivot.add(inner);
    holder.add(pivot);
    spec.scene.add(holder);
    const size = box.getSize(new THREE.Vector3());
    const label = document.createElement('div');
    label.className = 'compare-label';
    const note = exact ? '' : `<em>${meshes.length > 1 ? 'shown as a group in this model' : 'closest match in this model'}</em>`;
    label.innerHTML = `<strong>${esc(sp.en)}</strong><span>${esc(sp.latin || '')}</span>${note}`;
    cmp.labels.appendChild(label);
    cmp.items.push({ holder, pivot, size: Math.max(size.x, size.y, size.z), label, current: id === state.species });
  });
  $('specimen-loading').classList.add('hidden');
  if (!cmp.items.length) {
    $('specimen-loading').textContent = 'This bone is not separated in the other skeletons yet.';
    $('specimen-loading').classList.remove('hidden');
    return;
  }
  if (missing.length) {
    const label = document.createElement('div');
    label.className = 'compare-missing';
    label.textContent = `Not separated yet in: ${missing.join(', ')}`;
    cmp.labels.appendChild(label);
  }
  cmp.labels.classList.remove('hidden');
  cmp.tools.classList.remove('hidden');
  cmp.spin = true;
  layoutComparison();
  let last = performance.now();
  const v = new THREE.Vector3();
  const loop = (t) => {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (cmp.spin) cmp.yaw += dt * 0.35;
    const w = spec.renderer.domElement.clientWidth, h = spec.renderer.domElement.clientHeight;
    cmp.items.forEach((it) => {
      it.pivot.rotation.set(cmp.pitch, cmp.yaw, 0, 'XYZ');
      v.copy(it.holder.position);
      v.y -= it.box * 0.62;
      v.project(spec.camera);
      it.label.style.transform = `translate(-50%, 0) translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px)`;
    });
    spec.renderer.render(spec.scene, spec.camera);
    cmp.raf = requestAnimationFrame(loop);
  };
  cmp.raf = requestAnimationFrame(loop);
}

function layoutComparison() {
  if (!cmp.items.length) return;
  const biggest = Math.max(...cmp.items.map((it) => it.size));
  const gap = 1.15;
  cmp.items.forEach((it, i) => {
    const sc = cmp.trueScale ? 1 / biggest : 1 / it.size;
    it.holder.scale.setScalar(sc);
    it.box = it.size * sc;
    it.holder.position.set((i - (cmp.items.length - 1) / 2) * gap, 0, 0);
  });
  const width = cmp.items.length * gap;
  const aspect = spec.camera.aspect || 1.6;
  const fov = (spec.camera.fov * Math.PI) / 180;
  const dist = Math.max(width / aspect, 1.6) / (2 * Math.tan(fov / 2)) * 0.98;
  spec.camera.near = 0.01;
  spec.camera.far = 100;
  spec.camera.position.set(0, 0.05, dist);
  spec.camera.lookAt(0, -0.05, 0);
  spec.camera.updateProjectionMatrix();
}

function stopComparison(keepView = false) {
  cancelAnimationFrame(cmp.raf);
  cmp.items.forEach((it) => spec.scene.remove(it.holder));
  cmp.items = [];
  cmp.drag = null;
  if (cmp.labels) { cmp.labels.innerHTML = ''; cmp.labels.classList.add('hidden'); }
  if (cmp.tools) cmp.tools.classList.add('hidden');
  if (!keepView) {
    const k = document.querySelector('.specimen-kicker');
    if (k) k.textContent = 'Real specimen';
    if (spec.controls) spec.controls.enabled = true;
  }
}

async function openInSpecies(id, key) {
  await loadSpecies(id);
  const target = state.bones.find((x) => x.key === key);
  if (target) select(target, true);
}

// ------------------------------------------------------------------
// Controls
// ------------------------------------------------------------------
const searchEl = $('search');
searchEl.addEventListener('focus', openResults);
searchEl.addEventListener('blur', () => setTimeout(closeResults, 120));
searchEl.addEventListener('input', (e) => {
  state.search = e.target.value;
  state.resultIndex = 0;
  openResults();
});
searchEl.addEventListener('keydown', (e) => {
  const items = resultItems();
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    state.resultIndex = Math.min(state.resultIndex + 1, items.length - 1);
    renderResults();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    state.resultIndex = Math.max(state.resultIndex - 1, 0);
    renderResults();
  } else if (e.key === 'Enter' && items[state.resultIndex]) {
    chooseResult(items[state.resultIndex]);
  }
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

document.querySelectorAll('.views [data-view]').forEach((b) => (b.onclick = () => setView(b.dataset.view)));

$('spin-btn').addEventListener('click', (e) => {
  controls.autoRotate = !controls.autoRotate;
  e.currentTarget.setAttribute('aria-pressed', controls.autoRotate);
});

$('reset-btn').addEventListener('click', () => {
  state.hiddenRegions.clear();
  state.explode = 0;
  $('explode').value = 0;
  $('explode-val').textContent = '0%';
  applyExplode();
  select(null);
  setView('three');
  toast('View reset');
});

// Theme
try {
  const saved = localStorage.getItem('vetomy-theme-v2');
  if (saved) {
    document.documentElement.dataset.theme = saved;
    state.ground.material.map = groundTexture();
  }
  applyThemeColors();
} catch {}
$('theme-btn').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('vetomy-theme-v2', next); } catch {}
  const old = state.ground.material.map;
  state.ground.material.map = groundTexture();
  state.ground.material.needsUpdate = true;
  old?.dispose();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#0c1411' : '#ffffff');
  applyThemeColors();
  applyMaterials();
});

// Keyboard
window.addEventListener('keydown', (e) => {
  const typing = document.activeElement?.tagName === 'INPUT' && document.activeElement.type !== 'range';
  if (e.key === '/' && !typing) {
    e.preventDefault();
    searchEl.focus();
  } else if (e.key === 'Escape') {
    if (activeSpecimen) return closeSpecimen();
    if (lm.pending) return closeLmEditor();
    if (lm.open >= 0) return closeLm();
    if (typing) document.activeElement.blur();
    select(null);
  }
});


// ------------------------------------------------------------------
// Landmarks: numbered points on the selected bone
// ------------------------------------------------------------------
const EDIT = new URLSearchParams(location.search).has('edit');
const LM_DRAFT_KEY = 'vetomy-landmark-drafts';
const lm = { items: [], open: -1, pending: null };
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const mirrorName = (n) => (/_L$/.test(n) ? n.replace(/_L$/, '_R') : /_R$/.test(n) ? n.replace(/_R$/, '_L') : null);

function lmDrafts() {
  try { return JSON.parse(localStorage.getItem(LM_DRAFT_KEY)) || {}; } catch { return {}; }
}
function saveLmDrafts(d) {
  try { localStorage.setItem(LM_DRAFT_KEY, JSON.stringify(d)); } catch {}
}
function lmSpeciesData(id = state.species) {
  const base = state.landmarks?.[id] || {};
  return EDIT ? { ...base, ...(lmDrafts()[id] || {}) } : base;
}

function lmDefinition(b, name) {
  const defs = state.landmarks?.definitions || {};
  const n = String(name).toLowerCase();
  const def = defs[b.key]?.[n] || defs[groupKey(b.key)]?.[n];
  if (def) return def;
  const part = (info(b.key)?.parts || []).find((p) => samePart(name, p.name));
  return part ? { nav: part.nav, description: part.description } : null;
}

// Points for a bone; if only the opposite side has points, mirror them across the midline
function landmarksFor(b) {
  if (!b.mesh) return [];
  const data = lmSpeciesData();
  const own = data[b.name];
  if (own?.length) return own.map((e) => ({ ...e, local: v3(e.p), normal: v3(e.n), mirrored: false }));
  const otherName = mirrorName(b.name);
  const other = otherName && data[otherName];
  const otherBone = other && state.bones.find((x) => x.name === otherName);
  if (!other?.length || !otherBone) return [];
  b.mesh.updateMatrixWorld(true);
  otherBone.mesh.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(b.mesh.matrixWorld).invert();
  return other.map((e) => {
    const w = otherBone.mesh.localToWorld(v3(e.p));
    w.z = -w.z;
    const nw = v3(e.n).transformDirection(otherBone.mesh.matrixWorld);
    nw.z = -nw.z;
    return { ...e, local: b.mesh.worldToLocal(w), normal: nw.transformDirection(inv), mirrored: true };
  });
}

function landmarkList(b, names) {
  const placed = landmarksFor(b);
  const items = (names || []).map((n) => {
    const i = placed.findIndex((p) => p.name.toLowerCase() === String(n).toLowerCase());
    return i >= 0
      ? `<li class="has-point" data-lm="${i}" tabindex="0"><span class="lm-num">${i + 1}</span>${esc(n)}</li>`
      : `<li>${esc(n)}</li>`;
  });
  // points that are not in the written list
  placed.forEach((p, i) => {
    if (!(names || []).some((n) => String(n).toLowerCase() === p.name.toLowerCase())) {
      items.push(`<li class="has-point" data-lm="${i}" tabindex="0"><span class="lm-num">${i + 1}</span>${esc(p.name)}</li>`);
    }
  });
  return items.length ? `<ul class="lm-list">${items.join('')}</ul>` : '<p>—</p>';
}

function renderLandmarks() {
  const layer = $('lm-layer');
  layer.innerHTML = '';
  lm.items = [];
  closeLm();
  const b = state.selected;
  if (!b || activeSpecimen) return;
  landmarksFor(b).forEach((e, i) => {
    const el = document.createElement('button');
    el.className = 'lm-dot';
    el.textContent = i + 1;
    el.setAttribute('aria-label', e.name);
    el.onclick = (ev) => { ev.stopPropagation(); lm.open === i ? closeLm() : openLm(i); };
    layer.appendChild(el);
    lm.items.push({ el, entry: e, bone: b });
  });
}

function updateLandmarks() {
  if (!lm.items.length) return;
  const w = window.innerWidth, h = window.innerHeight;
  const camPos = camera.position;
  lm.items.forEach((it, i) => {
    const world = it.bone.mesh.localToWorld(it.entry.local.clone());
    const nWorld = it.entry.normal.clone().transformDirection(it.bone.mesh.matrixWorld);
    const facing = nWorld.dot(camPos.clone().sub(world).normalize()) > -0.1;
    const p = world.clone().project(camera);
    const x = (p.x + 1) / 2 * w, y = (1 - p.y) / 2 * h;
    it.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    it.el.classList.toggle('behind', !facing || p.z > 1);
    it.el.classList.toggle('active', i === lm.open);
    if (i === lm.open) placeLmPop(x, y);
  });
}

function placeLmPop(x, y) {
  const pop = $('lm-pop');
  const pw = pop.offsetWidth || 280, ph = pop.offsetHeight || 120;
  let left = x + 18, top = y - ph / 2;
  if (left + pw > window.innerWidth - 16) left = x - pw - 18;
  top = Math.max(16, Math.min(top, window.innerHeight - ph - 16));
  pop.style.transform = `translate(${left}px, ${top}px)`;
}

function openLm(i) {
  const it = lm.items[i];
  if (!it) return;
  lm.open = i;
  const def = lmDefinition(it.bone, it.entry.name);
  const pop = $('lm-pop');
  pop.innerHTML = `
    <p class="lm-pop-num">Point ${i + 1}</p>
    <h4>${esc(it.entry.name)}</h4>
    ${def?.nav ? `<p class="lm-pop-nav">${esc(def.nav)}</p>` : ''}
    <p class="lm-pop-text">${esc(def?.description || 'No description yet.')}</p>
    ${EDIT ? `<button class="pill lm-del">${it.entry.mirrored ? 'Mirrored from the other side' : 'Delete point'}</button>` : ''}`;
  if (EDIT && !it.entry.mirrored) pop.querySelector('.lm-del').onclick = () => deleteLm(it);
  pop.classList.remove('hidden');
  infoPanel.querySelectorAll('[data-lm]').forEach((li) => li.classList.toggle('active', +li.dataset.lm === i));
  updateLandmarks();
}

function closeLm() {
  lm.open = -1;
  $('lm-pop').classList.add('hidden');
  infoPanel.querySelectorAll('[data-lm].active').forEach((li) => li.classList.remove('active'));
}

// ---- Editor (only with ?edit in the address) ----
function openLmEditor(hit, ev) {
  const b = state.selected;
  lm.pending = {
    bone: b,
    p: b.mesh.worldToLocal(hit.point.clone()),
    n: hit.face.normal.clone(),
  };
  const sug = $('lm-suggest');
  const names = [...(info(b.key)?.landmarks || []), ...(info(b.key)?.parts || []).map((p) => p.name)];
  sug.innerHTML = names.map((n) => `<option value="${esc(n)}">`).join('');
  const form = $('lm-editor');
  form.classList.remove('hidden');
  const fw = 280;
  form.style.left = `${Math.min(ev.clientX + 12, window.innerWidth - fw - 16)}px`;
  form.style.top = `${Math.min(ev.clientY + 12, window.innerHeight - 170)}px`;
  $('lm-name').value = '';
  $('lm-name').focus();
}

function closeLmEditor() {
  lm.pending = null;
  $('lm-editor').classList.add('hidden');
}

function deleteLm(it) {
  const d = lmDrafts();
  const sp = (d[state.species] ||= {});
  const list = (sp[it.bone.name] ||= [...(state.landmarks?.[state.species]?.[it.bone.name] || [])]);
  const idx = list.findIndex((e) => e.name === it.entry.name && e.p.join() === it.entry.p.join());
  if (idx >= 0) list.splice(idx, 1);
  saveLmDrafts(d);
  renderInfo();
  renderLandmarks();
}

if (EDIT) {
  $('lm-editbar').classList.remove('hidden');
  document.body.classList.add('lm-editing');

  $('lm-editor').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('lm-name').value.trim();
    const pend = lm.pending;
    if (!name || !pend) return;
    if (pend.scan) {
      saveScanPoint(pend, name);
      closeLmEditor();
      toast(`Saved "${name}"`);
      return;
    }
    const r = (v) => [v.x, v.y, v.z].map((n) => Math.round(n * 1e5) / 1e5);
    const d = lmDrafts();
    const sp = (d[state.species] ||= {});
    const list = (sp[pend.bone.name] ||= [...(state.landmarks?.[state.species]?.[pend.bone.name] || [])]);
    list.push({ name, p: r(pend.p), n: r(pend.n.normalize()) });
    saveLmDrafts(d);
    closeLmEditor();
    renderInfo();
    renderLandmarks();
    toast(`Saved "${name}"`);
  });
  $('lm-cancel').addEventListener('click', closeLmEditor);
  $('lm-undo').addEventListener('click', undoScanPoint);

  $('lm-export').addEventListener('click', () => {
    const out = { ...state.landmarks };
    for (const s of SPECIES) {
      const merged = lmSpeciesData(s.id);
      if (Object.keys(merged).length) out[s.id] = merged;
    }
    const draftScans = lmDrafts().scans;
    if (draftScans) out.scans = { ...(state.landmarks?.scans || {}), ...draftScans };
    const blob = new Blob([JSON.stringify(out, null, 2) + '\n'], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'landmarks.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('lm-discard').addEventListener('click', () => {
    saveLmDrafts({});
    renderInfo();
    renderLandmarks();
    toast('Drafts discarded');
  });
}


// ------------------------------------------------------------------
// Full skeleton through Sketchfab (species without a local model)
// ------------------------------------------------------------------
let stageEmbedSession = 0;

// Maps a node name from the embedded model to one of our bone keys
const BONE_ALIASES = [
  [/metacarp/, 'metacarpus'], [/metatars/, 'metatarsus'],
  [/carp/, 'carpus'], [/tars|calcane|talus/, 'tarsus'],
  [/mandib|jaw/, 'mandible'], [/skull|cranium|cranial/, 'skull'], [/tooth|teeth|incisor|molar/, 'teeth'],
  [/atlas/, 'atlas'], [/axis/, 'axis'], [/cervical|neck vert/, 'vertebrae_cervical'],
  [/thoracic|dorsal vert/, 'vertebrae_thoracic'], [/lumbar/, 'vertebrae_lumbar'],
  [/sacrum|sacral/, 'sacrum'], [/caudal|coccyg|tail/, 'vertebrae_caudal'],
  [/stern/, 'sternum'], [/rib|costa/, 'ribs'],
  [/scapula|shoulder ?blade/, 'scapula'], [/humer/, 'humerus'], [/radius/, 'radius'], [/ulna/, 'ulna'],
  [/pelvi|coxa|hip|ilium|ischium|pubis/, 'os_coxae'], [/femur|thigh/, 'femur'], [/patella|kneecap/, 'patella'],
  [/tibia/, 'tibia'], [/fibula/, 'fibula'], [/phalan|hoof|digit|toe/, 'phalanges_fore'],
];

function aliasBone(rawName) {
  const n = String(rawName || '').toLowerCase().replace(/[_\-.]+/g, ' ');
  const hit = BONE_ALIASES.find(([re]) => re.test(n));
  if (!hit) return null;
  const side = /(^|\s)(l|left)(\s|\d|$)/.test(n) ? 'Left' : /(^|\s)(r|right)(\s|\d|$)/.test(n) ? 'Right' : '';
  return { key: hit[1], side };
}

async function showStageEmbed(entry) {
  const session = ++stageEmbedSession;
  document.body.classList.add('embed-mode');
  $('stage-embed').classList.remove('hidden');
  $('stage-embed-loading').classList.remove('hidden');
  $('stage-embed-hint').classList.add('hidden');
  $('placeholder-badge').classList.add('hidden');
  $('model-credit').innerHTML = `Model by <a href="${esc(entry.source || '#')}" target="_blank" rel="noopener">${esc(entry.credit || 'Sketchfab')}</a> on Sketchfab`;
  const frame = $('stage-embed-frame');
  const plain = () => {
    if (session !== stageEmbedSession) return;
    frame.onload = () => $('stage-embed-loading').classList.add('hidden');
    frame.src = `https://sketchfab.com/models/${entry.uid}/embed?${new URLSearchParams(sketchfabOptions())}`;
  };
  try {
    const Sketchfab = await loadSketchfabApi();
    if (session !== stageEmbedSession) return;
    new Sketchfab(frame).init(entry.uid, {
      ...sketchfabOptions(),
      success(api) {
        api.start();
        api.addEventListener('viewerready', () => {
          if (session !== stageEmbedSession) return;
          $('stage-embed-loading').classList.add('hidden');
          api.getNodeMap((err, nodes) => {
            if (err || session !== stageEmbedSession) return;
            const byId = new Map(Object.values(nodes || {}).map((n) => [n.instanceID, n]));
            console.info('[Vetomy] skeleton node names:', [...new Set([...byId.values()].map((n) => n.name).filter(Boolean))]);
            const resolve = (id) => {
              // walk up the hierarchy until a node name we recognise
              for (let n = byId.get(id), guard = 0; n && guard < 12; n = byId.get(n.parentID ?? n.parent), guard++) {
                const a = aliasBone(n.name);
                if (a) return a;
              }
              return null;
            };
            const anyKnown = [...byId.values()].some((n) => aliasBone(n.name));
            if (!anyKnown) return;
            $('stage-embed-hint').classList.remove('hidden');
            api.addEventListener('click', (info) => {
              if (session !== stageEmbedSession || info?.instanceID == null) return;
              const a = resolve(info.instanceID);
              if (!a) return;
              select({ key: a.key, name: a.key, side: a.side, region: regionFor(a.key), mesh: null }, false);
            }, { pick: 'fast' });
          });
        });
      },
      error: plain,
    });
  } catch {
    plain();
  }
}

function hideStageEmbed() {
  if (!document.body.classList.contains('embed-mode')) return;
  stageEmbedSession++;
  document.body.classList.remove('embed-mode');
  $('stage-embed').classList.add('hidden');
  $('stage-embed-frame').onload = null;
  $('stage-embed-frame').src = 'about:blank';
}

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
  updateLandmarks();
  requestAnimationFrame(tick);
}

(async function init() {
  renderTabs();
  await loadData();
  requestAnimationFrame(tick);
  await loadSpecies(state.species);
  window.__vetomyReady = true;
})();
