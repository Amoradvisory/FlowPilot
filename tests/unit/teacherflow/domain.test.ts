import { describe, expect, it } from 'vitest';
import {
	createCourse,
	createDecision,
	createObservation,
	createSession,
	archiveCourse,
	planCourseDeletion,
	planObservationDeletion,
	updateCourse,
	updateObservation,
	updateDecisionStatus,
	updateSession
} from '../../../src/lib/teacherflow/domain/commands';
import {
	DomainError,
	FIELD_LIMITS,
	validateWorkspaceSnapshot
} from '../../../src/lib/teacherflow/domain/invariants';
import { selectMemory, selectToday } from '../../../src/lib/teacherflow/domain/selectors';
import type {
	Clock,
	Course,
	Decision,
	IdFactory,
	Observation,
	Session,
	WorkspaceSnapshot
} from '../../../src/lib/teacherflow/domain/types';

const NOW = '2026-08-15T08:30:00.000Z';
const clock: Clock = () => new Date(NOW);

function ids(...values: string[]): IdFactory {
	let index = 0;
	return () => values[index++] ?? `generated-${index}`;
}

function expectDomainError(action: () => unknown, code: DomainError['code'], field?: string) {
	try {
		action();
		expect.fail('Expected a DomainError');
	} catch (error) {
		expect(error).toBeInstanceOf(DomainError);
		expect(error).toMatchObject({ name: 'DomainError', code, ...(field ? { field } : {}) });
	}
}

function makeSnapshot(): WorkspaceSnapshot {
	const courses: Course[] = [
		{
			id: 'course-maths',
			workspaceId: 'personal',
			name: 'Mathématiques',
			colorToken: 'indigo',
			createdAt: '2026-08-01T08:00:00.000Z',
			updatedAt: '2026-08-01T08:00:00.000Z'
		},
		{
			id: 'course-history',
			workspaceId: 'personal',
			name: 'Histoire',
			colorToken: 'ochre',
			createdAt: '2026-08-02T08:00:00.000Z',
			updatedAt: '2026-08-02T08:00:00.000Z'
		}
	];
	const sessions: Session[] = [
		{
			id: 'session-past',
			workspaceId: 'personal',
			courseId: 'course-maths',
			title: 'Fractions — bilan',
			scheduledFor: '2026-08-14T10:00:00.000Z',
			status: 'taught',
			createdAt: '2026-08-10T08:00:00.000Z',
			updatedAt: '2026-08-14T11:00:00.000Z'
		},
		{
			id: 'session-next',
			workspaceId: 'personal',
			courseId: 'course-maths',
			title: 'Fractions — réinvestissement',
			scheduledFor: '2026-08-16T09:00:00.000Z',
			status: 'planned',
			createdAt: '2026-08-10T08:00:00.000Z',
			updatedAt: '2026-08-10T08:00:00.000Z'
		},
		{
			id: 'session-later',
			workspaceId: 'personal',
			courseId: 'course-history',
			title: 'Révolutions',
			scheduledFor: '2026-08-20T09:00:00.000Z',
			status: 'planned',
			createdAt: '2026-08-10T08:00:00.000Z',
			updatedAt: '2026-08-10T08:00:00.000Z'
		},
		{
			id: 'session-undated',
			workspaceId: 'personal',
			courseId: 'course-history',
			title: 'Sources',
			status: 'planned',
			createdAt: '2026-08-10T08:00:00.000Z',
			updatedAt: '2026-08-10T08:00:00.000Z'
		}
	];
	const observations: Observation[] = [
		{
			id: 'observation-old',
			workspaceId: 'personal',
			sessionId: 'session-past',
			signal: 'keep',
			note: 'La manipulation a soutenu le raisonnement.',
			createdAt: '2026-08-14T10:30:00.000Z',
			updatedAt: '2026-08-14T10:30:00.000Z'
		},
		{
			id: 'observation-new',
			workspaceId: 'personal',
			sessionId: 'session-later',
			signal: 'verify',
			note: 'Vérifier la compréhension avant la synthèse.',
			createdAt: '2026-08-15T07:30:00.000Z',
			updatedAt: '2026-08-15T07:30:00.000Z'
		}
	];
	const decisions: Decision[] = [
		{
			id: 'decision-targeted',
			workspaceId: 'personal',
			observationId: 'observation-old',
			targetSessionId: 'session-next',
			text: 'Prévoir un exemple chiffré avant la consigne.',
			status: 'ready',
			createdAt: '2026-08-14T10:35:00.000Z',
			updatedAt: '2026-08-15T07:00:00.000Z'
		},
		{
			id: 'decision-unscheduled',
			workspaceId: 'personal',
			observationId: 'observation-new',
			text: 'Ajouter une vérification intermédiaire.',
			status: 'to_prepare',
			createdAt: '2026-08-15T07:35:00.000Z',
			updatedAt: '2026-08-15T07:35:00.000Z'
		}
	];

	return { workspaceId: 'personal', courses, sessions, observations, decisions };
}

