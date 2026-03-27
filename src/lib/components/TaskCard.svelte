<script lang="ts">
	import type { Task } from '$lib/types';
	import { formatMinutes } from '$lib/utils';

	let {
		task,
		projectTitle = null,
		selected = false,
		onSelect = () => undefined,
		onDone = () => undefined,
		onPostpone = () => undefined
	}: {
		task: Task;
		projectTitle?: string | null;
		selected?: boolean;
		onSelect?: () => void;
		onDone?: () => void;
		onPostpone?: () => void;
	} = $props();

	let dragX = $state(0);
	let startX = 0;
	let active = false;

	const priorityTone = {
		critical: 'border-red-500/30',
		important: 'border-amber-400/30',
		normal: 'border-white/10',
		low: 'border-zinc-700'
	};

	const start = (event: PointerEvent) => {
		startX = event.clientX;
		active = true;
	};

	const move = (event: PointerEvent) => {
		if (!active) return;
		dragX = Math.max(-120, Math.min(120, event.clientX - startX));
	};

	const stop = () => {
		if (dragX > 80) {
			onDone();
		}

		if (dragX < -80) {
			onPostpone();
		}

		active = false;
		dragX = 0;
	};
</script>

<button
	class={`relative w-full overflow-hidden rounded-3xl border bg-[#111] text-left transition ${selected ? 'border-[#3399FF]/40 shadow-[0_0_18px_rgba(51,153,255,0.12)]' : priorityTone[task.priority]}`}
	style={`transform: translateX(${dragX}px);`}
	type="button"
	onclick={onSelect}
	onpointerdown={start}
	onpointermove={move}
	onpointerup={stop}
	onpointercancel={stop}
>
	<div class="flex items-start justify-between gap-4 px-4 py-4">
		<div class="space-y-2">
			<div class="flex flex-wrap items-center gap-2">
				<span class="text-sm font-medium text-white">{task.title}</span>
				{#if task.status === 'done'}
					<span class="rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] uppercase tracking-wide text-green-400">
						Done
					</span>
				{/if}
				{#if task.deadline}
					<span class="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-red-300">
						Deadline
					</span>
				{/if}
			</div>

			<div class="flex flex-wrap gap-2 text-xs text-zinc-400">
				<span>{task.priority}</span>
				{#if task.estimated_duration}
					<span>{formatMinutes(task.estimated_duration)}</span>
				{/if}
				{#if task.energy}
					<span>{task.energy}</span>
				{/if}
				{#if task.context}
					<span>{task.context}</span>
				{/if}
				{#if projectTitle}
					<span>{projectTitle}</span>
				{/if}
				{#if task.scheduled_date}
					<span>{task.scheduled_date}</span>
				{/if}
			</div>
		</div>

		<div class="text-right text-xs text-zinc-500">
			<p>{task.total_focus_minutes} min focus</p>
			{#if task.scheduled_time_start}
				<p>{task.scheduled_time_start}{task.scheduled_time_end ? ` - ${task.scheduled_time_end}` : ''}</p>
			{/if}
		</div>
	</div>
</button>
