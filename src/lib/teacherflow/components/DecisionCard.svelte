<script lang="ts">
	import type { Decision, Session } from '$lib/teacherflow/domain/types';

	let { decision, target }: { decision: Decision; target?: Session } = $props();
</script>

<article class="decision-card">
	<span class="decision-status">
		{decision.status === 'to_prepare'
			? 'À préparer'
			: decision.status === 'ready'
				? 'Prête'
				: 'Appliquée'}
	</span>
	<p>{decision.text}</p>
	{#if target}<small>Pour · {target.title}</small>{:else}<small>À planifier</small>{/if}
</article>
