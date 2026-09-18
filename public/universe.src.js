import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { formatTime, graphLayerVisibility, graphNodeIsVisible, nearestNodeWithinRadius } from './archive-ui.js';

const host = document.querySelector('.hero-art');
if (!host) throw new Error('Evidence Universe host not found');

const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = motionPreference.matches;
let stageInView = typeof IntersectionObserver !== 'function';
let pageVisible = document.visibilityState !== 'hidden';
let rendererReady = false;
let frameId = null;

const evidence = [
  { id: 'vanessa-talk-too-much', title: 'Talk too much', guest: 'Vanessa Van Edwards', time: '00:00', seconds: 0, videoId: 'q2cg1gEYWJQ', query: 'How do you know you talk too much?', color: 0xc7a7ff },
  { id: 'vanessa-highlight', title: 'Highlight of your day', guest: 'Vanessa Van Edwards', time: '01:06', seconds: 66, videoId: 'q2cg1gEYWJQ', query: 'What is the best conversation starter?', color: 0xb6f3d4 },
  { id: 'vanessa-loneliness', title: 'Less conversation', guest: 'Vanessa Van Edwards', time: '00:33', seconds: 33, videoId: 'q2cg1gEYWJQ', query: 'How does technology affect loneliness?', color: 0xdc9869 }
];

const styles = document.createElement('style');
styles.textContent = `
  .universe-stage{position:absolute;inset:0;overflow:hidden;background:radial-gradient(circle at 50% 47%,rgba(199,167,255,.13),transparent 23%),#08080d;z-index:1}.universe-node-label{position:absolute;z-index:4;transform:translate(9px,-50%);white-space:nowrap;color:rgba(243,240,237,.78);font:9px 'neue-haas-grotesk-display';letter-spacing:.08em;pointer-events:none;text-shadow:0 1px 9px #08080d}.universe-node-label--row{pointer-events:auto;cursor:pointer;padding:5px 2px 5px 10px;border-left:1px solid rgba(199,167,255,.35)}.universe-node-label--row:hover{color:#f3f0ed;border-left-color:#c7a7ff}
  .universe-stage canvas{display:block;width:100%;height:100%;touch-action:none;cursor:grab}.universe-stage canvas:active{cursor:grabbing}
  .universe-ui{position:absolute;inset:0;pointer-events:none;font:10px 'neue-haas-grotesk-display',monospace;letter-spacing:.1em}.universe-ui>*{pointer-events:auto}
  .universe-access[open]{width:min(440px,calc(100vw - 32px))}.universe-access-row{display:flex;align-items:center;gap:8px;border-bottom:1px solid rgba(241,240,237,.06)}.universe-access-row button,.universe-access-row a{padding:7px 6px;color:var(--muted);background:none;border:0;text-align:left;text-decoration:none;font:9px 'neue-haas-grotesk-display',monospace;cursor:pointer}.universe-access-row button{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.universe-access-row button[aria-pressed="true"],.universe-access-row button:hover,.universe-access-row button:focus-visible,.universe-access-row a:hover,.universe-access-row a:focus-visible{color:var(--paper);background:rgba(187,164,255,.1);outline-color:var(--lilac)}
  .universe-heading{position:absolute;left:18px;top:17px;color:var(--paper)}.universe-heading span{color:var(--muted);margin-left:12px}.universe-hint{position:absolute;left:50%;bottom:19px;transform:translateX(-50%);white-space:nowrap;color:#8b8393;font-size:9px}.universe-foot{position:absolute;right:18px;bottom:17px;text-align:right;color:var(--lilac);line-height:1.5}.universe-foot small{display:block;color:#8b8393;font-size:9px}.universe-inspector{position:absolute;left:18px;bottom:18px;max-width:300px;padding:10px 12px;border-left:1px solid var(--lilac);background:rgba(8,8,13,.82);backdrop-filter:blur(8px);opacity:0;transform:translateY(5px);transition:opacity .18s ease,transform .18s ease}.universe-inspector.visible{opacity:1;transform:none}.universe-inspector strong{display:block;color:var(--paper);font-size:11px;letter-spacing:.04em}.universe-inspector small{display:block;color:var(--muted);font-size:9px;line-height:1.5;margin-top:4px}.universe-inspector button{border:0;background:none;color:var(--lilac);font:9px 'neue-haas-grotesk-display';padding:8px 0 0;cursor:pointer}.universe-inspector-moments{display:grid;gap:3px;margin-top:8px;max-height:120px;overflow:auto}.universe-inspector-moments a{display:block;color:var(--lilac);font:9px 'neue-haas-grotesk-display';line-height:1.35;text-decoration:none}.universe-inspector-moments a:hover,.universe-inspector-moments a:focus-visible{color:var(--paper);text-decoration:underline}.universe-controls{position:absolute;right:18px;top:17px;display:flex;gap:6px}.universe-controls button{border:1px solid rgba(243,240,237,.16);background:rgba(8,8,13,.65);color:var(--muted);padding:6px 8px;border-radius:999px;font:9px 'neue-haas-grotesk-display';cursor:pointer}.universe-controls button:hover,.universe-controls button:focus-visible{border-color:var(--lilac);color:var(--paper)}.universe-map-key{position:absolute;left:50%;top:25%;transform:translateX(-50%);display:flex;gap:25px;color:rgba(243,240,237,.78);font:10px 'neue-haas-grotesk-display';letter-spacing:.16em}.universe-map-key span{position:relative}.universe-map-key span+span:before{content:'→';position:absolute;left:-18px;color:var(--lilac)}
  @media(max-width:700px){.universe-node-label,.universe-map-key{display:none}.universe-controls{top:auto;right:12px;bottom:12px}.universe-hint{bottom:49px;font-size:8px}.universe-foot{right:12px;bottom:55px}.universe-heading{left:12px;top:12px}.universe-inspector{left:12px;bottom:12px}}
`;

