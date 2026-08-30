import * as THREE from 'three';

/**
 * Ultra-Realistic Procedural Earth Texture Generator (3D Digital Spherical Model)
 * Produces organic, natural, borderless continents with rich topographic elevation,
 * oceanic bathymetric depth gradients, and high-contrast specular reflectance.
 */

// Precise geographic polygon contours for all continents, subcontinents, and major islands [longitude, latitude] in degrees
const DETAILED_LANDMASSES: Array<{ name: string; rings: Array<Array<[number, number]>>; mountains?: Array<Array<[number, number]>> }> = [
    // ─── INDIA & SOUTH ASIA ───
    {
        name: 'India & South Asia',
        rings: [
            [
                [68, 24], [69.5, 22.5], [72.8, 21.2], [72.8, 19], [73.5, 16], [74.8, 13.5],
                [76.2, 10.5], [77.5, 8.1], [78.2, 9.2], [79.8, 10.8], [80.3, 13.2], [82.3, 16.8],
                [84.5, 18.9], [87.5, 21.8], [89.5, 22.2], [91.8, 22.5], [92.5, 20.8], [93.5, 16.5],
                [94.5, 22.5], [96.5, 27.5], [94.5, 28.5], [89.5, 27.5], [88, 27.8], [85, 28.5],
                [80.5, 30.5], [78, 31.2], [74.5, 36.5], [73, 34], [70, 31], [67, 28.5],
                [62, 25.5], [66.5, 24.8], [68, 24]
            ]
        ],
        mountains: [
            // Himalayas & Tibetan Plateau range
            [
                [74, 35], [78, 32], [84, 29], [90, 28], [95, 29], [92, 33], [85, 35], [78, 36], [74, 35]
            ],
            // Western Ghats
            [
                [73.5, 19], [74.5, 15], [76.5, 10.5], [77, 12], [75, 16], [74, 19], [73.5, 19]
            ]
        ]
    },
    {
        name: 'Sri Lanka',
        rings: [
            [
                [79.8, 9.6], [80.6, 9.8], [81.8, 8.5], [81.8, 6.8], [80.5, 5.9], [79.7, 7.2], [79.8, 9.6]
            ]
        ]
    },

    // ─── EURASIA & EAST ASIA ───
    {
        name: 'Eurasia Main',
        rings: [
            [
                [35, 65], [42, 67], [52, 68], [65, 71], [75, 73], [88, 74], [105, 77.5], [120, 76],
                [140, 73], [160, 70], [170, 67], [180, 66], [172, 64], [162, 59], [156, 51],
                [143, 50], [141, 46], [135, 43], [130, 42], [125, 39], [121, 38], [119, 35],
                [122, 31], [121, 28], [118, 24], [114, 22.5], [108, 21.5], [107, 16], [109, 11],
                [105, 9.5], [103, 13], [100, 14], [99, 8], [98, 12], [98, 16], [94.5, 22.5],
                [92.5, 20.8], [91.8, 22.5], [89.5, 22.2], [87.5, 21.8], [84.5, 18.9], [82.3, 16.8],
                [80.3, 13.2], [79.8, 10.8], [78.2, 9.2], [77.5, 8.1], [76.2, 10.5], [74.8, 13.5],
                [73.5, 16], [72.8, 19], [72.8, 21.2], [69.5, 22.5], [68, 24], [66.5, 24.8],
                [62, 25.5], [57, 25.5], [51, 29.5], [48, 31], [40, 31], [36, 35], [35, 41],
                [38, 44], [44, 47], [50, 47], [55, 54], [58, 62], [50, 68], [40, 66], [35, 65]
            ]
        ],
        mountains: [
            // Urals
            [
                [59, 66], [61, 58], [60, 52], [57, 52], [58, 59], [57, 66], [59, 66]
            ],
            // Alps & Caucasus
            [
                [6, 46], [11, 47], [16, 47], [42, 43], [48, 41], [44, 42], [14, 45], [7, 45], [6, 46]
            ]
        ]
    },
    {
        name: 'Arabian Peninsula',
        rings: [
            [
                [35, 29], [39, 23], [43, 16.5], [45, 13], [51, 14.5], [55, 18], [59.5, 22.5],
                [57, 25.5], [54, 24.5], [50.5, 27], [48, 30], [42, 31], [35, 29]
            ]
        ]
    },
    {
        name: 'Korean Peninsula',
        rings: [
            [
                [124.5, 38], [128.5, 38.5], [129.5, 36], [128.5, 34.5], [126, 34.5], [125, 37], [124.5, 38]
            ]
        ]
    },
    {
        name: 'Japan Main (Honshu, Hokkaido, Kyushu, Shikoku)',
        rings: [
            [
                [130.5, 31.5], [131.5, 33.5], [133.5, 35.5], [137, 36.5], [140.5, 37], [141.5, 40.5],
                [140, 41.5], [138.5, 37.5], [136, 35.5], [133, 34], [130, 32.5], [130.5, 31.5]
            ],
            [
                [140.5, 42], [144.5, 43], [145.5, 44.5], [142, 45.5], [141, 43.5], [140.5, 42]
            ]
        ]
    },
    {
        name: 'Taiwan',
        rings: [
            [
                [120, 22], [121.5, 23.5], [122, 25.3], [121, 25.2], [120, 23.5], [120, 22]
            ]
        ]
    },

    // ─── SOUTHEAST ASIA & INDONESIA ───
    {
        name: 'Malay Peninsula & Sumatra',
        rings: [
            [
                [100, 7], [102, 5], [104, 2], [103.5, 1.2], [101.5, 3], [100, 5.5], [100, 7]
            ],
            [
                [95.5, 5.5], [99, 2.5], [103, -0.5], [106, -5], [104, -5.5], [100, -2.5], [97, 1], [95.5, 5.5]
            ]
        ]
    },
    {
        name: 'Java',
        rings: [
            [
                [105.5, -6], [110, -7], [114.5, -8], [112.5, -8.5], [107, -7.5], [105.5, -6]
            ]
        ]
    },
    {
        name: 'Borneo',
        rings: [
            [
                [109.5, 1.5], [114, 5.5], [118, 5], [119, 2], [117.5, -2], [114, -3.8], [110.5, -1.8], [109.5, 1.5]
            ]
        ]
    },
    {
        name: 'Sulawesi & Philippines',
        rings: [
            [
                [120, 1.5], [123, 1], [125, -2], [122, -5.5], [119.5, -3], [120, 1.5]
            ],
            [
                [120, 18.5], [122, 17], [124, 13], [126, 8], [123.5, 6.5], [121, 12], [119.5, 16], [120, 18.5]
            ]
        ]
    },
    {
        name: 'New Guinea',
        rings: [
            [
                [131, -0.8], [137, -2.5], [144, -4.5], [150, -9.5], [147, -10.5], [141, -7.5], [134, -4.5], [131, -0.8]
            ]
        ]
    },

    // ─── AFRICA ───
    {
        name: 'Africa Main',
        rings: [
            [
                [-17, 15], [-17, 21], [-13, 26], [-8, 32], [-5.5, 36], [0, 36], [10, 37],
                [11, 33], [15, 32], [22, 32], [28, 31], [33, 31], [35, 27], [39, 22],
                [43, 13], [51, 11], [46, 5], [41, 0], [40, -10], [36, -18], [33, -27],
                [28, -33], [19, -34.8], [18, -32], [14, -23], [12, -15], [9, -5], [5, 4.5],
                [2, 6], [-5, 5], [-10, 5], [-15, 11], [-17, 15]
            ]
        ],
        mountains: [
            // Atlas Mountains & East African Rift Highlands
            [
                [-7, 32], [-2, 34], [4, 36], [8, 36], [5, 33], [-3, 31], [-7, 32]
            ],
            [
                [35, 8], [38, 2], [36, -6], [34, -14], [31, -8], [33, 1], [35, 8]
            ]
        ]
    },
    {
        name: 'Madagascar',
        rings: [
            [
                [44, -12], [49, -14], [50, -18], [47, -25.5], [44, -25], [44, -18], [44, -12]
            ]
        ]
    },

    // ─── EUROPE ───
    {
        name: 'Europe Main',
        rings: [
            [
                [-9, 36.5], [-9, 43], [-1.5, 43.5], [-4.5, 48.5], [-1.5, 49.5], [2, 51], [6, 53.5],
                [8.5, 55], [10, 54], [14, 54], [18, 54.5], [20, 55], [24, 57], [28, 59.5],
                [30, 60], [35, 65], [40, 65], [50, 68], [60, 65], [58, 55], [50, 48],
                [43, 47], [38, 44], [35, 46], [30, 46], [28, 42], [23, 40], [22, 38],
                [24, 35], [22, 36.5], [18, 40.5], [15, 38], [12, 42], [14, 45], [9, 43],
                [3, 43], [0, 39], [-5, 36], [-9, 36.5]
            ]
        ]
    },
    {
        name: 'Scandinavia',
        rings: [
            [
                [5, 58.5], [8, 58], [11, 58], [14, 55.5], [18, 59], [22, 63], [25, 65.5],
                [30, 70.5], [25, 71], [18, 69], [12, 67], [8, 63], [5, 61], [5, 58.5]
            ]
        ]
    },
    {
        name: 'Great Britain & Ireland',
        rings: [
            [
                [-5, 50], [-3, 50.5], [1.5, 51.5], [1.5, 52.8], [0, 54.5], [-1.5, 56], [-2, 58.5],
                [-4.5, 58.5], [-5, 56.5], [-4, 53], [-5, 51.5], [-5, 50]
            ],
            [
                [-10, 51.5], [-8, 51.5], [-6, 53], [-6, 54.5], [-7.5, 55.2], [-10, 54.5], [-10.5, 52.5], [-10, 51.5]
            ]
        ]
    },
    {
        name: 'Iceland',
        rings: [
            [
                [-24, 64], [-18, 64.5], [-14, 65.2], [-16, 66.5], [-23, 66], [-24, 64]
            ]
        ]
    },

    // ─── NORTH AMERICA ───
    {
        name: 'North America Main',
        rings: [
            [
                [-168, 65.5], [-166, 68], [-160, 71], [-154, 71], [-140, 69.5], [-130, 69], [-120, 68.5],
                [-115, 68], [-105, 67.5], [-95, 71], [-90, 67], [-85, 66], [-82, 62], [-86, 56],
                [-80, 52], [-76, 55], [-70, 50], [-65, 48], [-60, 46], [-64, 44], [-70, 42],
                [-74, 40], [-76, 35], [-80, 31], [-80.5, 25.5], [-82, 28], [-85, 30], [-90, 30],
                [-94, 29], [-97, 26], [-97, 21], [-93, 18], [-90, 16], [-83, 9], [-77, 8],
                [-82, 8.5], [-84, 10], [-87, 13], [-92, 16], [-96, 16], [-105, 21], [-110, 24],
                [-115, 29], [-117, 32.5], [-122, 37], [-124, 44], [-125, 49], [-130, 54], [-136, 58],
                [-145, 60], [-153, 59], [-160, 56], [-164, 54], [-166, 60], [-168, 65.5]
            ]
        ],
        mountains: [
            // Rocky Mountains & Sierra
            [
                [-122, 55], [-116, 50], [-112, 42], [-106, 34], [-102, 28], [-106, 26], [-112, 34], [-118, 44], [-124, 52], [-122, 55]
            ],
            // Appalachians
            [
                [-84, 34], [-80, 38], [-74, 42], [-71, 45], [-73, 44], [-78, 39], [-82, 35], [-84, 34]
            ]
        ]
    },
    {
        name: 'Greenland',
        rings: [
            [
                [-44, 60], [-35, 65], [-25, 70], [-18, 76], [-22, 82], [-35, 83.5], [-50, 83],
                [-60, 81], [-68, 77], [-60, 74], [-52, 70], [-50, 64], [-44, 60]
            ]
        ]
    },
    {
        name: 'Caribbean (Cuba, Hispaniola)',
        rings: [
            [
                [-84.5, 22], [-80, 23], [-74.5, 20], [-77, 19.5], [-82, 21.5], [-84.5, 22]
            ]
        ]
    },

    // ─── SOUTH AMERICA ───
    {
        name: 'South America Main',
        rings: [
            [
                [-77, 8], [-74, 11], [-67, 11.5], [-61, 10], [-52, 4], [-47, 0], [-35, -5],
                [-35, -9], [-37, -13], [-39, -18], [-44, -23], [-48, -28], [-53, -33], [-58, -38],
                [-64, -41], [-66, -46], [-66, -53], [-70, -54.5], [-74, -52], [-74, -45], [-72, -38],
                [-71, -30], [-70, -22], [-76, -14], [-81, -5], [-80, 0], [-78, 4], [-77, 8]
            ]
        ],
        mountains: [
            // Andes Mountain Range
            [
                [-76, 6], [-73, -2], [-75, -12], [-70, -20], [-68, -32], [-71, -44], [-73, -50],
                [-71, -50], [-66, -42], [-66, -30], [-68, -18], [-72, -10], [-71, 0], [-74, 6], [-76, 6]
            ]
        ]
    },

    // ─── AUSTRALIA & OCEANIA ───
    {
        name: 'Australia Main & Tasmania',
        rings: [
            [
                [113, -22], [118, -15], [128, -14], [135, -12], [142, -11], [144, -15],
                [150, -22], [153, -28], [150, -37], [144, -38], [137, -35], [130, -32],
                [122, -34], [115, -34], [113, -28], [113, -22]
            ],
            [
                [145, -41], [148, -41.5], [147.5, -43.5], [145, -43], [145, -41]
            ]
        ],
        mountains: [
            // Great Dividing Range
            [
                [145, -16], [149, -23], [151, -31], [148, -37], [146, -36], [148, -30], [146, -22], [144, -17], [145, -16]
            ]
        ]
    },
    {
        name: 'New Zealand',
        rings: [
            [
                [173, -35], [178, -37], [177, -40], [175, -41.5], [174, -38], [173, -35]
            ],
            [
                [168, -44], [174, -41], [173, -45], [168, -46.5], [166, -45], [168, -44]
            ]
        ]
    },

    // ─── ANTARCTICA ───
    {
        name: 'Antarctica Coast',
        rings: [
            [
                [-180, -70], [-150, -75], [-120, -73], [-90, -72], [-65, -65], [-55, -63],
                [-30, -72], [0, -68], [40, -66], [80, -65], [110, -66], [140, -66],
                [170, -70], [180, -72], [180, -90], [-180, -90], [-180, -70]
            ]
        ]
    }
];

