<script lang="ts">
	import type { HabitCompletion } from '$lib/types';

	let {
		habitId,
		completions
	}: {
		habitId: string;
		completions: HabitCompletion[];
	} = $props();

	const cells = $derived(
		Array.from({ length: 28 }, (_, index) => {
			const date = new Date();
			date.setDate(date.getDate() - (27 - index));
			const day = date.toISOString().slice(0, 10);
			const done = completions.some((item) => item.habit_id === habitId && item.completed_date === day);
			return { day, done };
		})
	);
</script>

<div class="grid grid-cols-7 gap-1">
	{#each cells as cell}
		<div
			class={`h-4 rounded-sm ${cell.done ? 'bg-[#3399FF]' : 'bg-white/6'}`}
			title={cell.day}
		></div>
	{/each}
</div>
