<script lang="ts">
	import { onMount } from 'svelte';
	import { setTeacherFlowState } from '$lib/teacherflow/state/context';
	import { createTeacherFlowState } from '$lib/teacherflow/state/teacherflow-state.svelte';
	import '../teacherflow.css';

	let { children } = $props();
	const teacherFlow = createTeacherFlowState({
		clock: () => new Date(),
		network: () => navigator.onLine,
		repositoryFactory: async (workspaceId) => {
			const { openTeacherFlowRepository } = await import('$lib/teacherflow/data/repository');
			return openTeacherFlowRepository(workspaceId);
		}
	});
	setTeacherFlowState(teacherFlow);

	onMount(() => {
		void teacherFlow.hydrate();
	});
</script>

<div class="teacherflow-app">
	<header>
		<p>TeacherFlow · démonstrateur local</p>
	</header>
	<main>
		<h1>Transformer une observation en prochaine décision</h1>
		<p>
			Cette démonstration fictive montre une boucle observation, décision, puis préparation d’une
			séance future. Les données restent dans ce navigateur.
		</p>
		{@render children()}
	</main>
</div>