styles.textContent += '@media(prefers-reduced-motion:reduce){.universe-inspector{transition:none}}';
styles.textContent += '.universe-stage{background:#f1f1ef}.universe-node-label{color:rgba(17,17,19,.72);text-shadow:0 1px 8px rgba(255,255,255,.9)}.universe-node-label--row{border-left-color:rgba(238,98,91,.4)}.universe-node-label--row:hover{color:#111113;border-left-color:#ee625b}.universe-heading{color:#111113}.universe-heading span,.universe-hint,.universe-foot small{color:#77777b}.universe-map-key{color:rgba(17,17,19,.72)}.universe-controls button{border-color:rgba(17,17,19,.18);background:rgba(255,255,255,.78);color:#55545a}.universe-controls button:hover,.universe-controls button:focus-visible{border-color:#ee625b;color:#111113}.universe-inspector{background:rgba(255,255,255,.9);border-left-color:#ee625b}.universe-inspector strong{color:#111113}.universe-inspector button{color:#c84b46}.universe-access-list{background:rgba(255,255,255,.94);border-color:#dededb}.universe-access-row{border-bottom-color:rgba(17,17,19,.1)}.universe-access-row button,.universe-access-row a{color:#77777b}.universe-access-row button[aria-pressed="true"],.universe-access-row button:hover,.universe-access-row button:focus-visible,.universe-access-row a:hover,.universe-access-row a:focus-visible{color:#111113;background:rgba(238,98,91,.1)}';
document.head.appendChild(styles);
host.innerHTML = `<div class="universe-stage"><div class="universe-ui"><div class="universe-heading">BROWSE THE ARCHIVE MAP <span>INDEXING IN PROGRESS</span></div><div class="universe-hint">DRAG TO ORBIT · SCROLL TO ZOOM · CLICK A NODE</div><div class="universe-controls"><button type="button" data-back hidden>← FULL MAP</button><button type="button" data-reset>RESET VIEW</button><button type="button" data-focus>FOCUS EVIDENCE</button></div><div class="universe-inspector" hidden tabindex="-1" role="region" aria-label="Selected archive node" aria-live="polite"><strong></strong><small></small><button type="button" data-open hidden>Inspect source ↗</button></div></div></div>`;

const stage = host.querySelector('.universe-stage');
const canvas = document.createElement('canvas');
canvas.setAttribute('role', 'img');
canvas.setAttribute('aria-label', '3D archive map. Use Browse featured archive nodes to select a topic, video, or citation; use its separate source link to open the original.');
stage.prepend(canvas);

