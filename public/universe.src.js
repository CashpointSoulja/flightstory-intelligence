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
  .universe-stage{position:absolute;inset:0;overflow:hidden;background:radial-gradient(circle at 50% 47%,rgba(199,167,255,.13),transparent 23%),#08080d;z-index:1}.universe-node-label{position:absolute;z-index:4;transform:translate(9px,-50%);white-space:nowrap;color:rgba(243,240,237,.78);font:9px 'DM Mono';letter-spacing:.08em;pointer-events:none;text-shadow:0 1px 9px #08080d}
  .universe-stage canvas{display:block;width:100%;height:100%;touch-action:none;cursor:grab}.universe-stage canvas:active{cursor:grabbing}.universe-stage canvas:focus-visible{outline:1px solid var(--lilac);outline-offset:-4px}
  .universe-ui{position:absolute;inset:0;pointer-events:none;font:10px 'DM Mono',monospace;letter-spacing:.1em}.universe-ui>*{pointer-events:auto}
  .universe-heading{position:absolute;left:18px;top:17px;color:var(--paper)}.universe-heading span{color:var(--muted);margin-left:12px}.universe-hint{position:absolute;left:50%;bottom:19px;transform:translateX(-50%);white-space:nowrap;color:#8b8393;font-size:9px}.universe-foot{position:absolute;right:18px;bottom:17px;text-align:right;color:var(--lilac);line-height:1.5}.universe-foot small{display:block;color:#8b8393;font-size:9px}.universe-inspector{position:absolute;left:18px;bottom:18px;max-width:230px;padding:10px 12px;border-left:1px solid var(--lilac);background:rgba(8,8,13,.82);backdrop-filter:blur(8px);opacity:0;transform:translateY(5px);transition:opacity .18s ease,transform .18s ease}.universe-inspector.visible{opacity:1;transform:none}.universe-inspector strong{display:block;color:var(--paper);font-size:11px;letter-spacing:.04em}.universe-inspector small{display:block;color:var(--muted);font-size:9px;line-height:1.5;margin-top:4px}.universe-inspector button{border:0;background:none;color:var(--lilac);font:9px 'DM Mono';padding:8px 0 0;cursor:pointer}.universe-controls{position:absolute;right:18px;top:17px;display:flex;gap:6px}.universe-controls button{border:1px solid rgba(243,240,237,.16);background:rgba(8,8,13,.65);color:var(--muted);padding:6px 8px;border-radius:999px;font:9px 'DM Mono';cursor:pointer}.universe-controls button:hover,.universe-controls button:focus-visible{border-color:var(--lilac);color:var(--paper)}.universe-map-key{position:absolute;left:50%;top:25%;transform:translateX(-50%);display:flex;gap:25px;color:rgba(243,240,237,.78);font:10px 'DM Mono';letter-spacing:.16em}.universe-map-key span{position:relative}.universe-map-key span+span:before{content:'→';position:absolute;left:-18px;color:var(--lilac)}
  @media(max-width:700px){.universe-controls{top:auto;right:12px;bottom:12px}.universe-hint{bottom:49px;font-size:8px}.universe-foot{right:12px;bottom:55px}.universe-heading{left:12px;top:12px}.universe-inspector{left:12px;bottom:12px}}
`;
styles.textContent += '.universe-hint{top:42px;bottom:auto}';
document.head.appendChild(styles);
host.innerHTML = `<div class="universe-stage"><div class="universe-ui"><div class="universe-heading">EVIDENCE UNIVERSE <span>LOADING</span></div><div class="universe-map-key" aria-label="Archive hierarchy"><span>TOPICS</span><span>GUESTS</span><span>CITATIONS</span></div><div class="universe-controls"><button type="button" data-reset>RESET VIEW</button><button type="button" data-focus>FOCUS EVIDENCE</button></div><div class="universe-hint">DRAG TO ORBIT · SCROLL TO ZOOM · CLICK A NODE</div><div class="universe-foot">COLOURED NODES ARE CITATIONS<small>CLICK A NODE TO INSPECT ITS SOURCE</small></div><div class="universe-inspector"><strong></strong><small></small><button type="button" data-open>Inspect source ↗</button></div></div></div>`;

const stage = host.querySelector('.universe-stage');
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
const nodeGeometry = new THREE.SphereGeometry(.055, 8, 8);
const evidenceGeometry = new THREE.SphereGeometry(.15, 16, 16);
const nodes = [];
const catalogue = await fetch('/api/catalog').then(response => response.ok ? response.json() : []).catch(() => []);
const graph = await fetch('/topic-graph.json').then(response => response.ok ? response.json() : { nodes: [], edges: [] }).catch(() => ({ nodes: [], edges: [] }));
const videoGraph = await fetch('/video-links.json').then(response => response.ok ? response.json() : { nodes: [], edges: [] }).catch(() => ({ nodes: [], edges: [] }));

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

const topicPositions = new Map();
const topicFamilies = [
  ['health', /brain|sleep|health|weight|fitness|diet|cancer|disease|body|exercise|nutrition|dopamine|insulin|aging|ageing|sex|pregnan|menopause/i, 0xe5bd77],
  ['mind', /mind|psych|anxiety|depress|trauma|emotion|fear|happiness|lonely|confidence|identity|addict/i, 0xbba4ff],
  ['money', /money|wealth|business|company|invest|econom|career|founder|million|finance|capital|work/i, 0x94bfff],
  ['culture', /ai|technology|future|politic|war|world|history|science|truth|religion|social|media/i, 0xa6e8c3],
  ['relationships', /love|relationship|marriage|dating|family|friend|conversation|people|parent|woman|man/i, 0xe78c6a]
];
const topicColor = label => topicFamilies.find(([, pattern]) => pattern.test(label))?.[2] || 0xa79bb8;
const clusterCenters = [new THREE.Vector3(-4.4, 1.6, -.4), new THREE.Vector3(-2.1, -2.1, .2), new THREE.Vector3(.1, 2.5, -.2), new THREE.Vector3(2.7, .55, .3), new THREE.Vector3(4.3, -1.45, -.1)];
const topicNodes = graph.nodes.map((topic, index) => {
  const family = topicFamilies.findIndex(([, pattern]) => pattern.test(topic.label));
  const cluster = clusterCenters[Math.max(family, 0) % clusterCenters.length];
  const theta = index * 2.399963 + (family < 0 ? 0 : family * .3); const spread = 1.1 + (index % 13) * .035;
  const position = new THREE.Vector3(cluster.x + Math.cos(theta) * spread, cluster.y + Math.sin(theta) * spread * .7, cluster.z + Math.sin(index * 1.73) * .75);
  topicPositions.set(topic.id, position);
  return addNode({ kind: 'topic', title: topic.label, occurrences: topic.occurrences, episodeCount: topic.episodeCount, seconds: topic.seconds, source: topic.source, sourceTitle: topic.sourceTitle, query: topic.label, color: topicColor(topic.label) }, position, nodeGeometry, 1 + Math.min(topic.occurrences, 40) / 55);
});
const topicLabels = topicNodes.slice(0, 36).map(node => {
  const label = document.createElement('span');
  label.className = 'universe-node-label';
  label.textContent = node.userData.title;
  stage.appendChild(label);
  return { node, label };
});
for (const [index, center] of clusterCenters.entries()) {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128; const context = canvas.getContext('2d'); const color = new THREE.Color(topicFamilies[index][2]); const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 64); gradient.addColorStop(0, `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},.22)`); gradient.addColorStop(1, 'rgba(0,0,0,0)'); context.fillStyle = gradient; context.fillRect(0, 0, 128, 128); const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, opacity: .75 })); sprite.position.copy(center); sprite.scale.set(4.4, 4.4, 1); root.add(sprite);
}
const videoPositions = new Map();
const videoNodes = videoGraph.nodes.map((video, index) => {
  const progress = index / Math.max(videoGraph.nodes.length, 1); const arm = index % 5; const radius = 6.2 + (index % 11) * .12; const theta = arm * (Math.PI * 2 / 5) + progress * 12.5;
  const position = new THREE.Vector3(Math.cos(theta) * radius, Math.sin(theta * 1.6 + arm) * radius * .24, Math.sin(theta) * radius * .58);
  videoPositions.set(video.id, position);
  return addNode({ kind: 'video', title: video.title, source: video.source, seconds: video.seconds, query: video.title, color: topicColor(video.title) }, position, nodeGeometry, 1.5);
});

const evidencePositions = [new THREE.Vector3(-2.5, -.9, .8), new THREE.Vector3(2.2, 1.55, .4), new THREE.Vector3(2.8, -.95, -.5)];
const evidenceNodes = evidence.map((item, index) => addNode({ ...item, kind: 'evidence' }, evidencePositions[index], evidenceGeometry));
const core = addNode({ kind: 'core', title: 'Conversation', query: 'What have guests said about conversation?' }, new THREE.Vector3(0, 0, 0), new THREE.SphereGeometry(.23, 20, 20), 1);
core.material.color.set(0xf3f0ed);

const linkMaterial = new THREE.LineBasicMaterial({ color: 0xc7a7ff, transparent: true, opacity: .55 });
for (const node of evidenceNodes) {
  root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([node.position, core.position]), linkMaterial));
}
for (const node of topicNodes.slice(0, 36)) {
  root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([node.position, core.position]), new THREE.LineBasicMaterial({ color: 0x686271, transparent: true, opacity: .18 })));
}
const edgePositions = [];
for (const edge of graph.edges) { const from = topicPositions.get(edge.source); const to = topicPositions.get(edge.target); if (from && to) edgePositions.push(from.x, from.y, from.z, to.x, to.y, to.z); }
const graphLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x665b78, transparent: true, opacity: .16 }));
graphLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
root.add(graphLines);
const videoEdgePositions = [];
const videoEdgePairs = [];
for (const edge of videoGraph.edges) { const from = videoPositions.get(edge.source); const to = videoPositions.get(edge.target); if (from && to) { videoEdgePositions.push(from.x, from.y, from.z, to.x, to.y, to.z); if (videoEdgePairs.length < 220) videoEdgePairs.push([from, to]); } }
const videoLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xe5bd77, transparent: true, opacity: .24 }));
videoLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(videoEdgePositions, 3));
root.add(videoLines);
const sparkPositions = new Float32Array(videoEdgePairs.length * 3); const sparks = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xffe3a6, size: .065, transparent: true, opacity: .9, depthWrite: false })); sparks.geometry.setAttribute('position', new THREE.Float32BufferAttribute(sparkPositions, 3)); root.add(sparks);

const stars = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xf3f0ed, size: .025, transparent: true, opacity: .38 }));
const starPositions = [];
for (let index = 0; index < 260; index += 1) { const angle = index * 2.399963; const radius = 8 + (index % 11) * .5; starPositions.push(Math.cos(angle) * radius, ((index % 19) - 9) * .48, Math.sin(angle) * radius); }
stars.geometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
scene.add(stars);

const headingMeta = stage.querySelector('.universe-heading span');
headingMeta.textContent = `${topicNodes.length} TOPICS · ${videoNodes.length} VIDEOS · ${videoGraph.edges.length} LINKS`;
const inspector = stage.querySelector('.universe-inspector');
const inspectorTitle = inspector.querySelector('strong');
const inspectorMeta = inspector.querySelector('small');
const openButton = inspector.querySelector('[data-open]');
let selected = evidenceNodes[0];

function selectNode(node) {
  selected = node;
  const data = node.userData;
  inspectorTitle.textContent = data.title;
  inspectorMeta.textContent = data.kind === 'evidence' ? `${data.guest} · ${data.time} · citation-grade moment` : data.kind === 'video' ? `semantic video node · ${data.title.slice(0, 48)} · source video` : `${data.occurrences} mentions · ${data.sourceTitle || 'indexed episode'} · ${Math.floor(data.seconds / 60)}:${String(Math.floor(data.seconds % 60)).padStart(2, '0')}`;
  openButton.textContent = data.kind === 'evidence' || data.kind === 'video' ? 'Watch source ↗' : `Open source at ${Math.floor(data.seconds / 60)}:${String(Math.floor(data.seconds % 60)).padStart(2, '0')} ↗`;
  inspector.classList.add('visible');
  root.add(node);
}

openButton.addEventListener('click', () => {
  const data = selected?.userData;
  if (!data) return;
  if (data.kind === 'evidence' || data.kind === 'topic' || data.kind === 'video') window.open(`${data.source || `https://www.youtube.com/watch?v=${data.videoId}`}&t=${data.seconds}s`, '_blank', 'noopener');
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
canvas.addEventListener('pointermove', event => { const hitNode = hit(event)[0]?.object; canvas.style.cursor = hitNode ? 'pointer' : 'grab'; if (!hitNode) { tooltip.style.display = 'none'; return; } tooltip.textContent = hitNode.userData.kind === 'evidence' ? `${hitNode.userData.title} · ${hitNode.userData.time}` : hitNode.userData.kind === 'video' ? `${hitNode.userData.title} · video link` : `${hitNode.userData.title} · ${hitNode.userData.occurrences} mentions`; tooltip.style.display = 'block'; tooltip.style.left = `${event.clientX - stage.getBoundingClientRect().left + 12}px`; tooltip.style.top = `${event.clientY - stage.getBoundingClientRect().top + 12}px`; });
canvas.addEventListener('pointerdown', event => { const hitNode = hit(event)[0]?.object; if (!hitNode) return; selectNode(hitNode); const data = hitNode.userData; if (data.kind === 'topic' || data.kind === 'video') window.open(`${data.source}&t=${data.seconds}s`, '_blank', 'noopener'); });

function resize() { const width = host.clientWidth; const height = host.clientHeight; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(host);
resize();
selectNode(evidenceNodes[0]);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function updateTopicLabels() { const width = stage.clientWidth; const height = stage.clientHeight; const point = new THREE.Vector3(); for (const { node, label } of topicLabels) { node.getWorldPosition(point).project(camera); label.style.left = `${(point.x * .5 + .5) * width}px`; label.style.top = `${(-point.y * .5 + .5) * height}px`; label.style.opacity = point.z < 1 ? '.82' : '0'; } }
function animate() { requestAnimationFrame(animate); const now = performance.now() / 1000; if (!reducedMotion) { root.rotation.y += .00045; stars.rotation.y -= .00012; } videoLines.material.opacity = .11 + (Math.sin(now * 1.6) + 1) * .09; for (let index = 0; index < videoEdgePairs.length; index += 1) { const [from, to] = videoEdgePairs[index]; const phase = (now * (.08 + (index % 7) * .012) + index / videoEdgePairs.length) % 1; sparkPositions[index * 3] = from.x + (to.x - from.x) * phase; sparkPositions[index * 3 + 1] = from.y + (to.y - from.y) * phase; sparkPositions[index * 3 + 2] = from.z + (to.z - from.z) * phase; } sparks.geometry.attributes.position.needsUpdate = true; controls.update(); updateTopicLabels(); renderer.render(scene, camera); }
animate();
