import assert from 'node:assert/strict';
import test from 'node:test';
import {
	addObservation,
	createObservation,
	restoreObservations,
	type DemoObservation,
	type ObservationSignal
} from './teacherflow-demo.ts';

const capturedAt = '2026-08-11T14:30:00.000Z';

test('refuse une capture qui ne contient que des espaces', () => {
	assert.throws(
		() => createObservation({ id: 'obs-empty', signal: 'blocked', note: ' \n\t ', capturedAt }),
		/observation/i
	);
});

test('normalise une observation et dérive une amélioration exploitable', () => {
	assert.deepEqual(
		createObservation({
			id: 'obs-1',
			signal: 'blocked',
			note: '  La consigne   mélange deux opérations.  ',
			capturedAt
		}),
		{
			id: 'obs-1',
			signal: 'blocked',
			note: 'La consigne mélange deux opérations.',
			capturedAt,
			nextAction: 'Clarifier la consigne : La consigne mélange deux opérations.'
		}
	);
});

test('associe chaque signal à une prochaine action différente', () => {
	const fixtures: Array<[ObservationSignal, string]> = [
		['worked', 'Capitaliser : Le schéma a déclenché les bonnes questions.'],
		['blocked', 'Clarifier la consigne : Le schéma a déclenché les bonnes questions.'],
		['try', 'Tester au prochain cours : Le schéma a déclenché les bonnes questions.']
	];

	for (const [signal, expected] of fixtures) {
		assert.equal(
			createObservation({
				id: `obs-${signal}`,
				signal,
				note: 'Le schéma a déclenché les bonnes questions.',
				capturedAt
			}).nextAction,
			expected
		);
	}
});

test('place la capture la plus récente en tête et borne l’historique', () => {
	const history: DemoObservation[] = Array.from({ length: 6 }, (_, index) => ({
		id: `old-${index}`,
		signal: 'worked',
		note: `Observation ${index}`,
		capturedAt,
		nextAction: `Capitaliser : Observation ${index}`
	}));
	const latest = createObservation({
		id: 'latest',
		signal: 'try',
		note: 'Faire verbaliser la stratégie.',
		capturedAt
	});

	assert.deepEqual(
		addObservation(history, latest).map((observation) => observation.id),
		['latest', 'old-0', 'old-1', 'old-2', 'old-3', 'old-4']
	);
});

test('ignore un stockage malformed ou des entrées inconnues', () => {
	assert.deepEqual(restoreObservations('{pas du JSON'), []);
	assert.deepEqual(
		restoreObservations(
			JSON.stringify([
				{
					id: 'valid',
					signal: 'worked',
					note: '  Exemple   utile. ',
					capturedAt
				},
				{ id: 'foreign', signal: 'unknown', note: 'À ignorer', capturedAt }
			])
		),
		[
			{
				id: 'valid',
				signal: 'worked',
				note: 'Exemple utile.',
				capturedAt,
				nextAction: 'Capitaliser : Exemple utile.'
			}
		]
	);
});
