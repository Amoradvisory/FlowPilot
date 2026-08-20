<script lang="ts">
	import ConfirmDialog from './ConfirmDialog.svelte';
	import type { Course, Session, SessionStatus } from '$lib/teacherflow/domain/types';
	import { planSessionDeletion } from '$lib/teacherflow/domain/commands';
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
	let deleteOpen = $state(false);
	let deleteTrigger = $state<HTMLButtonElement>();
	let deletionCounts = $state({ observations: 0, decisions: 0, cleared: 0 });
	const titleId = $derived(
		current
			? `session-form-title-${current.id}`
			: `session-form-title-new-${courses[0]?.id ?? 'unassigned'}`
	);
	const count = (value: number, singular: string, plural: string) =>
		`${value} ${value === 1 ? singular : plural}`;

	$effect(() => {
		courseId = current?.courseId ?? courses[0]?.id ?? '';
		title = current?.title ?? '';
		scheduledFor = localDate(current?.scheduledFor);
		status = current?.status ?? 'planned';
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (busy) return;
		busy = true;
		localStatus = undefined;
		try {
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
			localStatus = teacherFlow.status ?? undefined;
		} finally {
			busy = false;
		}
	}

	function requestRemove() {
		if (!current || busy) return;
		const intent = planSessionDeletion(teacherFlow.snapshot, current.id);
		deletionCounts = {
			observations: intent.delete.observationIds.length,
			decisions: intent.delete.decisionIds.length,
			cleared: intent.clearDecisionTargetIds.length
		};
		deleteOpen = true;
	}

	async function confirmRemove() {
		if (!current || busy) return;
		busy = true;
		try {
			await teacherFlow.deleteSession(current.id);
			deleteOpen = false;
		} finally {
			busy = false;
		}
	}
</script>

<form class="entity-form" onsubmit={submit} aria-labelledby={titleId}>
	<div class="form-heading">
		<div>
			<p class="card-kicker">{current ? 'Ajuster la séance' : 'Deuxième étape'}</p>
			<h2 id={titleId}>{current ? 'Votre première séance' : 'Créer une séance'}</h2>
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
	{#if current}<button
			bind:this={deleteTrigger}
			class="button button--quiet"
			type="button"
			disabled={busy}
			onclick={requestRemove}>Supprimer cette séance</button
		>{/if}
	<StatusMessage kind={localStatus?.kind ?? 'info'} message={localStatus?.message} />
</form>

{#if current}
	<ConfirmDialog
		id={`session-delete-${current.id}`}
		open={deleteOpen}
		title={`Supprimer « ${current.title} » ?`}
		description={`${count(deletionCounts.observations, 'observation', 'observations')} et ${count(deletionCounts.decisions, 'décision liée', 'décisions liées')} seront supprimées définitivement.${deletionCounts.cleared ? ` ${count(deletionCounts.cleared, 'autre décision', 'autres décisions')} ${deletionCounts.cleared === 1 ? 'perdra sa' : 'perdront leur'} séance cible.` : ''}`}
		confirmLabel="Supprimer cette séance"
		danger={true}
		{busy}
		returnFocus={deleteTrigger}
		onconfirm={confirmRemove}
		oncancel={() => (deleteOpen = false)}
	/>
{/if}
