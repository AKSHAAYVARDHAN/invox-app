import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { generateEarthTextures } from '../../utils/earthTextureGenerator';

export interface GlobeLandingNode {
    id: string;
    label: string;
    city: string;
    country: string;
    lat: number;
    lon: number;
    metric: string;
    details: string;
    type: 'IDEA' | 'PERSON' | 'QUERY' | 'COMMUNITY' | 'CLUSTER';
    accent?: boolean;
    position?: THREE.Vector3;
}

export const LANDING_GLOBE_NODES: GlobeLandingNode[] = [
    {
        id: 'node-tokyo',
        label: 'Quantum Systems Lab',
        city: 'Tokyo',
        country: 'Japan',
        lat: 35.6762,
        lon: 139.6503,
        metric: '840 Nodes Linked',
        details: 'Quantum Decoherence & Topological Superconductors',
        type: 'CLUSTER',
        accent: true,
    },
    {
        id: 'node-sf',
        label: 'Cognitive Architectures',
        city: 'San Francisco',
        country: 'USA',
        lat: 37.7749,
        lon: -122.4194,
        metric: '1.4k Insights',
        details: 'Neurosymbolic Reasoning & Active Inference',
        type: 'QUERY',
    },
    {
        id: 'node-zurich',
        label: 'Biomolecular Simulation',
        city: 'Zurich',
        country: 'Switzerland',
        lat: 47.3769,
        lon: 8.5417,
        metric: '620 Explorers',
        details: 'Synthetic Biology & Generative Protein Folding',
        type: 'COMMUNITY',
        accent: true,
    },
    {
        id: 'node-bengaluru',
        label: 'Distributed Systems Core',
        city: 'Bengaluru',
        country: 'India',
        lat: 12.9716,
        lon: 77.5946,
        metric: '2.1k Ideas',
        details: 'Autonomous Swarms & High-Scale Epistemics',
        type: 'CLUSTER',
        accent: true,
    },
    {
        id: 'node-london',
        label: 'Philosophy of Mind',
        city: 'London',
        country: 'United Kingdom',
        lat: 51.5074,
        lon: -0.1278,
        metric: '98 Discussions',
        details: 'Consciousness, Epistemology & Formal Logic',
        type: 'PERSON',
    },
    {
        id: 'node-saopaulo',
        label: 'Computational Ecology',
        city: 'São Paulo',
        country: 'Brazil',
        lat: -23.5505,
        lon: -46.6333,
        metric: '410 Contributors',
        details: 'Planetary Biosphere Modeling & Complex Systems',
        type: 'COMMUNITY',
    },
    {
        id: 'node-singapore',
        label: 'Decentralized Intelligence',
        city: 'Singapore',
        country: 'Singapore',
        lat: 1.3521,
        lon: 103.8198,
        metric: '1.8k Comrades',
        details: 'Zero-Knowledge Verification & Co-Creation Mesh',
        type: 'CLUSTER',
    },
    {
        id: 'node-berlin',
        label: 'Algorithmic Aesthetics',
        city: 'Berlin',
        country: 'Germany',
        lat: 52.5200,
        lon: 13.4050,
        metric: '390 Arguments',
        details: 'Generative Synthesis & Media Theory',
        type: 'IDEA',
    },
    {
        id: 'node-sydney',
        label: 'Deep Space Observation',
        city: 'Sydney',
        country: 'Australia',
        lat: -33.8688,
        lon: 151.2093,
        metric: '530 Telescopes',
        details: 'Exoplanet Spectroscopy & Orbital Telemetry',
        type: 'COMMUNITY',
    },
    {
        id: 'node-paris',
        label: 'Symbolic Math Collective',
        city: 'Paris',
        country: 'France',
        lat: 48.8566,
        lon: 2.3522,
        metric: '750 Threads',
        details: 'Category Theory & Proof Assistants',
        type: 'IDEA',
    },
    {
        id: 'node-nairobi',
        label: 'African Frontier Tech',
        city: 'Nairobi',
        country: 'Kenya',
        lat: -1.2921,
        lon: 36.8219,
        metric: '340 Researchers',
        details: 'Distributed Climate Sensors & Open Energy',
        type: 'CLUSTER',
    },
    {
        id: 'node-newyork',
        label: 'Information Markets',
        city: 'New York',
        country: 'USA',
        lat: 40.7128,
        lon: -74.0060,
        metric: '1.1k Traders',
        details: 'Epistemic Prediction Markets & Decision Theory',
        type: 'QUERY',
    },
];

