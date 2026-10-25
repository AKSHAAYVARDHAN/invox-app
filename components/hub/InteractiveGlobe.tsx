import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useAuth } from '../../contexts/AuthContext';
import type { InvoxUser } from '../../types';
import { 
    resolveUserLocation, 
    GeoLocation 
} from '../../utils/geoCoordinates';
import { generateEarthTextures } from '../../utils/earthTextureGenerator';
import { 
    subscribeUserRelationships, 
    getProfilesByIds, 
    UserRelationshipCounts 
} from '../../services/connectionService';
import { 
    isUserRecentlyActive, 
    formatLastActiveString, 
    touchUserPresence 
} from '../../services/presenceService';
import { 
    ProfileIcon, 
    ChatIcon, 
    CloseIcon 
} from '../ui/Icons';

export type ArcStatus = 'ACTIVE' | 'CONNECTING' | 'IDLE' | 'DISCONNECTING';
export type RelationshipType = 'connection' | 'following' | 'follower' | 'self';
export type NetworkFilter = 'all' | 'followers' | 'following' | 'connections' | 'active';

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
    relationshipType: RelationshipType;
    isActive: boolean;
    lastSeenAt?: any;
    userObj?: InvoxUser;
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
    relationshipType: 'connection' | 'following' | 'follower';
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
 * Styled distinctly based on relationship type
 */
function createTargetReticleTexture(type: RelationshipType): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const center = size / 2;
    let primaryColor = '#34d399'; // default emerald
    let glowColor = 'rgba(52, 211, 153, 0.45)';
    let accentColor = '#10b981';

    if (type === 'self') {
        primaryColor = '#10b981';
        glowColor = 'rgba(16, 185, 129, 0.6)';
        accentColor = '#34d399';
    } else if (type === 'connection') {
        primaryColor = '#34d399';
        glowColor = 'rgba(52, 211, 153, 0.45)';
        accentColor = '#059669';
    } else if (type === 'following') {
        primaryColor = '#f43f5e';
        glowColor = 'rgba(244, 63, 94, 0.45)';
        accentColor = '#e11d48';
    } else if (type === 'follower') {
        primaryColor = '#f8fafc';
        glowColor = 'rgba(248, 250, 252, 0.4)';
        accentColor = '#94a3b8';
    }

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
    grad.addColorStop(0.5, glowColor);
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
function createPulseWaveTexture(type: RelationshipType): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const center = size / 2;
    let strokeColor = 'rgba(52, 211, 153, 0.9)';
    let innerColor = 'rgba(52, 211, 153, 0.4)';

    if (type === 'self') {
        strokeColor = 'rgba(16, 185, 129, 0.95)';
        innerColor = 'rgba(52, 211, 153, 0.45)';
    } else if (type === 'following') {
        strokeColor = 'rgba(244, 63, 94, 0.9)';
        innerColor = 'rgba(244, 63, 94, 0.4)';
    } else if (type === 'follower') {
        strokeColor = 'rgba(248, 250, 252, 0.85)';
        innerColor = 'rgba(203, 213, 225, 0.35)';
    }

    // Outer ripple ring
    ctx.beginPath();
    ctx.arc(center, center, 108, 0, Math.PI * 2);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 4.0;
    ctx.stroke();

    // Faint inner secondary echo ring
    ctx.beginPath();
    ctx.arc(center, center, 74, 0, Math.PI * 2);
    ctx.strokeStyle = innerColor;
    ctx.lineWidth = 2.0;
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

/**
 * Glowing energy packet sprite texture for photon data packets gliding over arcs
 * Styled distinctly: Connections (emerald), Following (red), Followers (silver)
 */
