<script lang="ts">
	import { tick } from 'svelte';
	import { base } from '$app/paths';
	import type { ObservationSignal } from '$lib/teacherflow/domain/types';
	import { getTeacherFlowState } from '$lib/teacherflow/state/context';
	import StatusMessage from './StatusMessage.svelte';

	const teacherFlow = getTeacherFlowState();
	const courses = $derived(teacherFlow.snapshot.courses.filter((course) => !course.archivedAt));
	let selectedCourseId = $state(
		teacherFlow.snapshot.courses.find((course) => !course.archivedAt)?.id ?? ''
	);
	const sessions = $derived(
		teacherFlow.snapshot.sessions.filter((session) => session.courseId === selectedCourseId)
	);
	const targetSessions = $derived(
		sessions.filter((session) => session.status === 'planned' && session.scheduledFor)
	);
	let sessionId = $state(
		teacherFlow.snapshot.sessions.find(
			(session) => session.courseId === selectedCourseId && session.status === 'taught'
		)?.id ??
			teacherFlow.snapshot.sessions.find((session) => session.courseId === selectedCourseId)?.id ??
			''
	);
	let signal = $state<ObservationSignal | ''>('');
	let note = $state('');
	let decision = $state('');
	let targetSessionId = $state('');
	let busy = $state(false);
	let savedDecision = $state('');
	let localStatus = $state<{ kind: 'success' | 'error'; message: string }>();
	let savedSummary = $state<HTMLDivElement>();

	function selectCourse(event: Event) {
		selectedCourseId = (event.currentTarget as HTMLSelectElement).value;
		const first = teacherFlow.snapshot.sessions.find(
			(session) => session.courseId === selectedCourseId
		);
		sessionId = first?.id ?? '';
		targetSessionId = '';
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!signal) return;
		busy = true;
		localStatus = undefined;
		savedDecision = '';
		await teacherFlow.saveObservationFlow({
			observation: {
				workspaceId: teacherFlow.workspaceId,
				sessionId,
				signal,
				note
			},
			decision: {
				text: decision,
				...(targetSessionId ? { targetSessionId } : {})
			}
		});
		busy = false;
		localStatus = teacherFlow.status ?? undefined;
		if (teacherFlow.status?.kind === 'success') {
			savedDecision = decision.trim().replace(/\s+/gu, ' ');
			await tick();
			savedSummary?.focus();
		}
	}
</script>

{#if courses.length === 0 || teacherFlow.snapshot.sessions.length === 0}
	<section class="empty-state">
		<p class="card-kicker">Contexte requis</p>
		<h2>Créez d’abord un cours et une séance.</h2>
		<a class="button button--primary" href={`${base}/teacher/`}>Revenir à Aujourd’hui</a>
	</section>
{:else}
	<form class="observation-form" data-testid="observe-form" onsubmit={submit}>
		<fieldset class="context-grid">
			<legend>Contexte de l’observation</legend>
			<label>
				<span>Cours</span>
				<select value={selectedCourseId} onchange={selectCourse} required>
					{#each courses as course}<option value={course.id}>{course.name}</option>{/each}
				</select>
			</label>
			<label>
				<span>Séance observée</span>
				<select bind:value={sessionId} required>
					{#each sessions as session}<option value={session.id}>{session.title}</option>{/each}
				</select>
			</label>
		</fieldset>

		<fieldset class="signal-fieldset">
			<legend>Quel signal voulez-vous garder ?</legend>
			<div class="signal-options">
				{#each [['keep', 'À conserver'], ['adjust', 'À ajuster'], ['verify', 'À vérifier']] as option}
					<label class:checked={signal === option[0]}>
						<input
							type="radio"
							name="signal"
							value={option[0]}
							bind:group={signal}
							aria-label={`Signal : ${option[1]}`}
							required
						/>
						<span>{option[1]}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<label>
			<span>Observation</span>
			<textarea
				bind:value={note}
				maxlength="600"
				rows="4"
				required
				aria-describedby="student-data-warning"
				placeholder="Décrivez un fait pédagogique observable, sans identifier de personne."
			></textarea>
		</label>
		<p id="student-data-warning" class="field-warning">
			Ne saisissez ni nom d’élève ni information personnelle ou sensible.
		</p>

		<label>
			<span>Décision pédagogique</span>
			<textarea
				bind:value={decision}
				maxlength="300"
				rows="3"
				required
				aria-describedby="human-decision-note"
				placeholder="Formulez l’ajustement que vous choisissez de préparer."
			></textarea>
		</label>
		<p id="human-decision-note" class="field-help">
			Aucune IA ici : vous formulez, modifiez et validez vous-même la décision.
		</p>

		<label>
			<span>Séance cible (facultatif)</span>
			<select bind:value={targetSessionId}>
				<option value="">À planifier plus tard</option>
				{#each targetSessions as session}<option value={session.id}>{session.title}</option>{/each}
			</select>
		</label>

		<button class="button button--primary button--wide" type="submit" disabled={busy}>
			{busy ? 'Enregistrement…' : 'Enregistrer la décision'}
		</button>
		<StatusMessage kind={localStatus?.kind ?? 'info'} message={localStatus?.message} />
	</form>

	{#if savedDecision}
		<div
			class="saved-decision"
			data-testid="saved-decision"
			role="status"
			tabindex="-1"
			bind:this={savedSummary}
		>
			<p class="card-kicker">Décision enregistrée</p>
			<h2>Elle vous attendra au bon moment.</h2>
			<p>{savedDecision}</p>
			<a class="button button--primary" href={`${base}/teacher/`}>Revenir à Aujourd’hui</a>
		</div>
	{/if}
{/if}
