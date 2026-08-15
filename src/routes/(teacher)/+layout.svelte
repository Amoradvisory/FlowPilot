<script lang="ts">
	import { onMount } from 'svelte';
	import AppShell from '$lib/teacherflow/components/AppShell.svelte';
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

<AppShell>{@render children()}</AppShell>
