/**
 * Geographic coordinate resolver, location parser, and global network seed data
 * for INVOX Global Collective Network 3D Globe visualization.
 */

export interface GeoLocation {
    lat: number;
    lon: number;
    city?: string;
    country: string;
    regionName: string;
    isApproximate: boolean;
}

// Major global developer & tech hubs with precise coordinates
const CITY_COORDINATES: Record<string, { lat: number; lon: number; country: string; city: string }> = {
    // North America
    'san francisco': { lat: 37.7749, lon: -122.4194, country: 'United States', city: 'San Francisco' },
    'silicon valley': { lat: 37.3861, lon: -122.0839, country: 'United States', city: 'Silicon Valley' },
    'san jose': { lat: 37.3382, lon: -121.8863, country: 'United States', city: 'San Jose' },
    'los angeles': { lat: 34.0522, lon: -118.2437, country: 'United States', city: 'Los Angeles' },
    'seattle': { lat: 47.6062, lon: -122.3321, country: 'United States', city: 'Seattle' },
    'new york': { lat: 40.7128, lon: -74.0060, country: 'United States', city: 'New York' },
    'nyc': { lat: 40.7128, lon: -74.0060, country: 'United States', city: 'New York' },
    'boston': { lat: 42.3601, lon: -71.0589, country: 'United States', city: 'Boston' },
    'austin': { lat: 30.2672, lon: -97.7431, country: 'United States', city: 'Austin' },
    'chicago': { lat: 41.8781, lon: -87.6298, country: 'United States', city: 'Chicago' },
    'denver': { lat: 39.7392, lon: -104.9903, country: 'United States', city: 'Denver' },
    'miami': { lat: 25.7617, lon: -80.1918, country: 'United States', city: 'Miami' },
    'toronto': { lat: 43.6532, lon: -79.3832, country: 'Canada', city: 'Toronto' },
    'vancouver': { lat: 49.2827, lon: -123.1207, country: 'Canada', city: 'Vancouver' },
    'montreal': { lat: 45.5017, lon: -73.5673, country: 'Canada', city: 'Montreal' },
    'mexico city': { lat: 19.4326, lon: -99.1332, country: 'Mexico', city: 'Mexico City' },

    // Europe
    'london': { lat: 51.5074, lon: -0.1278, country: 'United Kingdom', city: 'London' },
    'cambridge': { lat: 52.2053, lon: 0.1218, country: 'United Kingdom', city: 'Cambridge' },
    'oxford': { lat: 51.7520, lon: -1.2577, country: 'United Kingdom', city: 'Oxford' },
    'edinburgh': { lat: 55.9533, lon: -3.1883, country: 'United Kingdom', city: 'Edinburgh' },
    'berlin': { lat: 52.5200, lon: 13.4050, country: 'Germany', city: 'Berlin' },
    'munich': { lat: 48.1351, lon: 11.5820, country: 'Germany', city: 'Munich' },
    'frankfurt': { lat: 50.1109, lon: 8.6821, country: 'Germany', city: 'Frankfurt' },
    'paris': { lat: 48.8566, lon: 2.3522, country: 'France', city: 'Paris' },
    'amsterdam': { lat: 52.3676, lon: 4.9041, country: 'Netherlands', city: 'Amsterdam' },
    'dublin': { lat: 53.3498, lon: -6.2603, country: 'Ireland', city: 'Dublin' },
    'zurich': { lat: 47.3769, lon: 8.5417, country: 'Switzerland', city: 'Zurich' },
    'geneva': { lat: 46.2044, lon: 6.1432, country: 'Switzerland', city: 'Geneva' },
    'stockholm': { lat: 59.3293, lon: 18.0686, country: 'Sweden', city: 'Stockholm' },
    'helsinki': { lat: 60.1699, lon: 24.9384, country: 'Finland', city: 'Helsinki' },
    'oslo': { lat: 59.9139, lon: 10.7522, country: 'Norway', city: 'Oslo' },
    'copenhagen': { lat: 55.6761, lon: 12.5683, country: 'Denmark', city: 'Copenhagen' },
    'madrid': { lat: 40.4168, lon: -3.7038, country: 'Spain', city: 'Madrid' },
    'barcelona': { lat: 41.3851, lon: 2.1734, country: 'Spain', city: 'Barcelona' },
    'milan': { lat: 45.4642, lon: 9.1900, country: 'Italy', city: 'Milan' },
    'rome': { lat: 41.9028, lon: 12.4964, country: 'Italy', city: 'Rome' },
    'warsaw': { lat: 52.2297, lon: 21.0122, country: 'Poland', city: 'Warsaw' },
    'krakow': { lat: 50.0647, lon: 19.9450, country: 'Poland', city: 'Krakow' },
    'vienna': { lat: 48.2082, lon: 16.3738, country: 'Austria', city: 'Vienna' },
    'lisbon': { lat: 38.7223, lon: -9.1393, country: 'Portugal', city: 'Lisbon' },
    'prague': { lat: 50.0755, lon: 14.4378, country: 'Czech Republic', city: 'Prague' },
    'brussels': { lat: 50.8503, lon: 4.3517, country: 'Belgium', city: 'Brussels' },
    'tallinn': { lat: 59.4370, lon: 24.7536, country: 'Estonia', city: 'Tallinn' },
    'bucharest': { lat: 44.4268, lon: 26.1025, country: 'Romania', city: 'Bucharest' },

    // Asia & Pacific
    'tokyo': { lat: 35.6762, lon: 139.6503, country: 'Japan', city: 'Tokyo' },
    'kyoto': { lat: 35.0116, lon: 135.7681, country: 'Japan', city: 'Kyoto' },
    'osaka': { lat: 34.6937, lon: 135.5023, country: 'Japan', city: 'Osaka' },
    'seoul': { lat: 37.5665, lon: 126.9780, country: 'South Korea', city: 'Seoul' },
    'bengaluru': { lat: 12.9716, lon: 77.5946, country: 'India', city: 'Bengaluru' },
    'bangalore': { lat: 12.9716, lon: 77.5946, country: 'India', city: 'Bengaluru' },
    'hyderabad': { lat: 17.3850, lon: 78.4867, country: 'India', city: 'Hyderabad' },
    'mumbai': { lat: 19.0760, lon: 72.8777, country: 'India', city: 'Mumbai' },
    'delhi': { lat: 28.6139, lon: 77.2090, country: 'India', city: 'New Delhi' },
    'new delhi': { lat: 28.6139, lon: 77.2090, country: 'India', city: 'New Delhi' },
    'pune': { lat: 18.5204, lon: 73.8567, country: 'India', city: 'Pune' },
    'chennai': { lat: 13.0827, lon: 80.2707, country: 'India', city: 'Chennai' },
    'gurgaon': { lat: 28.4595, lon: 77.0266, country: 'India', city: 'Gurgaon' },
    'noida': { lat: 28.5355, lon: 77.3910, country: 'India', city: 'Noida' },
    'singapore': { lat: 1.3521, lon: 103.8198, country: 'Singapore', city: 'Singapore' },
    'taipei': { lat: 25.0330, lon: 121.5654, country: 'Taiwan', city: 'Taipei' },
    'beijing': { lat: 39.9042, lon: 116.4074, country: 'China', city: 'Beijing' },
    'shanghai': { lat: 31.2304, lon: 121.4737, country: 'China', city: 'Shanghai' },
    'shenzhen': { lat: 22.5431, lon: 114.0579, country: 'China', city: 'Shenzhen' },
    'hong kong': { lat: 22.3193, lon: 114.1694, country: 'Hong Kong', city: 'Hong Kong' },
    'jakarta': { lat: -6.2088, lon: 106.8456, country: 'Indonesia', city: 'Jakarta' },
    'bangkok': { lat: 13.7563, lon: 100.5018, country: 'Thailand', city: 'Bangkok' },
    'kuala lumpur': { lat: 3.1390, lon: 101.6869, country: 'Malaysia', city: 'Kuala Lumpur' },
    'ho chi minh': { lat: 10.8231, lon: 106.6297, country: 'Vietnam', city: 'Ho Chi Minh City' },
    'manila': { lat: 14.5995, lon: 120.9842, country: 'Philippines', city: 'Manila' },
    'sydney': { lat: -33.8688, lon: 151.2093, country: 'Australia', city: 'Sydney' },
    'melbourne': { lat: -37.8136, lon: 144.9631, country: 'Australia', city: 'Melbourne' },
    'brisbane': { lat: -27.4698, lon: 153.0251, country: 'Australia', city: 'Brisbane' },
    'auckland': { lat: -36.8485, lon: 174.7633, country: 'New Zealand', city: 'Auckland' },
    'wellington': { lat: -41.2865, lon: 174.7762, country: 'New Zealand', city: 'Wellington' },

    // Middle East & Africa
    'dubai': { lat: 25.2048, lon: 55.2708, country: 'United Arab Emirates', city: 'Dubai' },
    'abu dhabi': { lat: 24.4539, lon: 54.3773, country: 'United Arab Emirates', city: 'Abu Dhabi' },
    'tel aviv': { lat: 32.0853, lon: 34.7818, country: 'Israel', city: 'Tel Aviv' },
    'riyadh': { lat: 24.7136, lon: 46.6753, country: 'Saudi Arabia', city: 'Riyadh' },
    'doha': { lat: 25.2854, lon: 51.5310, country: 'Qatar', city: 'Doha' },
    'cairo': { lat: 30.0444, lon: 31.2357, country: 'Egypt', city: 'Cairo' },
    'lagos': { lat: 6.5244, lon: 3.3792, country: 'Nigeria', city: 'Lagos' },
    'nairobi': { lat: -1.2921, lon: 36.8219, country: 'Kenya', city: 'Nairobi' },
    'cape town': { lat: -33.9249, lon: 18.4241, country: 'South Africa', city: 'Cape Town' },
    'johannesburg': { lat: -26.2041, lon: 28.0473, country: 'South Africa', city: 'Johannesburg' },
    'accra': { lat: 5.6037, lon: -0.1870, country: 'Ghana', city: 'Accra' },
    'kigali': { lat: -1.9706, lon: 30.1044, country: 'Rwanda', city: 'Kigali' },

    // South America
    'sao paulo': { lat: -23.5505, lon: -46.6333, country: 'Brazil', city: 'São Paulo' },
    'rio de janeiro': { lat: -22.9068, lon: -43.1729, country: 'Brazil', city: 'Rio de Janeiro' },
    'buenos aires': { lat: -34.6037, lon: -58.3816, country: 'Argentina', city: 'Buenos Aires' },
    'santiago': { lat: -33.4489, lon: -70.6693, country: 'Chile', city: 'Santiago' },
    'bogota': { lat: 4.7110, lon: -74.0721, country: 'Colombia', city: 'Bogota' },
    'lima': { lat: -12.0464, lon: -77.0428, country: 'Peru', city: 'Lima' },
};