describe('TeacherFlow domain commands', () => {
	it('normalizes whitespace, optional strings, ids and generated UTC timestamps', () => {
		const course = createCourse(
			{
				workspaceId: '  personal  ',
				name: '  Mathématiques\n   appliquées ',
				subject: ' \t ',
				colorToken: '  warm  indigo '
			},
			clock,
			ids('  course-1  ')
		);

		expect(course).toEqual({
			id: 'course-1',
			workspaceId: 'personal',
			name: 'Mathématiques appliquées',
			colorToken: 'warm indigo',
			createdAt: NOW,
			updatedAt: NOW
		});
	});

	it('edits and archives a course without replacing its identity or creation time', () => {
		const initial = makeSnapshot().courses[0];
		const edited = updateCourse(
			initial,
			{
				workspaceId: 'personal',
				name: '  Mathématiques appliquées ',
				subject: ' Algèbre ',
				colorToken: ' moss '
			},
			clock
		);
		const archived = archiveCourse(edited, () => new Date('2026-08-15T09:00:00.000Z'));

		expect(edited).toMatchObject({
			id: initial.id,
			createdAt: initial.createdAt,
			name: 'Mathématiques appliquées',
			subject: 'Algèbre',
			colorToken: 'moss',
			updatedAt: NOW
		});
		expect(archived).toMatchObject({
			id: initial.id,
			archivedAt: '2026-08-15T09:00:00.000Z',
			updatedAt: '2026-08-15T09:00:00.000Z'
		});
	});

	it('edits a session while preserving its identity and normalizing the optional date', () => {
		const initial = makeSnapshot().sessions[1];
		const edited = updateSession(
			initial,
			{
				workspaceId: 'personal',
				courseId: 'course-history',
				title: '  Nouvelle progression ',
				scheduledFor: '2026-08-20T11:00:00+02:00',
				status: 'planned'
			},
			clock
		);

		expect(edited).toEqual({
			...initial,
			courseId: 'course-history',
			title: 'Nouvelle progression',
			scheduledFor: '2026-08-20T09:00:00.000Z',
			status: 'planned',
			updatedAt: NOW
		});
	});

	it.each([
		[
			'course name',
			() =>
				createCourse({ workspaceId: 'w', name: 'x'.repeat(81), colorToken: 'c' }, clock, ids('c'))
		],
		[
			'session title',
			() =>
				createSession({ workspaceId: 'w', courseId: 'c', title: 'x'.repeat(121) }, clock, ids('s'))
		],
		[
			'observation note',
			() =>
				createObservation(
					{ workspaceId: 'w', sessionId: 's', signal: 'keep', note: 'x'.repeat(601) },
					clock,
					ids('o')
				)
		],
		[
			'decision text',
			() =>
				createDecision(
					{ workspaceId: 'w', observationId: 'o', text: 'x'.repeat(301) },
					clock,
					ids('d')
				)
		]
	])('rejects an overlong %s with a discriminated error', (_label, action) => {
		expectDomainError(action, 'too_long');
	});

	it('accepts content exactly at every explicit public boundary', () => {
		expect(
			createCourse(
				{ workspaceId: 'w', name: 'x'.repeat(FIELD_LIMITS.courseName), colorToken: 'c' },
				clock,
				ids('c')
			).name
		).toHaveLength(80);
		expect(
			createSession(
				{ workspaceId: 'w', courseId: 'c', title: 'x'.repeat(FIELD_LIMITS.sessionTitle) },
				clock,
				ids('s')
			).title
		).toHaveLength(120);
		expect(
			createObservation(
				{
					workspaceId: 'w',
					sessionId: 's',
					signal: 'adjust',
					note: 'x'.repeat(FIELD_LIMITS.observationNote)
				},
				clock,
				ids('o')
			).note
		).toHaveLength(600);
		expect(
			createDecision(
				{ workspaceId: 'w', observationId: 'o', text: 'x'.repeat(FIELD_LIMITS.decisionText) },
				clock,
				ids('d')
			).text
		).toHaveLength(300);
	});

	it.each([
		[
			'course name',
			() => createCourse({ workspaceId: 'w', name: ' \n ', colorToken: 'c' }, clock, ids('c'))
		],
		[
			'session title',
			() => createSession({ workspaceId: 'w', courseId: 'c', title: '\t' }, clock, ids('s'))
		],
		[
			'observation note',
			() =>
				createObservation(
					{ workspaceId: 'w', sessionId: 's', signal: 'keep', note: '   ' },
					clock,
					ids('o')
				)
		],
		[
			'decision text',
			() => createDecision({ workspaceId: 'w', observationId: 'o', text: '' }, clock, ids('d'))
		]
	])('rejects an empty normalized %s', (_label, action) => {
		expectDomainError(action, 'required');
	});

	it('rejects malformed dates and normalizes valid offset dates to UTC', () => {
		expectDomainError(
			() =>
				createSession(
					{ workspaceId: 'w', courseId: 'c', title: 'Séance', scheduledFor: 'demain' },
					clock,
					ids('s')
				),
			'invalid_date',
			'scheduledFor'
		);

		const session = createSession(
			{
				workspaceId: 'w',
				courseId: 'c',
				title: 'Séance',
				scheduledFor: '2026-08-16T11:00:00+02:00'
			},
			clock,
			ids('s')
		);
		expect(session.scheduledFor).toBe('2026-08-16T09:00:00.000Z');
	});

	it('rejects an invalid injected clock or id before an entity can escape', () => {
		expectDomainError(
			() =>
				createCourse(
					{ workspaceId: 'w', name: 'Mathématiques', colorToken: 'c' },
					() => new Date('invalid'),
					ids('course')
				),
			'invalid_date',
			'now'
		);
		expectDomainError(
			() =>
				createCourse(
					{ workspaceId: 'w', name: 'Mathématiques', colorToken: 'c' },
					clock,
					ids('   ')
				),
			'required',
			'id'
		);
	});

	it.each(['keep', 'adjust', 'verify'] as const)(
		'keeps %s as a neutral pedagogical signal without ranking it',
		(signal) => {
			const observation = createObservation(
				{ workspaceId: 'w', sessionId: 's', signal, note: 'Constat factuel' },
				clock,
				ids(`observation-${signal}`)
			);

			expect(observation.signal).toBe(signal);
		}
	);

	it('creates a decision in to_prepare with an optional normalized target session', () => {
		const targeted = createDecision(
			{
				workspaceId: 'personal',
				observationId: 'observation-1',
				targetSessionId: '  session-next ',
				text: '  Prévoir un exemple chiffré\n avant la consigne '
			},
			clock,
			ids('decision-1')
		);
		const unscheduled = createDecision(
			{
				workspaceId: 'personal',
				observationId: 'observation-1',
				targetSessionId: '   ',
				text: 'Préparer une reformulation'
			},
			clock,
			ids('decision-2')
		);

		expect(targeted).toMatchObject({
			targetSessionId: 'session-next',
			text: 'Prévoir un exemple chiffré avant la consigne',
			status: 'to_prepare'
		});
		expect(unscheduled).not.toHaveProperty('targetSessionId');
	});

	it('moves a decision forward through to_prepare, ready and applied with injected UTC time', () => {
		const initial = createDecision(
			{ workspaceId: 'w', observationId: 'o', text: 'Préparer un exemple' },
			clock,
			ids('decision')
		);
		const ready = updateDecisionStatus(initial, 'ready', () => new Date('2026-08-15T09:00:00Z'));
		const applied = updateDecisionStatus(ready, 'applied', () => new Date('2026-08-16T09:00:00Z'));

		expect(initial).toMatchObject({ status: 'to_prepare', updatedAt: NOW });
		expect(ready).toMatchObject({ status: 'ready', updatedAt: '2026-08-15T09:00:00.000Z' });
		expect(ready).not.toHaveProperty('appliedAt');
		expect(applied).toMatchObject({
			status: 'applied',
			updatedAt: '2026-08-16T09:00:00.000Z',
			appliedAt: '2026-08-16T09:00:00.000Z'
		});
		expect(initial.status).toBe('to_prepare');
	});

	it.each([
		['to_prepare', 'applied'],
		['ready', 'to_prepare'],
		['applied', 'ready'],
		['applied', 'to_prepare'],
		['ready', 'ready']
	] as const)('rejects the invalid decision transition %s -> %s', (from, to) => {
		const decision: Decision = {
			id: 'decision',
			workspaceId: 'w',
			observationId: 'o',
			text: 'Préparer un exemple',
			status: from,
			...(from === 'applied' ? { appliedAt: NOW } : {}),
			createdAt: NOW,
			updatedAt: NOW
		};

		expectDomainError(
			() => updateDecisionStatus(decision, to, clock),
			'invalid_transition',
			'status'
		);
	});

	it('rejects a transition timestamp earlier than the entity state', () => {
		const decision = makeSnapshot().decisions[0];
		expectDomainError(
			() => updateDecisionStatus(decision, 'applied', () => new Date('2026-08-14T09:00:00Z')),
			'invalid_date_order',
			'now'
		);
	});

	it('rejects a malformed incoming decision before evaluating its transition', () => {
		const base = makeSnapshot().decisions[1];
		for (const decision of [
			{ ...base, id: ' decision ' },
			{ ...base, workspaceId: ' personal ' },
			{ ...base, text: '   ' }
		]) {
			expectDomainError(
				() => updateDecisionStatus(decision, 'ready', clock),
				decision.text.trim() ? 'non_canonical' : 'required'
			);
		}
	});

	it('rejects an incoming non-applied decision carrying appliedAt', () => {
		const decision: Decision = { ...makeSnapshot().decisions[1], appliedAt: NOW };
		expectDomainError(
			() => updateDecisionStatus(decision, 'ready', clock),
			'invalid_status',
			'appliedAt'
		);
	});

	it('rejects an incoming decision whose updatedAt precedes createdAt', () => {
		const decision: Decision = {
			...makeSnapshot().decisions[1],
			createdAt: '2026-08-15T08:00:00.000Z',
			updatedAt: '2026-08-15T07:00:00.000Z'
		};
		expectDomainError(
			() => updateDecisionStatus(decision, 'ready', clock),
			'invalid_date_order',
			'updatedAt'
		);
	});
});

