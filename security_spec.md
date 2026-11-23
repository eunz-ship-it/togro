# Firestore Security Specification — TO-GROW (취업해봄)

## 1. Data Invariants
1. Every document under `/users/{userId}/...` belongs strictly to `{userId}` (`ownerId == request.auth.uid && userId == request.auth.uid`).
2. Unauthenticated or unverified users (`request.auth == null || request.auth.token.email_verified != true`) are denied all read and write access.
3. No blanket cross-user `list` queries are permitted; `users` root collection cannot be listed.
4. `RoadmapTask` cannot exist without an existing parent `GrowthRoadmap` owned by the same user (`exists(/databases/$(database)/documents/users/$(userId)/roadmaps/$(roadmapId))`).
5. `GoalActivityLog` entries are append-only (`allow update, delete: if false`) and must reference an existing parent `GrowthRoadmap` owned by the same user (`exists(...)`), with `actor` restricted to `'AI 제안'` or `'사용자 수정'`.
6. `PortfolioVersion` cannot exist without an existing parent `PortfolioDoc` owned by the same user, and snapshots are immutable (`allow update: if false`).
7. `ActivityLog` entries are append-only (`allow update: if false`).
8. `createdAt` must equal `request.time` on create and remain immutable on update; `updatedAt` must equal `request.time` on create and update.
9. Completed roadmaps (`status == 'completed'`) lock terminal state, and `RoadmapTask` `roadmapId` and `ownerId` are immutable.
10. `RoadmapTask.status`, when present, is restricted to `'진행 예정' | '실천 중' | '완료' | '미완료' | '건너뛰기'`, and `DailyCheckin.availableMinutes`, when present, is bounded to `5..480`.
11. `UserProfile.age` (when present) is bounded to `15..99`, `UserProfile.jobPrepStatus` (when present) is bounded to 60 chars, and `RecommendedProgram` strictly enforces `ownerId == userId == request.auth.uid`, valid `applyUrl` bounds, and `programId` path consistency.

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Identity Spoofing on Profile Create**: User A (`uidA`) attempts `create` on `/users/uidB` with `ownerId: "uidB"`.
2. **Owner Field Spoofing**: User A attempts `create` on `/users/uidA/worries/w1` with `ownerId: "uidB"`.
3. **Shadow Ghost Field Injection**: User A attempts `create` on `/users/uidA` including extra field `isAdmin: true`, or on `goalActivityLogs` with `ghostField: 1`.
4. **Unverified Email Write**: User A with `email_verified: false` attempts `create` on `/users/uidA/checkins/c1`.
5. **Cross-User Subcollection Read/List**: User A attempts `list` on `/users/uidB/goalActivityLogs`.
6. **ID Poisoning**: User A attempts `create` on `/users/uidA/worries/${"a".repeat(200)}` or `/users/uidA/worries/bad$id`.
7. **Timestamp Forgery**: User A attempts `create` on `/users/uidA/goalActivityLogs/g1` with client-supplied past timestamp `createdAt` instead of `request.time`.
8. **Immutable Field & Log Tampering**: User A attempts `update` on `/users/uidA/roadmaps/r1` modifying `createdAt`/`ownerId`, or `update`/`delete` on `/users/uidA/goalActivityLogs/g1`.
9. **Orphaned Subcollection Write**: User A attempts `create` on `/users/uidA/roadmaps/nonexistent/tasks/t1` or `/users/uidA/goalActivityLogs/g1` with `roadmapId: "nonexistent"`.
10. **Snapshot Tampering**: User A attempts `update` on `/users/uidA/portfolios/p1/versions/v1` to rewrite history.
11. **Value Type / Size Poisoning**: User A attempts `update` on `/users/uidA/roadmaps/r1/tasks/t1` with invalid `status: "임의상태"` or `availableMinutes: 99999` on check-in.
12. **Unbounded Array Injection**: User A attempts `create` on `/users/uidA` with `interests` array of 20 items or non-string element `[123]`.