function createPacketSpriteTexture(type: 'connection' | 'following' | 'follower'): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const center = size / 2;
    const grad = ctx.createRadialGradient(center, center, 0, center, center, size / 2);
    grad.addColorStop(0, '#ffffff');

    if (type === 'connection') {
        grad.addColorStop(0.2, '#34d399');
        grad.addColorStop(0.55, 'rgba(16, 185, 129, 0.55)');
    } else if (type === 'following') {
        grad.addColorStop(0.2, '#f43f5e');
        grad.addColorStop(0.55, 'rgba(225, 29, 72, 0.55)');
    } else {
        grad.addColorStop(0.2, '#f1f5f9');
        grad.addColorStop(0.55, 'rgba(148, 163, 184, 0.45)');
    }
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

    // Real data state
    const [relationships, setRelationships] = useState<UserRelationshipCounts | null>(null);
    const [networkUsers, setNetworkUsers] = useState<InvoxUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [webglError, setWebglError] = useState<string | null>(null);

    // Filter & interaction state
    const [networkFilter, setNetworkFilter] = useState<NetworkFilter>('all');
    const [hoveredNode, setHoveredNode] = useState<UserGlobeNode | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [selectedNode, setSelectedNode] = useState<UserGlobeNode | null>(null);
    const [showArcs, setShowArcs] = useState<boolean>(true);

    // References for Three.js render loop
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
    const rebuildVisualNetworkRef = useRef<(() => void) | null>(null);

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

    // 1. Subscribe to genuine user relationships in Firestore
    useEffect(() => {
        if (!currentUser?.uid) {
            setIsLoading(false);
            return;
        }

        // Keep signed-in user presence active in telemetry
        touchUserPresence(currentUser.uid);

        let isSubscribed = true;

        const unsubscribeRelationships = subscribeUserRelationships(
            currentUser.uid,
            async (rel) => {
                if (!isSubscribed) return;
                setRelationships(rel);

                // Collect all unique user IDs involved in the signed-in user's network
                const allNetworkUids = Array.from(new Set([...rel.followerIds, ...rel.followingIds]));

                if (allNetworkUids.length === 0) {
                    setNetworkUsers([]);
                    setIsLoading(false);
                    return;
                }

                try {
                    const profiles = await getProfilesByIds(allNetworkUids);
                    if (!isSubscribed) return;
                    setNetworkUsers(profiles);
                } catch (err: any) {
                    console.warn('[GLOBE] Profiles fetch error:', err.message);
                } finally {
                    if (isSubscribed) setIsLoading(false);
                }
            },
            (err) => {
                console.warn('[GLOBE] Firestore relationships sync notice:', err.message);
                if (isSubscribed) setIsLoading(false);
            }
        );

        return () => {
            isSubscribed = false;
            unsubscribeRelationships();
        };
    }, [currentUser?.uid]);

    // 2. Process authentic nodes & geodesic arcs strictly derived from validated application data
    const { allNodes, allArcs, hasCurrentUserLocation } = useMemo(() => {
        const nodes: UserGlobeNode[] = [];
        const arcs: ConnectionArcData[] = [];

        // Check current authenticated user's location
        let currentUserPos: THREE.Vector3 | null = null;
        let hasLocation = false;

        if (currentUser && userProfile) {
            const rawLoc = userProfile.location || (userProfile as any).city || (userProfile as any).country;
            const geo = resolveUserLocation(rawLoc, currentUser.uid);

            if (geo) {
                hasLocation = true;
                const pos = latLonToVector3(geo.lat, geo.lon, GLOBE_RADIUS + 1.2);
                currentUserPos = pos;

                nodes.push({
                    id: currentUser.uid,
                    uid: currentUser.uid,
                    username: userProfile.username || currentUser.email?.split('@')[0] || 'me',
                    displayName: userProfile.displayName || currentUser.displayName || 'Current User',
                    photoURL: userProfile.photoURL || currentUser.photoURL || null,
                    headline: userProfile.headline || '',
                    bio: userProfile.bio || '',
                    locationStr: userProfile.location || geo.regionName,
                    geo,
                    followerCount: relationships?.followerCount ?? userProfile.followerCount ?? 0,
                    followingCount: relationships?.followingCount ?? userProfile.followingCount ?? 0,
                    skills: userProfile.skills || [],
                    isCurrentUser: true,
                    position: pos,
                    relationshipType: 'self',
                    isActive: true,
                    lastSeenAt: Date.now(),
                    userObj: userProfile,
                });
            }
        }

        // Add verified network users who have a valid, resolvable geographic location
        // Rule: Exclude users without locations (never invent coordinates or jitter)
        networkUsers.forEach((user) => {
            if (!user.uid || user.uid === currentUser?.uid) return;

            const rawLoc = user.location || (user as any).city || (user as any).country;
            const geo = resolveUserLocation(rawLoc, user.uid);
            if (!geo) return; // Excluded from sphere placement if missing or unresolvable

            // Classify relationship type strictly
            // Mutual connection takes highest priority (User A follows User B AND User B follows User A)
            const isMutual = relationships?.connectionIds.has(user.uid);
            const isFollowing = relationships?.followingIds.has(user.uid);
            const isFollower = relationships?.followerIds.has(user.uid);

            let relType: RelationshipType = 'follower';
            if (isMutual) {
                relType = 'connection';
            } else if (isFollowing) {
                relType = 'following';
            }

            const active = isUserRecentlyActive(user);
            const pos = latLonToVector3(geo.lat, geo.lon, GLOBE_RADIUS + 1.2);

            const userNode: UserGlobeNode = {
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
                isCurrentUser: false,
                position: pos,
                relationshipType: relType,
                isActive: active,
                lastSeenAt: (user as any).lastSeenAt,
                userObj: user,
            };

            nodes.push(userNode);

            // Construct geographic network arc connecting signed-in user to connected user
            // Exactly ONE arc per relationship (mutual connections never duplicate as follower + following)
            if (currentUserPos && (isMutual || isFollowing || isFollower)) {
                const p1 = currentUserPos;
                const p2 = pos;
                const distance = p1.distanceTo(p2);
                const angularDist = p1.angleTo(p2);

                const elevation = GLOBE_RADIUS * (1.12 + Math.sin(angularDist * 0.5) * 0.48);
                const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5).normalize().multiplyScalar(elevation);

                const c1 = new THREE.Vector3().lerpVectors(p1, midPoint, 0.55).normalize().multiplyScalar(elevation * 0.94);
                const c2 = new THREE.Vector3().lerpVectors(p2, midPoint, 0.55).normalize().multiplyScalar(elevation * 0.94);

                const curve = new THREE.CubicBezierCurve3(p1, c1, c2, p2);
                const curvePoints = curve.getPoints(72);

                // Arc relationship type determines distinct color:
                // Connection = INVOX green / teal
                // Following = Restrained red
                // Follower = Neutral silver/white
                const arcRelType: 'connection' | 'following' | 'follower' = isMutual ? 'connection' : isFollowing ? 'following' : 'follower';

                arcs.push({
                    id: `arc-${currentUser?.uid}-${user.uid}`,
                    fromUserId: currentUser?.uid || '',
                    toUserId: user.uid,
                    fromPos: p1,
                    toPos: p2,
                    curve,
                    length: distance,
                    curvePoints,
                    status: 'ACTIVE',
                    drawProgress: 1.0,
                    relationshipType: arcRelType,
                });
            }
        });

        return { allNodes: nodes, allArcs: arcs, hasCurrentUserLocation: hasLocation };
    }, [currentUser, userProfile, networkUsers, relationships]);

    // 3. Apply active relationship filter dynamically without rebuilding Three.js canvas or resetting camera
    const { filteredNodes, filteredArcs } = useMemo(() => {
        if (networkFilter === 'all') {
            return { filteredNodes: allNodes, filteredArcs: allArcs };
        }

        const visibleNodeIds = new Set<string>();
        // Always retain current user if placed
        allNodes.forEach(node => {
            if (node.isCurrentUser) {
                visibleNodeIds.add(node.id);
                return;
            }

            if (networkFilter === 'connections' && node.relationshipType === 'connection') {
                visibleNodeIds.add(node.id);
            } else if (networkFilter === 'following' && (node.relationshipType === 'following' || relationships?.followingIds.has(node.uid))) {
                visibleNodeIds.add(node.id);
            } else if (networkFilter === 'followers' && (node.relationshipType === 'follower' || relationships?.followerIds.has(node.uid))) {
                visibleNodeIds.add(node.id);
            } else if (networkFilter === 'active' && node.isActive) {
                visibleNodeIds.add(node.id);
            }
        });

        const fNodes = allNodes.filter(n => visibleNodeIds.has(n.id));

        const fArcs = allArcs.filter(arc => {
            const hasTo = visibleNodeIds.has(arc.toUserId);
            if (!hasTo) return false;

            if (networkFilter === 'connections') return arc.relationshipType === 'connection';
            if (networkFilter === 'following') return arc.relationshipType === 'following' || arc.relationshipType === 'connection';
            if (networkFilter === 'followers') return arc.relationshipType === 'follower' || arc.relationshipType === 'connection';
            if (networkFilter === 'active') {
                const targetNode = allNodes.find(n => n.id === arc.toUserId);
                return targetNode?.isActive ?? false;
            }
            return true;
        });

        return { filteredNodes: fNodes, filteredArcs: fArcs };
    }, [allNodes, allArcs, networkFilter, relationships]);

    // Keep active visual nodes/arcs synced into animation refs and trigger live mesh rebuild
    useEffect(() => {
        nodesRef.current = filteredNodes;
        arcsRef.current = filteredArcs;
        rebuildVisualNetworkRef.current?.();
    }, [filteredNodes, filteredArcs]);

    // 4. Main Three.js Scene Setup & Render Engine
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

        const globeGroup = new THREE.Group();
        globeGroup.rotation.y = -Math.PI * 0.44;
        scene.add(globeGroup);

        const globeMesh = new THREE.Mesh(globeGeometry, globeMaterial);
        globeGroup.add(globeMesh);

        // ─── VOLUMETRIC ATMOSPHERIC SCATTERING ──────────────────────────────────
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

        // ─── TARGET RETICLE NODES & ARCS ────────────────────────────────────────
        const nodesGroup = new THREE.Group();
        globeGroup.add(nodesGroup);

        const arcsGroup = new THREE.Group();
        arcsGroup.visible = showArcsRef.current;
        arcsGroupRef.current = arcsGroup;
        globeGroup.add(arcsGroup);

        const nodeHitboxes: THREE.Mesh[] = [];
        const pulseSprites: Array<{ sprite: THREE.Sprite; seed: number; isCurrentUser: boolean }> = [];

        // Pre-create canvas textures for relationships
        const selfReticleTexture = createTargetReticleTexture('self');
        const connectionReticleTexture = createTargetReticleTexture('connection');
        const followingReticleTexture = createTargetReticleTexture('following');
        const followerReticleTexture = createTargetReticleTexture('follower');

        const selfPulseTexture = createPulseWaveTexture('self');
        const connectionPulseTexture = createPulseWaveTexture('connection');
        const followingPulseTexture = createPulseWaveTexture('following');
        const followerPulseTexture = createPulseWaveTexture('follower');

        const connectionPacketTexture = createPacketSpriteTexture('connection');
        const followingPacketTexture = createPacketSpriteTexture('following');
        const followerPacketTexture = createPacketSpriteTexture('follower');

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
            relationshipType: 'connection' | 'following' | 'follower';
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
                
                let reticleTex = followerReticleTexture;
                let pulseTex = followerPulseTexture;
                let ringColor = 0xf8fafc;
                let spikeColor = 0x94a3b8;

                if (isCurrent) {
                    reticleTex = selfReticleTexture;
                    pulseTex = selfPulseTexture;
                    ringColor = 0x10b981;
                    spikeColor = 0x34d399;
                } else if (node.relationshipType === 'connection') {
                    reticleTex = connectionReticleTexture;
                    pulseTex = connectionPulseTexture;
                    ringColor = 0x10b981;
                    spikeColor = 0x34d399;
                } else if (node.relationshipType === 'following') {
                    reticleTex = followingReticleTexture;
                    pulseTex = followingPulseTexture;
                    ringColor = 0xf43f5e;
                    spikeColor = 0xf43f5e;
                }

                if (isSelected) {
                    ringColor = 0x67e8f9;
                    spikeColor = 0x67e8f9;
                }

                // A. Ground Anchor Ring directly on the sphere's surface
                const groundPos = node.position.clone().normalize().multiplyScalar(GLOBE_RADIUS + 0.3);
                const surfaceNormal = groundPos.clone().normalize();
                
                const ringGeo = new THREE.RingGeometry(1.8, 2.4, 24);
                const ringMat = new THREE.MeshBasicMaterial({
                    color: ringColor,
                    transparent: true,
                    opacity: isCurrent ? 0.9 : 0.55,
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
                    color: spikeColor,
                    transparent: true,
                    opacity: isCurrent ? 0.95 : 0.6,
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
                const spriteSize = isCurrent ? 14 : (isSelected ? 14.5 : 12);
                sprite.scale.set(spriteSize, spriteSize, 1);
                nodesGroup.add(sprite);

                // D. Animated Concentric Radar Pulse Ring Sprite
                const pulseMat = new THREE.SpriteMaterial({
                    map: pulseTex,
                    transparent: true,
                    opacity: isCurrent ? 0.85 : 0.5,
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

                // 3 Distinct Arc Colors:
                // Connections: INVOX green / teal (0x10b981)
                // Following: Restrained red (0xf43f5e)
                // Followers: Neutral silver/white (0xf8fafc)
                let arcColor = 0xf8fafc;
                let glowColor = 0x94a3b8;
                let opacity = 0.75;
                let glowOpacity = 0.28;

                if (arc.relationshipType === 'connection') {
                    arcColor = 0x10b981;
                    glowColor = 0x059669;
                    opacity = 0.95;
                    glowOpacity = 0.52;
                } else if (arc.relationshipType === 'following') {
                    arcColor = 0xf43f5e;
                    glowColor = 0xe11d48;
                    opacity = 0.88;
                    glowOpacity = 0.42;
                } else if (arc.relationshipType === 'follower') {
                    arcColor = 0xf8fafc;
                    glowColor = 0x94a3b8;
                    opacity = 0.75;
                    glowOpacity = 0.25;
                }

                if (isConnectedToSelected) {
                    arcColor = 0x34d399;
                    glowColor = 0x10b981;
                    opacity = 1.0;
                    glowOpacity = 0.65;
                } else if (selected && !isConnectedToSelected) {
                    opacity = 0.08;
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

                // Layer 3: High-Speed Photon Energy Comet
                if (arc.status === 'ACTIVE' || arc.status === 'CONNECTING' || isConnectedToSelected) {
                    let packetTex = followerPacketTexture;
                    if (arc.relationshipType === 'connection') {
                        packetTex = connectionPacketTexture;
                    } else if (arc.relationshipType === 'following') {
                        packetTex = followingPacketTexture;
                    }

                    // Comet Head Sprite
                    const headMat = new THREE.SpriteMaterial({
                        map: packetTex,
                        transparent: true,
                        opacity: 0.95,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false,
                    });
                    const headSprite = new THREE.Sprite(headMat);
                    const headSize = arc.relationshipType === 'connection' ? 5.8 : 4.8;
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
                            opacity: (0.55 - t * 0.15),
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
                        relationshipType: arc.relationshipType,
                    });
                }
            });
        };

        rebuildVisualNetworkRef.current = rebuildVisualNetwork;
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
            pulseSprites.forEach(({ sprite, seed, isCurrentUser }) => {
                const speed = isCurrentUser ? 2.2 : 1.6;
                const cycle = (elapsedTime * speed + seed) % (Math.PI * 2);
                const scaleMultiplier = 1.0 + (Math.sin(cycle) + 1.0) * (isCurrentUser ? 0.5 : 0.4);
                const baseSize = isCurrentUser ? 14 : 12;
                sprite.scale.set(baseSize * scaleMultiplier, baseSize * scaleMultiplier, 1);
                (sprite.material as THREE.SpriteMaterial).opacity = Math.max(0.04, 0.8 - Math.sin(cycle) * 0.5);
                (sprite.material as THREE.SpriteMaterial).rotation = elapsedTime * (isCurrentUser ? 0.8 : -0.5) + seed;
            });

            // Flow Connection Packet Comets
            packetComets.forEach(comet => {
                comet.progress = (comet.progress + comet.speed) % 1.0;
                
                const headPt = comet.curve.getPoint(comet.progress);
                comet.headSprite.position.copy(headPt);

                const pulseFactor = 1.0 + Math.sin(comet.progress * Math.PI) * 0.35;
                const baseHeadSize = comet.relationshipType === 'connection' ? 5.8 : 4.8;
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
            selfReticleTexture.dispose();
            connectionReticleTexture.dispose();
            followingReticleTexture.dispose();
            followerReticleTexture.dispose();
            selfPulseTexture.dispose();
            connectionPulseTexture.dispose();
            followingPulseTexture.dispose();
            followerPulseTexture.dispose();
            connectionPacketTexture.dispose();
            followingPacketTexture.dispose();
            followerPacketTexture.dispose();
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
            <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2 pointer-events-auto">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Dynamic Network Filter Bar */}
                    <div className="bg-[#0c0c0e]/95 border border-zinc-800/90 p-1 flex items-center gap-1 shadow-xl backdrop-blur-md">
                        {[
                            { id: 'all', label: 'ALL' },
                            { id: 'followers', label: 'FOLLOWERS', dotClass: 'bg-slate-300' },
                            { id: 'following', label: 'FOLLOWING', dotClass: 'bg-rose-500' },
                            { id: 'connections', label: 'CONNECTIONS', dotClass: 'bg-emerald-400' },
                            { id: 'active', label: 'ACTIVE', dotClass: 'bg-emerald-400 animate-pulse' },
                        ].map((btn) => (
                            <button
                                key={btn.id}
                                onClick={() => setNetworkFilter(btn.id as NetworkFilter)}
                                className={`px-2 sm:px-2.5 py-1 text-[10px] font-mono tracking-wider transition-all flex items-center gap-1.5 ${
                                    networkFilter === btn.id
                                        ? 'bg-zinc-800 text-white font-bold border border-zinc-600 shadow-sm'
                                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
                                }`}
                            >
                                {btn.dotClass && <span className={`w-1.5 h-1.5 ${btn.dotClass}`}></span>}
                                <span>{btn.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Nodes & Arcs Count */}
                    <div className="bg-[#0c0c0e]/95 border border-zinc-800/90 px-3 py-1.5 flex items-center gap-2 shadow-xl backdrop-blur-md">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-none animate-pulse"></span>
                        <span className="text-[11px] text-zinc-300 font-mono font-medium tracking-wider">
                            {filteredNodes.length} NODES <span className="text-zinc-600">/</span> {filteredArcs.length} ARCS
                        </span>
                    </div>

                    {/* Arcs Visibility Toggle */}
                    <button
                        onClick={() => setShowArcs(prev => !prev)}
                        title={showArcs ? "Hide Connection Arcs" : "Show Connection Arcs"}
                        className={`border px-3 py-1.5 text-[11px] font-mono tracking-wider transition-colors shadow-lg active:scale-[0.98] flex items-center gap-1.5 ${
                            showArcs
                                ? 'bg-[#0c0c0e]/95 hover:bg-[#18181d] border-zinc-800/90 hover:border-zinc-600 text-zinc-300 hover:text-white'
                                : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                        }`}
                    >
                        <span className={`w-1.5 h-1.5 ${showArcs ? 'bg-emerald-400' : 'bg-zinc-600'}`}></span>
                        <span>ARCS: {showArcs ? 'ON' : 'OFF'}</span>
                    </button>

                    {/* Reset Camera View */}
                    <button
                        onClick={handleResetView}
                        title="Recenter Camera"
                        className="bg-[#0c0c0e]/95 hover:bg-[#18181d] border border-zinc-800/90 hover:border-zinc-600 text-zinc-300 hover:text-white px-3 py-1.5 text-[11px] font-mono tracking-wider transition-colors shadow-lg active:scale-[0.98] flex items-center gap-1.5"
                    >
                        <span className="text-zinc-500">↺</span>
                        <span>RESET</span>
                    </button>
                </div>

                {/* Arc Relationship Palette Legend */}
                <div className="hidden sm:flex items-center gap-3 px-3 py-1 bg-[#0c0c0e]/90 border border-zinc-800/90 text-[10px] font-mono text-zinc-400 backdrop-blur-md shadow-lg">
                    <span className="text-zinc-500 font-bold tracking-wider">// ARCS:</span>
                    <span className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-0.5 bg-emerald-400 inline-block shadow-sm"></span>
                        <span className="text-zinc-300">Connections (Mutual)</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-0.5 bg-rose-500 inline-block shadow-sm"></span>
                        <span className="text-zinc-300">Following</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-0.5 bg-slate-300 inline-block shadow-sm"></span>
                        <span className="text-zinc-300">Followers</span>
                    </span>
                </div>
            </div>

            {/* Notice if Signed-In User Lacks a Configured Profile Location */}
            {currentUser && !hasCurrentUserLocation && (
                <div className="absolute top-20 left-6 z-20 pointer-events-auto max-w-md bg-[#0c0c0e]/95 border border-amber-500/40 p-3 shadow-2xl backdrop-blur-md text-[11px] font-mono">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                            <span className="w-1.5 h-1.5 bg-amber-400 animate-pulse"></span>
                            <span>// HOST_NODE_LOCATION_MISSING</span>
                        </div>
                    </div>
                    <p className="text-zinc-400 text-[10px] leading-relaxed mb-2">
                        Set your country or city in Settings to anchor network arcs from your profile to connected users across the globe.
                    </p>
                    <button
                        onClick={() => navigate('/settings')}
                        className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 px-2.5 py-1 text-[10px] font-bold tracking-wider transition-colors uppercase"
                    >
                        Configure Location →
                    </button>
                </div>
            )}

            {/* Empty State Overlay when Filter Yields Zero Visible Network Nodes */}
            {!isLoading && filteredNodes.length <= (hasCurrentUserLocation ? 1 : 0) && (
                <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none p-4">
                    <div className="bg-[#0c0c0e]/95 border border-zinc-800 p-6 max-w-sm text-center shadow-2xl backdrop-blur-md pointer-events-auto font-mono">
                        <div className="w-8 h-8 mx-auto mb-3 border border-zinc-700 bg-zinc-900 flex items-center justify-center text-zinc-400">
                            ⌁
                        </div>
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-1">
                            {networkFilter === 'connections' && 'NO MUTUAL CONNECTIONS'}
                            {networkFilter === 'following' && 'NO FOLLOWED CREATORS'}
                            {networkFilter === 'followers' && 'NO FOLLOWERS DETECTED'}
                            {networkFilter === 'active' && 'NO ACTIVE NETWORK NODES'}
                            {networkFilter === 'all' && 'EMPTY NETWORK TOPOLOGY'}
                        </h3>
                        <p className="text-[11px] text-zinc-400 leading-relaxed mb-4">
                            {networkFilter === 'connections' && 'Network arcs require reciprocal follows. Follow creators back to establish mutual connection links.'}
                            {networkFilter === 'following' && 'You are not following any users with a registered location yet.'}
                            {networkFilter === 'followers' && 'No users with registered locations currently follow your profile.'}
                            {networkFilter === 'active' && 'None of your network comrades have reported activity in the last 20 minutes.'}
                            {networkFilter === 'all' && 'Connect with other INVOX creators to visualize geographic arcs across the globe.'}
                        </p>
                        <div className="flex justify-center gap-2">
                            {networkFilter !== 'all' ? (
                                <button
                                    onClick={() => setNetworkFilter('all')}
                                    className="bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-bold px-3 py-1.5 uppercase tracking-wider border border-zinc-600 transition-colors"
                                >
                                    View All Relationships
                                </button>
                            ) : (
                                <button
                                    onClick={() => navigate('/trendz')}
                                    className="bg-white hover:bg-zinc-200 text-black text-[10px] font-bold px-3 py-1.5 uppercase tracking-wider border border-white transition-colors"
                                >
                                    Explore Creators
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Hover Tooltip (Dynamic Cursor HUD) */}
            {hoveredNode && !selectedNode && (
                <div
                    className="fixed pointer-events-none z-50 transition-opacity duration-150"
                    style={{ left: tooltipPos.x + 18, top: tooltipPos.y - 18 }}
                >
                    <div className="bg-[#0c0c0e]/95 backdrop-blur-md border border-zinc-800 p-3.5 shadow-2xl min-w-[220px] font-mono">
                        <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-zinc-800/80">
                            <span className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                                {hoveredNode.isCurrentUser ? (
                                    <span className="text-emerald-400">// YOUR_NODE</span>
                                ) : hoveredNode.relationshipType === 'connection' ? (
                                    <span className="text-emerald-400">// MUTUAL_CONNECTION</span>
                                ) : hoveredNode.relationshipType === 'following' ? (
                                    <span className="text-rose-400">// FOLLOWING</span>
                                ) : (
                                    <span className="text-zinc-400">// FOLLOWER</span>
                                )}
                            </span>
                            <span className={`w-1.5 h-1.5 ${hoveredNode.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`}></span>
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
                                <span className="text-zinc-500 uppercase">STATUS:</span>
                                <span className={`text-[9px] font-bold ${hoveredNode.isActive ? 'text-emerald-400' : 'text-zinc-500'}`}>
                                    {hoveredNode.isActive ? 'ACTIVE NOW' : 'OFFLINE'}
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
                                <span className={`w-1.5 h-1.5 ${selectedNode.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`}></span>
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
                                <p className="text-[10px] text-zinc-300 truncate font-semibold mt-0.5">
                                    {selectedNode.geo.city ? `${selectedNode.geo.city}, ${selectedNode.geo.country}` : selectedNode.geo.country}
                                </p>
                            </div>
                        </div>

                        {/* Relationship Badge & Presence Telemetry */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-3">
                            {selectedNode.isCurrentUser ? (
                                <span className="text-[9px] bg-emerald-950/70 text-emerald-300 border border-emerald-500/70 px-2 py-0.5 font-bold uppercase tracking-wider">
                                    YOU // HOST
                                </span>
                            ) : selectedNode.relationshipType === 'connection' ? (
                                <span className="text-[9px] bg-emerald-950/70 text-emerald-300 border border-emerald-500/70 px-2 py-0.5 font-bold uppercase tracking-wider flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-emerald-400 inline-block"></span>
                                    MUTUAL CONNECTION
                                </span>
                            ) : selectedNode.relationshipType === 'following' ? (
                                <span className="text-[9px] bg-rose-950/70 text-rose-300 border border-rose-500/70 px-2 py-0.5 font-bold uppercase tracking-wider flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-rose-500 inline-block"></span>
                                    FOLLOWING
                                </span>
                            ) : (
                                <span className="text-[9px] bg-zinc-900 text-slate-300 border border-zinc-700 px-2 py-0.5 font-bold uppercase tracking-wider flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-slate-300 inline-block"></span>
                                    FOLLOWER
                                </span>
                            )}

                            <span className="text-[9px] text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 font-mono">
                                {selectedNode.isActive ? 'ONLINE' : formatLastActiveString(selectedNode.lastSeenAt)}
                            </span>
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
                                onClick={() => navigate(selectedNode.isCurrentUser ? '/myspace' : `/profile/${selectedNode.id}`)}
                                className="flex-1 bg-white hover:bg-zinc-200 text-black text-xs font-bold py-2 px-3 uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors border border-white"
                            >
                                <ProfileIcon className="w-3.5 h-3.5" />
                                <span>{selectedNode.isCurrentUser ? 'My Space' : 'Profile'}</span>
                            </button>
                            {!selectedNode.isCurrentUser && (
                                <button
                                    onClick={() => navigate(`/messages`)}
                                    className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white text-xs font-bold py-2 px-3 uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                                >
                                    <ChatIcon className="w-3.5 h-3.5" />
                                    <span>Signal</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InteractiveGlobe;
