import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConstellationField } from '@designcodeio/threeui';

const host = document.querySelector('.hero-art');
if (!host) throw new Error('Evidence Universe host not found');
if (!document.querySelector('link[href="/threeui.css"]')) {
  const threeUiStyles = document.createElement('link');
  threeUiStyles.rel = 'stylesheet';
  threeUiStyles.href = '/threeui.css';
  document.head.appendChild(threeUiStyles);
}

const neuralField = document.createElement('div');
neuralField.className = 'threeui-neural-field';
host.appendChild(neuralField);
createRoot(neuralField).render(React.createElement(ConstellationField, {
  variant: 'connectivity-graph',
  mode: 'dark',
  speed: 0.35,
  size: 0.85,
  strokeWidth: 0.65,
  length: 0.8,
  density: 0.9,
  opacity: 0.5,
  hue: 0.72,
  saturation: 0.55,
  brightness: 0.8,
}));

const evidence = [
  { id: 'vanessa-talk-too-much', title: 'Talk too much', guest: 'Vanessa Van Edwards', time: '00:00', seconds: 0, videoId: 'q2cg1gEYWJQ', query: 'How do you know you talk too much?', color: 0xc7a7ff },
  { id: 'vanessa-highlight', title: 'Highlight of your day', guest: 'Vanessa Van Edwards', time: '01:06', seconds: 66, videoId: 'q2cg1gEYWJQ', query: 'What is the best conversation starter?', color: 0xb6f3d4 },
  { id: 'vanessa-loneliness', title: 'Less conversation', guest: 'Vanessa Van Edwards', time: '00:33', seconds: 33, videoId: 'q2cg1gEYWJQ', query: 'How does technology affect loneliness?', color: 0xdc9869 }
];

const styles = document.createElement('style');
styles.textContent = `
  .threeui-neural-field{position:absolute;inset:0;z-index:0;opacity:.55;pointer-events:none}.threeui-neural-field canvas{display:block;width:100%!important;height:100%!important}
  .universe-stage{position:absolute;inset:0;overflow:hidden;background:radial-gradient(circle at 50% 47%,rgba(199,167,255,.13),transparent 23%),#08080d;z-index:1}
  .universe-stage canvas{display:block;width:100%;height:100%;touch-action:none;cursor:grab}.universe-stage canvas:active{cursor:grabbing}.universe-stage canvas:focus-visible{outline:1px solid var(--lilac);outline-offset:-4px}
  .universe-ui{position:absolute;inset:0;pointer-events:none;font:10px 'DM Mono',monospace;letter-spacing:.1em}.universe-ui>*{pointer-events:auto}
  .universe-heading{position:absolute;left:18px;top:17px;color:var(--paper)}.universe-heading span{color:var(--muted);margin-left:12px}.universe-hint{position:absolute;left:50%;bottom:19px;transform:translateX(-50%);white-space:nowrap;color:#8b8393;font-size:9px}.universe-foot{position:absolute;right:18px;bottom:17px;text-align:right;color:var(--lilac);line-height:1.5}.universe-foot small{display:block;color:#8b8393;font-size:9px}.universe-inspector{position:absolute;left:18px;bottom:18px;max-width:230px;padding:10px 12px;border-left:1px solid var(--lilac);background:rgba(8,8,13,.82);backdrop-filter:blur(8px);opacity:0;transform:translateY(5px);transition:opacity .18s ease,transform .18s ease}.universe-inspector.visible{opacity:1;transform:none}.universe-inspector strong{display:block;color:var(--paper);font-size:11px;letter-spacing:.04em}.universe-inspector small{display:block;color:var(--muted);font-size:9px;line-height:1.5;margin-top:4px}.universe-inspector button{border:0;background:none;color:var(--lilac);font:9px 'DM Mono';padding:8px 0 0;cursor:pointer}.universe-controls{position:absolute;right:18px;top:17px;display:flex;gap:6px}.universe-controls button{border:1px solid rgba(243,240,237,.16);background:rgba(8,8,13,.65);color:var(--muted);padding:6px 8px;border-radius:999px;font:9px 'DM Mono';cursor:pointer}.universe-controls button:hover,.universe-controls button:focus-visible{border-color:var(--lilac);color:var(--paper)}.universe-map-key{position:absolute;left:50%;top:25%;transform:translateX(-50%);display:flex;gap:25px;color:rgba(243,240,237,.78);font:10px 'DM Mono';letter-spacing:.16em}.universe-map-key span{position:relative}.universe-map-key span+span:before{content:'→';position:absolute;left:-18px;color:var(--lilac)}
  @media(max-width:700px){.universe-controls{top:auto;right:12px;bottom:12px}.universe-hint{bottom:49px;font-size:8px}.universe-foot{right:12px;bottom:55px}.universe-heading{left:12px;top:12px}.universe-inspector{left:12px;bottom:12px}}
`;
styles.textContent += '.universe-hint{top:42px;bottom:auto}';
document.head.appendChild(styles);
host.innerHTML = `<div class="universe-stage"><div class="universe-ui"><div class="universe-heading">EVIDENCE UNIVERSE <span>LOADING</span></div><div class="universe-map-key" aria-label="Archive hierarchy"><span>TOPICS</span><span>GUESTS</span><span>CITATIONS</span></div><div class="universe-controls"><button type="button" data-reset>RESET VIEW</button><button type="button" data-focus>FOCUS EVIDENCE</button></div><div class="universe-hint">DRAG TO ORBIT · SCROLL TO ZOOM · CLICK A NODE</div><div class="universe-foot">COLOURED NODES ARE CITATIONS<small>CLICK A NODE TO INSPECT ITS SOURCE</small></div><div class="universe-inspector"><strong></strong><small></small><button type="button" data-open>Inspect source ↗</button></div></div></div>`;

