<script lang="ts">
	import type { Course } from '$lib/teacherflow/domain/types';
	import { getTeacherFlowState } from '$lib/teacherflow/state/context';
	import StatusMessage from './StatusMessage.svelte';

	let { current }: { current?: Course } = $props();
	const teacherFlow = getTeacherFlowState();
	let name = $state('');
	let subject = $state('');
	let colorToken = $state('moss');
	let busy = $state(false);
	let localStatus = $state<{ kind: 'success' | 'error'; message: string }>();

	$effect(() => {
		name = current?.name ?? '';
		subject = current?.subject ?? '';
		colorToken = current?.colorToken ?? 'moss';
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		localStatus = undefined;
		await teacherFlow.saveCourse(
			{ workspaceId: teacherFlow.workspaceId, name, subject, colorToken },
			current
		);
		busy = false;
		localStatus = teacherFlow.status ?? undefined;
	}

	async function archive() {
		if (!current || !window.confirm(`Archiver « ${current.name} » ?`)) return;
		busy = true;
		localStatus = undefined;
		await teacherFlow.archiveCourse(current);
		busy = false;
		localStatus = teacherFlow.status ?? undefined;
	}
</script>

<form class="entity-form" onsubmit={submit} aria-labelledby="course-form-title">
	<div class="form-heading">
		<div>
			<p class="card-kicker">{current ? 'Modifier le contexte' : 'Première étape'}</p>
			<h2 id="course-form-title">{current ? 'Votre cours' : 'Créer un cours'}</h2>
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
			<button class="button button--quiet" type="button" disabled={busy} onclick={archive}>
				Archiver ce cours
			</button>
		{/if}
	</div>
	<StatusMessage kind={localStatus?.kind ?? 'info'} message={localStatus?.message} />
</form>
