import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildPlaceholder } from './placeholder.js?v=20261118g';
import { translateEs } from './translate-es.js?v=20261118g';

// Bump with every release so browsers never mix old and new files
const ASSET_V = '20261118g';

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

// ------------------------------------------------------------------
// State
// ------------------------------------------------------------------
const state = {
  species: 'horse',
  data: {},
  specimens: {},
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
  const rgb = dark ? '233, 214, 170' : '30, 40, 35';
  const a = dark ? [0.16, 0.05] : [0.16, 0.05];
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
const groupKey = (key) => vertebra(key)?.group.key || key;
const info = (key) => {
  if (!key || key === '_meta') return null;
  return state.data[key] || state.data[groupKey(key)] || null;
};
const species = () => SPECIES.find((s) => s.id === state.species);
const regionOf = (id) => REGIONS.find((r) => r.id === id) || REGIONS.at(-1);

function displayName(key) {
  if (state.data[key]?.names?.en) return state.data[key].names.en;
  const v = vertebra(key);
  if (v) return `${v.group.label} ${v.group.letter}${v.n}`;
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
  [state.data, state.specimens] = await Promise.all([
    loadJSON(`data/bones.json?v=${ASSET_V}`),
    loadJSON(`data/specimens.json?v=${ASSET_V}`),
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
    const gltf = await loader.loadAsync(`models/${id}.glb?v=${ASSET_V}`);
    root = gltf.scene;
    extras = gltf.asset?.extras || null;
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
  renderModelCredit(extras);
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
  state.selected = b;
  if (b && state.hiddenRegions.has(b.region)) state.hiddenRegions.delete(b.region);
  applyMaterials();
  renderInfo();
  renderRegions();
  if (b && focus) focusOn(b.mesh);
}

// ------------------------------------------------------------------
// UI
// ------------------------------------------------------------------
function renderAll() {
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
      <h3>Landmarks</h3>
      ${list(d.landmarks)}
      <h3>Articulates with</h3>
      ${list(d.articulations)}
      ${specimenSection(b.key)}
      <h3>Across species</h3>
      <div class="compare">${compare}</div>
      <p class="disclaimer">${esc(state.data._meta?.disclaimer || '')}</p>`;

    infoPanel.querySelectorAll('.specimen-btn').forEach((btn) => {
      btn.onclick = () => openSpecimen(specimensFor(b.key)[+btn.dataset.index], +btn.dataset.index);
    });

    // Jump to the same bone in another species
    infoPanel.querySelectorAll('.compare .row[data-species]').forEach((row) => {
      row.onclick = () => openInSpecies(row.dataset.species, b.key);
    });
  }
  infoPanel.querySelector('.close').onclick = () => select(null);
  infoPanel.scrollTop = 0;
}

// ------------------------------------------------------------------
// Real specimens (Sketchfab embeds)
// ------------------------------------------------------------------
function specimensFor(key) {
  const sp = state.specimens?.[state.species] || {};
  return sp[key] || sp[groupKey(key)] || [];
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
    credit.textContent = `Scan: ${state.specimens?._meta?.source || 'Sketchfab'}`;
    credit.href = `https://sketchfab.com/3d-models/${sp.uid}`;
    $('specimen-canvas').classList.add('hidden');
    $('specimen-frame').classList.remove('hidden');
    $('specimen-loading').textContent = 'Loading high-resolution scan…';
    $('specimen-loading').classList.remove('hidden');
    showSketchfab(sp.uid);
  } else {
    return;
  }
  $('specimen-view').classList.remove('hidden');
  document.body.classList.add('specimen-mode');
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
async function showSketchfab(uid) {
  const session = ++sketchfabSession;
  const frame = $('specimen-frame');
  $('specimen-landmarks').classList.add('hidden');
  $('lm-list').innerHTML = '';
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
            if (!err && list?.length && session === sketchfabSession) renderLandmarks(api, list);
          });
        });
        api.addEventListener('annotationSelect', (i) => markLandmark(i));
      },
      error: fallback,
    });
  } catch {
    fallback();
  }
}

function renderLandmarks(api, list) {
  const ol = $('lm-list');
  ol.innerHTML = '';
  list.forEach((a, i) => {
    const li = document.createElement('li');
    const name = translateEs(String(a.name || '').replace(/^\s*\d+[.)-]?\s*/, '')) || `Landmark ${i + 1}`;
    li.innerHTML = `<button data-i="${i}"><span class="n">${i + 1}</span><span>${esc(name)}</span></button>`;
    li.querySelector('button').onclick = () => {
      api.gotoAnnotation(i, { preventCameraAnimation: false });
      markLandmark(i);
    };
    ol.appendChild(li);
  });
  $('specimen-landmarks').classList.remove('hidden');
}

function markLandmark(i) {
  $('lm-list').querySelectorAll('button').forEach((b) => b.classList.toggle('active', +b.dataset.i === i));
}

function closeSpecimen() {
  if (!activeSpecimen) return;
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
  infoPanel.querySelectorAll('.specimen-btn').forEach((b) => b.classList.remove('active'));
}

$('specimen-back').addEventListener('click', closeSpecimen);

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
} catch {}
$('theme-btn').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('vetomy-theme-v2', next); } catch {}
  const old = state.ground.material.map;
  state.ground.material.map = groundTexture();
  state.ground.material.needsUpdate = true;
  old?.dispose();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#0c1411' : '#e9e6df');
});

// Keyboard
window.addEventListener('keydown', (e) => {
  const typing = document.activeElement?.tagName === 'INPUT' && document.activeElement.type !== 'range';
  if (e.key === '/' && !typing) {
    e.preventDefault();
    searchEl.focus();
  } else if (e.key === 'Escape') {
    if (activeSpecimen) return closeSpecimen();
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
  requestAnimationFrame(tick);
  await loadSpecies(state.species);
  window.__vetomyReady = true;
})();
