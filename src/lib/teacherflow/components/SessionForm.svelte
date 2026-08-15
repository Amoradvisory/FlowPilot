<script lang="ts">
	import type { Course, Session, SessionStatus } from '$lib/teacherflow/domain/types';
	import { getTeacherFlowState } from '$lib/teacherflow/state/context';
	import StatusMessage from './StatusMessage.svelte';

	let { courses, current }: { courses: readonly Course[]; current?: Session } = $props();
	const teacherFlow = getTeacherFlowState();
	const localDate = (iso: string | undefined) => (iso ? iso.slice(0, 16) : '');
	let courseId = $state('');
	let title = $state('');
	let scheduledFor = $state('');
	let status = $state<SessionStatus>('planned');
	let busy = $state(false);
	let localStatus = $state<{ kind: 'success' | 'error'; message: string }>();

	$effect(() => {
		courseId = current?.courseId ?? courses[0]?.id ?? '';
		title = current?.title ?? '';
		scheduledFor = localDate(current?.scheduledFor);
		status = current?.status ?? 'planned';
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		localStatus = undefined;
		await teacherFlow.saveSession(
			{
				workspaceId: teacherFlow.workspaceId,
				courseId,
				title,
				...(scheduledFor ? { scheduledFor: new Date(scheduledFor).toISOString() } : {}),
				status
			},
			current
		);
		busy = false;
		localStatus = teacherFlow.status ?? undefined;
	}
</script>

<form class="entity-form" onsubmit={submit} aria-labelledby="session-form-title">
	<div class="form-heading">
		<div>
			<p class="card-kicker">{current ? 'Ajuster la séance' : 'Deuxième étape'}</p>
			<h2 id="session-form-title">{current ? 'Votre première séance' : 'Créer une séance'}</h2>
		</div>
	</div>
	<label>
		<span>Cours</span>
		<select bind:value={courseId} required>
			{#each courses as course}
				<option value={course.id}>{course.name}</option>
			{/each}
		</select>
	</label>
	<label>
		<span>Titre de la séance</span>
		<input bind:value={title} maxlength="120" required autocomplete="off" />
	</label>
	<label>
		<span>Date et heure (facultatif)</span>
		<input bind:value={scheduledFor} type="datetime-local" />
	</label>
	<label>
		<span>Statut</span>
		<select bind:value={status}>
			<option value="planned">Planifiée</option>
			<option value="taught">Enseignée</option>
			<option value="completed">Terminée</option>
		</select>
	</label>
	<button class="button button--primary" type="submit" disabled={busy}>
		{current ? 'Enregistrer la séance' : 'Créer la séance'}
	</button>
	<StatusMessage kind={localStatus?.kind ?? 'info'} message={localStatus?.message} />
</form>