const stage = host.querySelector('.universe-stage');
stage.appendChild(neuralField);
const canvas = document.createElement('canvas');
canvas.setAttribute('role', 'img');
canvas.setAttribute('aria-label', 'Interactive 3D archive universe. Drag to orbit, scroll to zoom, and click a node to inspect an episode or citation.');
canvas.tabIndex = 0;
stage.prepend(canvas);

const scene = new THREE.Scene();
scene.add(new THREE.AmbientLight(0xb8a6d8, 1.7));
const keyLight = new THREE.DirectionalLight(0xf3f0ed, 2.8); keyLight.position.set(3, 5, 6); scene.add(keyLight);
const camera = new THREE.PerspectiveCamera(38, 1, .1, 1000);
camera.position.set(0, 0, 19);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = .08;
controls.minDistance = 7;
controls.maxDistance = 34;
controls.enablePan = false;
controls.minPolarAngle = .45;
controls.maxPolarAngle = Math.PI - .45;

const root = new THREE.Group();
scene.add(root);
const ringMaterials = [
  new THREE.MeshStandardMaterial({ color: 0x6e6879, metalness: .8, roughness: .3, transparent: true, opacity: .86 }),
  new THREE.MeshStandardMaterial({ color: 0x3e3b48, metalness: .72, roughness: .34, transparent: true, opacity: .92 }),
  new THREE.MeshStandardMaterial({ color: 0x272530, metalness: .65, roughness: .4, transparent: true, opacity: .96 })
];
const ringGroup = new THREE.Group();
ringGroup.rotation.set(-.17, .06, -.08);
root.add(ringGroup);
function ringLabel(text, radius, y = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = 720; canvas.height = 92;
  const context = canvas.getContext('2d');
  context.fillStyle = '#f3f0ed'; context.font = '600 34px DM Mono'; context.letterSpacing = '8px'; context.textAlign = 'center';
  context.fillText(text, 360, 54);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: .86 }));
  sprite.scale.set(2.9, .37, 1); sprite.position.set(0, y, radius + .04); ringGroup.add(sprite);
}
[[3.2, .18], [4.55, .04], [5.9, -.12]].forEach(([radius, y], index) => {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, index === 0 ? .23 : .18, 14, 160), ringMaterials[index]);
  ring.rotation.x = Math.PI / 2; ring.position.y = y; ringGroup.add(ring);
});
ringLabel('CITATIONS', 3.2, .18);
ringLabel('GUESTS', 4.55, .04);
ringLabel('TOPICS', 5.9, -.12);
const nodeGeometry = new THREE.SphereGeometry(.055, 8, 8);
const evidenceGeometry = new THREE.SphereGeometry(.15, 16, 16);
const nodes = [];
const catalogue = await fetch('/api/catalog').then(response => response.ok ? response.json() : []).catch(() => []);

