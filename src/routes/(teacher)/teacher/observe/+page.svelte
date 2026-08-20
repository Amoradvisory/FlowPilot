<script lang="ts">
	import ObservationForm from '$lib/teacherflow/components/ObservationForm.svelte';
	import StatusMessage from '$lib/teacherflow/components/StatusMessage.svelte';
	import { getTeacherFlowState } from '$lib/teacherflow/state/context';

	const teacherFlow = getTeacherFlowState();
</script>

<svelte:head>
	<title>Observer · TeacherFlow</title>
	<meta
		name="description"
		content="Transformez une observation pédagogique non nominative en décision humaine, liée si vous le souhaitez à une séance future."
	/>
</svelte:head>

<div class="page-shell observe-page">
	<header class="page-intro">
		<p class="eyebrow">Observer · après le cours</p>
		<h1>Gardez le signal. Décidez de la suite.</h1>
		<p>
			Le contexte réduit la saisie ; votre jugement garde le dernier mot. Voilà une hiérarchie des
			pouvoirs plutôt saine.
		</p>
	</header>

	{#if teacherFlow.phase === 'loading'}
		<section class="loading-state" aria-live="polite"><p>Chargement du contexte local…</p></section>
	{:else if teacherFlow.phase === 'error' && teacherFlow.snapshot.sessions.length === 0}
		<StatusMessage kind="error" message={teacherFlow.status?.message} />
	{:else}
		<ObservationForm />
	{/if}
</div>
