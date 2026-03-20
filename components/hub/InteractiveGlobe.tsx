
import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
// FIX: Added missing import for GlobeAltIcon to fix the "Cannot find name" error.
import { GlobeAltIcon } from '../ui/Icons';

interface MarkerData {
    id: string;
    name: string;
    lat: number;
    lon: number;
    activity: string;
}

const mockMarkers: MarkerData[] = [
    { id: '1', name: 'New York Hub', lat: 40.7128, lon: -74.0060, activity: 'High' },
    { id: '2', name: 'London Node', lat: 51.5074, lon: -0.1278, activity: 'Medium' },
    { id: '3', name: 'Tokyo Core', lat: 35.6762, lon: 139.6503, activity: 'Ultra' },
    { id: '4', name: 'Mumbai Stream', lat: 19.0760, lon: 72.8777, activity: 'High' },
    { id: '5', name: 'Sydney Link', lat: -33.8688, lon: 151.2093, activity: 'Medium' },
    { id: '6', name: 'San Francisco Base', lat: 37.7749, lon: -122.4194, activity: 'High' },
    { id: '7', name: 'Berlin Sync', lat: 52.5200, lon: 13.4050, activity: 'Low' },
    { id: '8', name: 'Cape Town Nexus', lat: -33.9249, lon: 18.4241, activity: 'Medium' },
];

const continentColors: Record<string, THREE.Color> = {
    'NA': new THREE.Color(0x00f5ff),
    'SA': new THREE.Color(0x00ff7f),
    'EU': new THREE.Color(0xffd700),
    'AF': new THREE.Color(0xff4500),
    'AS': new THREE.Color(0xff00ff),
    'OC': new THREE.Color(0x7b68ee),
    'AN': new THREE.Color(0xffffff),
    'SEA': new THREE.Color(0x080808),
};

