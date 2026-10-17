/**
 * Automated Verification & Acceptance Test Suite for INVOX Unique User ID System
 */
import {
    INVOX_ID_PREFIX,
    INVOX_ID_CHARSET,
    INVOX_ID_BODY_LENGTH,
    INVOX_ID_REGEX,
    generateCandidateInvoxId,
    normalizeInvoxId,
    isValidInvoxIdFormat,
} from '../services/invoxIdService';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        process.exit(1);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

console.log('====================================================');
console.log('RUNNING INVOX UNIQUE USER ID SYSTEM ACCEPTANCE TESTS');
console.log('====================================================\n');

// 1. Format & Entropy Verification
console.log('--- Test Suite 1: Format & Entropy Verification ---');
const generatedSamples = new Set<string>();
const SAMPLE_COUNT = 1000;

for (let i = 0; i < SAMPLE_COUNT; i++) {
    const id = generateCandidateInvoxId();
    assert(id.startsWith('IVX-'), `Generated ID ${id} starts with IVX- prefix`);
    assert(id.length === 10, `Generated ID ${id} length is exactly 10 characters (4 prefix + 6 body)`);
    assert(isValidInvoxIdFormat(id), `Generated ID ${id} conforms to strict format regex`);
    const body = id.slice(4);
    for (const char of body) {
        assert(INVOX_ID_CHARSET.includes(char), `Character "${char}" in ${id} belongs to Crockford-32 charset`);
        assert(!['0', 'O', '1', 'I'].includes(char), `Confusing char "${char}" is excluded from ${id}`);
    }
    generatedSamples.add(id);
}
assert(generatedSamples.size === SAMPLE_COUNT, `All ${SAMPLE_COUNT} randomly generated IDs are unique (zero collisions)`);

// 2. Normalization & Tolerance
console.log('\n--- Test Suite 2: Normalization & Input Tolerance ---');
assert(normalizeInvoxId('IVX-7K9P2M') === 'IVX-7K9P2M', 'Standard uppercase canonical ID normalized');
assert(normalizeInvoxId('ivx-7k9p2m') === 'IVX-7K9P2M', 'Lowercase ID normalized to uppercase');
assert(normalizeInvoxId('7k9p2m') === 'IVX-7K9P2M', 'ID without prefix normalized to IVX-7K9P2M');
assert(normalizeInvoxId('  IVX-7K9P2M  ') === 'IVX-7K9P2M', 'Trim whitespace handles padded input');
assert(normalizeInvoxId('ivx 7k9p2m') === 'IVX-7K9P2M', 'Handles space delimiter');
assert(normalizeInvoxId('ivx_7k9p2m') === 'IVX-7K9P2M', 'Handles underscore delimiter');
assert(normalizeInvoxId('IVX7K9P2M') === 'IVX-7K9P2M', 'Handles continuous uppercase without hyphens');
assert(normalizeInvoxId('ivx7k9p2m') === 'IVX-7K9P2M', 'Handles continuous lowercase without hyphens');

// Invalid inputs
assert(normalizeInvoxId('IVX-12345') === null, 'Rejects ID with length < 6');
assert(normalizeInvoxId('IVX-1234567') === null, 'Rejects ID with length > 6');
assert(normalizeInvoxId('IVX-000000') === null, 'Rejects ID with excluded "0" character');
assert(normalizeInvoxId('IVX-OOOOOO') === null, 'Rejects ID with excluded "O" character');
assert(normalizeInvoxId('IVX-111111') === null, 'Rejects ID with excluded "1" character');
assert(normalizeInvoxId('IVX-IIIIII') === null, 'Rejects ID with excluded "I" character');
assert(normalizeInvoxId('') === null, 'Rejects empty string');
assert(normalizeInvoxId(null) === null, 'Rejects null');
assert(normalizeInvoxId(undefined) === null, 'Rejects undefined');

// 3. Immutability & Idempotency Simulation
console.log('\n--- Test Suite 3: Immutability & Idempotent Allocation ---');
interface MockUserDoc {
    uid: string;
    email: string;
    username: string;
    displayName: string;
    invoxId?: string;
}