const LANDING_GLOBE_CONNECTIONS: Array<[string, string, boolean]> = [
    ['node-tokyo', 'node-sf', true],
    ['node-sf', 'node-zurich', false],
    ['node-zurich', 'node-london', false],
    ['node-london', 'node-bengaluru', true],
    ['node-bengaluru', 'node-tokyo', true],
    ['node-sf', 'node-saopaulo', false],
    ['node-london', 'node-berlin', false],
    ['node-tokyo', 'node-singapore', true],
    ['node-singapore', 'node-bengaluru', false],
    ['node-singapore', 'node-sydney', false],
    ['node-berlin', 'node-paris', false],
    ['node-zurich', 'node-nairobi', false],
    ['node-nairobi', 'node-bengaluru', false],
    ['node-newyork', 'node-london', true],
    ['node-newyork', 'node-sf', false],
    ['node-saopaulo', 'node-nairobi', false],
];

const GLOBE_RADIUS = 140;

/** Convert spherical latitude/longitude to 3D Cartesian coordinates */
function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    return new THREE.Vector3(x, y, z);
}

/**
 * Generate tactical target reticle canvas textures for node beacons
 */
function createTargetReticleTexture(isAccent: boolean): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const center = size / 2;
    const primaryColor = isAccent ? '#34d399' : '#ffffff';
    const glowColor = isAccent ? 'rgba(52, 211, 153, 0.45)' : 'rgba(255, 255, 255, 0.35)';
    const accentColor = isAccent ? '#10b981' : '#cbd5e1';

    // 1. Outer corner tactical bracket notches
    const bracketRadius = 92;
    const bracketAngle = Math.PI * 0.22;
    const quadrants = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];

    quadrants.forEach(q => {
        ctx.beginPath();
        ctx.arc(center, center, bracketRadius, q - bracketAngle * 0.5, q + bracketAngle * 0.5);
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // Cardinal tick mark on each quadrant
        const tx1 = center + Math.cos(q) * (bracketRadius - 12);
        const ty1 = center + Math.sin(q) * (bracketRadius - 12);
        const tx2 = center + Math.cos(q) * (bracketRadius + 10);
        const ty2 = center + Math.sin(q) * (bracketRadius + 10);
        ctx.beginPath();
        ctx.moveTo(tx1, ty1);
        ctx.lineTo(tx2, ty2);
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();
    });

    // 2. Mid precision telemetry ring
    ctx.beginPath();
    ctx.arc(center, center, 56, 0, Math.PI * 2);
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 6.0;
    ctx.stroke();

    // 3. Subtle outer radial halo aura
    const grad = ctx.createRadialGradient(center, center, 4, center, center, 42);
    grad.addColorStop(0, primaryColor);
    grad.addColorStop(0.5, isAccent ? 'rgba(52, 211, 153, 0.8)' : 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(center, center, 42, 0, Math.PI * 2);
    ctx.fill();

    // 4. Hot center core dot
    ctx.beginPath();
    ctx.arc(center, center, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Sharp stroke around inner core
    ctx.beginPath();
    ctx.arc(center, center, 18, 0, Math.PI * 2);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3.0;
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearMipMapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    return texture;
}

/**
 * Radar ping wave texture for expanding ripples around active beacon nodes
 */
function createPulseWaveTexture(isAccent: boolean): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const center = size / 2;
    const strokeColor = isAccent ? 'rgba(52, 211, 153, 0.9)' : 'rgba(255, 255, 255, 0.85)';

    // Multi-ring radar pulse
    ctx.beginPath();
    ctx.arc(center, center, 108, 0, Math.PI * 2);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 4.0;
    ctx.stroke();

    // Faint inner secondary echo ring
    ctx.beginPath();
    ctx.arc(center, center, 74, 0, Math.PI * 2);
    ctx.strokeStyle = isAccent ? 'rgba(52, 211, 153, 0.4)' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2.0;
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

/**
 * Glowing energy packet sprite texture for photon data packets gliding over arcs
 */
function createPacketSpriteTexture(isSpecial: boolean): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const center = size / 2;
    const grad = ctx.createRadialGradient(center, center, 0, center, center, size / 2);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.2, isSpecial ? '#34d399' : '#e0f2fe');
    grad.addColorStop(0.55, isSpecial ? 'rgba(16, 185, 129, 0.5)' : 'rgba(148, 163, 184, 0.4)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(center, center, size / 2, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

interface LandingHeroGlobeProps {
    onNodeSelect?: (node: { label: string; metric: string; details: string }) => void;
}

export const LandingHeroGlobe: React.FC<LandingHeroGlobeProps> = ({ onNodeSelect }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [hoveredNode, setHoveredNode] = useState<GlobeLandingNode | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [selectedNode, setSelectedNode] = useState<GlobeLandingNode | null>(null);
    const [showArcs, setShowArcs] = useState<boolean>(true);

    const showArcsRef = useRef<boolean>(true);
    const selectedNodeRef = useRef<GlobeLandingNode | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const targetCameraLookAt = useRef<THREE.Vector3 | null>(null);
    const isInteractingRef = useRef(false);
    const lastInteractionTimeRef = useRef(Date.now());

    useEffect(() => {
        selectedNodeRef.current = selectedNode;
    }, [selectedNode]);

    useEffect(() => {
        showArcsRef.current = showArcs;
    }, [showArcs]);

    useEffect(() => {
        if (!containerRef.current) return;

        let renderer: THREE.WebGLRenderer;
        try {
            renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                powerPreference: 'high-performance',
            });
        } catch (e) {
            console.warn('WebGL initialization note:', e);
            return;
        }

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);

        const width = containerRef.current.clientWidth || 600;
        const height = containerRef.current.clientHeight || 600;

        const camera = new THREE.PerspectiveCamera(36, width / height, 1, 4000);
        camera.position.set(0, 45, 660);
        cameraRef.current = camera;

        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        containerRef.current.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.055;
        controls.enablePan = false;
        controls.minDistance = 280;
        controls.maxDistance = 1100;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.35;
        controlsRef.current = controls;

        const onStartInteraction = () => {
            isInteractingRef.current = true;
            controls.autoRotate = false;
            lastInteractionTimeRef.current = Date.now();
        };

        const onEndInteraction = () => {
            isInteractingRef.current = false;
            lastInteractionTimeRef.current = Date.now();
        };

        controls.addEventListener('start', onStartInteraction);
        controls.addEventListener('end', onEndInteraction);

        // ─── AMBIENT 3D STARFIELD PARTICLES (Depth & Parallax) ──────────────────
        const starGeo = new THREE.BufferGeometry();
        const starCount = 600;
        const starPositions = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount * 3; i += 3) {
            const r = 450 + Math.random() * 850;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            starPositions[i] = r * Math.sin(phi) * Math.cos(theta);
            starPositions[i + 1] = r * Math.cos(phi);
            starPositions[i + 2] = r * Math.sin(phi) * Math.sin(theta);
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        const starMat = new THREE.PointsMaterial({
            color: 0x94a3b8,
            size: 1.6,
            transparent: true,
            opacity: 0.45,
            blending: THREE.AdditiveBlending,
        });
        const starField = new THREE.Points(starGeo, starMat);
        scene.add(starField);

        // ─── 3D SPHERICAL LIGHTING ──────────────────────────────────────────────
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 1.6);
        sunLight.position.set(340, 260, 360);
        scene.add(sunLight);

        const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.7);
        fillLight.position.set(-320, -140, 180);
        scene.add(fillLight);

        const backLight = new THREE.DirectionalLight(0x475569, 0.5);
        backLight.position.set(0, -200, -350);
        scene.add(backLight);

        // ─── EARTH MESH & PROCEDURAL TEXTURES (Exact Hub Section Model) ──────────
        const { diffuseMap, specularMap, bumpMap } = generateEarthTextures();

        const globeGeometry = new THREE.SphereGeometry(GLOBE_RADIUS, 128, 128);
        const globeMaterial = new THREE.MeshPhongMaterial({
            map: diffuseMap,
            specularMap: specularMap,
            bumpMap: bumpMap,
            bumpScale: 1.4,
            specular: new THREE.Color(0x5a687d),
            shininess: 28,
            color: new THREE.Color(0xffffff),
            emissive: new THREE.Color(0x020408),
        });

        const globeGroup = new THREE.Group();
        globeGroup.rotation.y = -Math.PI * 0.44;
        scene.add(globeGroup);

        const globeMesh = new THREE.Mesh(globeGeometry, globeMaterial);
        globeGroup.add(globeMesh);

        // ─── VOLUMETRIC ATMOSPHERIC SCATTERING (Exponential Limb Fade) ──────────
        const ATMO_RADIUS = GLOBE_RADIUS * 1.18;
        const atmosphereGeometry = new THREE.SphereGeometry(ATMO_RADIUS, 128, 128);
        const atmosphereMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uGlobeRadius: { value: GLOBE_RADIUS },
                uAtmoRadius: { value: ATMO_RADIUS },
            },
            vertexShader: `
                varying vec3 vViewPosition;
                varying vec3 vCenterInView;
                void main() {
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vViewPosition = mvPosition.xyz;
                    vec4 centerMv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                    vCenterInView = centerMv.xyz;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vViewPosition;
                varying vec3 vCenterInView;
                uniform float uGlobeRadius;
                uniform float uAtmoRadius;
                void main() {
                    vec3 rayDir = normalize(vViewPosition);
                    float dist = length(cross(rayDir, vCenterInView));
                    
                    float outerGlow = 0.0;
                    if (dist >= uGlobeRadius && dist < uAtmoRadius) {
                        float t = (dist - uGlobeRadius) / (uAtmoRadius - uGlobeRadius);
                        outerGlow = pow(1.0 - t, 2.6) * (1.0 - smoothstep(0.0, 1.0, t)) * 0.42;
                    }
                    
                    float innerGlow = 0.0;
                    if (dist < uGlobeRadius) {
                        float t = dist / uGlobeRadius;
                        innerGlow = pow(smoothstep(0.68, 1.0, t), 2.8) * 0.24;
                    }
                    
                    float totalAlpha = outerGlow + innerGlow;
                    if (totalAlpha <= 0.002) {
                        discard;
                    }
                    
                    vec3 rimColor = vec3(0.55, 0.68, 0.88);
                    gl_FragColor = vec4(rimColor, totalAlpha);
                }
            `,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false,
        });

        const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        scene.add(atmosphereMesh);

        // ─── NODES, BEACONS, ARCS & PHOTON PACKETS ──────────────────────────────
        const nodesGroup = new THREE.Group();
        globeGroup.add(nodesGroup);

        const arcsGroup = new THREE.Group();
        arcsGroup.visible = showArcsRef.current;
        globeGroup.add(arcsGroup);

        const nodeHitboxes: THREE.Mesh[] = [];
        const pulseSprites: Array<{ sprite: THREE.Sprite; seed: number; isAccent: boolean }> = [];
        const nodeMap = new Map<string, GlobeLandingNode & { position: THREE.Vector3 }>();

        const defaultReticleTexture = createTargetReticleTexture(false);
        const accentReticleTexture = createTargetReticleTexture(true);
        const defaultPulseTexture = createPulseWaveTexture(false);
        const accentPulseTexture = createPulseWaveTexture(true);
        const defaultPacketTexture = createPacketSpriteTexture(false);
        const specialPacketTexture = createPacketSpriteTexture(true);

        // Position nodes on spherical surface
        LANDING_GLOBE_NODES.forEach((node) => {
            const pos = latLonToVector3(node.lat, node.lon, GLOBE_RADIUS + 1.2);
            nodeMap.set(node.id, { ...node, position: pos });
        });

        const lineMeshes: Array<{
            mesh: THREE.Line;
            glowMesh: THREE.Line;
            arcId: string;
            fullPoints: THREE.Vector3[];
            drawProgress: number;
        }> = [];

        const packetComets: Array<{
            headSprite: THREE.Sprite;
            tailSprites: THREE.Sprite[];
            curve: THREE.CubicBezierCurve3;
            speed: number;
            progress: number;
            isSpecial: boolean;
        }> = [];

        const rebuildVisualNetwork = () => {
            // Clean children
            while (nodesGroup.children.length > 0) {
                const child = nodesGroup.children[0];
                nodesGroup.remove(child);
            }
            nodeHitboxes.length = 0;
            pulseSprites.length = 0;

            while (arcsGroup.children.length > 0) {
                const child = arcsGroup.children[0];
                arcsGroup.remove(child);
            }
            lineMeshes.length = 0;
            packetComets.length = 0;

            const selected = selectedNodeRef.current;

            // 1. Build Target Reticle Billboard Sprites & 3D Ground Stems
            Array.from(nodeMap.values()).forEach((node, idx) => {
                const isAccent = !!node.accent;
                const isSelected = selected && selected.id === node.id;
                const reticleTex = (isAccent || isSelected) ? accentReticleTexture : defaultReticleTexture;
                const pulseTex = (isAccent || isSelected) ? accentPulseTexture : defaultPulseTexture;

                // A. Ground Anchor Ring directly on the sphere's surface
                const groundPos = node.position.clone().normalize().multiplyScalar(GLOBE_RADIUS + 0.3);
                const surfaceNormal = groundPos.clone().normalize();

                const ringGeo = new THREE.RingGeometry(1.8, 2.4, 24);
                const ringMat = new THREE.MeshBasicMaterial({
                    color: isAccent ? 0x34d399 : (isSelected ? 0x67e8f9 : 0xffffff),
                    transparent: true,
                    opacity: isAccent ? 0.85 : 0.45,
                    side: THREE.DoubleSide,
                    depthWrite: false,
                });
                const groundRing = new THREE.Mesh(ringGeo, ringMat);
                groundRing.position.copy(groundPos);
                groundRing.lookAt(groundPos.clone().add(surfaceNormal));
                nodesGroup.add(groundRing);

                // B. Vertical Beacon Light Spike connecting ground to elevated reticle
                const elevatedPos = node.position.clone().normalize().multiplyScalar(GLOBE_RADIUS + 3.8);
                const spikeGeo = new THREE.BufferGeometry().setFromPoints([groundPos, elevatedPos]);
                const spikeMat = new THREE.LineBasicMaterial({
                    color: isAccent ? 0x34d399 : (isSelected ? 0x67e8f9 : 0x94a3b8),
                    transparent: true,
                    opacity: isAccent ? 0.9 : 0.5,
                });
                const spikeLine = new THREE.Line(spikeGeo, spikeMat);
                nodesGroup.add(spikeLine);

                // C. Main Tactical Reticle Sprite
                const spriteMat = new THREE.SpriteMaterial({
                    map: reticleTex,
                    transparent: true,
                    opacity: 0.98,
                    depthWrite: false,
                });
                const sprite = new THREE.Sprite(spriteMat);
                sprite.position.copy(elevatedPos);
                const spriteSize = isAccent ? 13.5 : (isSelected ? 14 : 11.5);
                sprite.scale.set(spriteSize, spriteSize, 1);
                nodesGroup.add(sprite);

                // D. Animated Concentric Radar Pulse Ring Sprite
                const pulseMat = new THREE.SpriteMaterial({
                    map: pulseTex,
                    transparent: true,
                    opacity: isAccent ? 0.85 : 0.45,
                    depthWrite: false,
                });
                const pulseSprite = new THREE.Sprite(pulseMat);
                pulseSprite.position.copy(elevatedPos);
                pulseSprite.scale.set(spriteSize, spriteSize, 1);
                nodesGroup.add(pulseSprite);
                pulseSprites.push({ sprite: pulseSprite, seed: idx * 1.35, isAccent });

                // E. Precision Hitbox for Hover Raycasting
                const hitGeo = new THREE.SphereGeometry(9.0, 12, 12);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.copy(elevatedPos);
                hitMesh.userData = { node };
                nodesGroup.add(hitMesh);
                nodeHitboxes.push(hitMesh);
            });

            // 2. Build High Parabolic Connection Arcs & Gliding Photon Comets
            LANDING_GLOBE_CONNECTIONS.forEach(([fromId, toId, isSpecialConn], i) => {
                const nodeA = nodeMap.get(fromId);
                const nodeB = nodeMap.get(toId);
                if (!nodeA || !nodeB) return;

                const p1 = nodeA.position;
                const p2 = nodeB.position;
                const angularDist = p1.angleTo(p2);

                const elevation = GLOBE_RADIUS * (1.12 + Math.sin(angularDist * 0.5) * 0.48);
                const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5).normalize().multiplyScalar(elevation);

                const c1 = new THREE.Vector3().lerpVectors(p1, midPoint, 0.55).normalize().multiplyScalar(elevation * 0.94);
                const c2 = new THREE.Vector3().lerpVectors(p2, midPoint, 0.55).normalize().multiplyScalar(elevation * 0.94);

                const curve = new THREE.CubicBezierCurve3(p1, c1, c2, p2);
                const curvePoints = curve.getPoints(72);

                const isConnectedToSelected = selected && (fromId === selected.id || toId === selected.id);

                let arcColor = 0xf1f5f9;
                let glowColor = 0x94a3b8;
                let opacity = 0.72;
                let glowOpacity = 0.22;

                if (isConnectedToSelected || isSpecialConn) {
                    arcColor = 0x34d399;
                    glowColor = 0x10b981;
                    opacity = 0.95;
                    glowOpacity = 0.55;
                }

                if (selected && !isConnectedToSelected) {
                    opacity = 0.08;
                    glowOpacity = 0.03;
                }

                // Layer 1: Core trajectory line
                const lineGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
                const lineMaterial = new THREE.LineBasicMaterial({
                    color: arcColor,
                    transparent: true,
                    opacity: opacity,
                });
                const lineMesh = new THREE.Line(lineGeometry, lineMaterial);
                arcsGroup.add(lineMesh);

                // Layer 2: Ambient optical bloom glow line
                const glowGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
                const glowMaterial = new THREE.LineBasicMaterial({
                    color: glowColor,
                    transparent: true,
                    opacity: glowOpacity,
                    blending: THREE.AdditiveBlending,
                });
                const glowMesh = new THREE.Line(glowGeometry, glowMaterial);
                arcsGroup.add(glowMesh);

                lineMeshes.push({
                    mesh: lineMesh,
                    glowMesh: glowMesh,
                    arcId: `arc-${fromId}-${toId}`,
                    fullPoints: curvePoints,
                    drawProgress: 1.0,
                });

                // Layer 3: High-Speed Photon Energy Comet
                const isSpecial = isSpecialConn || !!isConnectedToSelected;
                const packetTex = isSpecial ? specialPacketTexture : defaultPacketTexture;

                const headMat = new THREE.SpriteMaterial({
                    map: packetTex,
                    transparent: true,
                    opacity: isSpecial ? 1.0 : 0.88,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                });
                const headSprite = new THREE.Sprite(headMat);
                const headSize = isSpecial ? 5.5 : 4.2;
                headSprite.scale.set(headSize, headSize, 1);
                headSprite.position.copy(curvePoints[0]);
                arcsGroup.add(headSprite);

                // Trailing sparks
                const tailSprites: THREE.Sprite[] = [];
                for (let t = 0; t < 3; t++) {
                    const tailMat = new THREE.SpriteMaterial({
                        map: packetTex,
                        transparent: true,
                        opacity: (0.55 - t * 0.15) * (isSpecial ? 1.0 : 0.8),
                        blending: THREE.AdditiveBlending,
                        depthWrite: false,
                    });
                    const tailSprite = new THREE.Sprite(tailMat);
                    const tailSize = headSize * (0.75 - t * 0.18);
                    tailSprite.scale.set(tailSize, tailSize, 1);
                    tailSprite.position.copy(curvePoints[0]);
                    arcsGroup.add(tailSprite);
                    tailSprites.push(tailSprite);
                }

                packetComets.push({
                    headSprite,
                    tailSprites,
                    curve,
                    speed: 0.0035 + (i % 4) * 0.0012,
                    progress: (i * 0.22) % 1.0,
                    isSpecial,
                });
            });
        };

        rebuildVisualNetwork();

        // ─── RAYCASTER & INTERACTION ───────────────────────────────────────────
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        const handlePointerMove = (e: MouseEvent) => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;

            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(nodeHitboxes);

            if (intersects.length > 0) {
                const node = intersects[0].object.userData.node as GlobeLandingNode;
                setHoveredNode(node);
                setTooltipPos({ x: e.clientX, y: e.clientY });
                if (containerRef.current) containerRef.current.style.cursor = 'pointer';
            } else {
                setHoveredNode(null);
                if (containerRef.current) containerRef.current.style.cursor = 'grab';
            }
        };

        const handleClick = () => {
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(nodeHitboxes);

            if (intersects.length > 0) {
                const node = intersects[0].object.userData.node as GlobeLandingNode;
                setSelectedNode(node);
                selectedNodeRef.current = node;
                rebuildVisualNetwork();

                if (onNodeSelect) {
                    onNodeSelect({
                        label: node.label,
                        metric: node.metric,
                        details: `${node.city}, ${node.country} // ${node.details}`,
                    });
                }

                const worldPos = node.position!.clone().applyMatrix4(globeGroup.matrixWorld);
                const targetPos = worldPos.clone().normalize().multiplyScalar(320);
                targetCameraLookAt.current = targetPos;
                controls.autoRotate = false;
                lastInteractionTimeRef.current = Date.now();
            } else {
                if (selectedNodeRef.current) {
                    setSelectedNode(null);
                    selectedNodeRef.current = null;
                    targetCameraLookAt.current = null;
                    rebuildVisualNetwork();
                }
            }
        };

        window.addEventListener('mousemove', handlePointerMove);
        window.addEventListener('click', handleClick);

        // ─── ANIMATION LOOP ───────────────────────────────────────────────────
        let animationFrameId: number;
        const clock = new THREE.Clock();

        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            const elapsedTime = clock.getElapsedTime();

            if (!isInteractingRef.current && Date.now() - lastInteractionTimeRef.current > 3500) {
                controls.autoRotate = true;
            }

            if (targetCameraLookAt.current) {
                camera.position.lerp(targetCameraLookAt.current, 0.045);
                if (camera.position.distanceTo(targetCameraLookAt.current) < 3) {
                    targetCameraLookAt.current = null;
                }
            }

            // Pulse & Rotate Concentric Node Rings Animation
            pulseSprites.forEach(({ sprite, seed, isAccent }) => {
                const speed = isAccent ? 2.2 : 1.6;
                const cycle = (elapsedTime * speed + seed) % (Math.PI * 2);
                const scaleMultiplier = 1.0 + (Math.sin(cycle) + 1.0) * (isAccent ? 0.5 : 0.4);
                const baseSize = isAccent ? 13.5 : 11.5;
                sprite.scale.set(baseSize * scaleMultiplier, baseSize * scaleMultiplier, 1);
                (sprite.material as THREE.SpriteMaterial).opacity = Math.max(0.04, 0.8 - Math.sin(cycle) * 0.5);
                (sprite.material as THREE.SpriteMaterial).rotation = elapsedTime * (isAccent ? 0.8 : -0.5) + seed;
            });

            // Flow Connection Packet Comets & Trailing Photon Sparks
            packetComets.forEach(comet => {
                comet.progress = (comet.progress + comet.speed) % 1.0;

                const headPt = comet.curve.getPoint(comet.progress);
                comet.headSprite.position.copy(headPt);

                const pulseFactor = 1.0 + Math.sin(comet.progress * Math.PI) * 0.35;
                const baseHeadSize = comet.isSpecial ? 5.5 : 4.2;
                comet.headSprite.scale.set(baseHeadSize * pulseFactor, baseHeadSize * pulseFactor, 1);

                comet.tailSprites.forEach((tail, tIdx) => {
                    const tailProgress = (comet.progress - (tIdx + 1) * 0.016 + 1.0) % 1.0;
                    const tailPt = comet.curve.getPoint(tailProgress);
                    tail.position.copy(tailPt);

                    const tailSize = (baseHeadSize * (0.75 - tIdx * 0.18)) * pulseFactor;
                    tail.scale.set(tailSize, tailSize, 1);
                });
            });

            controls.update();
            renderer.render(scene, camera);
        };

        animate();

        // ─── RESIZE OBSERVER ───────────────────────────────────────────────────
        const handleResize = () => {
            if (!containerRef.current) return;
            const newW = containerRef.current.clientWidth;
            const newH = containerRef.current.clientHeight;
            camera.aspect = newW / newH;
            camera.updateProjectionMatrix();
            renderer.setSize(newW, newH);
        };

        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(containerRef.current);
        window.addEventListener('resize', handleResize);

        // ─── CLEANUP ON UNMOUNT ───────────────────────────────────────────────
        return () => {
            cancelAnimationFrame(animationFrameId);
            resizeObserver.disconnect();
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handlePointerMove);
            window.removeEventListener('click', handleClick);

            controls.removeEventListener('start', onStartInteraction);
            controls.removeEventListener('end', onEndInteraction);
            controls.dispose();

            if (containerRef.current && renderer.domElement.parentNode) {
                containerRef.current.removeChild(renderer.domElement);
            }

            globeGeometry.dispose();
            globeMaterial.dispose();
            diffuseMap.dispose();
            specularMap.dispose();
            bumpMap.dispose();
            atmosphereGeometry.dispose();
            atmosphereMaterial.dispose();
            defaultReticleTexture.dispose();
            accentReticleTexture.dispose();
            defaultPulseTexture.dispose();
            accentPulseTexture.dispose();
            defaultPacketTexture.dispose();
            specialPacketTexture.dispose();
            renderer.dispose();
        };
    }, [onNodeSelect]);

    const handleResetView = () => {
        if (cameraRef.current && controlsRef.current) {
            targetCameraLookAt.current = new THREE.Vector3(0, 45, 660);
            setSelectedNode(null);
            selectedNodeRef.current = null;
        }
    };

    return (
        <div className="w-full h-full relative group bg-black select-none overflow-hidden font-mono">
            {/* 3D WebGL Canvas Viewport */}
            <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

            {/* Top Telemetry & Controls HUD */}
            <div className="absolute top-3 right-3 z-20 flex items-center gap-2 pointer-events-auto">
                <div className="bg-[#0c0c0e]/90 border border-zinc-800/90 px-3 py-1 flex items-center gap-2 shadow-xl backdrop-blur-md">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-none animate-pulse"></span>
                    <span className="text-[10px] text-zinc-300 font-mono font-medium tracking-wider">
                        {LANDING_GLOBE_NODES.length} HUBS <span className="text-zinc-600">/</span> {LANDING_GLOBE_CONNECTIONS.length} ARCS
                    </span>
                </div>

                <button
                    onClick={() => setShowArcs(prev => !prev)}
                    title={showArcs ? 'Hide Connection Arcs' : 'Show Connection Arcs'}
                    className={`border px-2.5 py-1 text-[10px] font-mono tracking-wider transition-colors shadow-lg active:scale-[0.98] flex items-center gap-1.5 ${
                        showArcs
                            ? 'bg-[#0c0c0e]/90 hover:bg-[#18181d] border-zinc-800/90 hover:border-zinc-600 text-zinc-300 hover:text-white'
                            : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                    }`}
                >
                    <span className={`w-1.5 h-1.5 ${showArcs ? 'bg-emerald-400' : 'bg-zinc-600'}`}></span>
                    <span>ARCS</span>
                </button>

                <button
                    onClick={handleResetView}
                    title="Recenter Camera"
                    className="bg-[#0c0c0e]/90 hover:bg-[#18181d] border border-zinc-800/90 hover:border-zinc-600 text-zinc-300 hover:text-white px-2.5 py-1 text-[10px] font-mono tracking-wider transition-colors shadow-lg active:scale-[0.98] flex items-center gap-1.5"
                >
                    <span className="text-zinc-500">↺</span>
                    <span>RESET</span>
                </button>
            </div>

            {/* Hover Tooltip (Dynamic Cursor HUD) */}
            {hoveredNode && !selectedNode && (
                <div
                    className="fixed pointer-events-none z-50 transition-opacity duration-150"
                    style={{ left: tooltipPos.x + 18, top: tooltipPos.y - 18 }}
                >
                    <div className="bg-[#0c0c0e]/95 backdrop-blur-md border border-zinc-800 p-3 shadow-2xl min-w-[210px] font-mono">
                        <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-zinc-800/80">
                            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                                // REGIONAL_NODE
                            </span>
                            <span className="w-1.5 h-1.5 bg-emerald-400"></span>
                        </div>

                        <h4 className="text-xs font-bold text-white tracking-tight truncate">
                            {hoveredNode.label}
                        </h4>
                        <p className="text-[10px] text-zinc-400 truncate mb-2">
                            {hoveredNode.city}, {hoveredNode.country}
                        </p>

                        <div className="space-y-1 text-[10px] text-zinc-400 pt-1.5 border-t border-zinc-800/80">
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-500 uppercase">TELEMETRY:</span>
                                <span className="text-emerald-400 font-semibold">{hoveredNode.metric}</span>
                            </div>
                            <div className="text-[9px] text-zinc-500 truncate pt-0.5">
                                {hoveredNode.details}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