const graphLayerButtons = [...document.querySelectorAll('.layer[data-graph-layer]')];
let requestedGraphLayer = 'topics';
let applyGraphLayer = null;
function setGraphLayer(layer) {
  if (!['topics', 'videos', 'evidence'].includes(layer)) return;
  requestedGraphLayer = layer;
  graphLayerButtons.forEach(button => {
    const active = button.dataset.graphLayer === layer;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  applyGraphLayer?.(layer);
}
graphLayerButtons.forEach(button => button.addEventListener('click', () => setGraphLayer(button.dataset.graphLayer)));
setGraphLayer(requestedGraphLayer);
graphLayerButtons.forEach(button => { button.disabled = false; });

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
stage.querySelector('[data-reset]').addEventListener('click', () => { if (focusedTopicNode) { exitTopicFocus(); return; } if (activeGraphLayer !== 'topics') setGraphLayer('topics'); camera.position.set(0, 0, 19); controls.target.set(0, 0, 0); controls.update(); requestRender(); });
stage.querySelector('[data-focus]').addEventListener('click', () => { setGraphLayer('evidence'); camera.position.set(0, .4, 8); controls.target.set(0, 0, 0); controls.update(); requestRender(); });

const root = new THREE.Group();
scene.add(root);
const nodeGeometry = new THREE.SphereGeometry(.055, 8, 8);
const evidenceGeometry = new THREE.SphereGeometry(.15, 16, 16);
const nodes = [];
const catalogue = await fetch('/api/catalog').then(response => response.ok ? response.json() : []).catch(() => []);
const graph = await fetch('/topic-graph.json').then(response => response.ok ? response.json() : { nodes: [], edges: [] }).catch(() => ({ nodes: [], edges: [] }));
const videoGraph = await fetch('/video-links.json').then(response => response.ok ? response.json() : { nodes: [], edges: [] }).catch(() => ({ nodes: [], edges: [] }));
const subtopicData = await fetch('/topic-subtopics.json').then(response => response.ok ? response.json() : {}).catch(() => ({}));

function addNode(data, position, geometry, scale = 1) {
  const material = new THREE.MeshBasicMaterial({ color: data.color || 0x8c8792, transparent: true, opacity: data.kind === 'episode' ? .72 : 1 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.scale.setScalar(scale);
  mesh.userData = { ...data, baseScale: scale };
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
const familyCounts = topicFamilies.map(([, pattern]) => graph.nodes.filter(topic => pattern.test(topic.label)).length);
const familyIndexes = topicFamilies.map(() => 0);
const maxOccurrences = Math.max(1, ...graph.nodes.map(topic => topic.occurrences || 0));
const topicNodes = graph.nodes.map((topic, index) => {
  const family = topicFamilies.findIndex(([, pattern]) => pattern.test(topic.label));
  const familyIndex = Math.max(family, 0) % clusterCenters.length; const localIndex = familyIndexes[familyIndex]++; const localProgress = localIndex / Math.max(familyCounts[familyIndex] - 1, 1);
  const cluster = clusterCenters[familyIndex]; const theta = localIndex * 2.399963 + familyIndex * .7; const spread = 1.2 + Math.sqrt(localProgress) * 4.1;
  const position = new THREE.Vector3(cluster.x + Math.cos(theta) * spread, cluster.y + Math.sin(theta) * spread * .7, cluster.z + Math.sin(index * 1.73) * .75);
  topicPositions.set(topic.id, position);
  return addNode({ id: topic.id, kind: 'topic', title: topic.label, occurrences: topic.occurrences, episodeCount: topic.episodeCount, seconds: topic.seconds, source: topic.source, sourceTitle: topic.sourceTitle, sources: topic.sources, query: topic.label, color: topicColor(topic.label) }, position, nodeGeometry, .7 + .6 * Math.sqrt((topic.occurrences || 0) / maxOccurrences));
});
const topicLabels = [...topicNodes].sort((a, b) => b.userData.occurrences - a.userData.occurrences).slice(0, 12).map(node => {
  const label = document.createElement('span');
  label.className = 'universe-node-label';
  label.textContent = node.userData.title;
  stage.appendChild(label);
  return { node, label };
});
const topicBackgrounds = [];
for (const [index, center] of clusterCenters.entries()) {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128; const context = canvas.getContext('2d'); const color = new THREE.Color(topicFamilies[index][2]); const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 64); gradient.addColorStop(0, `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},.22)`); gradient.addColorStop(1, 'rgba(0,0,0,0)'); context.fillStyle = gradient; context.fillRect(0, 0, 128, 128); const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, opacity: .75 })); sprite.position.copy(center); sprite.scale.set(4.4, 4.4, 1); root.add(sprite); topicBackgrounds.push(sprite);
}
const videoPositions = new Map();
const videoNodes = videoGraph.nodes.map((video, index) => {
  const progress = index / Math.max(videoGraph.nodes.length, 1); const arm = index % 5; const radius = 6.2 + (index % 11) * .12; const theta = arm * (Math.PI * 2 / 5) + progress * 12.5;
  const position = new THREE.Vector3(Math.cos(theta) * radius, Math.sin(theta * 1.6 + arm) * radius * .24, Math.sin(theta) * radius * .58);
  videoPositions.set(video.id, position);
  return addNode({ id: video.id, kind: 'video', title: video.title, source: video.source, seconds: video.seconds, query: video.title, color: topicColor(video.title) }, position, nodeGeometry, 1.5);
});
const evidencePositions = [new THREE.Vector3(-2.5, -.9, .8), new THREE.Vector3(2.2, 1.55, .4), new THREE.Vector3(2.8, -.95, -.5)];
const evidenceNodes = evidence.map((item, index) => addNode({ ...item, kind: 'evidence' }, evidencePositions[index], evidenceGeometry));
const graphAccess = document.createElement('details'); graphAccess.className = 'universe-access'; const graphSummary = document.createElement('summary'); graphSummary.textContent = 'Browse featured archive nodes'; graphAccess.appendChild(graphSummary); const graphList = document.createElement('div'); graphList.className = 'universe-access-list'; const graphSelectionButtons = new Map();
function nodeSourceUrl(data) {
  const source = data.source || (data.videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(data.videoId)}` : '');
  if (!source) return null;
  try {
    const url = new URL(source);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.searchParams.set('t', `${Math.max(0, Math.round(Number(data.seconds) || 0))}s`);
    return url.href;
  } catch { return null; }
}
for (const node of [...topicNodes.slice(0, 30), ...videoNodes.slice(0, 30), ...evidenceNodes]) {
  const data = node.userData;
  const key = `${data.kind}:${data.id}`;
  const row = document.createElement('div'); row.className = 'universe-access-row';
  const select = document.createElement('button'); select.type = 'button'; select.className = 'universe-select-node'; select.setAttribute('aria-pressed', 'false');
  select.textContent = data.kind === 'evidence' ? `CITATION · ${data.guest} · ${data.title}` : `${data.kind === 'video' ? 'VIDEO' : 'TOPIC'} · ${data.title}`;
  select.addEventListener('click', () => { const layer = data.kind === 'evidence' ? 'evidence' : data.kind === 'video' ? 'videos' : 'topics'; if (activeGraphLayer !== layer) setGraphLayer(layer); selectNode(node); });
  graphSelectionButtons.set(key, select); row.appendChild(select);
  const href = nodeSourceUrl(data);
  if (href) { const sourceLink = document.createElement('a'); sourceLink.className = 'universe-node-source'; sourceLink.textContent = 'OPEN SOURCE ↗'; sourceLink.href = href; sourceLink.target = '_blank'; sourceLink.rel = 'noopener noreferrer'; sourceLink.setAttribute('aria-label', `Open source for ${data.title} at ${formatTime(data.seconds)}`); row.appendChild(sourceLink); }
  graphList.appendChild(row);
}
graphAccess.appendChild(graphList); stage.appendChild(graphAccess);
const core = addNode({ kind: 'core', title: 'Conversation', query: 'What have guests said about conversation?' }, new THREE.Vector3(0, 0, 0), new THREE.SphereGeometry(.23, 20, 20), 1);
core.material.color.set(0xf3f0ed);

const linkMaterial = new THREE.LineBasicMaterial({ color: 0xc7a7ff, transparent: true, opacity: .55 });
const evidenceCoreLines = [];
for (const node of evidenceNodes) {
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([node.position, core.position]), linkMaterial); root.add(line); evidenceCoreLines.push(line);
}
const topicCoreLines = [];
for (const node of topicNodes.slice(0, 36)) {
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([node.position, core.position]), new THREE.LineBasicMaterial({ color: 0x686271, transparent: true, opacity: .18 })); root.add(line); topicCoreLines.push(line);
}
// Thin only rendered connections; retain the full graphs for inspection.
const topicEdgeWeights = graph.edges.map(edge => edge.weight).sort((a, b) => a - b);
const topicEdgeThreshold = topicEdgeWeights[Math.floor(topicEdgeWeights.length * .85)] ?? Infinity;
const visibleTopicEdges = graph.edges.filter(edge => edge.weight >= topicEdgeThreshold);
const edgePositions = [];
for (const edge of visibleTopicEdges) { const from = topicPositions.get(edge.source); const to = topicPositions.get(edge.target); if (from && to) edgePositions.push(from.x, from.y, from.z, to.x, to.y, to.z); }
const graphLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x665b78, transparent: true, opacity: .12 }));
graphLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
root.add(graphLines);
// A small neural signal layer gives the concept field a living rhythm without adding hit targets.
const neuralLinks = [];
for (const [index, edge] of visibleTopicEdges.slice(0, 18).entries()) {
  const from = topicPositions.get(edge.source); const to = topicPositions.get(edge.target);
  if (!from || !to) continue;
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([from, to]),
    new THREE.LineBasicMaterial({ color: topicColor(graph.nodes.find(node => node.id === edge.source)?.label || ''), transparent: true, opacity: 0, depthWrite: false })
  );
  line.userData.signalPhase = index / 18;
  root.add(line); neuralLinks.push(line);
}
const videoEdgeWeights = videoGraph.edges.map(edge => edge.score).sort((a, b) => a - b);
const videoEdgeThreshold = videoEdgeWeights[Math.floor(videoEdgeWeights.length * .90)] ?? Infinity;
const visibleVideoEdges = videoGraph.edges.filter(edge => edge.score >= videoEdgeThreshold);
const videoEdgePositions = [];
const videoEdgePairs = [];
for (const edge of visibleVideoEdges) { const from = videoPositions.get(edge.source); const to = videoPositions.get(edge.target); if (from && to) { videoEdgePositions.push(from.x, from.y, from.z, to.x, to.y, to.z); if (videoEdgePairs.length < 220) videoEdgePairs.push([from, to]); } }
const videoLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xe5bd77, transparent: true, opacity: .12 }));
videoLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(videoEdgePositions, 3));
root.add(videoLines);
const videoById = new Map(videoGraph.nodes.map(video => [video.id, video]));
const connectionMarkers = [];
for (const edge of videoGraph.edges) { const from = videoPositions.get(edge.source); const to = videoPositions.get(edge.target); if (!from || !to) continue; const marker = addNode({ kind: 'connection', title: 'Semantic connection', score: edge.score, relationship: edge.relationship, fromVideo: videoById.get(edge.source), toVideo: videoById.get(edge.target), source: videoById.get(edge.source)?.source, seconds: videoById.get(edge.source)?.seconds }, from.clone().add(to).multiplyScalar(.5), new THREE.SphereGeometry(.13, 6, 6), .8); marker.material.opacity = 0; connectionMarkers.push(marker); }
const sparkPositions = new Float32Array(videoEdgePairs.length * 3); const sparks = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xffe3a6, size: .065, transparent: true, opacity: .9, depthWrite: false })); sparks.geometry.setAttribute('position', new THREE.Float32BufferAttribute(sparkPositions, 3)); root.add(sparks);

const stars = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xf3f0ed, size: .025, transparent: true, opacity: .38 }));
const starPositions = [];
for (let index = 0; index < 260; index += 1) { const angle = index * 2.399963; const radius = 8 + (index % 11) * .5; starPositions.push(Math.cos(angle) * radius, ((index % 19) - 9) * .48, Math.sin(angle) * radius); }
stars.geometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
scene.add(stars);

const headingMeta = stage.querySelector('.universe-heading span');
headingMeta.textContent = `${topicNodes.length} TOPICS · ${videoGraph.indexedVideoCount || videoNodes.length} INDEXED VIDEOS · ${videoGraph.edges.length} LINKS`;
window.dispatchEvent(new CustomEvent('archive:counts', { detail: { topics: topicNodes.length, episodes: videoNodes.length, evidence: evidenceNodes.length, graphTranscripts: graph.transcriptCount || 0 } }));
const inspector = stage.querySelector('.universe-inspector');
const inspectorTitle = inspector.querySelector('strong');
const inspectorMeta = inspector.querySelector('small');
const openButton = inspector.querySelector('[data-open]');
const inspectorMoments = document.createElement('div'); inspectorMoments.className = 'universe-inspector-moments'; inspectorMoments.setAttribute('aria-label', 'Linked transcript moments'); inspector.appendChild(inspectorMoments);
let selected = null;
const activeIds = new Set();
let activeGraphLayer = 'topics';
let visibleNodes = [];

applyGraphLayer = layer => {
  if (focusedTopicNode) exitTopicFocus(true);
  const visible = graphLayerVisibility(layer);
  topicNodes.forEach(node => { node.visible = visible.topics; });
  videoNodes.forEach(node => { node.visible = visible.videos; });
  evidenceNodes.forEach(node => { node.visible = visible.evidence; });
  topicLabels.forEach(({ label }) => { label.hidden = !visible.topics; });
  topicBackgrounds.forEach(background => { background.visible = visible.topics; });
  topicCoreLines.forEach(line => { line.visible = visible.topics; });
  evidenceCoreLines.forEach(line => { line.visible = visible.evidence; });
  graphLines.visible = visible.topics;
  neuralLinks.forEach(line => { line.visible = visible.topics; });
  videoLines.visible = visible.videos;
  connectionMarkers.forEach(marker => { marker.visible = visible.videos; });
  sparks.visible = visible.videos;
  core.visible = true;
  visibleNodes = nodes.filter(node => graphNodeIsVisible(layer, node.userData.kind));
  if (activeGraphLayer !== layer) {
    activeIds.clear();
    if (selected && selected.userData.kind !== 'core' && !visible[selected.userData.kind]) {
      selected = null;
      for (const button of graphSelectionButtons.values()) button.setAttribute('aria-pressed', 'false');
      inspector.hidden = true;
      inspector.classList.remove('visible');
    }
  }
  activeGraphLayer = layer;
  graphLayerButtons.forEach(button => {
    const active = button.dataset.graphLayer === layer;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  requestRender();
};
setGraphLayer(requestedGraphLayer);

function selectNode(node) {
  selected = node;
  const data = node.userData;
  for (const [key, button] of graphSelectionButtons) button.setAttribute('aria-pressed', String(key === `${data.kind}:${data.id}`));
  activeIds.clear(); if (data.id) activeIds.add(data.id);
  if (data.kind === 'topic') for (const edge of graph.edges) if (edge.source === data.id || edge.target === data.id) { activeIds.add(edge.source); activeIds.add(edge.target); }
  if (data.kind === 'video') for (const edge of videoGraph.edges) if (edge.source === data.id || edge.target === data.id) { activeIds.add(edge.source); activeIds.add(edge.target); }
  if (data.kind === 'connection') { activeIds.add(data.fromVideo?.id); activeIds.add(data.toVideo?.id); }
  inspectorTitle.textContent = data.kind === 'connection' ? `${data.fromVideo?.title || 'Source A'} ↔ ${data.toVideo?.title || 'Source B'}` : data.title;
  inspectorMeta.textContent = data.kind === 'core' ? 'archive activation point · search to explore' : data.kind === 'connection' ? `${Math.round((data.score || 0) * 100)}% semantic similarity · ${data.relationship}` : data.kind === 'evidence' ? `${data.guest} · ${formatTime(data.seconds)} · indexed moment` : data.kind === 'subtopic' ? `"${data.topic}" sub-topic · ${data.count || 0} mentions · ${(data.moments || []).length} episode${(data.moments || []).length === 1 ? '' : 's'}` : data.kind === 'moment' ? `"${data.topic}" moment · ${data.count || 1} mentions in this episode · ${formatTime(data.seconds)}` : data.kind === 'video' ? `semantic video node · ${data.title.slice(0, 48)} · source video` : `${data.occurrences} mentions · ${data.sourceTitle || 'indexed episode'} · ${formatTime(data.seconds)}`;
  openButton.hidden = data.kind === 'core';
  openButton.textContent = data.kind === 'subtopic' ? 'Search this sub-topic ↗' : data.kind === 'connection' ? 'Open source A ↗' : data.kind === 'evidence' || data.kind === 'video' ? 'Watch source ↗' : data.kind === 'moment' ? `Open moment at ${formatTime(data.seconds)} ↗` : `Open source at ${formatTime(data.seconds)} ↗`;
  inspectorMoments.replaceChildren();
  const inspectorMomentItems = data.kind === 'topic' ? (data.sources || []) : data.kind === 'subtopic' ? (data.moments || []).map(moment => ({ title: moment.episode, url: `https://www.youtube.com/watch?v=${moment.videoId}`, seconds: moment.seconds })) : [];
  for (const moment of inspectorMomentItems) {
    const href = nodeSourceUrl({ source: moment.url, seconds: moment.seconds });
    if (!href) continue;
    const link = document.createElement('a'); link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = `${moment.title} · ${formatTime(moment.seconds)} ↗`; inspectorMoments.appendChild(link);
  }
  inspector.hidden = false;
  inspector.classList.add('visible');
  inspector.focus({ preventScroll: true });
  root.add(node);
  requestRender();
}

// --- topic zoom focus: click a topic -> camera dives in, topic breaks into clickable moment sub-nodes ---
const momentGeometry = new THREE.SphereGeometry(.09, 8, 8);
const backButton = stage.querySelector('[data-back]');
const hintEl = stage.querySelector('.universe-hint');
const defaultHint = hintEl.textContent;
let focusedTopicNode = null;
const focusMomentNodes = [];
const focusMomentLines = [];
const focusMomentLabels = [];
const cameraTween = { active: false, start: null, duration: .9, fromPos: new THREE.Vector3(), toPos: new THREE.Vector3(), fromTarget: new THREE.Vector3(), toTarget: new THREE.Vector3() };

function tweenCamera(toPos, toTarget) {
  if (reducedMotion) { camera.position.copy(toPos); controls.target.copy(toTarget); controls.update(); requestRender(); return; }
  cameraTween.fromPos.copy(camera.position); cameraTween.toPos.copy(toPos);
  cameraTween.fromTarget.copy(controls.target); cameraTween.toTarget.copy(toTarget);
  cameraTween.start = null; cameraTween.active = true;
  requestRender();
}

function enterTopicFocus(node) {
  if (focusedTopicNode === node) return;
  exitTopicFocus(true);
  focusedTopicNode = node;
  const data = node.userData;
  const center = node.position;
  const subtopics = subtopicData[data.id]?.subtopics;
  const useSubtopics = Array.isArray(subtopics) && subtopics.length > 0;
  const moments = useSubtopics ? subtopics : (data.sources || []).slice(0, 8);
  const ringCount = Math.max(moments.length, 1);
  moments.forEach((moment, index) => {
    const angle = index / ringCount * Math.PI * 2 + Math.PI / ringCount;
    const position = new THREE.Vector3(center.x + Math.cos(angle) * 1.7, center.y + (index % 2 === 0 ? .3 : -.3), center.z + Math.sin(angle) * 1.7);
    const mesh = useSubtopics
      ? addNode({ id: `${data.id}:subtopic:${index}`, kind: 'subtopic', title: moment.name, count: moment.count, moments: moment.moments, query: `${data.title} ${moment.name}`, topic: data.title, color: data.color }, position, momentGeometry, 1)
      : addNode({ id: `${data.id}:moment:${index}`, kind: 'moment', title: moment.title, source: moment.url, seconds: moment.seconds, count: moment.count, topic: data.title, color: data.color }, position, momentGeometry, 1);
    mesh.material.opacity = 0;
    focusMomentNodes.push(mesh);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([center.clone(), position]), new THREE.LineBasicMaterial({ color: data.color, transparent: true, opacity: 0, depthWrite: false }));
    root.add(line); focusMomentLines.push(line);
    const label = document.createElement('span');
    label.className = 'universe-node-label';
    label.classList.add('universe-node-label--row');
    label.textContent = useSubtopics
      ? `${moment.name.length > 38 ? `${moment.name.slice(0, 38)}…` : moment.name} · ${moment.count}`
      : `${moment.title.length > 38 ? `${moment.title.slice(0, 38)}…` : moment.title} · ${formatTime(moment.seconds)}`;
    label.addEventListener('click', () => selectNode(mesh));
    stage.appendChild(label);
    focusMomentLabels.push({ node: mesh, label });
  });
  for (const other of topicNodes) if (other !== node) other.material.opacity = .05;
  topicLabels.forEach(({ label, node: labelNode }) => { label.hidden = labelNode !== node; });
  topicBackgrounds.forEach(background => { background.visible = false; });
  topicCoreLines.forEach(line => { line.visible = false; });
  graphLines.visible = false; neuralLinks.forEach(line => { line.visible = false; });
  core.visible = false;
  visibleNodes = [node, ...focusMomentNodes];
  const out = center.clone().normalize();
  if (out.lengthSq() < .01) out.set(0, .3, 1).normalize();
  tweenCamera(center.clone().add(out.multiplyScalar(3.4)).add(new THREE.Vector3(0, .9, 0)), center.clone());
  backButton.hidden = false;
  hintEl.textContent = useSubtopics ? 'CLICK A SUB-TOPIC · CLICK BACKGROUND FOR FULL MAP' : 'CLICK A MOMENT · CLICK BACKGROUND FOR FULL MAP';
  selectNode(node);
  requestRender();
}

