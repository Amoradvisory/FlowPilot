<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { flowpilot } from '$lib/flowpilot';

	onMount(() => {
		const timer = window.setTimeout(() => {
			void flowpilot.init().then(() => goto('/'));
		}, 1200);

		return () => window.clearTimeout(timer);
	});
</script>

<div class="flex min-h-screen items-center justify-center text-sm text-zinc-400">
	Finalisation de la connexion...
</div>
