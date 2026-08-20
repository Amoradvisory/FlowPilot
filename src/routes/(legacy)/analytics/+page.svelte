<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import { focusSessions, habitProgress, visibleTasks } from '$lib/flowpilot';
	import { formatMinutes } from '$lib/utils';

	let range = $state<7 | 30>(7);

	const timeline = $derived.by(() =>
		Array.from({ length: range }, (_, index) => {
			const date = new Date();
			date.setDate(date.getDate() - (range - index - 1));
			const day = date.toISOString().slice(0, 10);
			const focus = $focusSessions
				.filter((session) => session.started_at.slice(0, 10) === day)
				.reduce((sum, session) => sum + (session.duration_minutes ?? 0), 0);
			const done = $visibleTasks.filter((task) => task.status === 'done' && task.updated_at.slice(0, 10) === day).length;
			const planned = $visibleTasks.filter((task) => task.scheduled_date === day).length;
			return { day, focus, done, drift: planned ? Math.max(0, planned - done) : 0 };
		})
	);

	const totalFocus = $derived(timeline.reduce((sum, item) => sum + item.focus, 0));
	const totalDone = $derived(timeline.reduce((sum, item) => sum + item.done, 0));
	const totalDrift = $derived(timeline.reduce((sum, item) => sum + item.drift, 0));
	const maxFocus = $derived(Math.max(1, ...timeline.map((item) => item.focus)));
	const maxDone = $derived(Math.max(1, ...timeline.map((item) => item.done)));
	const maxDrift = $derived(Math.max(1, ...timeline.map((item) => item.drift)));
	const energyBreakdown = $derived(
		(['high', 'medium', 'low'] as const).map((energy) => {
			const tasks = $visibleTasks.filter((task) => task.energy === energy);
			const done = tasks.filter((task) => task.status === 'done').length;
			return {
				energy,
				total: tasks.length,
				done,
				rate: tasks.length ? Math.round((done / tasks.length) * 100) : 0
			};
		})
	);
</script>

<div class="space-y-4">
	<Card tone="active">
		<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<div>
				<p class="text-xs uppercase tracking-[0.2em] text-[#3399FF]">Analytics</p>
				<h1 class="mt-2 text-2xl font-semibold text-white">Graphiques simples</h1>
			</div>
			<div class="flex gap-2">
				<button class={`rounded-2xl px-4 py-2 text-sm ${range === 7 ? 'bg-white/10 text-white' : 'border border-white/10 text-zinc-400'}`} type="button" onclick={() => (range = 7)}>7 jours</button>
				<button class={`rounded-2xl px-4 py-2 text-sm ${range === 30 ? 'bg-white/10 text-white' : 'border border-white/10 text-zinc-400'}`} type="button" onclick={() => (range = 30)}>30 jours</button>
			</div>
		</div>
	</Card>

	<div class="grid gap-4 md:grid-cols-3">
		<Card>
			<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Focus</p>
			<p class="mt-2 text-2xl font-semibold text-white">{formatMinutes(totalFocus)}</p>
		</Card>
		<Card>
			<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Taches faites</p>
			<p class="mt-2 text-2xl font-semibold text-white">{totalDone}</p>
		</Card>
		<Card>
			<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Derive</p>
			<p class="mt-2 text-2xl font-semibold text-white">{totalDrift}</p>
		</Card>
	</div>

	<div class="grid gap-4 xl:grid-cols-3">
		<Card>
			<p class="text-sm font-medium text-white">Focus</p>
			<div class="mt-4 space-y-3">
				{#each timeline as item}
					<div>
						<div class="mb-1 flex justify-between text-xs text-zinc-400">
							<span>{item.day.slice(5)}</span>
							<span>{item.focus} min</span>
						</div>
						<div class="h-2 rounded-full bg-white/6">
							<div class="h-2 rounded-full bg-[#3399FF]" style={`width:${(item.focus / maxFocus) * 100}%`}></div>
						</div>
					</div>
				{/each}
			</div>
		</Card>

		<Card>
			<p class="text-sm font-medium text-white">Taches faites</p>
			<div class="mt-4 space-y-3">
				{#each timeline as item}
					<div>
						<div class="mb-1 flex justify-between text-xs text-zinc-400">
							<span>{item.day.slice(5)}</span>
							<span>{item.done}</span>
						</div>
						<div class="h-2 rounded-full bg-white/6">
							<div class="h-2 rounded-full bg-green-500" style={`width:${(item.done / maxDone) * 100}%`}></div>
						</div>
					</div>
				{/each}
			</div>
		</Card>

		<Card>
			<p class="text-sm font-medium text-white">Derive planning</p>
			<div class="mt-4 space-y-3">
				{#each timeline as item}
					<div>
						<div class="mb-1 flex justify-between text-xs text-zinc-400">
							<span>{item.day.slice(5)}</span>
							<span>{item.drift}</span>
						</div>
						<div class="h-2 rounded-full bg-white/6">
							<div class="h-2 rounded-full bg-red-500" style={`width:${(item.drift / maxDrift) * 100}%`}></div>
						</div>
					</div>
				{/each}
			</div>
		</Card>
	</div>

	<Card>
		<p class="text-sm font-medium text-white">Energie</p>
		<div class="mt-4 grid gap-3 md:grid-cols-3">
			{#each energyBreakdown as item}
				<div class="rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
					<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">{item.energy}</p>
					<p class="mt-2 text-xl font-semibold text-white">{item.total} tache(s)</p>
					<p class="mt-1 text-sm text-zinc-400">{item.done} faites - {item.rate}% completes</p>
				</div>
			{/each}
		</div>
	</Card>

	<Card>
		<p class="text-sm font-medium text-white">Habitudes</p>
		<div class="mt-4 grid gap-3 md:grid-cols-2">
			{#each $habitProgress as item}
				<div class="rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
					<p class="font-medium text-white">{item.habit.title}</p>
					<p class="mt-1 text-sm text-zinc-400">{item.completionRate}% sur les 28 derniers jours</p>
				</div>
			{/each}
		</div>
	</Card>
</div>