function addNode(data, position, geometry, scale = 1) {
  const material = new THREE.MeshBasicMaterial({ color: data.color || 0x8c8792, transparent: true, opacity: data.kind === 'episode' ? .72 : 1 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.scale.setScalar(scale);
  mesh.userData = data;
  root.add(mesh);
  nodes.push(mesh);
  return mesh;
}

const topicRules = [
  ['AI & technology', /\b(ai|artificial intelligence|technology|tech|future|robot|internet|social media)\b/i],
  ['Health & longevity', /\b(health|longevity|sleep|insulin|weight|fitness|exercise|nutrition|diet|brain|dopamine)\b/i],
  ['Mind & psychology', /\b(mind|psycholog|trauma|anxiety|depression|emotion|fear|happiness|mental)\b/i],
  ['Business & money', /\b(business|money|wealth|founder|entrepreneur|company|invest|econom|capital|career)\b/i],
  ['Relationships', /\b(relationship|love|marriage|dating|family|friend|lonely|conversation|people)\b/i],
  ['Leadership', /\b(leader|leadership|ceo|manager|team|culture|power|decision)\b/i],
  ['Identity & purpose', /\b(identity|purpose|meaning|life|success|failure|story|belief|self)\b/i],
  ['Science & truth', /\b(science|truth|lie|evidence|research|doctor|expert|history|world)\b/i],
];
const topicMap = new Map(topicRules.map(([title]) => [title, []]));
for (const episode of catalogue) {
  const match = topicRules.find(([, pattern]) => pattern.test(episode.title));
  if (match) topicMap.get(match[0]).push(episode);
}
const topics = [...topicMap].filter(([, episodes]) => episodes.length >= 3).map(([title, episodes]) => ({ title, episodes }));
const topicNodes = topics.map((topic, index) => {
  const angle = index * 2.399963;
  const radius = [5.9, 4.55, 3.2][index % 3];
  const position = new THREE.Vector3(Math.cos(angle) * radius, [ -.12, .04, .18 ][index % 3], Math.sin(angle) * radius);
  return addNode({ kind: 'topic', title: topic.title, episodes: topic.episodes, query: topic.title, color: 0xa79bb8 }, position, nodeGeometry, 1 + Math.min(topic.episodes.length, 16) / 18);
});

const evidencePositions = [new THREE.Vector3(-2.5, -.9, .8), new THREE.Vector3(2.2, 1.55, .4), new THREE.Vector3(2.8, -.95, -.5)];
const evidenceNodes = evidence.map((item, index) => addNode({ ...item, kind: 'evidence' }, evidencePositions[index], evidenceGeometry));
const core = addNode({ kind: 'core', title: 'Conversation', query: 'What have guests said about conversation?' }, new THREE.Vector3(0, 0, 0), new THREE.SphereGeometry(.23, 20, 20), 1);
core.material.color.set(0xf3f0ed);

const linkMaterial = new THREE.LineBasicMaterial({ color: 0xc7a7ff, transparent: true, opacity: .55 });
for (const node of evidenceNodes) {
  root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([node.position, core.position]), linkMaterial));
}
for (const node of topicNodes) {
  root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([node.position, core.position]), new THREE.LineBasicMaterial({ color: 0x686271, transparent: true, opacity: .18 })));
}