const InteractiveGlobe: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [hoveredMarker, setHoveredMarker] = useState<MarkerData | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [webglError, setWebglError] = useState<string | null>(null);
    const hoveredMarkerRef = useRef<MarkerData | null>(null);

    useEffect(() => {
        hoveredMarkerRef.current = hoveredMarker;
    }, [hoveredMarker]);

    useEffect(() => {
        if (!containerRef.current) return;

        let renderer: THREE.WebGLRenderer;
        
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        } catch (e) {
            setWebglError("WebGL is not supported or was blocked by your browser.");
            return;
        }

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000); 

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
        camera.position.z = 450;

        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        containerRef.current.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.enablePan = false;
        controls.minDistance = 250;
        controls.maxDistance = 1500;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.5;

        const starGeometry = new THREE.BufferGeometry();
        const starCount = 1800; 
        const starPositions = new Float32Array(starCount * 3);
        const starColors = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount; i++) {
            const r = 1200 + Math.random() * 3800;
            const theta = 2 * Math.PI * Math.random();
            const phi = Math.acos(2 * Math.random() - 1);
            starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            starPositions[i * 3 + 2] = r * Math.cos(phi);

            const spectral = Math.random();
            if (spectral > 0.82) {
                starColors[i * 3] = 0.2; starColors[i * 3 + 1] = 0.5; starColors[i * 3 + 2] = 1.0;
            } else if (spectral > 0.65) {
                starColors[i * 3] = 1.0; starColors[i * 3 + 1] = 0.85; starColors[i * 3 + 2] = 0.1;
            } else if (spectral > 0.55) {
                starColors[i * 3] = 1.0; starColors[i * 3 + 1] = 0.4; starColors[i * 3 + 2] = 0.05;
            } else {
                starColors[i * 3] = 1.0; starColors[i * 3 + 1] = 1.0; starColors[i * 3 + 2] = 1.0;
            }
        }
        starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
        
        const starMaterial = new THREE.PointsMaterial({
            size: 11.5, 
            vertexColors: true, 
            transparent: true, 
            opacity: 1.0, 
            sizeAttenuation: true, 
            blending: THREE.AdditiveBlending 
        });
        const stars = new THREE.Points(starGeometry, starMaterial);
        scene.add(stars);

        const radius = 160;
        const latLonToVector3 = (lat: number, lon: number, r: number) => {
            const phi = (90 - lat) * (Math.PI / 180);
            const theta = (lon + 180) * (Math.PI / 180);
            const x = -(r * Math.sin(phi) * Math.cos(theta));
            const y = r * Math.cos(phi);
            const z = r * Math.sin(phi) * Math.sin(theta);
            return new THREE.Vector3(x, y, z);
        };

        const vector3ToLatLon = (v: THREE.Vector3) => {
            const r = v.length();
            const lat = 90 - (Math.acos(v.y / r) * 180 / Math.PI);
            const lon = (Math.atan2(v.z, -v.x) * 180 / Math.PI) - 180;
            return { lat, lon: lon < -180 ? lon + 360 : lon };
        };

        const getContinentAt = (lat: number, lon: number): string | null => {
            if (lat < -62) return 'AN';
            if (lat > 7 && lat < 84 && lon > -168 && lon < -52) {
                if (lat < 15 && lon > -77) return null;
                return 'NA';
            }
            if (lat > -56 && lat < 13 && lon > -82 && lon < -34) {
                if (lat > 7 && lon < -77) return null;
                return 'SA';
            }
            if (lat > -35 && lat < 38 && lon > -20 && lon < 52) {
                if (lat > 12 && lon > 34) {
                    if (lat > 30 && lon > 32) return null;
                    if (lon > 35) return null;
                }
                return 'AF';
            }
            if (lat > 35 && lat < 72 && lon > -25 && lon < 60) {
                if (lon > 40) {
                    if (lat < 46 && lon > 40) return null;
                    if (lat >= 46 && lon > 58) return null;
                }
                return 'EU';
            }
            if (lat > -10 && lat < 81 && lon > 34 && lon < 180) {
                if (lat < 15 && lon > 105) return 'OC';
                if (lat > 35 && lat < 45 && lon < 45) {
                    if (lon < 40) return null;
                }
                return 'AS';
            }
            if (lat > -48 && lat < 10 && lon > 110 && lon < 180) {
                if (lat > 0 && lon < 115) return null;
                return 'OC';
            }
            return null;
        };

        const segments = 280; 
        const pointsCount = segments * (segments / 2);
        const positions = new Float32Array(pointsCount * 3);
        const colors = new Float32Array(pointsCount * 3);
        let idx = 0;
        for (let latIdx = 0; latIdx < segments / 2; latIdx++) {
            for (let lonIdx = 0; lonIdx < segments; lonIdx++) {
                const phi = (latIdx / (segments / 2)) * Math.PI;
                const theta = (lonIdx / segments) * 2 * Math.PI;
                const lat = 90 - (phi * 180) / Math.PI;
                const lon = (theta * 180) / Math.PI - 180;
                const pos = latLonToVector3(lat, lon, radius);
                positions[idx * 3] = pos.x;
                positions[idx * 3 + 1] = pos.y;
                positions[idx * 3 + 2] = pos.z;
                
                const cont = getContinentAt(lat, lon);
                const col = cont ? continentColors[cont] : continentColors['SEA'];
                colors[idx * 3] = col.r;
                colors[idx * 3 + 1] = col.g;
                colors[idx * 3 + 2] = col.b;
                idx++;
            }
        }
        const pointGeometry = new THREE.BufferGeometry();
        pointGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        pointGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const pointMaterial = new THREE.PointsMaterial({
            size: 1.25, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, sizeAttenuation: true,
        });
        const points = new THREE.Points(pointGeometry, pointMaterial);
        scene.add(points);

        const hitSphereGeo = new THREE.SphereGeometry(radius, 64, 64);
        const hitSphereMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitSphere = new THREE.Mesh(hitSphereGeo, hitSphereMat);
        scene.add(hitSphere);

        // --- BORDERS WITH SHIMMER SHADER ---
        const borderSegments: number[] = [];
        const lineResolution = 200;
        for (let latIdx = 0; latIdx < lineResolution / 2; latIdx++) {
            for (let lonIdx = 0; lonIdx < lineResolution; lonIdx++) {
                const lat = 90 - (latIdx / (lineResolution / 2)) * 180;
                const lon = (lonIdx / lineResolution) * 360 - 180;
                const isLand = !!getContinentAt(lat, lon);
                const nextLat = 90 - ((latIdx + 1) / (lineResolution / 2)) * 180;
                const nextLon = ((lonIdx + 1) / lineResolution) * 360 - 180;
                const isLandRight = !!getContinentAt(lat, nextLon);
                const isLandDown = !!getContinentAt(nextLat, lon);
                
                if (isLand !== isLandRight) {
                    const p1 = latLonToVector3(lat, lon, radius + 0.5);
                    const p2 = latLonToVector3(lat, nextLon, radius + 0.5);
                    borderSegments.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
                }
                if (isLand !== isLandDown) {
                    const p1 = latLonToVector3(lat, lon, radius + 0.5);
                    const p2 = latLonToVector3(nextLat, lon, radius + 0.5);
                    borderSegments.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
                }
            }
        }
        const borderGeometry = new THREE.BufferGeometry();
        borderGeometry.setAttribute('position', new THREE.Float32BufferAttribute(borderSegments, 3));

        const borderShimmerMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uHoverStrength: { value: 0 },
            },
            vertexShader: `
                varying vec3 vPosition;
                void main() {
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform float uHoverStrength;
                varying vec3 vPosition;
                void main() {
                    float speed = 1.5 + (uHoverStrength * 3.0);
                    float freq = 0.08 + (uHoverStrength * 0.12);
                    float shimmer = sin(vPosition.y * freq + vPosition.x * freq + uTime * speed);
                    shimmer = pow(max(0.0, shimmer), 3.0);
                    float alpha = (0.08 + (uHoverStrength * 0.15)) + (shimmer * (0.2 + uHoverStrength * 0.5));
                    vec3 color = mix(vec3(0.3, 0.3, 0.3), vec3(1.0, 1.0, 1.0), shimmer);
                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const borderLines = new THREE.LineSegments(borderGeometry, borderShimmerMaterial);
        scene.add(borderLines);

        const markerGroup = new THREE.Group();
        const markerGeometry = new THREE.SphereGeometry(2.5, 16, 16);
        const markerMeshes: THREE.Mesh[] = [];

        mockMarkers.forEach(data => {
            const pos = latLonToVector3(data.lat, data.lon, radius + 2);
            const mat = new THREE.MeshBasicMaterial({ color: 0xe50914 });
            const mesh = new THREE.Mesh(markerGeometry, mat);
            mesh.position.copy(pos);
            mesh.userData = data;
            markerGroup.add(mesh);
            markerMeshes.push(mesh);
            
            const glowGeo = new THREE.SphereGeometry(5, 16, 16);
            const glowMat = new THREE.MeshBasicMaterial({ color: 0xe50914, transparent: true, opacity: 0.3 });
            const glowMesh = new THREE.Mesh(glowGeo, glowMat);
            glowMesh.position.copy(pos);
            markerGroup.add(glowMesh);
        });
        scene.add(markerGroup);

        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        let targetHoverStrength = 0;

        const handlePointerMove = (event: MouseEvent) => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            const markerIntersects = raycaster.intersectObjects(markerMeshes);

            if (markerIntersects.length > 0) {
                targetHoverStrength = 1.0;
                const marker = markerIntersects[0].object as THREE.Mesh;
                const data = marker.userData as MarkerData;
                setHoveredMarker(data);
                setTooltipPos({ x: event.clientX, y: event.clientY });
                if (containerRef.current) containerRef.current.style.cursor = 'pointer';
                marker.scale.set(1.4, 1.4, 1.4);
            } else {
                setHoveredMarker(null);
                markerMeshes.forEach(m => m.scale.set(1, 1, 1));
                
                const globeIntersects = raycaster.intersectObject(hitSphere);
                if (globeIntersects.length > 0) {
                    const point = globeIntersects[0].point;
                    const { lat, lon } = vector3ToLatLon(point);
                    const continent = getContinentAt(lat, lon);
                    
                    if (continent) {
                        targetHoverStrength = 0.6;
                        if (containerRef.current) containerRef.current.style.cursor = 'crosshair';
                    } else {
                        targetHoverStrength = 0;
                        if (containerRef.current) containerRef.current.style.cursor = 'grab';
                    }
                } else {
                    targetHoverStrength = 0;
                    if (containerRef.current) containerRef.current.style.cursor = 'grab';
                }
            }
        };

        const handleClick = (event: MouseEvent) => {
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(markerMeshes);
            if (intersects.length > 0) {
                const data = intersects[0].object.userData as MarkerData;
                alert(`Redirecting to ${data.name} feed...`);
            }
        };

        window.addEventListener('mousemove', handlePointerMove);
        window.addEventListener('click', handleClick);

        let animationId: number;
        const animate = () => {
            animationId = requestAnimationFrame(animate);
            stars.rotation.y -= 0.0001;
            stars.rotation.x += 0.00005;
            const time = Date.now() * 0.0015;
            
            borderShimmerMaterial.uniforms.uTime.value = time;
            borderShimmerMaterial.uniforms.uHoverStrength.value += (targetHoverStrength - borderShimmerMaterial.uniforms.uHoverStrength.value) * 0.1;

            markerGroup.children.forEach((child, i) => {
                if (i % 2 !== 0) {
                    const markerMesh = markerGroup.children[i - 1] as THREE.Mesh;
                    const isHovered = hoveredMarkerRef.current && markerMesh.userData.id === hoveredMarkerRef.current.id;
                    const pulseAmount = isHovered ? 0.6 : 0.25;
                    const pulseSpeed = isHovered ? 6 : 2;
                    (child as THREE.Mesh).scale.setScalar(1 + Math.sin(time * pulseSpeed + i) * pulseAmount);
                }
            });

            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        const handleResize = () => {
            if (!containerRef.current) return;
            const newWidth = containerRef.current.clientWidth;
            const newHeight = containerRef.current.clientHeight;
            camera.aspect = newWidth / newHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(newWidth, newHeight);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handlePointerMove);
            window.removeEventListener('click', handleClick);
            
            if (containerRef.current && renderer.domElement.parentNode) {
                containerRef.current.removeChild(renderer.domElement);
            }

            // Thorough disposal to free WebGL context
            pointGeometry.dispose(); 
            starGeometry.dispose(); 
            markerGeometry.dispose();
            hitSphereGeo.dispose(); 
            borderGeometry.dispose();
            pointMaterial.dispose(); 
            starMaterial.dispose(); 
            hitSphereMat.dispose(); 
            borderShimmerMaterial.dispose();
            renderer.dispose();
        };
    }, []);

    if (webglError) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-black p-8 text-center">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl max-w-md">
                    <GlobeAltIcon className="w-16 h-16 text-invox-red/50 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-tighter">Connection Interrupted</h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-6">
                        {webglError} Please ensure hardware acceleration is enabled in your browser settings.
                    </p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="bg-white/10 hover:bg-white/20 border border-white/10 text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all"
                    >
                        Try Reconnect
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative group bg-black overflow-hidden">
            <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
            
            {hoveredMarker && (
                <div 
                    className="fixed pointer-events-none z-50 animate-fadeInUp"
                    style={{ left: tooltipPos.x + 20, top: tooltipPos.y - 20 }}
                >
                    <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-xl shadow-2xl min-w-[200px]">
                        <p className="text-xs font-black text-invox-red uppercase tracking-widest mb-1">Active Node</p>
                        <h4 className="text-lg font-bold text-white mb-2">{hoveredMarker.name}</h4>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-400 uppercase font-bold">Activity Level</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                hoveredMarker.activity === 'Ultra' ? 'bg-invox-blue text-white' : 'bg-green-500/20 text-green-400'
                            }`}>
                                {hoveredMarker.activity}
                            </span>
                        </div>
                        <div className="mt-3 text-[9px] text-gray-500 italic">Click to expand feed</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InteractiveGlobe;
