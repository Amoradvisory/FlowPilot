<script lang="ts">
	import ConfirmDialog from './ConfirmDialog.svelte';
	import type { Course } from '$lib/teacherflow/domain/types';
	import { planCourseDeletion } from '$lib/teacherflow/domain/commands';
	import { getTeacherFlowState } from '$lib/teacherflow/state/context';
	import StatusMessage from './StatusMessage.svelte';

	let { current }: { current?: Course } = $props();
	const teacherFlow = getTeacherFlowState();
	let name = $state('');
	let subject = $state('');
	let colorToken = $state('moss');
	let busy = $state(false);
	let localStatus = $state<{ kind: 'success' | 'error'; message: string }>();
	let archiveOpen = $state(false);
	let deleteOpen = $state(false);
	let archiveTrigger = $state<HTMLButtonElement>();
	let deleteTrigger = $state<HTMLButtonElement>();
	let deletionCounts = $state({ sessions: 0, observations: 0, decisions: 0, cleared: 0 });
	const titleId = $derived(current ? `course-form-title-${current.id}` : 'course-form-title-new');
	const count = (value: number, singular: string, plural: string) =>
		`${value} ${value === 1 ? singular : plural}`;

	$effect(() => {
		name = current?.name ?? '';
		subject = current?.subject ?? '';
		colorToken = current?.colorToken ?? 'moss';
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (busy) return;
		busy = true;
		localStatus = undefined;
		try {
			await teacherFlow.saveCourse(
				{ workspaceId: teacherFlow.workspaceId, name, subject, colorToken },
				current
			);
			localStatus = teacherFlow.status ?? undefined;
		} finally {
			busy = false;
		}
	}

	function requestArchive() {
		if (!current || busy) return;
		archiveOpen = true;
	}

	async function confirmArchive() {
		if (!current || busy) return;
		busy = true;
		localStatus = undefined;
		try {
			await teacherFlow.archiveCourse(current);
			localStatus = teacherFlow.status ?? undefined;
			archiveOpen = false;
		} finally {
			busy = false;
		}
	}

	function requestRemove() {
		if (!current || busy) return;
		const intent = planCourseDeletion(teacherFlow.snapshot, current.id);
		deletionCounts = {
			sessions: intent.delete.sessionIds.length,
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
			await teacherFlow.deleteCourse(current.id);
			deleteOpen = false;
		} finally {
			busy = false;
		}
	}
</script>

<form class="entity-form" onsubmit={submit} aria-labelledby={titleId}>
	<div class="form-heading">
		<div>
			<p class="card-kicker">{current ? 'Modifier le contexte' : 'Première étape'}</p>
			<h2 id={titleId}>{current ? 'Votre cours' : 'Créer un cours'}</h2>
		</div>
	</div>
	<label>
		<span>Nom du cours</span>
		<input bind:value={name} maxlength="80" required autocomplete="off" />
	</label>
	<label>
		<span>Matière (facultatif)</span>
		<input bind:value={subject} maxlength="80" autocomplete="off" />
	</label>
	<label>
		<span>Repère couleur</span>
		<select bind:value={colorToken}>
			<option value="moss">Vert mousse</option>
			<option value="clay">Terre cuite</option>
			<option value="indigo">Indigo</option>
		</select>
	</label>
	<div class="form-actions">
		<button class="button button--primary" type="submit" disabled={busy}>
			{current ? 'Enregistrer le cours' : 'Créer le cours'}
		</button>
		{#if current && !current.archivedAt}
			<button
				bind:this={archiveTrigger}
				class="button button--quiet"
				type="button"
				disabled={busy}
				onclick={requestArchive}
			>
				Archiver ce cours
			</button>
			<button
				bind:this={deleteTrigger}
				class="button button--quiet"
				type="button"
				disabled={busy}
				onclick={requestRemove}>Supprimer ce cours</button
			>
		{/if}
	</div>
	<StatusMessage kind={localStatus?.kind ?? 'info'} message={localStatus?.message} />
</form>

{#if current}
	<ConfirmDialog
		id={`course-archive-${current.id}`}
		open={archiveOpen}
		title={`Archiver « ${current.name} » ?`}
		description="Le cours disparaîtra des contextes actifs, mais toutes ses données resteront conservées."
		confirmLabel="Archiver ce cours"
		{busy}
		returnFocus={archiveTrigger}
		onconfirm={confirmArchive}
		oncancel={() => (archiveOpen = false)}
	/>
	<ConfirmDialog
		id={`course-delete-${current.id}`}
		open={deleteOpen}
		title={`Supprimer « ${current.name} » ?`}
		description={`${count(deletionCounts.sessions, 'séance', 'séances')}, ${count(deletionCounts.observations, 'observation', 'observations')} et ${count(deletionCounts.decisions, 'décision liée', 'décisions liées')} seront supprimées définitivement.${deletionCounts.cleared ? ` ${count(deletionCounts.cleared, 'autre décision', 'autres décisions')} ${deletionCounts.cleared === 1 ? 'perdra sa' : 'perdront leur'} séance cible.` : ''}`}
		confirmLabel="Supprimer ce cours"
		danger={true}
		{busy}
		returnFocus={deleteTrigger}
		onconfirm={confirmRemove}
		oncancel={() => (deleteOpen = false)}
	/>
{/if}