// Country centroid coordinates & aliases
const COUNTRY_COORDINATES: Record<string, { lat: number; lon: number; name: string }> = {
    'united states': { lat: 39.8283, lon: -98.5795, name: 'United States' },
    'usa': { lat: 39.8283, lon: -98.5795, name: 'United States' },
    'us': { lat: 39.8283, lon: -98.5795, name: 'United States' },
    'united kingdom': { lat: 54.5593, lon: -2.3219, name: 'United Kingdom' },
    'uk': { lat: 54.5593, lon: -2.3219, name: 'United Kingdom' },
    'great britain': { lat: 54.5593, lon: -2.3219, name: 'United Kingdom' },
    'england': { lat: 52.3555, lon: -1.1743, name: 'United Kingdom' },
    'germany': { lat: 51.1657, lon: 10.4515, name: 'Germany' },
    'de': { lat: 51.1657, lon: 10.4515, name: 'Germany' },
    'india': { lat: 20.5937, lon: 78.9629, name: 'India' },
    'in': { lat: 20.5937, lon: 78.9629, name: 'India' },
    'japan': { lat: 36.2048, lon: 138.2529, name: 'Japan' },
    'jp': { lat: 36.2048, lon: 138.2529, name: 'Japan' },
    'canada': { lat: 56.1304, lon: -106.3468, name: 'Canada' },
    'ca': { lat: 56.1304, lon: -106.3468, name: 'Canada' },
    'australia': { lat: -25.2744, lon: 133.7751, name: 'Australia' },
    'au': { lat: -25.2744, lon: 133.7751, name: 'Australia' },
    'france': { lat: 46.2276, lon: 2.2137, name: 'France' },
    'fr': { lat: 46.2276, lon: 2.2137, name: 'France' },
    'netherlands': { lat: 52.1326, lon: 5.2913, name: 'Netherlands' },
    'nl': { lat: 52.1326, lon: 5.2913, name: 'Netherlands' },
    'holland': { lat: 52.1326, lon: 5.2913, name: 'Netherlands' },
    'brazil': { lat: -14.2350, lon: -51.9253, name: 'Brazil' },
    'br': { lat: -14.2350, lon: -51.9253, name: 'Brazil' },
    'singapore': { lat: 1.3521, lon: 103.8198, name: 'Singapore' },
    'sg': { lat: 1.3521, lon: 103.8198, name: 'Singapore' },
    'switzerland': { lat: 46.8182, lon: 8.2275, name: 'Switzerland' },
    'ch': { lat: 46.8182, lon: 8.2275, name: 'Switzerland' },
    'sweden': { lat: 60.1282, lon: 18.6435, name: 'Sweden' },
    'se': { lat: 60.1282, lon: 18.6435, name: 'Sweden' },
    'spain': { lat: 40.4637, lon: -3.7492, name: 'Spain' },
    'es': { lat: 40.4637, lon: -3.7492, name: 'Spain' },
    'italy': { lat: 41.8719, lon: 12.5674, name: 'Italy' },
    'it': { lat: 41.8719, lon: 12.5674, name: 'Italy' },
    'south korea': { lat: 35.9078, lon: 127.7669, name: 'South Korea' },
    'korea': { lat: 35.9078, lon: 127.7669, name: 'South Korea' },
    'kr': { lat: 35.9078, lon: 127.7669, name: 'South Korea' },
    'china': { lat: 35.8617, lon: 104.1954, name: 'China' },
    'cn': { lat: 35.8617, lon: 104.1954, name: 'China' },
    'poland': { lat: 51.9194, lon: 19.1451, name: 'Poland' },
    'pl': { lat: 51.9194, lon: 19.1451, name: 'Poland' },
    'ireland': { lat: 53.1424, lon: -7.6921, name: 'Ireland' },
    'ie': { lat: 53.1424, lon: -7.6921, name: 'Ireland' },
    'norway': { lat: 60.4720, lon: 8.4689, name: 'Norway' },
    'no': { lat: 60.4720, lon: 8.4689, name: 'Norway' },
    'denmark': { lat: 56.2639, lon: 9.5018, name: 'Denmark' },
    'dk': { lat: 56.2639, lon: 9.5018, name: 'Denmark' },
    'finland': { lat: 61.9241, lon: 25.7482, name: 'Finland' },
    'fi': { lat: 61.9241, lon: 25.7482, name: 'Finland' },
    'austria': { lat: 47.5162, lon: 14.5501, name: 'Austria' },
    'at': { lat: 47.5162, lon: 14.5501, name: 'Austria' },
    'portugal': { lat: 39.3999, lon: -8.2245, name: 'Portugal' },
    'pt': { lat: 39.3999, lon: -8.2245, name: 'Portugal' },
    'new zealand': { lat: -40.9006, lon: 174.8860, name: 'New Zealand' },
    'nz': { lat: -40.9006, lon: 174.8860, name: 'New Zealand' },
    'united arab emirates': { lat: 23.4241, lon: 53.8478, name: 'United Arab Emirates' },
    'uae': { lat: 23.4241, lon: 53.8478, name: 'United Arab Emirates' },
    'israel': { lat: 31.0461, lon: 34.8516, name: 'Israel' },
    'il': { lat: 31.0461, lon: 34.8516, name: 'Israel' },
    'south africa': { lat: -30.5595, lon: 22.9375, name: 'South Africa' },
    'za': { lat: -30.5595, lon: 22.9375, name: 'South Africa' },
    'nigeria': { lat: 9.0820, lon: 8.6753, name: 'Nigeria' },
    'ng': { lat: 9.0820, lon: 8.6753, name: 'Nigeria' },
    'kenya': { lat: -0.0236, lon: 37.9062, name: 'Kenya' },
    'ke': { lat: -0.0236, lon: 37.9062, name: 'Kenya' },
    'indonesia': { lat: -0.7893, lon: 113.9213, name: 'Indonesia' },
    'id': { lat: -0.7893, lon: 113.9213, name: 'Indonesia' },
    'mexico': { lat: 23.6345, lon: -102.5528, name: 'Mexico' },
    'mx': { lat: 23.6345, lon: -102.5528, name: 'Mexico' },
    'argentina': { lat: -38.4161, lon: -63.6167, name: 'Argentina' },
    'ar': { lat: -38.4161, lon: -63.6167, name: 'Argentina' },
    'chile': { lat: -35.6751, lon: -71.5430, name: 'Chile' },
    'cl': { lat: -35.6751, lon: -71.5430, name: 'Chile' },
    'colombia': { lat: 4.5709, lon: -74.2973, name: 'Colombia' },
    'co': { lat: 4.5709, lon: -74.2973, name: 'Colombia' },
    'turkey': { lat: 38.9637, lon: 35.2433, name: 'Turkey' },
    'tr': { lat: 38.9637, lon: 35.2433, name: 'Turkey' },
    'saudi arabia': { lat: 23.8859, lon: 45.0792, name: 'Saudi Arabia' },
    'sa': { lat: 23.8859, lon: 45.0792, name: 'Saudi Arabia' },
};

