import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useAuth } from '../../contexts/AuthContext';
import { COLLECTIONS, subscribeToQuery } from '../../services/firestoreService';
import type { InvoxUser } from '../../types';
import { 
    resolveUserLocation, 
    GeoLocation, 
    INITIAL_MOCK_NODES, 
    INITIAL_MOCK_CONNECTIONS 
} from '../../utils/geoCoordinates';
import { generateEarthTextures } from '../../utils/earthTextureGenerator';
import { 
    GlobeAltIcon, 
    SparklesIcon, 
    ProfileIcon, 
    ChatIcon, 
    CloseIcon, 
    RadioIcon 
} from '../ui/Icons';

export type ArcStatus = 'ACTIVE' | 'CONNECTING' | 'IDLE' | 'DISCONNECTING';

export interface UserGlobeNode {
    id: string;
    uid: string;
    username: string;
    displayName: string;
    photoURL: string | null;
    headline: string;
    bio: string;
    locationStr: string;
    geo: GeoLocation;
    followerCount: number;
    followingCount: number;
    skills: string[];
    isCurrentUser: boolean;
    position: THREE.Vector3;
}

export interface ConnectionArcData {
    id: string;
    fromUserId: string;
    toUserId: string;
    fromPos: THREE.Vector3;
    toPos: THREE.Vector3;
    curve: THREE.CubicBezierCurve3;
    length: number;
    curvePoints: THREE.Vector3[];
    status: ArcStatus;
    drawProgress: number;
}

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
 * Generate ultra-sharp 2D cybernetic target reticle canvas textures for node beacons
 * High-resolution canvas with tactical corner brackets, cardinal tick marks, and optical core
 */
function createTargetReticleTexture(isCurrentUser: boolean): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const center = size / 2;
    const primaryColor = isCurrentUser ? '#34d399' : '#ffffff';
    const glowColor = isCurrentUser ? 'rgba(52, 211, 153, 0.45)' : 'rgba(255, 255, 255, 0.35)';
    const accentColor = isCurrentUser ? '#10b981' : '#cbd5e1';

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
    grad.addColorStop(0.5, isCurrentUser ? 'rgba(52, 211, 153, 0.8)' : 'rgba(255, 255, 255, 0.8)');
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
function createPulseWaveTexture(isCurrentUser: boolean): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const center = size / 2;
    const strokeColor = isCurrentUser ? 'rgba(52, 211, 153, 0.9)' : 'rgba(255, 255, 255, 0.85)';

    // Multi-ring radar pulse
    ctx.beginPath();
    ctx.arc(center, center, 108, 0, Math.PI * 2);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 4.0;
    ctx.stroke();

    // Faint inner secondary echo ring
    ctx.beginPath();
    ctx.arc(center, center, 74, 0, Math.PI * 2);
    ctx.strokeStyle = isCurrentUser ? 'rgba(52, 211, 153, 0.4)' : 'rgba(255, 255, 255, 0.35)';
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

