import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const host = document.querySelector('.hero-art');
if (!host) throw new Error('Evidence Universe host not found');

const evidence = [
  { id: 'vanessa-talk-too-much', title: 'Talk too much', guest: 'Vanessa Van Edwards', time: '00:00', seconds: 0, videoId: 'q2cg1gEYWJQ', query: 'How do you know you talk too much?', color: 0xc7a7ff },
  { id: 'vanessa-highlight', title: 'Highlight of your day', guest: 'Vanessa Van Edwards', time: '01:06', seconds: 66, videoId: 'q2cg1gEYWJQ', query: 'What is the best conversation starter?', color: 0xb6f3d4 },
  { id: 'vanessa-loneliness', title: 'Less conversation', guest: 'Vanessa Van Edwards', time: '00:33', seconds: 33, videoId: 'q2cg1gEYWJQ', query: 'How does technology affect loneliness?', color: 0xdc9869 }
];

const styles = document.createElement('style');
styles.textContent = `
  .universe-stage{position:absolute;inset:0;overflow:hidden;background:radial-gradient(circle at 50% 47%,rgba(199,167,255,.13),transparent 23%),#08080d}
  .universe-stage canvas{display:block;width:100%;height:100%;touch-action:none;cursor:grab}.universe-stage canvas:active{cursor:grabbing}.universe-stage canvas:focus-visible{outline:1px solid var(--lilac);outline-offset:-4px}
  .universe-ui{position:absolute;inset:0;pointer-events:none;font:10px 'DM Mono',monospace;letter-spacing:.1em}.universe-ui>*{pointer-events:auto}
  .universe-heading{position:absolute;left:18px;top:17px;color:var(--paper)}.universe-heading span{color:var(--muted);margin-left:12px}.universe-hint{position:absolute;left:50%;bottom:19px;transform:translateX(-50%);white-space:nowrap;color:#8b8393;font-size:9px}.universe-foot{position:absolute;right:18px;bottom:17px;text-align:right;color:var(--lilac);line-height:1.5}.universe-foot small{display:block;color:#8b8393;font-size:9px}.universe-inspector{position:absolute;left:18px;bottom:18px;max-width:230px;padding:10px 12px;border-left:1px solid var(--lilac);background:rgba(8,8,13,.82);backdrop-filter:blur(8px);opacity:0;transform:translateY(5px);transition:opacity .18s ease,transform .18s ease}.universe-inspector.visible{opacity:1;transform:none}.universe-inspector strong{display:block;color:var(--paper);font-size:11px;letter-spacing:.04em}.universe-inspector small{display:block;color:var(--muted);font-size:9px;line-height:1.5;margin-top:4px}.universe-inspector button{border:0;background:none;color:var(--lilac);font:9px 'DM Mono';padding:8px 0 0;cursor:pointer}.universe-controls{position:absolute;right:18px;top:17px;display:flex;gap:6px}.universe-controls button{border:1px solid rgba(243,240,237,.16);background:rgba(8,8,13,.65);color:var(--muted);padding:6px 8px;border-radius:999px;font:9px 'DM Mono';cursor:pointer}.universe-controls button:hover,.universe-controls button:focus-visible{border-color:var(--lilac);color:var(--paper)}
  @media(max-width:700px){.universe-controls{top:auto;right:12px;bottom:12px}.universe-hint{bottom:49px;font-size:8px}.universe-foot{right:12px;bottom:55px}.universe-heading{left:12px;top:12px}.universe-inspector{left:12px;bottom:12px}}
`;
styles.textContent += '.universe-hint{top:42px;bottom:auto}';
document.head.appendChild(styles);
host.innerHTML = `<div class="universe-stage"><div class="universe-ui"><div class="universe-heading">EVIDENCE UNIVERSE <span>LOADING</span></div><div class="universe-controls"><button type="button" data-reset>RESET VIEW</button><button type="button" data-focus>FOCUS EVIDENCE</button></div><div class="universe-hint">DRAG TO ORBIT · SCROLL TO ZOOM · CLICK A NODE</div><div class="universe-foot">COLOURED NODES ARE CITATIONS<small>CLICK A NODE TO INSPECT ITS SOURCE</small></div><div class="universe-inspector"><strong></strong><small></small><button type="button" data-open>Inspect source ↗</button></div></div></div>`;

const stage = host.querySelector('.universe-stage');
const canvas = document.createElement('canvas');
canvas.setAttribute('role', 'img');
canvas.setAttribute('aria-label', 'Interactive 3D archive universe. Drag to orbit, scroll to zoom, and click a node to inspect an episode or citation.');
canvas.tabIndex = 0;
stage.prepend(canvas);

