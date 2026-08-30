import * as THREE from 'three';

/**
 * Generates procedural high-resolution equirectangular Earth textures
 * for realistic 3D sphere rendering in the dark monospace INVOX aesthetic.
 */

// Precise continent boundary polygons in [lon, lat] degrees
const CONTINENT_POLYGONS: Array<Array<[number, number]>> = [
    // North America (Mainland + Alaska)
    [
        [-168, 66], [-160, 71], [-140, 70], [-130, 69], [-120, 69], [-100, 68], [-95, 72], [-80, 65],
        [-65, 60], [-60, 50], [-65, 44], [-70, 42], [-75, 38], [-80, 32], [-81, 25], [-85, 29],
        [-90, 30], [-97, 26], [-97, 20], [-90, 16], [-83, 9], [-77, 8], [-83, 10], [-92, 16],
        [-105, 22], [-115, 30], [-124, 38], [-125, 48], [-135, 57], [-150, 60], [-162, 55], [-168, 66]
    ],
    // Greenland
    [
        [-45, 60], [-35, 65], [-20, 70], [-18, 77], [-30, 83], [-55, 82], [-60, 76], [-50, 68], [-45, 60]
    ],
    // South America
    [
        [-77, 8], [-60, 10], [-50, 0], [-35, -5], [-35, -12], [-40, -22], [-50, -30], [-58, -38],
        [-65, -55], [-75, -50], [-72, -40], [-70, -20], [-80, -5], [-80, 2], [-77, 8]
    ],
    // Europe
    [
        [-9, 36], [-9, 43], [0, 44], [-4, 48], [2, 51], [8, 54], [12, 56], [10, 58], [5, 62],
        [15, 68], [25, 71], [35, 68], [40, 65], [50, 68], [60, 60], [50, 50], [40, 45],
        [30, 40], [25, 36], [15, 38], [10, 44], [0, 38], [-5, 36], [-9, 36]
    ],
    // Scandinavia
    [
        [5, 58], [10, 58], [12, 56], [18, 59], [25, 65], [28, 70], [20, 70], [12, 65], [5, 60], [5, 58]
    ],
    // British Isles (UK & Ireland)
    [
        [-5, 50], [-1, 51], [1, 52], [0, 54], [-2, 58], [-5, 58], [-4, 55], [-5, 50]
    ],
    [
        [-10, 51], [-6, 52], [-6, 55], [-10, 54], [-10, 51]
    ],
    // Africa
    [
        [-17, 15], [-17, 21], [-10, 28], [-5, 36], [10, 37], [25, 32], [32, 31], [35, 27],
        [43, 12], [51, 11], [42, 2], [40, -10], [35, -25], [28, -33], [18, -34], [12, -20],
        [10, -5], [5, 4], [0, 6], [-10, 5], [-17, 15]
    ],
    // Madagascar
    [
        [44, -12], [50, -14], [48, -25], [44, -25], [44, -12]
    ],
    // Eurasia / Asia
    [
        [30, 40], [40, 45], [50, 50], [60, 60], [70, 72], [90, 76], [110, 77], [130, 73],
        [150, 72], [170, 65], [180, 65], [170, 60], [160, 55], [145, 50], [140, 40], [130, 35],
        [122, 30], [118, 20], [108, 15], [105, 10], [100, 5], [98, 15], [90, 22], [80, 13],
        [75, 8], [72, 19], [68, 24], [60, 25], [50, 28], [40, 20], [35, 28], [35, 35], [30, 40]
    ],
    // Arabian Peninsula
    [
        [35, 28], [40, 20], [50, 15], [58, 24], [55, 27], [50, 30], [45, 30], [35, 28]
    ],
    // India Subcontinent
    [
        [68, 24], [72, 19], [75, 8], [80, 13], [85, 20], [90, 22], [88, 26], [75, 30], [68, 24]
    ],
    // Japan
    [
        [130, 32], [135, 34], [140, 36], [142, 40], [145, 44], [142, 45], [140, 42], [136, 36], [130, 32]
    ],
    // Southeast Asia Archipelago / Indonesia / Philippines / Malaysia
    [
        [95, 5], [105, 2], [110, -8], [115, -8], [120, -5], [115, 0], [105, 6], [95, 5]
    ],
    [
        [110, 2], [117, 4], [118, -4], [110, -2], [110, 2]
    ],
    [
        [120, 15], [125, 12], [126, 8], [122, 6], [120, 10], [120, 15]
    ],
    // Australia & Oceania
    [
        [113, -22], [120, -15], [130, -12], [142, -11], [148, -20], [153, -28], [150, -37],
        [140, -38], [135, -35], [125, -34], [115, -34], [113, -22]
    ],
    // New Zealand
    [
        [172, -35], [178, -38], [176, -41], [172, -35]
    ],
    [
        [166, -46], [172, -43], [174, -41], [170, -44], [166, -46]
    ],
    // Antarctica (Northern Coastline)
    [
        [-180, -72], [-140, -74], [-100, -72], [-60, -64], [-20, -70], [20, -68],
        [60, -66], [100, -65], [140, -66], [180, -72], [180, -90], [-180, -90], [-180, -72]
    ]
];