// Global default network anchor points
const DEFAULT_GATEWAYS: Array<{ lat: number; lon: number; regionName: string; country: string }> = [
    { lat: 37.7749, lon: -122.4194, regionName: 'Pacific Hub (SF)', country: 'United States' },
    { lat: 51.5074, lon: -0.1278, regionName: 'Atlantic Hub (London)', country: 'United Kingdom' },
    { lat: 12.9716, lon: 77.5946, regionName: 'South Asia Hub (Bengaluru)', country: 'India' },
    { lat: 35.6762, lon: 139.6503, regionName: 'East Asia Hub (Tokyo)', country: 'Japan' },
    { lat: 52.5200, lon: 13.4050, regionName: 'Central Europe Hub (Berlin)', country: 'Germany' },
    { lat: 1.3521, lon: 103.8198, regionName: 'SE Asia Hub (Singapore)', country: 'Singapore' },
    { lat: -33.8688, lon: 151.2093, regionName: 'Oceania Hub (Sydney)', country: 'Australia' },
    { lat: -23.5505, lon: -46.6333, regionName: 'LatAm Hub (São Paulo)', country: 'Brazil' },
];

function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

export function resolveUserLocation(rawLocation?: string | null, userIdSeed: string = 'node-seed'): GeoLocation {
    if (!rawLocation || typeof rawLocation !== 'string' || !rawLocation.trim()) {
        const hash = hashString(userIdSeed);
        const gateway = DEFAULT_GATEWAYS[hash % DEFAULT_GATEWAYS.length];
        const jitterLat = ((hash % 100) / 100 - 0.5) * 1.5;
        const jitterLon = (((hash >> 4) % 100) / 100 - 0.5) * 1.5;
        return {
            lat: gateway.lat + jitterLat,
            lon: gateway.lon + jitterLon,
            country: gateway.country,
            regionName: gateway.regionName,
            isApproximate: true,
        };
    }

    const clean = rawLocation.toLowerCase().trim();

    // 1. Direct city check
    for (const [cityKey, cityData] of Object.entries(CITY_COORDINATES)) {
        if (clean.includes(cityKey)) {
            return {
                lat: cityData.lat,
                lon: cityData.lon,
                city: cityData.city,
                country: cityData.country,
                regionName: `${cityData.city}, ${cityData.country}`,
                isApproximate: false,
            };
        }
    }

    // 2. Comma separated segments (e.g. "Seattle, WA, USA")
    const segments = clean.split(',').map(s => s.trim()).filter(Boolean);
    for (const segment of segments) {
        if (CITY_COORDINATES[segment]) {
            const match = CITY_COORDINATES[segment];
            return {
                lat: match.lat,
                lon: match.lon,
                city: match.city,
                country: match.country,
                regionName: `${match.city}, ${match.country}`,
                isApproximate: false,
            };
        }
        if (COUNTRY_COORDINATES[segment]) {
            const match = COUNTRY_COORDINATES[segment];
            return {
                lat: match.lat,
                lon: match.lon,
                country: match.name,
                regionName: match.name,
                isApproximate: false,
            };
        }
    }

    // 3. Substring country check
    for (const [countryKey, countryData] of Object.entries(COUNTRY_COORDINATES)) {
        const regex = new RegExp(`\\b${countryKey}\\b`, 'i');
        if (regex.test(clean)) {
            return {
                lat: countryData.lat,
                lon: countryData.lon,
                country: countryData.name,
                regionName: countryData.name,
                isApproximate: false,
            };
        }
    }

    // 4. Fallback to deterministic regional gateway
    const hash = hashString(userIdSeed + clean);
    const gateway = DEFAULT_GATEWAYS[hash % DEFAULT_GATEWAYS.length];
    const jitterLat = ((hash % 100) / 100 - 0.5) * 2.0;
    const jitterLon = (((hash >> 4) % 100) / 100 - 0.5) * 2.0;

    return {
        lat: gateway.lat + jitterLat,
        lon: gateway.lon + jitterLon,
        country: gateway.country,
        regionName: rawLocation.trim(),
        isApproximate: true,
    };
}

