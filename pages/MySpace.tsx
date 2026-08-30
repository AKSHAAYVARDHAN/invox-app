
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SparklesIcon, ChevronDownIcon, ClockIcon, CheckIcon, GlobeAltIcon, RadioIcon, CubeIcon } from '../components/ui/Icons';
import { useAuth } from '../contexts/AuthContext';
import { useAIAssistant } from '../contexts/AIAssistantContext';
import { subscribeToUserPosts } from '../services/postService';
import type { Post } from '../types';

type Timeframe = '7d' | '1m' | '1y' | 'all';

const METRICS_BY_TIMEFRAME: Record<Timeframe, { uploads: number; score: number; activity: string }> = {
    '7d': { uploads: 12, score: 9.5, activity: 'Low' },
    '1m': { uploads: 58, score: 8.8, activity: 'Medium' },
    '1y': { uploads: 312, score: 8.6, activity: 'Medium' },
    'all': { uploads: 450, score: 8.5, activity: 'High' }
};

const timeframeLabels: Record<Timeframe, string> = {
    '7d': 'Last 7 Days',
    '1m': 'Last Month',
    '1y': 'Last Year',
    'all': 'All Time'
};

const DataGalaxy: React.FC<{ uploads: number; score: number; activity: string; timeframe: Timeframe }> = ({ uploads, score, activity, timeframe }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [webglError, setWebglError] = useState<string | null>(null);
    
    useEffect(() => {
        if (!containerRef.current) return;

        let renderer: THREE.WebGLRenderer;
        
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        } catch (e) {
            setWebglError("Galaxy visualization restricted. Context limit reached or WebGL disabled.");
            return;
        }

        const scene = new THREE.Scene();
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
        camera.position.set(0, 350, 600);

        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        containerRef.current.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.autoRotate = false; 

        const rotationSpeeds: Record<string, number> = {
            'Low': (0.635 * Math.PI / 180) / 60,
            'Medium': (0.93 * Math.PI / 180) / 60,
            'High': (1.35 * Math.PI / 180) / 60
        };
        const currentRotationSpeed = rotationSpeeds[activity] || rotationSpeeds['Medium'];

        const particleCount = Math.min(25000, uploads * 50 + 5000); 
        const spiralArms = 3;
        
        const timeframeTightness: Record<Timeframe, number> = { '7d': 0.9, '1m': 0.6, '1y': 0.35, 'all': 0.2 };
        const timeframeExpansion: Record<Timeframe, number> = { '7d': 0.4, '1m': 0.7, '1y': 1.1, 'all': 1.6 };
        
        const spiralTightness = timeframeTightness[timeframe];
        const expansionFactor = timeframeExpansion[timeframe];
        
        const jitterAmount = (10 - score) * 1.2;
        const basePointSize = score * 0.35;

        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);

        const colorCore = new THREE.Color(0xFFFFFF); 
        const colorArm = new THREE.Color(0x71717A);  

        for (let i = 0; i < particleCount; i++) {
            const armIndex = i % spiralArms;
            const distance = (Math.random() * (uploads / 1.2 + 150) + 20) * expansionFactor;
            const angle = distance * spiralTightness + (armIndex * (Math.PI * 2) / spiralArms);

            const xJitter = (Math.random() - 0.5) * jitterAmount * (distance / 40);
            const yJitter = (Math.random() - 0.5) * jitterAmount * (distance / 40);
            const zJitter = (Math.random() - 0.5) * jitterAmount * (distance / 80);

            positions[i * 3] = Math.cos(angle) * distance + xJitter;
            positions[i * 3 + 1] = zJitter;
            positions[i * 3 + 2] = Math.sin(angle) * distance + yJitter;

            const mixRatio = Math.min(1, distance / (250 * expansionFactor));
            const mixedColor = colorCore.clone().lerp(colorArm, mixRatio);
            
            const coreFactor = Math.max(0, 1 - mixRatio);
            colors[i * 3] = mixedColor.r + coreFactor * 0.2;
            colors[i * 3 + 1] = mixedColor.g + coreFactor * 0.1;
            colors[i * 3 + 2] = mixedColor.b + coreFactor * 0.1;

            sizes[i] = (Math.random() * basePointSize + 1.5) * (1.2 - mixRatio * 0.4);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.PointsMaterial({
            size: 2.2,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });

        const galaxyPoints = new THREE.Points(geometry, material);
        scene.add(galaxyPoints);

        const starCount = 18000;
        const starPositions = new Float32Array(starCount * 3);
        const starColors = new Float32Array(starCount * 3);
        const starOffsets = new Float32Array(starCount);

        const spectralTypes = [
            new THREE.Color(0xFFFFFF), 
            new THREE.Color(0xD4D4D8), 
            new THREE.Color(0xA1A1AA), 
            new THREE.Color(0xE4E4E7), 
            new THREE.Color(0x71717A)  
        ];

        for (let i = 0; i < starCount; i++) {
            const r = 1500 + Math.random() * 4500;
            const theta = 2 * Math.PI * Math.random();
            const phi = Math.acos(2 * Math.random() - 1);
            
            starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            starPositions[i * 3 + 2] = r * Math.cos(phi);

            const colorIdx = Math.floor(Math.pow(Math.random(), 2) * spectralTypes.length);
            const color = spectralTypes[colorIdx];
            starColors[i * 3] = color.r;
            starColors[i * 3 + 1] = color.g;
            starColors[i * 3 + 2] = color.b;
            starOffsets[i] = Math.random() * 100.0;
        }

        const starGeo = new THREE.BufferGeometry();
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
        starGeo.setAttribute('offset', new THREE.BufferAttribute(starOffsets, 1));

        const starShaderMaterial = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 } },
            vertexShader: `
                uniform float uTime;
                attribute float offset;
                attribute vec3 color;
                varying vec3 vColor;
                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    float sizeVariation = (sin(offset) * 0.5 + 1.2);
                    gl_PointSize = (2.2 * sizeVariation) * (600.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                void main() {
                    float dist = distance(gl_PointCoord, vec2(0.5));
                    if (dist > 0.5) discard;
                    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
                    alpha = pow(alpha, 1.8);
                    gl_FragColor = vec4(vColor, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const starField = new THREE.Points(starGeo, starShaderMaterial);
        scene.add(starField);

        const clock = new THREE.Clock();
        let animationId: number;
        const animate = () => {
            animationId = requestAnimationFrame(animate);
            const elapsedTime = clock.getElapsedTime();
            starShaderMaterial.uniforms.uTime.value = elapsedTime;
            galaxyPoints.rotation.y += currentRotationSpeed;
            starField.rotation.y += 0.00004;
            starField.rotation.z += 0.00002;
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        const handleResize = () => {
            if (!containerRef.current) return;
            const w = containerRef.current.clientWidth;
            const h = containerRef.current.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener('resize', handleResize);
            if (containerRef.current && renderer.domElement.parentNode) {
                containerRef.current.removeChild(renderer.domElement);
            }
            geometry.dispose();
            material.dispose();
            starGeo.dispose();
            starShaderMaterial.dispose();
            renderer.dispose();
        };
    }, [uploads, score, activity, timeframe]);

    if (webglError) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-black/40 backdrop-blur-md border border-zinc-800">
                <GlobeAltIcon className="w-10 h-10 text-zinc-700 mb-3" />
                <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider max-w-[240px] text-center">
                    Neural visualization restricted. Using telemetry feed.
                </p>
            </div>
        );
    }

    return <div ref={containerRef} className="w-full h-full bg-black" />;
};

interface MetricItemProps {
    label: string;
    code: string;
    value: string | number;
    colorClass?: string;
    tooltipTitle: string;
    tooltipBody: string;
    delay?: string;
}

const MetricItem: React.FC<MetricItemProps> = ({ label, code, value, colorClass = "text-white", tooltipTitle, tooltipBody, delay = "0ms" }) => (
    <div className="flex flex-col group relative pointer-events-auto cursor-help bg-[#0c0c0e]/85 backdrop-blur-md border border-zinc-800/90 hover:border-zinc-700 p-4 transition-all duration-200 min-w-[140px] md:min-w-[160px]" style={{ animationDelay: delay }}>
        <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider group-hover:text-zinc-400 transition-colors">{label}</span>
            <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">{code}</span>
        </div>
        <span className={`text-2xl md:text-3xl font-mono font-bold tabular-nums tracking-tight transition-all duration-300 ${colorClass}`}>{value}</span>
        
        {/* Tooltip */}
        <div className="absolute bottom-full left-0 mb-3 w-64 md:w-72 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none translate-y-2 group-hover:translate-y-0 z-50">
            <div className="bg-[#0c0c0e]/95 backdrop-blur-xl border border-zinc-700/80 p-4 shadow-2xl">
                <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b border-zinc-850">
                    <span className="w-1.5 h-1.5 bg-zinc-400"></span>
                    <p className="text-white font-mono font-bold text-[11px] uppercase tracking-wider">{tooltipTitle}</p>
                </div>
                <p className="text-zinc-400 text-xs leading-relaxed font-sans">
                    {tooltipBody}
                </p>
            </div>
        </div>
    </div>
);

const TimeframeDropdown: React.FC<{ current: Timeframe; onChange: (t: Timeframe) => void }> = ({ current, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const options: Timeframe[] = ['7d', '1m', '1y', 'all'];

    return (
        <div className="relative pointer-events-auto" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2.5 bg-[#0c0c0e]/90 hover:bg-zinc-900 backdrop-blur-md border border-zinc-750 hover:border-zinc-500 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-white transition-all duration-150 shadow-sm"
            >
                <ClockIcon className="w-3.5 h-3.5 text-zinc-400" />
                <span>{timeframeLabels[current]}</span>
                <ChevronDownIcon className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-[#0c0c0e] border border-zinc-750 shadow-2xl z-[60] animate-fadeIn">
                    <div className="p-1 space-y-0.5">
                        {options.map((opt) => (
                            <button
                                key={opt}
                                onClick={() => {
                                    onChange(opt);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-mono uppercase tracking-wider transition-all duration-150 ${
                                    current === opt 
                                        ? 'bg-zinc-800 text-white font-bold border border-zinc-700' 
                                        : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-white border border-transparent'
                                }`}
                            >
                                <span>{timeframeLabels[opt]}</span>
                                {current === opt && <CheckIcon className="w-3.5 h-3.5 text-zinc-300" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const MySpacePage = () => {
    const { currentUser } = useAuth();
    const { openModal } = useAIAssistant();
    const [userPosts, setUserPosts] = useState<Post[]>([]);
    const { setRightSidebarVariant } = ReactRouterDOM.useOutletContext<{
        setRightSidebarVariant: (variant: string) => void;
    }>();

    const [currentTimeframe, setCurrentTimeframe] = useState<Timeframe>('all');

    // Subscribe to current user's uploads from Firestore
    useEffect(() => {
        if (!currentUser?.uid) return;
        const unsubscribe = subscribeToUserPosts(
            currentUser.uid,
            (posts) => {
                setUserPosts(posts);
            },
            (err) => {
                console.warn('[MY_SPACE_USER_POSTS_WARN]', err);
            }
        );
        return () => unsubscribe();
    }, [currentUser?.uid]);

    // Calculate dynamic metrics with graceful fallback
    const currentMetrics = useMemo(() => {
        const base = METRICS_BY_TIMEFRAME[currentTimeframe];
        if (!currentUser || userPosts.length === 0) {
            return base;
        }

        const now = Date.now();
        const timeframeDurations: Record<Timeframe, number> = {
            '7d': 7 * 24 * 60 * 60 * 1000,
            '1m': 30 * 24 * 60 * 60 * 1000,
            '1y': 365 * 24 * 60 * 60 * 1000,
            'all': Infinity,
        };

        const maxAge = timeframeDurations[currentTimeframe];
        const filteredUserPosts = userPosts.filter(p => {
            const postTime = p.createdAt ? new Date(p.createdAt).getTime() : now;
            return now - postTime <= maxAge;
        });

        const totalUserUploads = filteredUserPosts.length;
        const totalLikes = filteredUserPosts.reduce((acc, p) => acc + (p.stats?.likes || 0), 0);
        const totalViews = filteredUserPosts.reduce((acc, p) => acc + (p.stats?.views || 0), 0);

        // Compute dynamic score between 7.5 and 9.9
        const computedScore = totalUserUploads > 0
            ? Math.min(9.9, Math.max(7.5, 8.0 + (totalLikes * 0.1) + (totalUserUploads * 0.2)))
            : base.score;

        let activityLevel = 'Low';
        if (totalUserUploads >= 5 || totalViews > 100) activityLevel = 'High';
        else if (totalUserUploads >= 2 || totalViews > 20) activityLevel = 'Medium';

        return {
            uploads: totalUserUploads > 0 ? totalUserUploads : base.uploads,
            score: Number(computedScore.toFixed(1)),
            activity: totalUserUploads > 0 ? activityLevel : base.activity
        };
    }, [currentTimeframe, currentUser, userPosts]);

    const handleDeepInsightClick = () => {
        openModal({
            id: 'myspace-insight',
            title: `My Space Analytics Insight (${timeframeLabels[currentTimeframe]})`,
            content: `User Intelligence Footprint Overview:
- Total Published Signals: ${currentMetrics.uploads}
- Network Clarity Score: ${currentMetrics.score}/10
- Dynamic Activity Flow: ${currentMetrics.activity}
- Active Timeframe Window: ${timeframeLabels[currentTimeframe]}

Ask anything to synthesize your signals, spot trends in your audience engagement, or generate your next high-impact broadcast idea!`,
            author: currentUser?.displayName || currentUser?.email || 'Invox Core'
        });
    };

    useEffect(() => {
        if (setRightSidebarVariant) {
            setRightSidebarVariant('myspace');
        }
        return () => {
            if (setRightSidebarVariant) {
                setRightSidebarVariant('default');
            }
        };
    }, [setRightSidebarVariant]);

    return (
        <div className="relative overflow-hidden flex flex-col -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 md:-mt-6 -mb-4 md:-mb-10 h-[calc(100vh-4rem)] md:h-screen transition-all duration-500 bg-black">
            {/* 3D Galaxy Canvas */}
            <div className="absolute inset-0 z-0 opacity-100">
                <DataGalaxy 
                    uploads={currentMetrics.uploads} 
                    score={currentMetrics.score} 
                    activity={currentMetrics.activity} 
                    timeframe={currentTimeframe}
                />
            </div>

            {/* Subtle Grid Background Lines */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:24px_24px] opacity-40"></div>

            <div className="relative z-10 p-4 md:p-8 pointer-events-none flex flex-col h-full flex-grow justify-between">
                {/* Header Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-850 pb-4 bg-black/40 backdrop-blur-sm px-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">// TELEMETRY_SPACE</span>
                            <span className="text-zinc-700">|</span>
                            <span className="font-mono text-[10px] text-zinc-600 uppercase">NODE: {currentUser?.uid ? currentUser.uid.slice(0, 8) : 'ANONYMOUS'}</span>
                        </div>
                        <h1 className="text-xl md:text-2xl font-mono font-bold text-white tracking-tight uppercase mt-0.5">
                            MY SPACE <span className="text-zinc-500 font-normal text-sm">// GALAXY_MAP</span>
                        </h1>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <TimeframeDropdown current={currentTimeframe} onChange={setCurrentTimeframe} />
                    </div>
                </div>

                {/* Bottom Metric Deck & Actions */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 px-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <MetricItem 
                            label="Total Uploads"
                            code="SIG_CNT"
                            value={currentMetrics.uploads}
                            tooltipTitle="Intelligence Footprint"
                            tooltipBody="Expands your intelligence footprint. Each upload extends the spiral outward, forming new data layers."
                            delay="100ms"
                        />
                        <MetricItem 
                            label="Analytics Score"
                            code="CLR_INDX"
                            value={currentMetrics.score}
                            tooltipTitle="Clarity & Coherence"
                            tooltipBody="Defines clarity and coherence. Higher scores produce brighter, cleaner, more stable spiral patterns."
                            delay="200ms"
                        />
                        <MetricItem 
                            label="Activity Level"
                            code="DYN_FLOW"
                            value={currentMetrics.activity}
                            colorClass={
                                currentMetrics.activity === 'High' ? "text-white" : 
                                currentMetrics.activity === 'Medium' ? "text-zinc-300" : 
                                "text-zinc-400"
                            }
                            tooltipTitle="Energy & Motion"
                            tooltipBody="Drives energy and motion. Active engagement increases spiral flow and rotational dynamics."
                            delay="300ms"
                        />
                    </div>
                    
                    <div className="pointer-events-auto flex items-center gap-2">
                        <button 
                            onClick={handleDeepInsightClick}
                            className="flex items-center justify-center gap-2.5 bg-zinc-900/85 hover:bg-zinc-800 backdrop-blur-md border border-zinc-700/80 hover:border-zinc-500 px-6 py-3 text-xs font-mono font-bold uppercase tracking-wider text-white transition-all duration-150 shadow-md group"
                        >
                            <SparklesIcon className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                            <span>// DEEP_INSIGHT</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MySpacePage;
