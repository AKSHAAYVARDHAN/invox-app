import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useAuth } from '../../contexts/AuthContext';
import { COLLECTIONS, subscribeToQuery } from '../../services/firestoreService';
import type { InvoxUser } from '../../types';
import { resolveUserLocation, GeoLocation } from '../../utils/geoCoordinates';
import { generateEarthTextures } from '../../utils/earthTextureGenerator';
import { 
    GlobeAltIcon, 
    SparklesIcon, 
    ProfileIcon, 
    ChatIcon, 
    CloseIcon, 
    RadioIcon 
} from '../ui/Icons';

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
    active: boolean;
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

    // References for the animation / render loop
    const nodesRef = useRef<UserGlobeNode[]>([]);
    const arcsRef = useRef<ConnectionArcData[]>([]);
    const selectedNodeRef = useRef<UserGlobeNode | null>(null);
    const hoveredNodeRef = useRef<UserGlobeNode | null>(null);
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
        hoveredNodeRef.current = hoveredNode;
    }, [hoveredNode]);

    // 1. Subscribe to real Firestore Users
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

    // 2. Process real users and connections into 3D Nodes and Geodesic Arcs
    const { globeNodes, connectionArcs } = useMemo(() => {
        let activeUsers = [...rawUsers];

        // If current user is logged in but not yet in the Firestore array (transient state), inject them
        if (currentUser && userProfile && !activeUsers.some(u => u.uid === currentUser.uid)) {
            activeUsers.unshift({
                ...userProfile,
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: userProfile.displayName || currentUser.displayName || 'Current User',
                username: userProfile.username || 'user',
            });
        }

        const nodes: UserGlobeNode[] = activeUsers.map(user => {
            const geo = resolveUserLocation(user.location, user.uid);
            const pos = latLonToVector3(geo.lat, geo.lon, GLOBE_RADIUS + 1.2);
            return {
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
            };
        });

        // Build node lookup map
        const nodeMap = new Map<string, UserGlobeNode>();
        nodes.forEach(n => nodeMap.set(n.id, n));

        const arcs: ConnectionArcData[] = [];
        const seenConnections = new Set<string>();

        // Build arcs from real follow relationships
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

                    // Great-Circle Arc Elevation Midpoint
                    const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
                    const angularDist = p1.angleTo(p2);
                    const elevation = GLOBE_RADIUS * (1.0 + Math.sin(angularDist * 0.5) * 0.28);
                    midPoint.normalize().multiplyScalar(elevation);

                    // Cubic Bezier Control Points
                    const c1 = new THREE.Vector3().lerpVectors(p1, midPoint, 0.55).normalize().multiplyScalar(elevation * 0.92);
                    const c2 = new THREE.Vector3().lerpVectors(p2, midPoint, 0.55).normalize().multiplyScalar(elevation * 0.92);

                    const curve = new THREE.CubicBezierCurve3(p1, c1, c2, p2);
                    const curvePoints = curve.getPoints(48);

                    arcs.push({
                        id: `arc-${fromId}-${toId}`,
                        fromUserId: fromId,
                        toUserId: toId,
                        fromPos: p1,
                        toPos: p2,
                        curve,
                        length: distance,
                        curvePoints,
                        active: true,
                    });
                }
            }
        });

        // If there are registered users with no explicit follow records yet, generate subtle network mesh between nearest nodes
        if (arcs.length === 0 && nodes.length > 1) {
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const nodeA = nodes[i];
                    const nodeB = nodes[j];
                    const p1 = nodeA.position;
                    const p2 = nodeB.position;
                    const angularDist = p1.angleTo(p2);

                    // Only connect if reasonable geographic proximity or direct bridge
                    if (angularDist < Math.PI * 0.9) {
                        const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
                        const elevation = GLOBE_RADIUS * (1.0 + Math.sin(angularDist * 0.5) * 0.25);
                        midPoint.normalize().multiplyScalar(elevation);

                        const c1 = new THREE.Vector3().lerpVectors(p1, midPoint, 0.55).normalize().multiplyScalar(elevation * 0.92);
                        const c2 = new THREE.Vector3().lerpVectors(p2, midPoint, 0.55).normalize().multiplyScalar(elevation * 0.92);

                        const curve = new THREE.CubicBezierCurve3(p1, c1, c2, p2);
                        const curvePoints = curve.getPoints(48);

                        arcs.push({
                            id: `mesh-${nodeA.id}-${nodeB.id}`,
                            fromUserId: nodeA.id,
                            toUserId: nodeB.id,
                            fromPos: p1,
                            toPos: p2,
                            curve,
                            length: p1.distanceTo(p2),
                            curvePoints,
                            active: false,
                        });
                    }
                }
            }
        }

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

        const camera = new THREE.PerspectiveCamera(42, width / height, 1, 4000);
        camera.position.set(0, 45, 410);
        cameraRef.current = camera;

        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        containerRef.current.appendChild(renderer.domElement);

        // OrbitControls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;
        controls.enablePan = false;
        controls.minDistance = 210;
        controls.maxDistance = 620;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.32;
        controlsRef.current = controls;

        // Interaction listeners to handle auto-rotate pause & resume
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

        // ─── LIGHTING ──────────────────────────────────────────────────────────
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 1.8);
        sunLight.position.set(400, 200, 300);
        scene.add(sunLight);

        const rimLight = new THREE.DirectionalLight(0x71717a, 0.75);
        rimLight.position.set(-400, -100, -300);
        scene.add(rimLight);

        // ─── DEEP CELESTIAL STARFIELD ──────────────────────────────────────────
        const starCount = 2400;
        const starPositions = new Float32Array(starCount * 3);
        const starColors = new Float32Array(starCount * 3);

        const spectralColors = [
            new THREE.Color(0xffffff),
            new THREE.Color(0xd4d4d8),
            new THREE.Color(0xa1a1aa),
            new THREE.Color(0x93c5fd),
            new THREE.Color(0x71717a),
        ];

        for (let i = 0; i < starCount; i++) {
            const r = 1000 + Math.random() * 2400;
            const theta = 2 * Math.PI * Math.random();
            const phi = Math.acos(2 * Math.random() - 1);
            starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            starPositions[i * 3 + 2] = r * Math.cos(phi);

            const col = spectralColors[Math.floor(Math.random() * spectralColors.length)];
            starColors[i * 3] = col.r;
            starColors[i * 3 + 1] = col.g;
            starColors[i * 3 + 2] = col.b;
        }

        const starGeometry = new THREE.BufferGeometry();
        starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

        const starMaterial = new THREE.PointsMaterial({
            size: 1.8,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true,
        });

        const starField = new THREE.Points(starGeometry, starMaterial);
        scene.add(starField);

        // ─── 3D EARTH SPHERE GEOMETRY & TEXTURES ────────────────────────────────
        const { diffuseMap, specularMap, bumpMap } = generateEarthTextures();

        const globeGeometry = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
        const globeMaterial = new THREE.MeshPhongMaterial({
            map: diffuseMap,
            specularMap: specularMap,
            bumpMap: bumpMap,
            bumpScale: 0.8,
            specular: new THREE.Color(0x3a3f4d),
            shininess: 32,
            color: new THREE.Color(0x18181f),
            emissive: new THREE.Color(0x06070a),
        });

        const globeMesh = new THREE.Mesh(globeGeometry, globeMaterial);
        scene.add(globeMesh);

        // ─── ATMOSPHERE FRESNEL GLOW SHELL ─────────────────────────────────────
        const atmosphereGeometry = new THREE.SphereGeometry(GLOBE_RADIUS * 1.03, 64, 64);
        const atmosphereMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                void main() {
                    vec3 viewDir = normalize(-vPosition);
                    float rim = 1.0 - max(0.0, dot(viewDir, vNormal));
                    float intensity = pow(rim, 3.2);
                    vec3 atmosphereColor = vec3(0.55, 0.65, 0.85);
                    gl_FragColor = vec4(atmosphereColor, intensity * 0.35);
                }
            `,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false,
        });

        const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        scene.add(atmosphereMesh);

        // ─── EQUATORIAL TELEMETRY RING ─────────────────────────────────────────
        const ringGeo = new THREE.RingGeometry(GLOBE_RADIUS * 1.08, GLOBE_RADIUS * 1.085, 96);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x3f3f46,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.25,
        });
        const equatorRing = new THREE.Mesh(ringGeo, ringMat);
        equatorRing.rotation.x = Math.PI / 2;
        scene.add(equatorRing);

        // ─── DYNAMIC USER NODES GROUP ──────────────────────────────────────────
        const nodesGroup = new THREE.Group();
        scene.add(nodesGroup);

        const nodeHitboxes: THREE.Mesh[] = [];
        const pulseRings: Array<{ mesh: THREE.Mesh; seed: number; isCurrentUser: boolean }> = [];

        // ─── DYNAMIC CONNECTION ARCS GROUP ─────────────────────────────────────
        const arcsGroup = new THREE.Group();
        scene.add(arcsGroup);

        const packetParticles: Array<{
            mesh: THREE.Mesh;
            curve: THREE.CubicBezierCurve3;
            speed: number;
            progress: number;
            fromId: string;
            toId: string;
        }> = [];

        // Rebuild 3D visual representations when nodes or arcs change
        const rebuildVisualNetwork = () => {
            // Clean up previous nodes
            while (nodesGroup.children.length > 0) {
                const child = nodesGroup.children[0];
                nodesGroup.remove(child);
            }
            nodeHitboxes.length = 0;
            pulseRings.length = 0;

            const currentNodes = nodesRef.current;
            const currentArcs = arcsRef.current;

            // 1. Build User Nodes
            const dotGeometry = new THREE.SphereGeometry(2.0, 16, 16);
            const currentUserDotGeometry = new THREE.SphereGeometry(2.8, 16, 16);
            const ringGeometry = new THREE.RingGeometry(2.8, 3.6, 24);

            currentNodes.forEach((node, idx) => {
                const isCurrent = node.isCurrentUser;
                const nodeColor = isCurrent ? 0x10b981 : 0xffffff;

                // Core Dot
                const dotMat = new THREE.MeshBasicMaterial({
                    color: nodeColor,
                });
                const dotMesh = new THREE.Mesh(isCurrent ? currentUserDotGeometry : dotGeometry, dotMat);
                dotMesh.position.copy(node.position);
                nodesGroup.add(dotMesh);

                // Concentric Pulse Beacon Ring (oriented normal to globe surface)
                const ringMat = new THREE.MeshBasicMaterial({
                    color: nodeColor,
                    transparent: true,
                    opacity: isCurrent ? 0.8 : 0.5,
                    side: THREE.DoubleSide,
                    depthWrite: false,
                });
                const ringMesh = new THREE.Mesh(ringGeometry, ringMat);
                ringMesh.position.copy(node.position.clone().multiplyScalar(1.002));
                ringMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), node.position.clone().normalize());
                nodesGroup.add(ringMesh);
                pulseRings.push({ mesh: ringMesh, seed: idx * 1.37, isCurrentUser: isCurrent });

                // Invisible Hitbox for Precision Hover Raycasting
                const hitGeo = new THREE.SphereGeometry(6.5, 12, 12);
                const hitMat = new THREE.MeshBasicMaterial({ visible: false });
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.copy(node.position);
                hitMesh.userData = { node };
                nodesGroup.add(hitMesh);
                nodeHitboxes.push(hitMesh);
            });

            // 2. Build Connection Arcs
            while (arcsGroup.children.length > 0) {
                const child = arcsGroup.children[0];
                arcsGroup.remove(child);
            }
            packetParticles.length = 0;

            const packetGeo = new THREE.SphereGeometry(1.4, 12, 12);
            const selected = selectedNodeRef.current;

            currentArcs.forEach((arc, i) => {
                const isConnectedToSelected = selected && (arc.fromUserId === selected.id || arc.toUserId === selected.id);
                const isHighlighted = !selected || isConnectedToSelected;

                const arcColor = isConnectedToSelected 
                    ? 0xffffff 
                    : arc.active 
                        ? 0x93c5fd 
                        : 0x52525b;

                const opacity = isConnectedToSelected 
                    ? 0.95 
                    : !selected 
                        ? (arc.active ? 0.45 : 0.2) 
                        : 0.05;

                const lineGeometry = new THREE.BufferGeometry().setFromPoints(arc.curvePoints);
                const lineMaterial = new THREE.LineBasicMaterial({
                    color: arcColor,
                    transparent: true,
                    opacity: opacity,
                    linewidth: isConnectedToSelected ? 2 : 1,
                });

                const lineMesh = new THREE.Line(lineGeometry, lineMaterial);
                arcsGroup.add(lineMesh);

                // Traveling Packet Particle (flowing energy along active connection)
                if (arc.active || isConnectedToSelected || currentArcs.length < 24) {
                    const packetMat = new THREE.MeshBasicMaterial({
                        color: isConnectedToSelected ? 0xffffff : 0x60a5fa,
                        transparent: true,
                        opacity: isConnectedToSelected ? 1.0 : 0.8,
                    });
                    const packetMesh = new THREE.Mesh(packetGeo, packetMat);
                    packetMesh.position.copy(arc.curvePoints[0]);
                    arcsGroup.add(packetMesh);

                    packetParticles.push({
                        mesh: packetMesh,
                        curve: arc.curve,
                        speed: 0.003 + (i % 5) * 0.0012,
                        progress: (i * 0.17) % 1.0,
                        fromId: arc.fromUserId,
                        toId: arc.toUserId,
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

                // Smoothly orient camera to look toward selected node
                const targetPos = node.position.clone().normalize().multiplyScalar(320);
                targetCameraLookAt.current = targetPos;
                controls.autoRotate = false;
                lastInteractionTimeRef.current = Date.now();
            } else {
                // Clicked blank space: deselect node
                if (selectedNodeRef.current) {
                    setSelectedNode(null);
                    targetCameraLookAt.current = null;
                }
            }
        };

        window.addEventListener('mousemove', handlePointerMove);
        window.addEventListener('click', handleClick);

        // ─── ANIMATION LOOP ───────────────────────────────────────────────────
        let animationFrameId: number;
        let clock = new THREE.Clock();

        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            const elapsedTime = clock.getElapsedTime();

            // Resume auto-rotate after 3.5 seconds of user inactivity
            if (!isInteractingRef.current && Date.now() - lastInteractionTimeRef.current > 3500) {
                controls.autoRotate = true;
            }

            // Smooth camera tweening when a node is selected
            if (targetCameraLookAt.current) {
                camera.position.lerp(targetCameraLookAt.current, 0.045);
                if (camera.position.distanceTo(targetCameraLookAt.current) < 3) {
                    targetCameraLookAt.current = null;
                }
            }

            // Subtle celestial star rotation
            starField.rotation.y = elapsedTime * 0.008;
            equatorRing.rotation.z = elapsedTime * 0.03;

            // Pulse Node Rings Animation
            pulseRings.forEach(({ mesh, seed, isCurrentUser }) => {
                const speed = isCurrentUser ? 3.0 : 2.0;
                const cycle = (elapsedTime * speed + seed) % (Math.PI * 2);
                const scale = 1.0 + Math.sin(cycle) * (isCurrentUser ? 0.8 : 0.5);
                mesh.scale.set(scale, scale, 1);
                (mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.1, 0.7 - Math.sin(cycle) * 0.4);
            });

            // Flow Connection Packet Particles along Bezier Arcs
            packetParticles.forEach(packet => {
                packet.progress = (packet.progress + packet.speed) % 1.0;
                const pt = packet.curve.getPoint(packet.progress);
                packet.mesh.position.copy(pt);

                // Subtle scale pulsing
                const s = 1.0 + Math.sin(packet.progress * Math.PI) * 0.4;
                packet.mesh.scale.set(s, s, s);
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

            // Dispose WebGL Geometries and Materials
            globeGeometry.dispose();
            globeMaterial.dispose();
            diffuseMap.dispose();
            specularMap.dispose();
            bumpMap.dispose();
            atmosphereGeometry.dispose();
            atmosphereMaterial.dispose();
            starGeometry.dispose();
            starMaterial.dispose();
            ringGeo.dispose();
            ringMat.dispose();
            renderer.dispose();
        };
    }, []);

    // Helper: Reset globe camera view to neutral
    const handleResetView = () => {
        if (cameraRef.current && controlsRef.current) {
            targetCameraLookAt.current = new THREE.Vector3(0, 45, 410);
            setSelectedNode(null);
        }
    };

    return (
        <div className="w-full h-full relative group bg-black select-none overflow-hidden font-mono">
            {/* 3D WebGL Canvas Viewport */}
            <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

            {/* Top Telemetry & Controls HUD */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2 pointer-events-auto">
                <div className="bg-[#0c0c0e]/90 border border-zinc-800/90 px-3 py-1.5 flex items-center gap-2 shadow-xl backdrop-blur-md">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-none animate-pulse"></span>
                    <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">
                        {globeNodes.length} NODES // {connectionArcs.length} ARCS
                    </span>
                </div>

                <button
                    onClick={handleResetView}
                    title="Recenter Camera"
                    className="bg-[#0c0c0e]/90 hover:bg-[#18181d] border border-zinc-800/90 hover:border-zinc-600 text-zinc-400 hover:text-white px-2.5 py-1.5 text-[10px] uppercase font-mono tracking-wider transition-colors"
                >
                    [RESET_CAM]
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
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
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

                        <div className="space-y-1 text-[10px] text-zinc-400 pt-1 border-t border-zinc-850">
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-500 uppercase">LOC:</span>
                                <span className="text-zinc-300 truncate max-w-[130px] font-bold">
                                    {hoveredNode.geo.city ? `${hoveredNode.geo.city}, ${hoveredNode.geo.country}` : hoveredNode.geo.country}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-500 uppercase">CONNECTIONS:</span>
                                <span className="text-zinc-200 font-bold tabular-nums">
                                    {hoveredNode.followerCount + hoveredNode.followingCount}
                                </span>
                            </div>
                        </div>

                        <div className="mt-2 pt-1.5 border-t border-zinc-850 text-[9px] text-zinc-600 uppercase">
                            &gt; CLICK_TO_INSPECT
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
                                <span className="w-2 h-2 bg-emerald-500 animate-pulse"></span>
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
                            {selectedNode.photoURL ? (
                                <img
                                    src={selectedNode.photoURL}
                                    alt={selectedNode.displayName}
                                    className="w-10 h-10 border border-zinc-700 object-cover flex-shrink-0"
                                />
                            ) : (
                                <div className="w-10 h-10 bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                    {selectedNode.displayName.slice(0, 2).toUpperCase()}
                                </div>
                            )}

                            <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-bold text-white tracking-tight truncate">
                                    {selectedNode.displayName}
                                </h3>
                                <p className="text-xs text-zinc-400 truncate">
                                    @{selectedNode.username}
                                </p>
                                {selectedNode.headline && (
                                    <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                                        {selectedNode.headline}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Metadata Grid */}
                        <div className="bg-[#09090b] border border-zinc-800/90 p-2.5 space-y-1.5 text-xs mb-3">
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="text-zinc-500 uppercase">// REGION</span>
                                <span className="text-white font-bold truncate max-w-[160px]">
                                    {selectedNode.geo.city ? `${selectedNode.geo.city}, ${selectedNode.geo.country}` : selectedNode.geo.country}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="text-zinc-500 uppercase">// FOLLOWERS</span>
                                <span className="text-zinc-300 font-bold tabular-nums">
                                    {selectedNode.followerCount}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="text-zinc-500 uppercase">// FOLLOWING</span>
                                <span className="text-zinc-300 font-bold tabular-nums">
                                    {selectedNode.followingCount}
                                </span>
                            </div>
                        </div>

                        {/* Skills / Tags */}
                        {selectedNode.skills && selectedNode.skills.length > 0 && (
                            <div className="mb-3">
                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider block mb-1.5">
                                    // CAPABILITIES
                                </span>
                                <div className="flex flex-wrap gap-1">
                                    {selectedNode.skills.slice(0, 4).map((skill, i) => (
                                        <span
                                            key={i}
                                            className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-400 text-[9px] uppercase tracking-wider"
                                        >
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-2 border-t border-zinc-800">
                            <button
                                onClick={() => navigate(`/profile/${selectedNode.id}`)}
                                className="flex-1 bg-white hover:bg-zinc-200 text-black p-2 text-center text-[10px] font-bold uppercase tracking-wider transition-colors border border-white"
                            >
                                // VIEW_PROFILE
                            </button>
                            <button
                                onClick={() => navigate('/hub')}
                                className="flex-1 bg-[#09090b] hover:bg-[#18181d] text-zinc-300 hover:text-white p-2 text-center text-[10px] font-bold uppercase tracking-wider transition-colors border border-zinc-800"
                            >
                                // STREAM_SIGNAL
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* WebGL Error / Fallback State */}
            {webglError && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-black p-8 text-center">
                    <div className="bg-[#0c0c0e] border border-zinc-800 p-8 max-w-md">
                        <GlobeAltIcon className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                        <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">
                            // HARDWARE_ACCELERATION_REQUIRED
                        </span>
                        <h3 className="text-base font-bold text-white mb-2 uppercase tracking-wider">
                            3D Canvas Restricted
                        </h3>
                        <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                            {webglError} Please ensure WebGL is enabled in your browser settings.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-white hover:bg-zinc-200 text-black px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border border-white"
                        >
                            // RETRY_CONNECTION
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InteractiveGlobe;