describe('TeacherFlow relationship invariants and deletion intents', () => {
	it('accepts a coherent snapshot and an optional decision target', () => {
		const snapshot = makeSnapshot();
		expect(validateWorkspaceSnapshot(snapshot)).toBe(snapshot);

		const withoutTarget: WorkspaceSnapshot = {
			...snapshot,
			decisions: snapshot.decisions.map((decision) => {
				if (decision.id !== 'decision-targeted') return decision;
				const { targetSessionId: _targetSessionId, ...unscheduled } = decision;
				return unscheduled;
			})
		};
		expect(validateWorkspaceSnapshot(withoutTarget)).toBe(withoutTarget);
	});

	it.each([
		[
			'course workspace',
			(snapshot: WorkspaceSnapshot) => ({
				...snapshot,
				courses: snapshot.courses.map((course) =>
					course.id === 'course-maths' ? { ...course, workspaceId: 'demo' } : course
				)
			})
		],
		[
			'session to course workspace',
			(snapshot: WorkspaceSnapshot) => ({
				...snapshot,
				sessions: snapshot.sessions.map((session) =>
					session.id === 'session-next' ? { ...session, workspaceId: 'demo' } : session
				)
			})
		],
		[
			'observation to session workspace',
			(snapshot: WorkspaceSnapshot) => ({
				...snapshot,
				observations: snapshot.observations.map((observation) =>
					observation.id === 'observation-old'
						? { ...observation, workspaceId: 'demo' }
						: observation
				)
			})
		],
		[
			'decision to target workspace',
			(snapshot: WorkspaceSnapshot) => ({
				...snapshot,
				decisions: snapshot.decisions.map((decision) =>
					decision.id === 'decision-targeted' ? { ...decision, workspaceId: 'demo' } : decision
				)
			})
		]
	] as const)('rejects a cross-workspace %s relation', (_label, mutate) => {
		expectDomainError(
			() => validateWorkspaceSnapshot(mutate(makeSnapshot())),
			'workspace_mismatch'
		);
	});

	it('rejects missing references, duplicate ids and a target that is not future-facing', () => {
		const snapshot = makeSnapshot();
		expectDomainError(
			() =>
				validateWorkspaceSnapshot({
					...snapshot,
					observations: snapshot.observations.map((observation) => ({
						...observation,
						sessionId: 'missing-session'
					}))
				}),
			'relation_not_found',
			'sessionId'
		);
		expectDomainError(
			() =>
				validateWorkspaceSnapshot({
					...snapshot,
					courses: [...snapshot.courses, { ...snapshot.courses[0] }]
				}),
			'duplicate_id',
			'id'
		);
		expectDomainError(
			() =>
				validateWorkspaceSnapshot({
					...snapshot,
					decisions: snapshot.decisions.map((decision) =>
						decision.id === 'decision-targeted'
							? { ...decision, targetSessionId: 'session-past' }
							: decision
					)
				}),
			'target_not_future',
			'targetSessionId'
		);
	});

	it('rejects non-canonical required values before they can desynchronize relations', () => {
		const snapshot = makeSnapshot();
		expectDomainError(
			() =>
				validateWorkspaceSnapshot({
					...snapshot,
					sessions: snapshot.sessions.map((session) =>
						session.id === 'session-next' ? { ...session, id: ' session-next ' } : session
					)
				}),
			'non_canonical',
			'id'
		);
		expectDomainError(
			() =>
				validateWorkspaceSnapshot({
					...snapshot,
					courses: snapshot.courses.map((course) =>
						course.id === 'course-maths' ? { ...course, name: ' Mathématiques ' } : course
					)
				}),
			'non_canonical',
			'name'
		);
	});

	it.each([
		[
			'course subject',
			(snapshot: WorkspaceSnapshot) => ({
				...snapshot,
				courses: snapshot.courses.map((course) =>
					course.id === 'course-maths' ? { ...course, subject: '' } : course
				)
			})
		],
		[
			'course archivedAt',
			(snapshot: WorkspaceSnapshot) => ({
				...snapshot,
				courses: snapshot.courses.map((course) =>
					course.id === 'course-maths' ? { ...course, archivedAt: '' } : course
				)
			})
		],
		[
			'session scheduledFor',
			(snapshot: WorkspaceSnapshot) => ({
				...snapshot,
				sessions: snapshot.sessions.map((session) =>
					session.id === 'session-undated' ? { ...session, scheduledFor: '' } : session
				)
			})
		],
		[
			'decision targetSessionId',
			(snapshot: WorkspaceSnapshot) => ({
				...snapshot,
				decisions: snapshot.decisions.map((decision) =>
					decision.id === 'decision-unscheduled' ? { ...decision, targetSessionId: '' } : decision
				)
			})
		],
		[
			'decision appliedAt',
			(snapshot: WorkspaceSnapshot) => ({
				...snapshot,
				decisions: snapshot.decisions.map((decision) =>
					decision.id === 'decision-unscheduled' ? { ...decision, appliedAt: '' } : decision
				)
			})
		]
	] as const)('rejects an empty but present optional %s', (_label, mutate) => {
		expectDomainError(() => validateWorkspaceSnapshot(mutate(makeSnapshot())), 'non_canonical');
	});

	it('rejects valid instants that are not stored in canonical UTC form', () => {
		const snapshot = makeSnapshot();
		expectDomainError(
			() =>
				validateWorkspaceSnapshot({
					...snapshot,
					sessions: snapshot.sessions.map((session) =>
						session.id === 'session-next'
							? { ...session, scheduledFor: '2026-08-16T11:00:00+02:00' }
							: session
					)
				}),
			'non_canonical',
			'scheduledFor'
		);
	});

	it('enforces createdAt <= appliedAt <= updatedAt with inclusive boundaries', () => {
		const snapshot = makeSnapshot();
		const base: Decision = {
			...snapshot.decisions[1],
			updatedAt: '2026-08-15T08:00:00.000Z'
		};
		const atLowerBound: Decision = {
			...base,
			status: 'applied',
			appliedAt: base.createdAt
		};
		const atUpperBound: Decision = {
			...base,
			status: 'applied',
			appliedAt: base.updatedAt
		};
		expect(
			validateWorkspaceSnapshot({ ...snapshot, decisions: [snapshot.decisions[0], atLowerBound] })
		).toBeTruthy();
		expect(
			validateWorkspaceSnapshot({ ...snapshot, decisions: [snapshot.decisions[0], atUpperBound] })
		).toBeTruthy();

		expectDomainError(
			() =>
				validateWorkspaceSnapshot({
					...snapshot,
					decisions: [
						snapshot.decisions[0],
						{
							...base,
							status: 'applied',
							appliedAt: '2026-08-15T08:01:00.000Z'
						}
					]
				}),
			'invalid_date_order',
			'appliedAt'
		);
	});

	it('plans observation deletion with its decisions without mutating the snapshot', () => {
		const snapshot = makeSnapshot();
		const before = structuredClone(snapshot);

		expect(planObservationDeletion(snapshot, 'observation-old')).toEqual({
			kind: 'delete_observation',
			workspaceId: 'personal',
			delete: {
				courseIds: [],
				sessionIds: [],
				observationIds: ['observation-old'],
				decisionIds: ['decision-targeted']
			},
			clearDecisionTargetIds: [],
			requiresDetailedConfirmation: false
		});
		expect(snapshot).toEqual(before);
	});

	it('plans a detailed course cascade and clears surviving decisions aimed at removed sessions', () => {
		const snapshot = makeSnapshot();
		const crossCourseTarget: Decision = {
			...snapshot.decisions[1],
			id: 'decision-cross-course-target',
			targetSessionId: 'session-next'
		};
		const withCrossCourseTarget = {
			...snapshot,
			decisions: [...snapshot.decisions, crossCourseTarget]
		};

		expect(planCourseDeletion(withCrossCourseTarget, 'course-maths')).toEqual({
			kind: 'delete_course',
			workspaceId: 'personal',
			delete: {
				courseIds: ['course-maths'],
				sessionIds: ['session-next', 'session-past'],
				observationIds: ['observation-old'],
				decisionIds: ['decision-targeted']
			},
			clearDecisionTargetIds: ['decision-cross-course-target'],
			requiresDetailedConfirmation: true
		});
	});

	it('rejects a deletion intent for an entity outside the snapshot', () => {
		expectDomainError(
			() => planObservationDeletion(makeSnapshot(), 'missing'),
			'relation_not_found',
			'observationId'
		);
		expectDomainError(
			() => planCourseDeletion(makeSnapshot(), 'missing'),
			'relation_not_found',
			'courseId'
		);
	});
});