const scene = new THREE.Scene();
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

const episodeNodes = catalogue.slice(0, 140).map((episode, index) => {
  const angle = index * 2.399963;
  const radius = 2.3 + ((index * 37) % 70) / 20;
  const position = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * .72, ((index % 17) - 8) * .24);
  return addNode({ kind: 'episode', title: episode.title, publishedAt: episode.publishedAt, durationSeconds: episode.durationSeconds, query: episode.title, color: 0x8b8792 }, position, nodeGeometry, 1 + (index % 3) * .35);
});

const evidencePositions = [new THREE.Vector3(-2.5, -.9, .8), new THREE.Vector3(2.2, 1.55, .4), new THREE.Vector3(2.8, -.95, -.5)];
const evidenceNodes = evidence.map((item, index) => addNode({ ...item, kind: 'evidence' }, evidencePositions[index], evidenceGeometry));
const core = addNode({ kind: 'core', title: 'Conversation', query: 'What have guests said about conversation?' }, new THREE.Vector3(0, 0, 0), new THREE.SphereGeometry(.23, 20, 20), 1);
core.material.color.set(0xf3f0ed);

const orbitMaterial = new THREE.LineBasicMaterial({ color: 0x8d79b2, transparent: true, opacity: .24 });
for (const rotation of [[.35, .1, -.2], [-.5, .6, .2], [.2, -.45, .8]]) {
  const curve = new THREE.EllipseCurve(0, 0, 5.6, 3.6, 0, Math.PI * 2, false, 0);
  const points = curve.getPoints(120).map(point => new THREE.Vector3(point.x, point.y, 0));
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), orbitMaterial);
  line.rotation.set(...rotation);
  root.add(line);
}

const linkMaterial = new THREE.LineBasicMaterial({ color: 0xc7a7ff, transparent: true, opacity: .55 });
for (const node of evidenceNodes) {
  root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([node.position, core.position]), linkMaterial));
}

const stars = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xf3f0ed, size: .025, transparent: true, opacity: .38 }));
const starPositions = [];
for (let index = 0; index < 260; index += 1) { const angle = index * 2.399963; const radius = 8 + (index % 11) * .5; starPositions.push(Math.cos(angle) * radius, ((index % 19) - 9) * .48, Math.sin(angle) * radius); }
stars.geometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
scene.add(stars);

const headingMeta = stage.querySelector('.universe-heading span');
headingMeta.textContent = `3 EVIDENCE · ${catalogue.length} EPISODES`;
const inspector = stage.querySelector('.universe-inspector');
const inspectorTitle = inspector.querySelector('strong');
const inspectorMeta = inspector.querySelector('small');
const openButton = inspector.querySelector('[data-open]');
let selected = evidenceNodes[0];

function selectNode(node) {
  selected = node;
  const data = node.userData;
  inspectorTitle.textContent = data.kind === 'evidence' ? data.title : data.title;
  inspectorMeta.textContent = data.kind === 'evidence' ? `${data.guest} · ${data.time} · citation-grade moment` : `${new Date(data.publishedAt).toLocaleDateString('en-GB')} · catalogue record · transcript pending`;
  openButton.textContent = data.kind === 'evidence' ? `Watch from ${data.time} ↗` : 'Search this episode ↗';
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
canvas.addEventListener('pointermove', event => { const hitNode = hit(event)[0]?.object; canvas.style.cursor = hitNode ? 'pointer' : 'grab'; if (!hitNode) { tooltip.style.display = 'none'; return; } tooltip.textContent = hitNode.userData.kind === 'evidence' ? `${hitNode.userData.title} · ${hitNode.userData.time}` : hitNode.userData.title; tooltip.style.display = 'block'; tooltip.style.left = `${event.clientX - stage.getBoundingClientRect().left + 12}px`; tooltip.style.top = `${event.clientY - stage.getBoundingClientRect().top + 12}px`; });
canvas.addEventListener('pointerdown', event => { const hitNode = hit(event)[0]?.object; if (hitNode) selectNode(hitNode); });

function resize() { const width = host.clientWidth; const height = host.clientHeight; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(host);
resize();
selectNode(evidenceNodes[0]);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function animate() { requestAnimationFrame(animate); if (!reducedMotion) { root.rotation.y += .00045; stars.rotation.y -= .00012; } controls.update(); renderer.render(scene, camera); }
animate();
