import type { Clock, WorkspaceSnapshot } from '../domain/types';

/** Fixed partitions prevent accidental merging of fictional and personal data. */
export const DEMO_WORKSPACE_ID = 'demo';
export const PERSONAL_WORKSPACE_ID = 'personal';

function iso(clock: Clock, offsetDays: number): string {
	return new Date(clock().getTime() + offsetDays * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * A deliberately small fictional loop. IDs are fixed so reset is reproducible;
 * no individual, institution or impact claim is represented here.
 */
export function createDemoSeed(clock: Clock): WorkspaceSnapshot {
	const now = iso(clock, 0);
	const observedAt = iso(clock, -1);
	const futureAt = iso(clock, 2);

	return {
		workspaceId: DEMO_WORKSPACE_ID,
		courses: [
			{
				id: 'demo-course-algebra',
				workspaceId: DEMO_WORKSPACE_ID,
				name: 'Représentations algébriques',
				colorToken: 'moss',
				createdAt: observedAt,
				updatedAt: now
			}
		],
		sessions: [
			{
				id: 'demo-session-representations',
				workspaceId: DEMO_WORKSPACE_ID,
				courseId: 'demo-course-algebra',
				title: 'Comparer deux représentations',
				status: 'taught',
				createdAt: observedAt,
				updatedAt: observedAt
			},
			{
				id: 'demo-session-next-strategy',
				workspaceId: DEMO_WORKSPACE_ID,
				courseId: 'demo-course-algebra',
				title: 'Préparer une stratégie de comparaison',
				scheduledFor: futureAt,
				status: 'planned',
				createdAt: now,
				updatedAt: now
			}
		],
		observations: [
			{
				id: 'demo-observation-representations',
				workspaceId: DEMO_WORKSPACE_ID,
				sessionId: 'demo-session-representations',
				signal: 'adjust',
				note: 'La comparaison gagne en clarté quand un exemple commun précède la consigne.',
				createdAt: observedAt,
				updatedAt: observedAt
			}
		],
		decisions: [
			{
				id: 'demo-decision-common-example',
				workspaceId: DEMO_WORKSPACE_ID,
				observationId: 'demo-observation-representations',
				targetSessionId: 'demo-session-next-strategy',
				text: 'Prévoir un exemple commun avant la consigne de comparaison.',
				status: 'to_prepare',
				createdAt: now,
				updatedAt: now
			}
		]
	};
}