function exitTopicFocus(keepCamera = false) {
  if (!focusedTopicNode) return;
  focusedTopicNode = null;
  for (const mesh of focusMomentNodes) { root.remove(mesh); mesh.material.dispose(); const at = nodes.indexOf(mesh); if (at >= 0) nodes.splice(at, 1); }
  focusMomentNodes.length = 0;
  for (const line of focusMomentLines) { root.remove(line); line.geometry.dispose(); line.material.dispose(); }
  focusMomentLines.length = 0;
  for (const { label } of focusMomentLabels) label.remove();
  focusMomentLabels.length = 0;
  backButton.hidden = true;
  hintEl.textContent = defaultHint;
  applyGraphLayer(activeGraphLayer);
  if (!keepCamera) tweenCamera(new THREE.Vector3(0, 0, 19), new THREE.Vector3(0, 0, 0));
  requestRender();
}
backButton.addEventListener('click', () => exitTopicFocus());

openButton.addEventListener('click', () => {
  const data = selected?.userData;
  if (!data) return;
  if (data.kind === 'connection') window.open(`${data.fromVideo.source}&t=${data.fromVideo.seconds}s`, '_blank', 'noopener');
  else if (data.kind === 'evidence' || data.kind === 'topic' || data.kind === 'video' || data.kind === 'moment') window.open(`${data.source || `https://www.youtube.com/watch?v=${data.videoId}`}&t=${Math.round(data.seconds)}s`, '_blank', 'noopener');
  else { const input = document.querySelector('#query'); input.value = data.query; document.querySelector('#search-form').requestSubmit(); }
});
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const tooltip = document.createElement('div');
tooltip.className = 'universe-tooltip';
tooltip.style.cssText = 'position:absolute;display:none;padding:7px 9px;border:1px solid rgba(199,167,255,.35);background:rgba(8,8,13,.9);color:#f3f0ed;font:9px DM Mono,monospace;pointer-events:none;z-index:5;max-width:190px';
stage.appendChild(tooltip);

function hit(event, pointerDown = false) {
  const bounds = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(visibleNodes);
  if (intersections.length || !pointerDown) return intersections;
  const projected = [];
  const position = new THREE.Vector3();
  for (const node of visibleNodes) {
    node.getWorldPosition(position).project(camera);
    if (position.z >= -1 && position.z <= 1) projected.push({ node, x: bounds.left + (position.x * .5 + .5) * bounds.width, y: bounds.top + (-position.y * .5 + .5) * bounds.height });
  }
  const nearest = nearestNodeWithinRadius(projected, event.clientX, event.clientY);
  return nearest ? [{ object: nearest }] : [];
}
canvas.addEventListener('pointermove', event => { const hitNode = hit(event)[0]?.object; canvas.style.cursor = hitNode ? 'pointer' : 'grab'; if (!hitNode) { tooltip.style.display = 'none'; return; } tooltip.textContent = hitNode.userData.kind === 'connection' ? `${Math.round((hitNode.userData.score || 0) * 100)}% semantic link · click to inspect` : hitNode.userData.kind === 'evidence' ? `${hitNode.userData.title} · ${hitNode.userData.time}` : hitNode.userData.kind === 'subtopic' ? `${hitNode.userData.title} · ${hitNode.userData.count} mentions · click to explore` : hitNode.userData.kind === 'moment' ? `${hitNode.userData.title} · ${formatTime(hitNode.userData.seconds)} · click to open moment` : hitNode.userData.kind === 'video' ? `${hitNode.userData.title} · video link` : `${hitNode.userData.title} · ${hitNode.userData.occurrences} mentions`; tooltip.style.display = 'block'; tooltip.style.left = `${event.clientX - stage.getBoundingClientRect().left + 12}px`; tooltip.style.top = `${event.clientY - stage.getBoundingClientRect().top + 12}px`; });
canvas.addEventListener('pointerdown', event => { const hitNode = hit(event, true)[0]?.object; if (hitNode) { if (hitNode.userData.kind === 'topic' && activeGraphLayer === 'topics') enterTopicFocus(hitNode); else selectNode(hitNode); } else if (focusedTopicNode) exitTopicFocus(); });

function resize() { const width = host.clientWidth; const height = host.clientHeight; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); requestRender(); }
new ResizeObserver(resize).observe(host);
resize();

