
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { SparklesIcon, ChevronDownIcon, ClockIcon, CheckIcon, GlobeAltIcon } from '../components/ui/Icons';

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

        const colorCore = new THREE.Color(0xFF2211); 
        const colorArm = new THREE.Color(0x0052FF);  

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
            colors[i * 3 + 1] = mixedColor.g + coreFactor * 0.05;
            colors[i * 3 + 2] = mixedColor.b + coreFactor * 0.05;

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
            new THREE.Color(0xCAD8FF), 
            new THREE.Color(0xFFF4EA), 
            new THREE.Color(0xFFF1D1), 
            new THREE.Color(0xFFD2A1), 
            new THREE.Color(0xFFCC6F)  
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
            <div className="w-full h-full flex flex-col items-center justify-center bg-black/40 backdrop-blur-md">
                <GlobeAltIcon className="w-12 h-12 text-gray-800 mb-4" />
                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest max-w-[200px] text-center">
                    Neural visualization unavailable. Using simplified data stream.
                </p>
            </div>
        );
    }

    return <div ref={containerRef} className="w-full h-full bg-black" />;
};

interface MetricItemProps {
    label: string;
    value: string | number;
    colorClass?: string;
    tooltipTitle: string;
    tooltipBody: string;
    accentColor: string;
    delay?: string;
}

const MetricItem: React.FC<MetricItemProps> = ({ label, value, colorClass = "text-white", tooltipTitle, tooltipBody, accentColor, delay = "0ms" }) => (
    <div className="flex flex-col group relative pointer-events-auto cursor-help animate-fadeInUp" style={{ animationDelay: delay }}>
        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 group-hover:text-gray-400 transition-colors">{label}</span>
        <span className={`text-3xl font-bold tabular-nums transition-all duration-500 ${colorClass}`}>{value}</span>
        
        <div className="absolute bottom-full left-0 mb-6 w-72 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none translate-y-4 group-hover:translate-y-0 z-50">
            <div className="bg-invox-dark-accent/90 backdrop-blur-2xl border border-white/10 p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-2 mb-2">
                    <div className={`w-1.5 h-4 rounded-full ${accentColor}`}></div>
                    <p className="text-white font-black text-[11px] uppercase tracking-widest">{tooltipTitle}</p>
                </div>
                <p className="text-gray-400 text-xs leading-relaxed font-medium">
                    {tooltipBody}
                </p>
                <div className="absolute top-full left-6 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-invox-dark-accent/90"></div>
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
                className="flex items-center gap-3 bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white transition-all duration-300"
            >
                <ClockIcon className="w-4 h-4 text-invox-red" />
                <span>{timeframeLabels[current]}</span>
                <ChevronDownIcon className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-3 w-56 bg-invox-dark-accent/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[60] animate-fadeInUp">
                    <div className="p-2 space-y-1">
                        {options.map((opt) => (
                            <button
                                key={opt}
                                onClick={() => {
                                    onChange(opt);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-200 ${
                                    current === opt ? 'bg-invox-red text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                            >
                                <span>{timeframeLabels[opt]}</span>
                                {current === opt && <CheckIcon className="w-4 h-4" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const MySpacePage = () => {
    const { setRightSidebarVariant } = ReactRouterDOM.useOutletContext<{
        setRightSidebarVariant: (variant: string) => void;
    }>();

    const [currentTimeframe, setCurrentTimeframe] = useState<Timeframe>('all');
    const currentMetrics = useMemo(() => METRICS_BY_TIMEFRAME[currentTimeframe], [currentTimeframe]);

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
            <div className="absolute inset-0 z-0 opacity-100">
                <DataGalaxy 
                    uploads={currentMetrics.uploads} 
                    score={currentMetrics.score} 
                    activity={currentMetrics.activity} 
                    timeframe={currentTimeframe}
                />
            </div>

            <div className="relative z-10 p-6 md:p-10 pointer-events-none flex flex-col h-full flex-grow justify-between">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl md:text-4xl font-black text-white leading-tight animate-fadeInUp tracking-tighter uppercase">
                            My<br />
                            <span className="text-invox-red">Space</span>
                        </h1>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Invox Intelligence System</p>
                    </div>
                    
                    <div className="animate-fadeInUp">
                        <TimeframeDropdown current={currentTimeframe} onChange={setCurrentTimeframe} />
                    </div>
                </div>

                <div className="flex items-center gap-12 mb-12">
                    <MetricItem 
                        label="Total Uploads"
                        value={currentMetrics.uploads}
                        accentColor="bg-invox-blue"
                        tooltipTitle="Intelligence Footprint"
                        tooltipBody="Expands your intelligence footprint. Each upload extends the spiral outward, forming new data layers."
                        delay="100ms"
                    />
                    <MetricItem 
                        label="Analytics Score"
                        value={currentMetrics.score}
                        accentColor="bg-invox-red"
                        tooltipTitle="Clarity & Coherence"
                        tooltipBody="Defines clarity and coherence. Higher scores produce brighter, cleaner, more stable spiral patterns."
                        delay="200ms"
                    />
                    <MetricItem 
                        label="Activity Level"
                        value={currentMetrics.activity}
                        colorClass={
                            currentMetrics.activity === 'High' ? "text-invox-red" : 
                            currentMetrics.activity === 'Medium' ? "text-yellow-500" : 
                            "text-green-500"
                        }
                        accentColor={
                            currentMetrics.activity === 'High' ? "bg-invox-red" : 
                            currentMetrics.activity === 'Medium' ? "bg-yellow-500" : 
                            "bg-green-500"
                        }
                        tooltipTitle="Energy & Motion"
                        tooltipBody="Drives energy and motion. Active engagement increases spiral flow and rotational dynamics."
                        delay="300ms"
                    />
                    
                    <div className="ml-auto pointer-events-auto hidden sm:block">
                        <button className="flex items-center gap-3 bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 px-8 py-4 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-300 group shadow-2xl">
                            <SparklesIcon className="w-5 h-5 text-invox-blue group-hover:scale-125 transition-transform" />
                            <span>Deep Insight</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MySpacePage;
