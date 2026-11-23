/**
 * Verification matrix for the "Dirty Dozen" adversarial payloads defined in security_spec.md.
 * Designed for execution against the Firestore Rules Emulator when available.
 */
export interface SecurityTestCase {
  id: number;
  name: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  path: string;
  actorUid: string;
  emailVerified: boolean;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const dirtyDozenTests: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Profile Create',
    operation: 'create',
    path: 'users/uidB',
    actorUid: 'uidA',
    emailVerified: true,
    payload: { ownerId: 'uidB', nickname: 'attacker' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Owner Field Spoofing on Worry Create',
    operation: 'create',
    path: 'users/uidA/worries/w1',
    actorUid: 'uidA',
    emailVerified: true,
    payload: { ownerId: 'uidB', title: 'Spoofed' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow Ghost Field Injection',
    operation: 'create',
    path: 'users/uidA',
    actorUid: 'uidA',
    emailVerified: true,
    payload: { ownerId: 'uidA', nickname: 'user', isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Unverified Email Write',
    operation: 'create',
    path: 'users/uidA/checkins/c1',
    actorUid: 'uidA',
    emailVerified: false,
    payload: { ownerId: 'uidA', moodScore: 3 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Cross-User Subcollection List on GoalActivityLogs',
    operation: 'list',
    path: 'users/uidB/goalActivityLogs',
    actorUid: 'uidA',
    emailVerified: true,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'ID Poisoning with Special Characters',
    operation: 'create',
    path: 'users/uidA/worries/bad$id',
    actorUid: 'uidA',
    emailVerified: true,
    payload: { ownerId: 'uidA', title: 'Test' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Timestamp Forgery on GoalActivityLog',
    operation: 'create',
    path: 'users/uidA/goalActivityLogs/g1',
    actorUid: 'uidA',
    emailVerified: true,
    payload: { ownerId: 'uidA', roadmapId: 'r1', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Immutable GoalActivityLog Update Tampering',
    operation: 'update',
    path: 'users/uidA/goalActivityLogs/g1',
    actorUid: 'uidA',
    emailVerified: true,
    payload: { actor: 'AI 제안' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Orphaned Subcollection Write on Tasks & GoalActivityLogs',
    operation: 'create',
    path: 'users/uidA/roadmaps/nonexistent/tasks/t1',
    actorUid: 'uidA',
    emailVerified: true,
    payload: { ownerId: 'uidA', roadmapId: 'nonexistent', title: 'Orphan' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Immutable Portfolio Version Tampering',
    operation: 'update',
    path: 'users/uidA/portfolios/p1/versions/v1',
    actorUid: 'uidA',
    emailVerified: true,
    payload: { changeNote: 'Tampered' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Invalid Task Status & Out-of-Bounds AvailableMinutes',
    operation: 'update',
    path: 'users/uidA/roadmaps/r1/tasks/t1',
    actorUid: 'uidA',
    emailVerified: true,
    payload: { status: '임의상태' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unbounded Array Injection',
    operation: 'create',
    path: 'users/uidA',
    actorUid: 'uidA',
    emailVerified: true,
    payload: { ownerId: 'uidA', interests: Array.from({ length: 20 }, (_, i) => `tag-${i}`) },
    expected: 'PERMISSION_DENIED',
  },
];