/**
 * High-fidelity initial fallback dataset spanning all requested countries:
 * India, United States, United Kingdom, Germany, Singapore, Australia, Japan, Canada, UAE, Brazil
 */
export const INITIAL_MOCK_NODES = [
    {
        uid: 'node-us-sf',
        username: 'alex_chen',
        displayName: 'Alex Chen',
        location: 'San Francisco, United States',
        headline: 'Distributed Systems Architect',
        bio: 'Building real-time state machines and decentralized node meshes.',
        followerCount: 342,
        followingCount: 184,
        skills: ['Distributed Systems', 'Rust', 'WebAssembly', 'Three.js'],
        photoURL: null,
    },
    {
        uid: 'node-us-nyc',
        username: 'elena_v',
        displayName: 'Elena Vance',
        location: 'New York, United States',
        headline: 'Full-Stack Protocol Engineer',
        bio: 'Focusing on high-throughput streaming pipelines and WebGL interfaces.',
        followerCount: 289,
        followingCount: 95,
        skills: ['TypeScript', 'Node.js', 'PostgreSQL', 'GraphQL'],
        photoURL: null,
    },
    {
        uid: 'node-in-del',
        username: 'rohit_verma',
        displayName: 'Rohit Verma',
        location: 'New Delhi, India',
        headline: 'Autonomous Systems & Edge AI',
        bio: 'Optimizing low-latency neural routing and embedded inference.',
        followerCount: 512,
        followingCount: 260,
        skills: ['Embedded Systems', 'C++', 'PyTorch', 'Robotics'],
        photoURL: null,
    },
    {
        uid: 'node-in-blr',
        username: 'aarav_sharma',
        displayName: 'Aarav Sharma',
        location: 'Bengaluru, India',
        headline: 'AI & Neural Systems Specialist',
        bio: 'Training autonomous agent swarms and multimodal vision models.',
        followerCount: 412,
        followingCount: 220,
        skills: ['PyTorch', 'Gemini API', 'Transformers', 'CUDA'],
        photoURL: null,
    },
    {
        uid: 'node-in-mum',
        username: 'priya_nair',
        displayName: 'Priya Nair',
        location: 'Mumbai, India',
        headline: 'Cloud Infrastructure Lead',
        bio: 'Designing fault-tolerant microservices across global edge clusters.',
        followerCount: 198,
        followingCount: 130,
        skills: ['Kubernetes', 'Go', 'Terraform', 'Kafka'],
        photoURL: null,
    },
    {
        uid: 'node-uk-ldn',
        username: 'oliver_smith',
        displayName: 'Oliver Smith',
        location: 'London, United Kingdom',
        headline: 'Cryptographic Security Researcher',
        bio: 'Zero-knowledge proofs, verifiable computing, and secure enclaves.',
        followerCount: 520,
        followingCount: 310,
        skills: ['Cryptography', 'Rust', 'ZK-SNARKs', 'C++'],
        photoURL: null,
    },
    {
        uid: 'node-de-ber',
        username: 'lukas_weber',
        displayName: 'Lukas Weber',
        location: 'Berlin, Germany',
        headline: 'Spatial Computing & 3D Dev',
        bio: 'Procedural generation, shader authoring, and immersive visualization.',
        followerCount: 376,
        followingCount: 215,
        skills: ['GLSL', 'WebGL', 'Three.js', 'WebGPU'],
        photoURL: null,
    },
    {
        uid: 'node-sg-sg',
        username: 'mei_ling',
        displayName: 'Mei Ling Tan',
        location: 'Singapore',
        headline: 'Edge Compute & Quant Systems',
        bio: 'Ultra low-latency network telemetry and edge caching architectures.',
        followerCount: 260,
        followingCount: 145,
        skills: ['C++', 'Networking', 'ZeroMQ', 'Redis'],
        photoURL: null,
    },
    {
        uid: 'node-jp-tok',
        username: 'kenji_sato',
        displayName: 'Kenji Sato',
        location: 'Tokyo, Japan',
        headline: 'Robotics & Embedded Systems',
        bio: 'Interfacing physical sensor telemetry with digital twin engines.',
        followerCount: 480,
        followingCount: 290,
        skills: ['ROS', 'Embedded C', 'Computer Vision', 'IoT'],
        photoURL: null,
    },
    {
        uid: 'node-au-syd',
        username: 'chloe_taylor',
        displayName: 'Chloe Taylor',
        location: 'Sydney, Australia',
        headline: 'Data Mesh & Graph Engineer',
        bio: 'Knowledge graph synthesis and vector embedding indexing.',
        followerCount: 215,
        followingCount: 180,
        skills: ['Neo4j', 'Python', 'Vector DBs', 'FastAPI'],
        photoURL: null,
    },
    {
        uid: 'node-ca-tor',
        username: 'marcus_roy',
        displayName: 'Marcus Roy',
        location: 'Toronto, Canada',
        headline: 'Machine Learning Infrastructure',
        bio: 'Scaling distributed model evaluation and GPU orchestrations.',
        followerCount: 330,
        followingCount: 175,
        skills: ['PyTorch', 'Ray', 'Docker', 'Python'],
        photoURL: null,
    },
    {
        uid: 'node-ae-dxb',
        username: 'tariq_almansoor',
        displayName: 'Tariq Al-Mansoor',
        location: 'Dubai, United Arab Emirates',
        headline: 'Fintech & Settlement Mesh Lead',
        bio: 'Building cross-border liquidity rails and high-availability gateways.',
        followerCount: 295,
        followingCount: 160,
        skills: ['Go', 'Solidity', 'Postgres', 'Distributed DBs'],
        photoURL: null,
    },
    {
        uid: 'node-br-sao',
        username: 'gabriel_silva',
        displayName: 'Gabriel Silva',
        location: 'São Paulo, Brazil',
        headline: 'Mobile & Real-Time Sync Dev',
        bio: 'Local-first offline synchronization and CRDT data structures.',
        followerCount: 245,
        followingCount: 190,
        skills: ['React Native', 'CRDTs', 'WebSockets', 'Swift'],
        photoURL: null,
    },
];

