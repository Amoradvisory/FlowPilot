<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import HabitHeatmap from '$lib/components/HabitHeatmap.svelte';
	import { flowpilot, habitCompletions, habitProgress } from '$lib/flowpilot';
	import type { HabitFrequency } from '$lib/types';

	let title = $state('');
	let frequency = $state<HabitFrequency>('daily');
	let frequencyTarget = $state(7);

	const getDefaultTarget = (value: HabitFrequency) =>
		value === 'daily' ? 7 : value === 'weekly_3' ? 3 : value === 'weekly_5' ? 5 : 4;

	const setFrequency = (value: HabitFrequency) => {
		frequency = value;
		frequencyTarget = getDefaultTarget(value);
	};
</script>

<div class="space-y-4">
	<Card tone="active">
		<div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
			<div>
				<p class="text-xs uppercase tracking-[0.2em] text-[#3399FF]">Habitudes</p>
				<h1 class="mt-2 text-2xl font-semibold text-white">1 tap, streak, visuel</h1>
			</div>
			<form class="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]" onsubmit={(event) => { event.preventDefault(); if (title.trim()) { void flowpilot.createHabit(title, frequency, frequencyTarget); title = ''; setFrequency('daily'); } }}>
				<input class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" placeholder="Nouvelle habitude" bind:value={title} />
				<select class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" value={frequency} onchange={(event) => setFrequency((event.currentTarget as HTMLSelectElement).value as HabitFrequency)}>
					<option value="daily">daily</option>
					<option value="weekly_3">weekly_3</option>
					<option value="weekly_5">weekly_5</option>
					<option value="custom">custom</option>
				</select>
				<input class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" type="number" min="1" max="14" bind:value={frequencyTarget} />
				<button class="rounded-2xl bg-[#3399FF] px-4 py-3 text-sm font-medium text-white" type="submit">Ajouter</button>
			</form>
		</div>
	</Card>

	<div class="grid gap-4 lg:grid-cols-2">
		{#each $habitProgress as item}
			<Card>
				<div class="flex items-center justify-between gap-4">
					<div>
						<h2 class="text-xl font-semibold text-white">{item.habit.title}</h2>
						<p class="mt-2 text-sm text-zinc-400">streak {item.currentStreak} - meilleur {item.bestStreak}</p>
						<p class="mt-1 text-sm text-zinc-500">
							{item.habit.frequency} - {item.recentDone}/{item.targetWindow} sur 28 jours
						</p>
					</div>
					<div class="flex flex-col gap-2">
						<button
							class={`rounded-2xl px-4 py-3 text-sm font-medium ${item.todayDone ? 'bg-green-500/15 text-green-300' : 'border border-white/10 text-white'}`}
							type="button"
							onclick={() => flowpilot.toggleHabitCompletion(item.habit.id)}
						>
							{item.todayDone ? 'Fait aujourd hui' : 'Valider'}
						</button>
						<button class="rounded-2xl border border-red-500/20 px-4 py-2 text-sm text-red-300" type="button" onclick={() => flowpilot.deleteHabit(item.habit.id)}>
							Archiver
						</button>
					</div>
				</div>

				<div class="mt-4 h-2 rounded-full bg-white/6">
					<div class="h-2 rounded-full bg-[#3399FF]" style={`width: ${Math.min(100, item.completionRate)}%`}></div>
				</div>

				<div class="mt-4 grid gap-3 md:grid-cols-2">
					<select class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" value={item.habit.frequency} onchange={(event) => { const nextFrequency = (event.currentTarget as HTMLSelectElement).value as HabitFrequency; void flowpilot.updateHabit(item.habit.id, { frequency: nextFrequency, frequency_target: nextFrequency === 'daily' ? 7 : nextFrequency === 'weekly_3' ? 3 : nextFrequency === 'weekly_5' ? 5 : item.habit.frequency_target }); }}>
						<option value="daily">daily</option>
						<option value="weekly_3">weekly_3</option>
						<option value="weekly_5">weekly_5</option>
						<option value="custom">custom</option>
					</select>
					<input class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" type="number" min="1" max="14" value={item.habit.frequency_target} onchange={(event) => flowpilot.updateHabit(item.habit.id, { frequency_target: Number((event.currentTarget as HTMLInputElement).value) || 1 })} />
				</div>

				<div class="mt-4">
					<HabitHeatmap habitId={item.habit.id} completions={$habitCompletions} />
				</div>
			</Card>
		{/each}
	</div>
</div>