describe('TeacherFlow monotonic editing', () => {
	it('moves an observation timestamp forward when the clock has not advanced', () => {
		const observation = makeSnapshot().observations[0]!;
		const updated = updateObservation(
			observation,
			{
				workspaceId: observation.workspaceId,
				sessionId: observation.sessionId,
				signal: observation.signal,
				note: observation.note
			},
			() => new Date(observation.updatedAt)
		);
		expect(updated.updatedAt).toBe('2026-08-15T07:00:00.001Z');
	});
});

describe('TeacherFlow selectors', () => {
	it('selects the next planned dated session and its actionable decision queues', () => {
		const snapshot = makeSnapshot();
		const result = selectToday(snapshot, new Date(NOW));

		expect(result.nextSession?.id).toBe('session-next');
		expect(result.unscheduledDecisions.map(({ id }) => id)).toEqual(['decision-unscheduled']);
		expect(result.sessionDecisions.map(({ id }) => id)).toEqual(['decision-targeted']);
	});

	it('uses ids as deterministic tie-breakers and excludes applied decisions', () => {
		const snapshot = makeSnapshot();
		const tiedSession: Session = {
			...snapshot.sessions.find(({ id }) => id === 'session-next')!,
			id: 'session-a'
		};
		const applied: Decision = {
			...snapshot.decisions[1],
			id: 'decision-applied',
			status: 'applied',
			appliedAt: snapshot.decisions[1].updatedAt
		};
		const result = selectToday(
			{
				...snapshot,
				sessions: [...snapshot.sessions, tiedSession],
				decisions: [...snapshot.decisions, applied]
			},
			new Date(NOW)
		);

		expect(result.nextSession?.id).toBe('session-a');
		expect(result.unscheduledDecisions.map(({ id }) => id)).not.toContain('decision-applied');
	});

	it('filters memory by course, signal and decision status in newest-observation order', () => {
		const snapshot = makeSnapshot();

		expect(selectMemory(snapshot, {}).map(({ observation }) => observation.id)).toEqual([
			'observation-new',
			'observation-old'
		]);
		expect(
			selectMemory(snapshot, { courseId: 'course-maths' }).map(({ observation }) => observation.id)
		).toEqual(['observation-old']);
		expect(
			selectMemory(snapshot, { signal: 'verify' }).map(({ observation }) => observation.id)
		).toEqual(['observation-new']);
		expect(
			selectMemory(snapshot, { decisionStatus: 'ready' }).map(({ observation }) => observation.id)
		).toEqual(['observation-old']);
	});

	it('never mutates snapshot arrays while selecting deterministic derived views', () => {
		const snapshot = makeSnapshot();
		const before = structuredClone(snapshot);

		selectToday(snapshot, new Date(NOW));
		selectMemory(snapshot, {});

		expect(snapshot).toEqual(before);
	});

	it('rejects invalid selector dates through the same discriminated domain contract', () => {
		expectDomainError(
			() => selectToday(makeSnapshot(), new Date('invalid')),
			'invalid_date',
			'now'
		);
	});

	it('rejects a non-canonical snapshot instead of deriving views from mismatched keys', () => {
		const snapshot = makeSnapshot();
		const invalid: WorkspaceSnapshot = {
			...snapshot,
			sessions: snapshot.sessions.map((session) =>
				session.id === 'session-next' ? { ...session, id: ' session-next ' } : session
			)
		};

		expectDomainError(() => selectToday(invalid, new Date(NOW)), 'non_canonical', 'id');
		expectDomainError(() => selectMemory(invalid, {}), 'non_canonical', 'id');
	});

	it('uses ordinal id tie-breakers that are independent from the host locale', () => {
		const snapshot = makeSnapshot();
		const next = snapshot.sessions.find(({ id }) => id === 'session-next')!;
		const sessions = snapshot.sessions.filter(({ id }) => id !== 'session-next');
		const result = selectToday(
			{
				...snapshot,
				sessions: [...sessions, { ...next, id: 'é' }, { ...next, id: 'z' }],
				decisions: snapshot.decisions.map((decision) =>
					decision.targetSessionId === 'session-next'
						? { ...decision, targetSessionId: 'z' }
						: decision
				)
			},
			new Date(NOW)
		);

		expect(result.nextSession?.id).toBe('z');
	});
});