/**
 * Initial connection relationships with dynamic connection state
 */
export const INITIAL_MOCK_CONNECTIONS = [
    { fromId: 'node-in-del', toId: 'node-in-blr', status: 'ACTIVE' as const },
    { fromId: 'node-in-del', toId: 'node-uk-ldn', status: 'ACTIVE' as const },
    { fromId: 'node-in-del', toId: 'node-jp-tok', status: 'ACTIVE' as const },
    { fromId: 'node-in-blr', toId: 'node-sg-sg', status: 'ACTIVE' as const },
    { fromId: 'node-in-del', toId: 'node-sg-sg', status: 'ACTIVE' as const },
    { fromId: 'node-in-blr', toId: 'node-in-mum', status: 'ACTIVE' as const },
    { fromId: 'node-us-sf', toId: 'node-jp-tok', status: 'ACTIVE' as const },
    { fromId: 'node-us-sf', toId: 'node-uk-ldn', status: 'ACTIVE' as const },
    { fromId: 'node-us-nyc', toId: 'node-uk-ldn', status: 'ACTIVE' as const },
    { fromId: 'node-us-nyc', toId: 'node-ca-tor', status: 'ACTIVE' as const },
    { fromId: 'node-uk-ldn', toId: 'node-de-ber', status: 'ACTIVE' as const },
    { fromId: 'node-de-ber', toId: 'node-ae-dxb', status: 'CONNECTING' as const },
    { fromId: 'node-in-mum', toId: 'node-ae-dxb', status: 'ACTIVE' as const },
    { fromId: 'node-sg-sg', toId: 'node-jp-tok', status: 'ACTIVE' as const },
    { fromId: 'node-sg-sg', toId: 'node-au-syd', status: 'ACTIVE' as const },
    { fromId: 'node-jp-tok', toId: 'node-au-syd', status: 'IDLE' as const },
    { fromId: 'node-us-sf', toId: 'node-br-sao', status: 'ACTIVE' as const },
    { fromId: 'node-br-sao', toId: 'node-uk-ldn', status: 'DISCONNECTING' as const },
];