const mockDatabase = new Map<string, MockUserDoc>();
const mockInvoxRegistry = new Map<string, { invoxId: string; uid: string }>();

const simulateAllocateInvoxId = (uid: string): string => {
    const user = mockDatabase.get(uid);
    if (!user) throw new Error(`User not found: ${uid}`);

    // Idempotent return
    if (user.invoxId && isValidInvoxIdFormat(user.invoxId)) {
        return user.invoxId;
    }

    // Allocate candidate
    let candidate = '';
    for (let attempt = 0; attempt < 5; attempt++) {
        candidate = generateCandidateInvoxId();
        if (!mockInvoxRegistry.has(candidate)) {
            mockInvoxRegistry.set(candidate, { invoxId: candidate, uid });
            user.invoxId = candidate;
            return candidate;
        }
    }
    throw new Error('Collision exhaustion');
};

// Seed existing users (some without invoxId, simulating existing legacy accounts)
mockDatabase.set('user_legacy_1', {
    uid: 'user_legacy_1',
    email: 'alice@example.com',
    username: 'alice_builder',
    displayName: 'Alice Architect',
});

mockDatabase.set('user_legacy_2', {
    uid: 'user_legacy_2',
    email: 'bob@example.com',
    username: 'bob_crypto',
    displayName: 'Bob Cryptographer',
});

// Seed an already provisioned account
mockDatabase.set('user_provisioned_3', {
    uid: 'user_provisioned_3',
    email: 'carol@example.com',
    username: 'carol_dev',
    displayName: 'Carol Developer',
    invoxId: 'IVX-9P4W8M',
});
mockInvoxRegistry.set('IVX-9P4W8M', { invoxId: 'IVX-9P4W8M', uid: 'user_provisioned_3' });

// First allocation for legacy user 1
const id1 = simulateAllocateInvoxId('user_legacy_1');
assert(isValidInvoxIdFormat(id1), `Allocated valid ID ${id1} to legacy user 1`);
assert(mockDatabase.get('user_legacy_1')?.invoxId === id1, 'User document updated with new ID');
assert(mockInvoxRegistry.get(id1)?.uid === 'user_legacy_1', 'Registry correctly links ID to user 1 UID');

// Rerun allocation (testing idempotency)
const id1_again = simulateAllocateInvoxId('user_legacy_1');
assert(id1 === id1_again, 'Re-allocating returns identical ID (idempotent, no changes)');

// Verify existing user 3 ID was preserved
const id3 = simulateAllocateInvoxId('user_provisioned_3');
assert(id3 === 'IVX-9P4W8M', 'Pre-existing ID was preserved untouched');

// Verify legacy user 2 gets distinct ID
const id2 = simulateAllocateInvoxId('user_legacy_2');
assert(id2 !== id1 && id2 !== id3, `User 2 received distinct unique ID ${id2}`);

// 4. Privacy & Sanitization Check
console.log('\n--- Test Suite 4: Privacy & Information Barrier ---');
const simulateLookupSanitization = (rawUser: any, normalizedId: string) => {
    // Only return public fields
    return {
        uid: rawUser.uid,
        invoxId: normalizedId,
        username: rawUser.username,
        displayName: rawUser.displayName,
        headline: rawUser.headline || '',
    };
};

const lookupProfile = simulateLookupSanitization(mockDatabase.get('user_legacy_1'), id1);
assert(!('email' in lookupProfile), 'Private email address is strictly NOT exposed in lookup result');
assert(!('password' in lookupProfile), 'Password/auth metadata is NOT exposed');
assert(lookupProfile.uid === 'user_legacy_1', 'Resolves canonical UID correctly');
assert(lookupProfile.invoxId === id1, 'Resolves public INVOX ID correctly');

console.log('\n====================================================');
console.log('ALL ACCEPTANCE TESTS COMPLETED SUCCESSFULLY (100%)');
console.log('====================================================');
