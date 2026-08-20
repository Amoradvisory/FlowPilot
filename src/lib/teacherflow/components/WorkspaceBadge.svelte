<script lang="ts">
	import { getTeacherFlowState } from '$lib/teacherflow/state/context';
	import { DEMO_WORKSPACE_ID, PERSONAL_WORKSPACE_ID } from '$lib/teacherflow/demo/seed';

	const teacherFlow = getTeacherFlowState();
	let switching = $state(false);

	async function switchTo(workspaceId: typeof DEMO_WORKSPACE_ID | typeof PERSONAL_WORKSPACE_ID) {
		if (teacherFlow.workspaceId === workspaceId || switching) return;
		switching = true;
		await teacherFlow.switchWorkspace(workspaceId);
		switching = false;
	}
</script>

<div class="workspace-switcher" aria-label="Espace de travail">
	<span class="workspace-badge">
		{teacherFlow.workspaceId === DEMO_WORKSPACE_ID
			? 'Données de démonstration'
			: 'Espace personnel'}
	</span>
	<div class="workspace-actions">
		<button
			type="button"
			class:active={teacherFlow.workspaceId === DEMO_WORKSPACE_ID}
			disabled={switching}
			onclick={() => switchTo(DEMO_WORKSPACE_ID)}>Explorer la démonstration</button
		>
		<button
			type="button"
			class:active={teacherFlow.workspaceId === PERSONAL_WORKSPACE_ID}
			disabled={switching}
			onclick={() => switchTo(PERSONAL_WORKSPACE_ID)}>Commencer à vide</button
		>
	</div>
</div>