const stars = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xf3f0ed, size: .025, transparent: true, opacity: .38 }));
const starPositions = [];
for (let index = 0; index < 260; index += 1) { const angle = index * 2.399963; const radius = 8 + (index % 11) * .5; starPositions.push(Math.cos(angle) * radius, ((index % 19) - 9) * .48, Math.sin(angle) * radius); }
stars.geometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
scene.add(stars);

const headingMeta = stage.querySelector('.universe-heading span');
headingMeta.textContent = `3 EVIDENCE · ${topics.length} TOPICS · ${catalogue.length} EPISODES`;
const inspector = stage.querySelector('.universe-inspector');
const inspectorTitle = inspector.querySelector('strong');
const inspectorMeta = inspector.querySelector('small');
const openButton = inspector.querySelector('[data-open]');
let selected = evidenceNodes[0];

function selectNode(node) {
  selected = node;
  const data = node.userData;
  inspectorTitle.textContent = data.title;
  inspectorMeta.textContent = data.kind === 'evidence' ? `${data.guest} · ${data.time} · citation-grade moment` : `${data.episodes.length} catalogue episodes · title-derived topic · transcript indexing pending`;
  openButton.textContent = data.kind === 'evidence' ? `Watch from ${data.time} ↗` : 'Search this topic ↗';
  inspector.classList.add('visible');
  root.add(node);
}

openButton.addEventListener('click', () => {
  const data = selected?.userData;
  if (!data) return;
  if (data.kind === 'evidence') window.open(`https://www.youtube.com/watch?v=${data.videoId}&t=${data.seconds}s`, '_blank', 'noopener');
  else { const input = document.querySelector('#query'); input.value = data.query; document.querySelector('#search-form').requestSubmit(); window.scrollTo({ top: document.querySelector('#archive').offsetTop, behavior: 'smooth' }); }
});
stage.querySelector('[data-reset]').addEventListener('click', () => { camera.position.set(0, 0, 19); controls.target.set(0, 0, 0); controls.update(); });
stage.querySelector('[data-focus]').addEventListener('click', () => { camera.position.set(0, .4, 8); controls.target.set(0, 0, 0); controls.update(); });

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const tooltip = document.createElement('div');
tooltip.className = 'universe-tooltip';
tooltip.style.cssText = 'position:absolute;display:none;padding:7px 9px;border:1px solid rgba(199,167,255,.35);background:rgba(8,8,13,.9);color:#f3f0ed;font:9px DM Mono,monospace;pointer-events:none;z-index:5;max-width:190px';
stage.appendChild(tooltip);

function hit(event) { const bounds = canvas.getBoundingClientRect(); pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1; pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1; raycaster.setFromCamera(pointer, camera); return raycaster.intersectObjects(nodes); }
canvas.addEventListener('pointermove', event => { const hitNode = hit(event)[0]?.object; canvas.style.cursor = hitNode ? 'pointer' : 'grab'; if (!hitNode) { tooltip.style.display = 'none'; return; } tooltip.textContent = hitNode.userData.kind === 'evidence' ? `${hitNode.userData.title} · ${hitNode.userData.time}` : `${hitNode.userData.title} · ${hitNode.userData.episodes.length} episodes`; tooltip.style.display = 'block'; tooltip.style.left = `${event.clientX - stage.getBoundingClientRect().left + 12}px`; tooltip.style.top = `${event.clientY - stage.getBoundingClientRect().top + 12}px`; });
canvas.addEventListener('pointerdown', event => { const hitNode = hit(event)[0]?.object; if (hitNode) selectNode(hitNode); });

function resize() { const width = host.clientWidth; const height = host.clientHeight; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(host);
resize();
selectNode(evidenceNodes[0]);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function animate() { requestAnimationFrame(animate); if (!reducedMotion) { root.rotation.y += .00045; stars.rotation.y -= .00012; } controls.update(); renderer.render(scene, camera); }
animate();
