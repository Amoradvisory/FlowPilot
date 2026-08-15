import { describe, expect, it } from 'vitest';
import { validateWorkspaceSnapshot } from '../../../src/lib/teacherflow/domain/invariants';
import {
	DEMO_WORKSPACE_ID,
	PERSONAL_WORKSPACE_ID,
	createDemoSeed
} from '../../../src/lib/teacherflow/demo/seed';

const clock = () => new Date('2026-08-15T09:00:00.000Z');

describe('TeacherFlow demo seed', () => {
	it('is deterministic, fictitious, and forms one complete future learning loop', () => {
		const first = createDemoSeed(clock);
		const second = createDemoSeed(clock);

		expect(first).toEqual(second);
		expect(first.workspaceId).toBe(DEMO_WORKSPACE_ID);
		expect(PERSONAL_WORKSPACE_ID).not.toBe(DEMO_WORKSPACE_ID);
		expect(validateWorkspaceSnapshot(first)).toBe(first);
		expect(first.courses.map((course) => course.id)).toEqual(['demo-course-algebra']);
		expect(first.sessions.map((session) => session.id)).toEqual([
			'demo-session-representations',
			'demo-session-next-strategy'
		]);

		const observation = first.observations[0]!;
		const decision = first.decisions[0]!;
		const futureSession = first.sessions.find((session) => session.id === decision.targetSessionId);
		expect(decision.observationId).toBe(observation.id);
		expect(futureSession?.scheduledFor).toBeDefined();
		expect(Date.parse(futureSession!.scheduledFor!)).toBeGreaterThan(
			Date.parse(observation.createdAt)
		);

		const content = JSON.stringify(first).toLocaleLowerCase('fr-FR');
		expect(content).not.toMatch(/\b(élève|eleve|collège|college|lycée|lycee|école|ecole)\b/u);
		expect(content).not.toMatch(/\b(marie|paul|lucas|emma|dupont)\b/u);
	});

	it('reads its clock once, so a progressive clock cannot split one snapshot across instants', () => {
		let calls = 0;
		const progressiveClock = () => new Date(`2026-08-15T09:00:0${calls++}.000Z`);

		const seed = createDemoSeed(progressiveClock);

		expect(calls).toBe(1);
		expect(seed.observations.map((observation) => observation.id)).toEqual([
			'demo-observation-representations'
		]);
		expect(seed.decisions.map((decision) => decision.id)).toEqual(['demo-decision-common-example']);
		expect(seed.courses[0]?.updatedAt).toBe('2026-08-15T09:00:00.000Z');
	});
});