const InteractiveGlobe: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const navigate = ReactRouterDOM.useNavigate();
    const { currentUser, userProfile } = useAuth();

    // Data state
    const [rawUsers, setRawUsers] = useState<InvoxUser[]>([]);
    const [rawFollows, setRawFollows] = useState<Array<{ id: string; followerId?: string; followingId?: string; followerUid?: string; followingUid?: string; fromUserId?: string; toUserId?: string }>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [webglError, setWebglError] = useState<string | null>(null);

    // Interaction state
    const [hoveredNode, setHoveredNode] = useState<UserGlobeNode | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [selectedNode, setSelectedNode] = useState<UserGlobeNode | null>(null);
    const [showArcs, setShowArcs] = useState<boolean>(true);

    // References for the animation / render loop
    const nodesRef = useRef<UserGlobeNode[]>([]);
    const arcsRef = useRef<ConnectionArcData[]>([]);
    const selectedNodeRef = useRef<UserGlobeNode | null>(null);
    const showArcsRef = useRef<boolean>(true);
    const arcsGroupRef = useRef<THREE.Group | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const targetCameraLookAt = useRef<THREE.Vector3 | null>(null);
    const isInteractingRef = useRef(false);
    const lastInteractionTimeRef = useRef(Date.now());

    // Sync refs
    useEffect(() => {
        selectedNodeRef.current = selectedNode;
    }, [selectedNode]);

    useEffect(() => {
        showArcsRef.current = showArcs;
        if (arcsGroupRef.current) {
            arcsGroupRef.current.visible = showArcs;
        }
    }, [showArcs]);

    // 1. Subscribe to real Firestore Users & Follows
    useEffect(() => {
        const unsubscribeUsers = subscribeToQuery<InvoxUser>(
            COLLECTIONS.users,
            [],
            (users) => {
                setRawUsers(users);
                setIsLoading(false);
            },
            (err) => {
                console.warn('[GLOBE] Firestore users sync notice:', err.message);
                setIsLoading(false);
            }
        );

        const unsubscribeFollows = subscribeToQuery<any>(
            COLLECTIONS.follows,
            [],
            (follows) => {
                setRawFollows(follows);
            },
            (err) => {
                console.warn('[GLOBE] Firestore follows sync notice:', err.message);
            }
        );

        return () => {
            unsubscribeUsers();
            unsubscribeFollows();
        };
    }, []);

    // 2. Process nodes & geodesic arcs (merging live Firestore with global network anchor nodes)
    const { globeNodes, connectionArcs } = useMemo(() => {
        const activeNodesMap = new Map<string, UserGlobeNode>();

        // Seed with realistic anchor nodes
        INITIAL_MOCK_NODES.forEach(mock => {
            const geo = resolveUserLocation(mock.location, mock.uid);
            const pos = latLonToVector3(geo.lat, geo.lon, GLOBE_RADIUS + 1.2);
            activeNodesMap.set(mock.uid, {
                id: mock.uid,
                uid: mock.uid,
                username: mock.username,
                displayName: mock.displayName,
                photoURL: mock.photoURL,
                headline: mock.headline,
                bio: mock.bio,
                locationStr: mock.location,
                geo,
                followerCount: mock.followerCount,
                followingCount: mock.followingCount,
                skills: mock.skills,
                isCurrentUser: false,
                position: pos,
            });
        });

        // Overlay real Firestore registered users
        rawUsers.forEach(user => {
            const geo = resolveUserLocation(user.location, user.uid);
            const pos = latLonToVector3(geo.lat, geo.lon, GLOBE_RADIUS + 1.2);
            activeNodesMap.set(user.uid, {
                id: user.uid,
                uid: user.uid,
                username: user.username || user.email?.split('@')[0] || 'node',
                displayName: user.displayName || user.username || 'Invox Node',
                photoURL: user.photoURL || null,
                headline: user.headline || '',
                bio: user.bio || '',
                locationStr: user.location || geo.regionName,
                geo,
                followerCount: user.followerCount || 0,
                followingCount: user.followingCount || 0,
                skills: user.skills || [],
                isCurrentUser: currentUser?.uid === user.uid,
                position: pos,
            });
        });

        // Current authenticated user
        if (currentUser && userProfile) {
            const geo = resolveUserLocation(userProfile.location, currentUser.uid);
            const pos = latLonToVector3(geo.lat, geo.lon, GLOBE_RADIUS + 1.2);
            activeNodesMap.set(currentUser.uid, {
                id: currentUser.uid,
                uid: currentUser.uid,
                username: userProfile.username || currentUser.email?.split('@')[0] || 'me',
                displayName: userProfile.displayName || currentUser.displayName || 'Current User',
                photoURL: userProfile.photoURL || currentUser.photoURL || null,
                headline: userProfile.headline || '',
                bio: userProfile.bio || '',
                locationStr: userProfile.location || geo.regionName,
                geo,
                followerCount: userProfile.followerCount || 0,
                followingCount: userProfile.followingCount || 0,
                skills: userProfile.skills || [],
                isCurrentUser: true,
                position: pos,
            });
        }

        const nodes = Array.from(activeNodesMap.values());
        const nodeMap = new Map<string, UserGlobeNode>();
        nodes.forEach(n => nodeMap.set(n.id, n));

        // Build connection arcs
        const arcs: ConnectionArcData[] = [];
        const seenConnections = new Set<string>();

        // 2a. Real follow connections
        rawFollows.forEach((f) => {
            const fromId = f.followerId || f.followerUid || f.fromUserId;
            const toId = f.followingId || f.followingUid || f.toUserId;

            if (fromId && toId && fromId !== toId) {
                const nodeA = nodeMap.get(fromId);
                const nodeB = nodeMap.get(toId);

                const edgeKey = [fromId, toId].sort().join('::');
                if (nodeA && nodeB && !seenConnections.has(edgeKey)) {
                    seenConnections.add(edgeKey);

                    const p1 = nodeA.position;
                    const p2 = nodeB.position;
                    const distance = p1.distanceTo(p2);

                    const angularDist = p1.angleTo(p2);
                    // High soaring parabolic orbit elevation matching the sample image
                    const elevation = GLOBE_RADIUS * (1.12 + Math.sin(angularDist * 0.5) * 0.48);
                    const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5).normalize().multiplyScalar(elevation);

                    const c1 = new THREE.Vector3().lerpVectors(p1, midPoint, 0.55).normalize().multiplyScalar(elevation * 0.94);
                    const c2 = new THREE.Vector3().lerpVectors(p2, midPoint, 0.55).normalize().multiplyScalar(elevation * 0.94);

                    const curve = new THREE.CubicBezierCurve3(p1, c1, c2, p2);
                    const curvePoints = curve.getPoints(72);

                    arcs.push({
                        id: `arc-${fromId}-${toId}`,
                        fromUserId: fromId,
                        toUserId: toId,
                        fromPos: p1,
                        toPos: p2,
                        curve,
                        length: distance,
                        curvePoints,
                        status: 'ACTIVE',
                        drawProgress: 1.0,
                    });
                }
            }
        });

        // 2b. Initial seed connections
        INITIAL_MOCK_CONNECTIONS.forEach((conn) => {
            const nodeA = nodeMap.get(conn.fromId);
            const nodeB = nodeMap.get(conn.toId);
            const edgeKey = [conn.fromId, conn.toId].sort().join('::');

            if (nodeA && nodeB && !seenConnections.has(edgeKey)) {
                seenConnections.add(edgeKey);

                const p1 = nodeA.position;
                const p2 = nodeB.position;
                const distance = p1.distanceTo(p2);

                const angularDist = p1.angleTo(p2);
                // High soaring parabolic orbit elevation matching the reference image
                const elevation = GLOBE_RADIUS * (1.12 + Math.sin(angularDist * 0.5) * 0.48);
                const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5).normalize().multiplyScalar(elevation);

                const c1 = new THREE.Vector3().lerpVectors(p1, midPoint, 0.55).normalize().multiplyScalar(elevation * 0.94);
                const c2 = new THREE.Vector3().lerpVectors(p2, midPoint, 0.55).normalize().multiplyScalar(elevation * 0.94);

                const curve = new THREE.CubicBezierCurve3(p1, c1, c2, p2);
                const curvePoints = curve.getPoints(72);

                arcs.push({
                    id: `mock-arc-${conn.fromId}-${conn.toId}`,
                    fromUserId: conn.fromId,
                    toUserId: conn.toId,
                    fromPos: p1,
                    toPos: p2,
                    curve,
                    length: distance,
                    curvePoints,
                    status: conn.status,
                    drawProgress: conn.status === 'CONNECTING' ? 0.4 : 1.0,
                });
            }
        });

        return { globeNodes: nodes, connectionArcs: arcs };
    }, [rawUsers, rawFollows, currentUser, userProfile]);

    useEffect(() => {
        nodesRef.current = globeNodes;
        arcsRef.current = connectionArcs;
    }, [globeNodes, connectionArcs]);

    // 3. Main Three.js Scene Setup & Render Engine
    useEffect(() => {
        if (!containerRef.current) return;

        let renderer: THREE.WebGLRenderer;
        try {
            renderer = new THREE.WebGLRenderer({ 
                antialias: true, 
                alpha: true, 
                powerPreference: 'high-performance' 
            });
        } catch (e) {
            setWebglError("WebGL 3D rendering unavailable or hardware acceleration is disabled.");
            return;
        }

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);

        const width = containerRef.current.clientWidth || window.innerWidth;
        const height = containerRef.current.clientHeight || window.innerHeight;

        const camera = new THREE.PerspectiveCamera(36, width / height, 1, 4000);
        // Framing: Centered and zoomed out for comfortable view of globe and towering arcs
        camera.position.set(0, 45, 660);
        cameraRef.current = camera;

        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        containerRef.current.appendChild(renderer.domElement);

        // OrbitControls with comfortable zoomed-out distance range
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
            const phi = Math.acos((Math.random() * 2) - 1);
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
        // Ambient Light: Balanced baseline illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
        scene.add(ambientLight);

        // Primary Sun Directional Light: Crisp key light creating authentic 3D sphere curvature
        const sunLight = new THREE.DirectionalLight(0xffffff, 1.6);
        sunLight.position.set(340, 260, 360);
        scene.add(sunLight);

        // Fill Light: Soft slate fill from the opposite side
        const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.7);
        fillLight.position.set(-320, -140, 180);
        scene.add(fillLight);

        // Soft back rim light for dimensional edge separation
        const backLight = new THREE.DirectionalLight(0x475569, 0.5);
        backLight.position.set(0, -200, -350);
        scene.add(backLight);

        // ─── EARTH MESH & TEXTURES ──────────────────────────────────────────────
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

        // Rotate globe slightly so South Asia / India is front and center on launch
        const globeGroup = new THREE.Group();
        globeGroup.rotation.y = -Math.PI * 0.44;
        scene.add(globeGroup);

        const globeMesh = new THREE.Mesh(globeGeometry, globeMaterial);
        globeGroup.add(globeMesh);

        // ─── VOLUMETRIC ATMOSPHERIC SCATTERING (Soft Exponential Limb Fade) ───
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
                    // Perpendicular distance from camera ray to globe center
                    float dist = length(cross(rayDir, vCenterInView));
                    
                    // Outer halo glow: gently peaks at globe horizon and smoothly fades to 0 before outer radius
                    float outerGlow = 0.0;
                    if (dist >= uGlobeRadius && dist < uAtmoRadius) {
                        float t = (dist - uGlobeRadius) / (uAtmoRadius - uGlobeRadius);
                        // Quadratic/cubic ease to ensure zero derivative at outer edge (eliminates sharp circular outline)
                        outerGlow = pow(1.0 - t, 2.6) * (1.0 - smoothstep(0.0, 1.0, t)) * 0.42;
                    }
                    
                    // Inner limb soft scattering: softens the transition along the edge of the sphere
                    float innerGlow = 0.0;
                    if (dist < uGlobeRadius) {
                        float t = dist / uGlobeRadius;
                        innerGlow = pow(smoothstep(0.68, 1.0, t), 2.8) * 0.24;
                    }
                    
                    float totalAlpha = outerGlow + innerGlow;
                    if (totalAlpha <= 0.002) {
                        discard;
                    }
                    
                    // Subtle, cool cinematic cyan-silver atmospheric glow
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

        // ─── TARGET RETICLE NODES & ARCS ────────────────────────────────────────
        const nodesGroup = new THREE.Group();
        globeGroup.add(nodesGroup);

        const arcsGroup = new THREE.Group();
        arcsGroup.visible = showArcsRef.current;
        arcsGroupRef.current = arcsGroup;
        globeGroup.add(arcsGroup);

        const nodeHitboxes: THREE.Mesh[] = [];
        const pulseSprites: Array<{ sprite: THREE.Sprite; seed: number; isCurrentUser: boolean }> = [];

        const defaultReticleTexture = createTargetReticleTexture(false);
        const currentUserReticleTexture = createTargetReticleTexture(true);
        const defaultPulseTexture = createPulseWaveTexture(false);
        const currentUserPulseTexture = createPulseWaveTexture(true);
        const defaultPacketTexture = createPacketSpriteTexture(false);
        const specialPacketTexture = createPacketSpriteTexture(true);

        const lineMeshes: Array<{
            mesh: THREE.Line;
            glowMesh: THREE.Line;
            arcId: string;
            fullPoints: THREE.Vector3[];
            status: ArcStatus;
            drawProgress: number;
        }> = [];

        const packetComets: Array<{
            headSprite: THREE.Sprite;
            tailSprites: THREE.Sprite[];
            curve: THREE.CubicBezierCurve3;
            speed: number;
            progress: number;
            fromId: string;
            toId: string;
            isSpecial: boolean;
        }> = [];

        const rebuildVisualNetwork = () => {
            // Clear previous nodes
            while (nodesGroup.children.length > 0) {
                const child = nodesGroup.children[0];
                nodesGroup.remove(child);
            }
            nodeHitboxes.length = 0;
            pulseSprites.length = 0;

            const currentNodes = nodesRef.current;
            const currentArcs = arcsRef.current;
            const selected = selectedNodeRef.current;

            // 1. Build Target Reticle Billboard Sprites & 3D Ground Stems
            currentNodes.forEach((node, idx) => {
                const isCurrent = node.isCurrentUser;
                const isSelected = selected && selected.id === node.id;
                const reticleTex = isCurrent ? currentUserReticleTexture : defaultReticleTexture;
                const pulseTex = isCurrent ? currentUserPulseTexture : defaultPulseTexture;

                // A. Ground Anchor Ring directly on the sphere's surface
                const groundPos = node.position.clone().normalize().multiplyScalar(GLOBE_RADIUS + 0.3);
                const surfaceNormal = groundPos.clone().normalize();
                
                const ringGeo = new THREE.RingGeometry(1.8, 2.4, 24);
                const ringMat = new THREE.MeshBasicMaterial({
                    color: isCurrent ? 0x34d399 : (isSelected ? 0x67e8f9 : 0xffffff),
                    transparent: true,
                    opacity: isCurrent ? 0.85 : 0.45,
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
                    color: isCurrent ? 0x34d399 : (isSelected ? 0x67e8f9 : 0x94a3b8),
                    transparent: true,
                    opacity: isCurrent ? 0.9 : 0.5,
                });
                const spikeLine = new THREE.Line(spikeGeo, spikeMat);
                nodesGroup.add(spikeLine);

                // C. Main Tactical Reticle Sprite (Elevated slightly for optimal 3D parallax)
                const spriteMat = new THREE.SpriteMaterial({
                    map: reticleTex,
                    transparent: true,
                    opacity: 0.98,
                    depthWrite: false,
                });
                const sprite = new THREE.Sprite(spriteMat);
                sprite.position.copy(elevatedPos);
                const spriteSize = isCurrent ? 13.5 : (isSelected ? 14 : 11.5);
                sprite.scale.set(spriteSize, spriteSize, 1);
                nodesGroup.add(sprite);

                // D. Animated Concentric Radar Pulse Ring Sprite
                const pulseMat = new THREE.SpriteMaterial({
                    map: pulseTex,
                    transparent: true,
                    opacity: isCurrent ? 0.85 : 0.45,
                    depthWrite: false,
                });
                const pulseSprite = new THREE.Sprite(pulseMat);
                pulseSprite.position.copy(elevatedPos);
                pulseSprite.scale.set(spriteSize, spriteSize, 1);
                nodesGroup.add(pulseSprite);
                pulseSprites.push({ sprite: pulseSprite, seed: idx * 1.35, isCurrentUser: isCurrent });

                // E. Precision Hitbox for Hover Raycasting
                const hitGeo = new THREE.SphereGeometry(9.0, 12, 12);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.copy(elevatedPos);
                hitMesh.userData = { node };
                nodesGroup.add(hitMesh);
                nodeHitboxes.push(hitMesh);
            });

            // 2. Build Multi-Layer Connection Arcs & Comet Packet Systems
            while (arcsGroup.children.length > 0) {
                const child = arcsGroup.children[0];
                arcsGroup.remove(child);
            }
            packetComets.length = 0;
            lineMeshes.length = 0;

            currentArcs.forEach((arc, i) => {
                const isConnectedToSelected = selected && (arc.fromUserId === selected.id || arc.toUserId === selected.id);

                // Color definition based on connection telemetry status
                let arcColor = 0xffffff;
                let glowColor = 0x93c5fd;
                let opacity = 0.75;
                let glowOpacity = 0.28;

                if (isConnectedToSelected) {
                    arcColor = 0x34d399;
                    glowColor = 0x10b981;
                    opacity = 1.0;
                    glowOpacity = 0.65;
                } else if (arc.status === 'ACTIVE') {
                    arcColor = 0xf1f5f9;
                    glowColor = 0x94a3b8;
                    opacity = 0.72;
                    glowOpacity = 0.22;
                } else if (arc.status === 'CONNECTING') {
                    arcColor = 0x34d399;
                    glowColor = 0x059669;
                    opacity = 0.9;
                    glowOpacity = 0.45;
                } else if (arc.status === 'DISCONNECTING') {
                    arcColor = 0xf87171;
                    glowColor = 0xdc2626;
                    opacity = 0.45;
                    glowOpacity = 0.15;
                }

                if (selected && !isConnectedToSelected) {
                    opacity = 0.06;
                    glowOpacity = 0.02;
                }

                // Layer 1: Core crisp trajectory line
                const lineGeometry = new THREE.BufferGeometry().setFromPoints(arc.curvePoints);
                const lineMaterial = new THREE.LineBasicMaterial({
                    color: arcColor,
                    transparent: true,
                    opacity: opacity,
                    linewidth: 1.5,
                });
                const lineMesh = new THREE.Line(lineGeometry, lineMaterial);
                arcsGroup.add(lineMesh);

                // Layer 2: Ambient optical bloom glow line
                const glowGeometry = new THREE.BufferGeometry().setFromPoints(arc.curvePoints);
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
                    arcId: arc.id,
                    fullPoints: arc.curvePoints,
                    status: arc.status,
                    drawProgress: arc.drawProgress,
                });

                // Layer 3: High-Speed Photon Energy Comet (Head + Trailing Sparks)
                if (arc.status === 'ACTIVE' || arc.status === 'CONNECTING' || isConnectedToSelected) {
                    const isSpecial = isConnectedToSelected || arc.status === 'CONNECTING';
                    const packetTex = isSpecial ? specialPacketTexture : defaultPacketTexture;

                    // Comet Head Sprite
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
                    headSprite.position.copy(arc.curvePoints[0]);
                    arcsGroup.add(headSprite);

                    // Trailing Tail Particles
                    const tailCount = 3;
                    const tailSprites: THREE.Sprite[] = [];
                    for (let t = 0; t < tailCount; t++) {
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
                        tailSprite.position.copy(arc.curvePoints[0]);
                        arcsGroup.add(tailSprite);
                        tailSprites.push(tailSprite);
                    }

                    packetComets.push({
                        headSprite,
                        tailSprites,
                        curve: arc.curve,
                        speed: 0.0035 + (i % 4) * 0.0012,
                        progress: (i * 0.24) % 1.0,
                        fromId: arc.fromUserId,
                        toId: arc.toUserId,
                        isSpecial,
                    });
                }
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
                const node = intersects[0].object.userData.node as UserGlobeNode;
                setHoveredNode(node);
                setTooltipPos({ x: e.clientX, y: e.clientY });
                if (containerRef.current) containerRef.current.style.cursor = 'pointer';
            } else {
                setHoveredNode(null);
                if (containerRef.current) containerRef.current.style.cursor = 'grab';
            }
        };

        const handleClick = (e: MouseEvent) => {
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(nodeHitboxes);

            if (intersects.length > 0) {
                const node = intersects[0].object.userData.node as UserGlobeNode;
                setSelectedNode(node);
                selectedNodeRef.current = node;
                rebuildVisualNetwork();

                // Compute world space position of node for camera focus
                const worldPos = node.position.clone().applyMatrix4(globeGroup.matrixWorld);
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
        let clock = new THREE.Clock();
        let lastStateCycleTime = 0;

        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            const elapsedTime = clock.getElapsedTime();

            // Resume auto-rotate after 3.5s of user inactivity
            if (!isInteractingRef.current && Date.now() - lastInteractionTimeRef.current > 3500) {
                controls.autoRotate = true;
            }

            // Smooth camera tweening when a node is inspected
            if (targetCameraLookAt.current) {
                camera.position.lerp(targetCameraLookAt.current, 0.045);
                if (camera.position.distanceTo(targetCameraLookAt.current) < 3) {
                    targetCameraLookAt.current = null;
                }
            }

            // Periodic connection arc state pulse simulation
            if (elapsedTime - lastStateCycleTime > 5.5) {
                lastStateCycleTime = elapsedTime;
                const statuses: ArcStatus[] = ['ACTIVE', 'CONNECTING', 'IDLE', 'ACTIVE'];
                lineMeshes.forEach((item, idx) => {
                    if (Math.random() < 0.2) {
                        const newStatus = statuses[(idx + Math.floor(elapsedTime)) % statuses.length];
                        item.status = newStatus;
                        if (newStatus === 'CONNECTING') {
                            item.drawProgress = 0.1;
                        }
                    }
                });
            }

            // Animate progressive drawing for 'CONNECTING' arcs
            lineMeshes.forEach(item => {
                if (item.status === 'CONNECTING' && item.drawProgress < 1.0) {
                    item.drawProgress = Math.min(1.0, item.drawProgress + 0.015);
                    const pointCount = Math.max(2, Math.floor(item.fullPoints.length * item.drawProgress));
                    const currentPoints = item.fullPoints.slice(0, pointCount);
                    item.mesh.geometry.setFromPoints(currentPoints);
                    item.glowMesh.geometry.setFromPoints(currentPoints);
                }
            });

            // Pulse & Rotate Concentric Node Rings Animation
            pulseSprites.forEach(({ sprite, seed, isCurrentUser }) => {
                const speed = isCurrentUser ? 2.2 : 1.6;
                const cycle = (elapsedTime * speed + seed) % (Math.PI * 2);
                const scaleMultiplier = 1.0 + (Math.sin(cycle) + 1.0) * (isCurrentUser ? 0.5 : 0.4);
                const baseSize = isCurrentUser ? 13.5 : 11.5;
                sprite.scale.set(baseSize * scaleMultiplier, baseSize * scaleMultiplier, 1);
                (sprite.material as THREE.SpriteMaterial).opacity = Math.max(0.04, 0.8 - Math.sin(cycle) * 0.5);
                (sprite.material as THREE.SpriteMaterial).rotation = elapsedTime * (isCurrentUser ? 0.8 : -0.5) + seed;
            });

            // Flow Connection Packet Comets & Trailing Photon Sparks
            packetComets.forEach(comet => {
                comet.progress = (comet.progress + comet.speed) % 1.0;
                
                // Head photon packet position
                const headPt = comet.curve.getPoint(comet.progress);
                comet.headSprite.position.copy(headPt);

                const pulseFactor = 1.0 + Math.sin(comet.progress * Math.PI) * 0.35;
                const baseHeadSize = comet.isSpecial ? 5.5 : 4.2;
                comet.headSprite.scale.set(baseHeadSize * pulseFactor, baseHeadSize * pulseFactor, 1);

                // Trailing photon sparks along arc
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
            currentUserReticleTexture.dispose();
            defaultPulseTexture.dispose();
            currentUserPulseTexture.dispose();
            defaultPacketTexture.dispose();
            specialPacketTexture.dispose();
            renderer.dispose();
        };
    }, []);

    // Helper: Reset globe camera view to default orientation
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
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2 pointer-events-auto">
                <div className="bg-[#0c0c0e]/90 border border-zinc-800/90 px-3.5 py-1.5 flex items-center gap-2 shadow-xl backdrop-blur-md">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-none animate-pulse"></span>
                    <span className="text-[11px] text-zinc-300 font-mono font-medium tracking-wider">
                        {globeNodes.length} NODES <span className="text-zinc-600">/</span> {connectionArcs.length} ARCS
                    </span>
                </div>

                <button
                    onClick={() => setShowArcs(prev => !prev)}
                    title={showArcs ? "Hide Connection Arcs" : "Show Connection Arcs"}
                    className={`border px-3 py-1.5 text-[11px] font-mono tracking-wider transition-colors shadow-lg active:scale-[0.98] flex items-center gap-1.5 ${
                        showArcs
                            ? 'bg-[#0c0c0e]/90 hover:bg-[#18181d] border-zinc-800/90 hover:border-zinc-600 text-zinc-300 hover:text-white'
                            : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                    }`}
                >
                    <span className={`w-1.5 h-1.5 ${showArcs ? 'bg-emerald-400' : 'bg-zinc-600'}`}></span>
                    <span>ARCS: {showArcs ? 'ON' : 'OFF'}</span>
                </button>

                <button
                    onClick={handleResetView}
                    title="Recenter Camera"
                    className="bg-[#0c0c0e]/90 hover:bg-[#18181d] border border-zinc-800/90 hover:border-zinc-600 text-zinc-300 hover:text-white px-3 py-1.5 text-[11px] font-mono tracking-wider transition-colors shadow-lg active:scale-[0.98] flex items-center gap-1.5"
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
                    <div className="bg-[#0c0c0e]/95 backdrop-blur-md border border-zinc-800 p-3.5 shadow-2xl min-w-[220px] font-mono">
                        <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-zinc-800/80">
                            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                                {hoveredNode.isCurrentUser ? '// YOUR_NODE' : '// ACTIVE_NODE'}
                            </span>
                            <span className="w-1.5 h-1.5 bg-emerald-400"></span>
                        </div>

                        <h4 className="text-xs font-bold text-white tracking-tight truncate">
                            {hoveredNode.displayName}
                        </h4>
                        <p className="text-[10px] text-zinc-400 truncate mb-2">
                            @{hoveredNode.username}
                        </p>

                        <div className="space-y-1 text-[10px] text-zinc-400 pt-1.5 border-t border-zinc-800/80">
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-500 uppercase">LOC:</span>
                                <span className="text-zinc-200 truncate max-w-[130px] font-semibold">
                                    {hoveredNode.geo.city ? `${hoveredNode.geo.city}, ${hoveredNode.geo.country}` : hoveredNode.geo.country}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-500 uppercase">CONNS:</span>
                                <span className="text-zinc-200 font-bold tabular-nums">
                                    {hoveredNode.followerCount + hoveredNode.followingCount}
                                </span>
                            </div>
                        </div>

                        <div className="mt-2.5 pt-1.5 border-t border-zinc-800/80 text-[9px] text-zinc-500 uppercase tracking-wider flex items-center justify-between">
                            <span>&gt; CLICK_TO_INSPECT</span>
                            <span>→</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Selected Node Detailed Inspector Card Overlay */}
            {selectedNode && (
                <div className="absolute bottom-6 left-6 z-30 pointer-events-auto max-w-sm w-[calc(100%-3rem)] sm:w-80 animate-fadeInUp">
                    <div className="bg-[#0c0c0e]/95 backdrop-blur-lg border border-zinc-700/90 p-4 shadow-2xl font-mono">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-emerald-500 animate-pulse"></span>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                    // NODE_TELEMETRY
                                </span>
                            </div>
                            <button
                                onClick={() => setSelectedNode(null)}
                                className="text-zinc-500 hover:text-white p-1 transition-colors"
                            >
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Node Identity */}
                        <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 bg-zinc-900 border border-zinc-700 flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden shadow-md">
                                {selectedNode.photoURL ? (
                                    <img 
                                        src={selectedNode.photoURL} 
                                        alt={selectedNode.displayName} 
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer" 
                                    />
                                ) : (
                                    <span>{selectedNode.displayName[0]?.toUpperCase() || 'N'}</span>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-bold text-white truncate">
                                    {selectedNode.displayName}
                                </h3>
                                <p className="text-xs text-zinc-400 truncate">
                                    @{selectedNode.username}
                                </p>
                                <p className="text-[10px] text-emerald-400 truncate font-semibold mt-0.5">
                                    {selectedNode.geo.city ? `${selectedNode.geo.city}, ${selectedNode.geo.country}` : selectedNode.geo.country}
                                </p>
                            </div>
                        </div>

                        {/* Bio & Headline */}
                        {selectedNode.headline && (
                            <p className="text-xs text-zinc-300 mb-3 leading-relaxed font-sans line-clamp-2">
                                {selectedNode.headline}
                            </p>
                        )}

                        {/* Skills / Stacks Tags */}
                        {selectedNode.skills && selectedNode.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                                {selectedNode.skills.slice(0, 4).map((skill, sIdx) => (
                                    <span key={sIdx} className="text-[9px] bg-zinc-900 text-zinc-400 border border-zinc-800 px-1.5 py-0.5">
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Metric Bar */}
                        <div className="grid grid-cols-2 gap-2 p-2 bg-zinc-900/80 border border-zinc-800 mb-3 text-center">
                            <div>
                                <span className="block text-[9px] text-zinc-500 uppercase">Followers</span>
                                <span className="text-xs font-bold text-white tabular-nums">{selectedNode.followerCount}</span>
                            </div>
                            <div>
                                <span className="block text-[9px] text-zinc-500 uppercase">Following</span>
                                <span className="text-xs font-bold text-white tabular-nums">{selectedNode.followingCount}</span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => navigate(`/profile/${selectedNode.id}`)}
                                className="flex-1 bg-white hover:bg-zinc-200 text-black text-xs font-bold py-2 px-3 uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors border border-white"
                            >
                                <ProfileIcon className="w-3.5 h-3.5" />
                                <span>Profile</span>
                            </button>
                            <button
                                onClick={() => navigate(`/messages`)}
                                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white text-xs font-bold py-2 px-3 uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                            >
                                <ChatIcon className="w-3.5 h-3.5" />
                                <span>Signal</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InteractiveGlobe;