/**
 * Generate Equirectangular Earth Diffuse & Specular Textures
 */
export function generateEarthTextures(): {
    diffuseMap: THREE.CanvasTexture;
    specularMap: THREE.CanvasTexture;
    bumpMap: THREE.CanvasTexture;
} {
    const width = 2048;
    const height = 1024;

    const lonToX = (lon: number) => ((lon + 180) / 360) * width;
    const latToY = (lat: number) => ((90 - lat) / 180) * height;

    // 1. Diffuse Albedo Canvas
    const diffuseCanvas = document.createElement('canvas');
    diffuseCanvas.width = width;
    diffuseCanvas.height = height;
    const ctx = diffuseCanvas.getContext('2d')!;

    // Deep abyss ocean background
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
    oceanGrad.addColorStop(0, '#040508');
    oceanGrad.addColorStop(0.3, '#07090f');
    oceanGrad.addColorStop(0.7, '#07090f');
    oceanGrad.addColorStop(1, '#030406');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle bathymetry shallow water glow along equator and coastlines
    const shallowGrad = ctx.createRadialGradient(width * 0.5, height * 0.5, 100, width * 0.5, height * 0.5, width * 0.6);
    shallowGrad.addColorStop(0, 'rgba(12, 18, 28, 0.4)');
    shallowGrad.addColorStop(1, 'rgba(4, 6, 10, 0)');
    ctx.fillStyle = shallowGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle geographic latitude/longitude tech grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);

    // Parallels (every 30 deg)
    for (let lat = -60; lat <= 60; lat += 30) {
        const y = latToY(lat);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // Meridians (every 45 deg)
    for (let lon = -180; lon < 180; lon += 45) {
        const x = lonToX(lon);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw Landmasses (High precision dark charcoal graphite with crisp tech borders)
    ctx.fillStyle = '#14151b';
    ctx.strokeStyle = '#2d303f';
    ctx.lineWidth = 1.5;

    for (const poly of CONTINENT_POLYGONS) {
        ctx.beginPath();
        poly.forEach(([lon, lat], i) => {
            const x = lonToX(lon);
            const y = latToY(lat);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    // Secondary subtle topographic interior shading
    ctx.fillStyle = '#181a22';
    ctx.lineWidth = 0.5;
    for (const poly of CONTINENT_POLYGONS) {
        if (poly.length > 8) {
            ctx.beginPath();
            poly.forEach(([lon, lat], i) => {
                // Shrink inward slightly toward center
                const x = lonToX(lon * 0.96);
                const y = latToY(lat * 0.94);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.fillStyle = 'rgba(25, 28, 38, 0.6)';
            ctx.fill();
        }
    }

    // 2. Specular Map Canvas (Oceans reflect subtle light, landmasses are matte)
    const specCanvas = document.createElement('canvas');
    specCanvas.width = width;
    specCanvas.height = height;
    const specCtx = specCanvas.getContext('2d')!;

    // Oceans: high specular reflectivity
    specCtx.fillStyle = '#606470';
    specCtx.fillRect(0, 0, width, height);

    // Landmasses: black (matte / no specular glare)
    specCtx.fillStyle = '#000000';
    for (const poly of CONTINENT_POLYGONS) {
        specCtx.beginPath();
        poly.forEach(([lon, lat], i) => {
            const x = lonToX(lon);
            const y = latToY(lat);
            if (i === 0) specCtx.moveTo(x, y);
            else specCtx.lineTo(x, y);
        });
        specCtx.closePath();
        specCtx.fill();
    }

    // 3. Bump / Topography Map Canvas
    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = width;
    bumpCanvas.height = height;
    const bumpCtx = bumpCanvas.getContext('2d')!;

    bumpCtx.fillStyle = '#000000';
    bumpCtx.fillRect(0, 0, width, height);

    bumpCtx.fillStyle = '#555555';
    for (const poly of CONTINENT_POLYGONS) {
        bumpCtx.beginPath();
        poly.forEach(([lon, lat], i) => {
            const x = lonToX(lon);
            const y = latToY(lat);
            if (i === 0) bumpCtx.moveTo(x, y);
            else bumpCtx.lineTo(x, y);
        });
        bumpCtx.closePath();
        bumpCtx.fill();
    }

    const diffuseMap = new THREE.CanvasTexture(diffuseCanvas);
    diffuseMap.colorSpace = THREE.SRGBColorSpace;
    diffuseMap.wrapS = THREE.RepeatWrapping;
    diffuseMap.wrapT = THREE.ClampToEdgeWrapping;

    const specularMap = new THREE.CanvasTexture(specCanvas);
    specularMap.wrapS = THREE.RepeatWrapping;
    specularMap.wrapT = THREE.ClampToEdgeWrapping;

    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    bumpMap.wrapS = THREE.RepeatWrapping;
    bumpMap.wrapT = THREE.ClampToEdgeWrapping;

    return { diffuseMap, specularMap, bumpMap };
}