/**
 * Generate Equirectangular Earth Diffuse, Specular, and Bump Textures
 * Creates natural, organic, borderless 3D continent topography with deep luxury oceans
 */
export function generateEarthTextures(): {
    diffuseMap: THREE.CanvasTexture;
    specularMap: THREE.CanvasTexture;
    bumpMap: THREE.CanvasTexture;
} {
    const width = 4096;
    const height = 2048;

    const lonToX = (lon: number) => ((lon + 180) / 360) * width;
    const latToY = (lat: number) => ((90 - lat) / 180) * height;

    // ─────────────────────────────────────────────────────────────
    // 1. DIFFUSE ALBEDO MAP (Seamless 3D Topography without 2D lines)
    // ─────────────────────────────────────────────────────────────
    const diffuseCanvas = document.createElement('canvas');
    diffuseCanvas.width = width;
    diffuseCanvas.height = height;
    const ctx = diffuseCanvas.getContext('2d', { alpha: false })!;

    // 1a. Base Deep Ocean: Rich dark obsidian abyss (#05070a to #0c0f16)
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
    oceanGrad.addColorStop(0, '#040608');
    oceanGrad.addColorStop(0.2, '#080b10');
    oceanGrad.addColorStop(0.5, '#0b0e15');
    oceanGrad.addColorStop(0.8, '#080b10');
    oceanGrad.addColorStop(1, '#040608');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, width, height);

    // 1b. Subtle Faint Coordinates Grid (Extremely thin & elegant, barely perceptible)
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.setLineDash([4, 12]);

    for (let lat = -75; lat <= 75; lat += 15) {
        const y = latToY(lat);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    for (let lon = -180; lon < 180; lon += 30) {
        const x = lonToX(lon);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    ctx.setLineDash([]);

    // 1c. Coastal Bathymetry Shallow Shelf Layer (Soft glow into water depth)
    ctx.fillStyle = '#141822';
    for (const land of DETAILED_LANDMASSES) {
        for (const ring of land.rings) {
            ctx.beginPath();
            ring.forEach(([lon, lat], i) => {
                const x = lonToX(lon);
                const y = latToY(lat);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.lineWidth = 14;
            ctx.strokeStyle = '#11151f';
            ctx.stroke();
        }
    }

    // 1d. Primary Continent Base Landmass (Rich Slate-Charcoal #2c3240)
    ctx.fillStyle = '#2d3342';
    for (const land of DETAILED_LANDMASSES) {
        for (const ring of land.rings) {
            ctx.beginPath();
            ring.forEach(([lon, lat], i) => {
                const x = lonToX(lon);
                const y = latToY(lat);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.fill();
        }
    }

    // 1e. Secondary Interior Plateau Terrain Layer (#384052)
    ctx.fillStyle = '#3a4254';
    for (const land of DETAILED_LANDMASSES) {
        for (const ring of land.rings) {
            ctx.beginPath();
            ring.forEach(([lon, lat], i) => {
                const x = lonToX(lon);
                const y = latToY(lat);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.lineWidth = 5;
            ctx.strokeStyle = '#323947';
            ctx.fill();
        }
    }

    // 1f. Mountain Ranges & High Elevation Ridges (Natural 3D terrain highlights #4b566d)
    ctx.fillStyle = '#4c576e';
    for (const land of DETAILED_LANDMASSES) {
        if (land.mountains) {
            for (const mtn of land.mountains) {
                ctx.beginPath();
                mtn.forEach(([lon, lat], i) => {
                    const x = lonToX(lon);
                    const y = latToY(lat);
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                });
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    // 1g. Micro-Dot Digital Matrix (Very subtle, integrated smoothly without harsh lines)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    const gridSpacing = 28;
    for (let y = gridSpacing / 2; y < height; y += gridSpacing) {
        for (let x = gridSpacing / 2; x < width; x += gridSpacing) {
            ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. SPECULAR MAP (High-gloss oceans, matte continents for tangible 3D light reflections)
    // ─────────────────────────────────────────────────────────────
    const specCanvas = document.createElement('canvas');
    specCanvas.width = width;
    specCanvas.height = height;
    const specCtx = specCanvas.getContext('2d', { alpha: false })!;

    // Oceans have distinct specular gloss
    specCtx.fillStyle = '#65738a';
    specCtx.fillRect(0, 0, width, height);

    // Continents are matte
    specCtx.fillStyle = '#080a0e';
    for (const land of DETAILED_LANDMASSES) {
        for (const ring of land.rings) {
            specCtx.beginPath();
            ring.forEach(([lon, lat], i) => {
                const x = lonToX(lon);
                const y = latToY(lat);
                if (i === 0) specCtx.moveTo(x, y);
                else specCtx.lineTo(x, y);
            });
            specCtx.closePath();
            specCtx.fill();
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. BUMP / ELEVATION MAP (Physical 3D elevation without 2D borders)
    // ─────────────────────────────────────────────────────────────
    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = width;
    bumpCanvas.height = height;
    const bumpCtx = bumpCanvas.getContext('2d', { alpha: false })!;

    bumpCtx.fillStyle = '#000000';
    bumpCtx.fillRect(0, 0, width, height);

    // Landmass elevation
    bumpCtx.fillStyle = '#606060';
    for (const land of DETAILED_LANDMASSES) {
        for (const ring of land.rings) {
            bumpCtx.beginPath();
            ring.forEach(([lon, lat], i) => {
                const x = lonToX(lon);
                const y = latToY(lat);
                if (i === 0) bumpCtx.moveTo(x, y);
                else bumpCtx.lineTo(x, y);
            });
            bumpCtx.closePath();
            bumpCtx.fill();
        }
    }

    // Mountains raised elevation in bump map
    bumpCtx.fillStyle = '#a8a8a8';
    for (const land of DETAILED_LANDMASSES) {
        if (land.mountains) {
            for (const mtn of land.mountains) {
                bumpCtx.beginPath();
                mtn.forEach(([lon, lat], i) => {
                    const x = lonToX(lon);
                    const y = latToY(lat);
                    if (i === 0) bumpCtx.moveTo(x, y);
                    else bumpCtx.lineTo(x, y);
                });
                bumpCtx.closePath();
                bumpCtx.fill();
            }
        }
    }

    const diffuseMap = new THREE.CanvasTexture(diffuseCanvas);
    diffuseMap.colorSpace = THREE.SRGBColorSpace;
    diffuseMap.wrapS = THREE.RepeatWrapping;
    diffuseMap.wrapT = THREE.ClampToEdgeWrapping;
    diffuseMap.minFilter = THREE.LinearMipMapLinearFilter;
    diffuseMap.magFilter = THREE.LinearFilter;
    diffuseMap.generateMipmaps = true;

    const specularMap = new THREE.CanvasTexture(specCanvas);
    specularMap.wrapS = THREE.RepeatWrapping;
    specularMap.wrapT = THREE.ClampToEdgeWrapping;
    specularMap.minFilter = THREE.LinearMipMapLinearFilter;
    specularMap.magFilter = THREE.LinearFilter;

    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    bumpMap.wrapS = THREE.RepeatWrapping;
    bumpMap.wrapT = THREE.ClampToEdgeWrapping;
    bumpMap.minFilter = THREE.LinearMipMapLinearFilter;
    bumpMap.magFilter = THREE.LinearFilter;

    return { diffuseMap, specularMap, bumpMap };
}