function updateTopicLabels() { const width = stage.clientWidth; const height = stage.clientHeight; const point = new THREE.Vector3(); for (const { node, label } of topicLabels) { node.getWorldPosition(point).project(camera); label.style.left = `${(point.x * .5 + .5) * width}px`; label.style.top = `${(-point.y * .5 + .5) * height}px`; label.style.transform = 'translate(9px,-50%)'; label.style.opacity = point.z < 1 ? '.82' : '0'; } focusMomentLabels.forEach(({ label }, index) => { label.style.left = 'auto'; label.style.right = '18px'; label.style.top = `${64 + index * 24}px`; label.style.transform = 'none'; label.style.textAlign = 'right'; label.style.opacity = '.82'; }); }
function canRender({ ready, inView, visible }) { return ready && inView && visible; }
function shouldAnimate({ reduced, inView, visible }) { return !reduced && inView && visible; }
function requestRender() {
  if (!canRender({ ready: rendererReady, inView: stageInView, visible: pageVisible }) || frameId !== null) return;
  frameId = requestAnimationFrame(renderFrame);
}
function stopRendering() {
  if (frameId !== null) cancelAnimationFrame(frameId);
  frameId = null;
}
function renderFrame(timestamp) {
  frameId = null;
  if (!canRender({ ready: rendererReady, inView: stageInView, visible: pageVisible })) return;
  const now = timestamp / 1000;
  if (!reducedMotion) {
    if (!focusedTopicNode) root.rotation.y += .00005;
    stars.rotation.y -= .000013;
    videoLines.material.opacity = (activeIds.size ? .13 : .10) + (Math.sin(now * 1.6) + 1) * .01;
  } else {
    videoLines.material.opacity = activeIds.size ? .15 : .12;
  }
  if (cameraTween.active) {
    if (cameraTween.start === null) cameraTween.start = now;
    const p = Math.min(1, (now - cameraTween.start) / cameraTween.duration);
    const eased = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    camera.position.lerpVectors(cameraTween.fromPos, cameraTween.toPos, eased);
    controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, eased);
    if (p >= 1) { cameraTween.active = false; cameraTween.start = null; }
  }
  for (const node of topicNodes) {
    node.material.opacity = focusedTopicNode ? (node === focusedTopicNode ? .95 : .05) : activeIds.size ? (activeIds.has(node.userData.id) ? .95 : .20) : .72;
    const pulse = reducedMotion ? 1 : 1 + Math.max(0, Math.sin(now * 1.7 + node.userData.id.length * .41)) * .045;
    node.scale.setScalar(node.userData.baseScale * pulse * (node === focusedTopicNode ? 1.35 : 1));
  }
  for (const mesh of focusMomentNodes) {
    mesh.material.opacity = Math.min(.95, mesh.material.opacity + .045);
    const pulse = reducedMotion ? 1 : 1 + Math.max(0, Math.sin(now * 2.1 + mesh.position.x)) * .08;
    mesh.scale.setScalar(mesh.userData.baseScale * pulse);
  }
  for (const line of focusMomentLines) line.material.opacity = Math.min(.38, line.material.opacity + .018);
  for (const line of neuralLinks) {
    const phase = (now * .16 + line.userData.signalPhase) % 1;
    const envelope = Math.sin(phase * Math.PI);
    line.material.opacity = reducedMotion ? 0 : .05 + envelope * .19;
  }
  for (const node of videoNodes) node.material.opacity = activeIds.size ? (activeIds.has(node.userData.id) ? 1 : .18) : .75;
  for (let index = 0; index < videoEdgePairs.length; index += 1) {
    const [from, to] = videoEdgePairs[index];
    const phase = reducedMotion ? .5 : (now * (.08 + (index % 7) * .012) + index / videoEdgePairs.length) % 1;
    sparkPositions[index * 3] = from.x + (to.x - from.x) * phase;
    sparkPositions[index * 3 + 1] = from.y + (to.y - from.y) * phase;
    sparkPositions[index * 3 + 2] = from.z + (to.z - from.z) * phase;
  }
  sparks.geometry.attributes.position.needsUpdate = true;
  controls.update();
  updateTopicLabels();
  renderer.render(scene, camera);
  if (shouldAnimate({ reduced: reducedMotion, inView: stageInView, visible: pageVisible })) requestRender();
}

controls.addEventListener('change', requestRender);
document.addEventListener('visibilitychange', () => {
  pageVisible = document.visibilityState !== 'hidden';
  if (pageVisible) requestRender(); else stopRendering();
});
motionPreference.addEventListener('change', event => {
  reducedMotion = event.matches;
  controls.enableDamping = !reducedMotion;
  requestRender();
});
controls.enableDamping = !reducedMotion;
if (typeof IntersectionObserver === 'function') {
  new IntersectionObserver(([entry]) => {
    stageInView = entry.isIntersecting && entry.intersectionRatio > 0;
    if (stageInView) requestRender(); else stopRendering();
  }).observe(host);
}
rendererReady = true;
requestRender();
