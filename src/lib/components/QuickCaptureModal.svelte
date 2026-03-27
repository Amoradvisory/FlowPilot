<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import { flowpilot, shellState } from '$lib/flowpilot';

	const submit = async () => {
		if (!$shellState.quickCaptureText.trim()) return;
		await flowpilot.createInboxItem($shellState.quickCaptureText);
	};

	const onKeyDown = async (event: KeyboardEvent) => {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			await submit();
		}
	};
</script>

{#if $shellState.quickCaptureOpen}
	<div class="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm md:items-center">
		<button
			class="absolute inset-0"
			type="button"
			aria-label="Fermer"
			onclick={() => flowpilot.closeQuickCapture()}
		></button>

		<Card class="relative z-10 w-full max-w-xl" tone="active">
			<div class="mb-4 flex items-start justify-between gap-4">
				<div>
					<p class="text-xs uppercase tracking-[0.2em] text-[#3399FF]">Inbox</p>
					<h2 class="text-xl font-semibold text-white">Capture rapide</h2>
				</div>
				<button
					class="rounded-full border border-white/10 px-3 py-1 text-sm text-zinc-300 transition hover:border-white/20 hover:text-white"
					type="button"
					onclick={() => flowpilot.closeQuickCapture()}
				>
					Fermer
				</button>
			</div>

			<label class="mb-2 block text-sm text-zinc-400" for="quick-capture-input">
				Entree pour enregistrer. Shift+Entree pour sauter une ligne.
			</label>
			<textarea
				id="quick-capture-input"
				class="min-h-32 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-500 focus:border-[#3399FF]/50 focus:ring-1 focus:ring-[#3399FF]/30"
				placeholder="Ex: demain 14h appel urgent #admin"
				bind:value={$shellState.quickCaptureText}
				onkeydown={onKeyDown}
			></textarea>

			<div class="mt-4 flex flex-wrap items-center justify-between gap-3">
				<p class="text-sm text-zinc-500">Parsing auto: date, priorite, tags, projet.</p>
				<button
					class="rounded-2xl bg-[#3399FF] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#4aa5ff]"
					type="button"
					onclick={submit}
				>
					Ajouter a l inbox
				</button>
			</div>
		</Card>
	</div>
{/if}
