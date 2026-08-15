<script lang="ts">
	import ConfirmDialog from '$lib/teacherflow/components/ConfirmDialog.svelte';
	import EmptyState from '$lib/teacherflow/components/EmptyState.svelte';
	import MemoryFilters from '$lib/teacherflow/components/MemoryFilters.svelte';
	import StatusMessage from '$lib/teacherflow/components/StatusMessage.svelte';
	import { getTeacherFlowState } from '$lib/teacherflow/state/context';
	import type {
		Decision,
		MemoryFilters as Filters,
		Observation
	} from '$lib/teacherflow/domain/types';

	const teacherFlow = getTeacherFlowState();
	let filters = $state<Filters>({});
	let editing = $state<Observation>();
	let note = $state('');
	let decisionText = $state('');
	let deleting = $state<Observation>();
	let chronology = $state<HTMLElement>();
	const entries = $derived(teacherFlow.memory(filters));

	function beginEdit(observation: Observation, decision?: Decision) {
		editing = observation;
		note = observation.note;
		decisionText = decision?.text ?? '';
	}

	async function saveEdit(decision?: Decision) {
		if (!editing) return;
		await teacherFlow.saveObservation(
			{
				workspaceId: teacherFlow.workspaceId,
				sessionId: editing.sessionId,
				signal: editing.signal,
				note
			},
			editing
		);
		if (decision && decisionText !== decision.text)
			await teacherFlow.editDecisionText(decision, decisionText);
		editing = undefined;
	}

	async function confirmDelete() {
		if (!deleting) return;
		await teacherFlow.deleteObservation(deleting.id);
		deleting = undefined;
		chronology?.focus();
	}
</script>

<svelte:head><title>Mémoire · TeacherFlow</title></svelte:head>

<div class="page-shell memory-page">
	<section class="page-intro">
		<p class="eyebrow">Mémoire</p>
		<h1>Retrouver le raisonnement, pas une pluie de post-it.</h1>
		<p>
			Les observations sont classées de la plus récente à la plus ancienne, avec leur contexte et
			leur décision.
		</p>
	</section>

	<MemoryFilters
		courses={teacherFlow.snapshot.courses}
		value={filters}
		onchange={(value) => (filters = value)}
	/>
	<StatusMessage kind={teacherFlow.status?.kind ?? 'info'} message={teacherFlow.status?.message} />

	{#if entries.length === 0}
		<EmptyState
			title="Aucune trace pour ce filtre"
			message="Ajoutez une observation ou élargissez les filtres pour retrouver votre chronologie."
		/>
	{:else}
		<section
			bind:this={chronology}
			class="memory-list"
			aria-label="Chronologie pédagogique"
			tabindex="-1"
		>
			{#each entries as entry (entry.decision?.id ?? entry.observation.id)}
				<article class="memory-entry">
					<p class="card-kicker">{entry.course.name} · {entry.session.title}</p>
					<h2>
						{entry.observation.signal === 'keep'
							? 'À conserver'
							: entry.observation.signal === 'adjust'
								? 'À ajuster'
								: 'À vérifier'}
					</h2>
					<p>{entry.observation.note}</p>
					{#if entry.decision}
						<p class="memory-decision">
							<strong>Décision · {entry.decision.status}</strong><br />{entry.decision.text}
						</p>
					{/if}
					<div class="form-actions">
						<button
							class="button button--quiet"
							type="button"
							onclick={() => beginEdit(entry.observation, entry.decision)}>Modifier</button
						>
						{#if entry.decision && entry.decision.status !== 'applied'}
							<button
								class="button button--secondary"
								type="button"
								onclick={() => teacherFlow.advanceDecision(entry.decision!)}
								>{entry.decision.status === 'to_prepare'
									? 'Marquer prête'
									: 'Marquer appliquée'}</button
							>
						{/if}
						<button
							class="button button--quiet"
							type="button"
							onclick={() => (deleting = entry.observation)}>Supprimer</button
						>
					</div>
					{#if editing?.id === entry.observation.id}
						<form
							class="memory-edit"
							onsubmit={(event) => {
								event.preventDefault();
								void saveEdit(entry.decision);
							}}
						>
							<label>Note <textarea bind:value={note} maxlength="600" required></textarea></label>
							{#if entry.decision}<label
									>Décision <textarea bind:value={decisionText} maxlength="300" required
									></textarea></label
								>{/if}
							<div class="form-actions">
								<button class="button button--primary" type="submit"
									>Enregistrer les modifications</button
								><button
									class="button button--quiet"
									type="button"
									onclick={() => (editing = undefined)}>Annuler</button
								>
							</div>
						</form>
					{/if}
				</article>
			{/each}
		</section>
	{/if}
</div>

<ConfirmDialog
	open={deleting !== undefined}
	title="Supprimer cette observation ?"
	description={deleting
		? `Cette observation${teacherFlow.snapshot.decisions.some((decision) => decision.observationId === deleting!.id) ? ' et sa décision liée' : ''} seront supprimées définitivement de cet appareil.`
		: ''}
	confirmLabel="Supprimer définitivement"
	danger={true}
	onconfirm={confirmDelete}
	oncancel={() => (deleting = undefined)}
/>
