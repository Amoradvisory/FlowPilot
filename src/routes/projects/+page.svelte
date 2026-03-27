	<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import { activeProjects, flowpilot, notes, projectProgress, tasks } from '$lib/flowpilot';

	let title = $state('');
	let description = $state('');
	let deadline = $state('');
	let taskDrafts = $state<Record<string, string>>({});
	let noteDrafts = $state<Record<string, string>>({});
	let standaloneNote = $state('');

	const activeCount = $derived($projectProgress.filter((item) => item.project.status === 'active').length);
	const stagnantCount = $derived($projectProgress.filter((item) => item.isStagnant).length);
	const doneCount = $derived($projectProgress.filter((item) => item.project.status === 'done').length);

	const setTaskDraft = (projectId: string, value: string) => {
		taskDrafts = { ...taskDrafts, [projectId]: value };
	};

	const setNoteDraft = (projectId: string, value: string) => {
		noteDrafts = { ...noteDrafts, [projectId]: value };
	};

	const submitProjectTask = async (projectId: string) => {
		const value = taskDrafts[projectId]?.trim();
		if (!value) return;
		await flowpilot.createTask({ title: value, project_id: projectId });
		setTaskDraft(projectId, '');
	};

	const noteTitle = (value: string) => value.trim().split('\n')[0].slice(0, 60) || 'Nouvelle note';

	const submitProjectNote = async (projectId: string) => {
		const value = noteDrafts[projectId]?.trim();
		if (!value) return;
		await flowpilot.createNote({
			title: noteTitle(value),
			content: value,
			project_id: projectId
		});
		setNoteDraft(projectId, '');
	};

	const submitStandaloneNote = async () => {
		const value = standaloneNote.trim();
		if (!value) return;
		await flowpilot.createNote({
			title: noteTitle(value),
			content: value
		});
		standaloneNote = '';
	};
</script>

<div class="space-y-4">
	<Card tone="active">
		<div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
			<div>
				<p class="text-xs uppercase tracking-[0.2em] text-[#3399FF]">Projets</p>
				<h1 class="mt-2 text-2xl font-semibold text-white">Vue portefeuille</h1>
			</div>
			<form class="grid gap-2 md:grid-cols-[1fr_1.2fr_auto_auto]" onsubmit={(event) => { event.preventDefault(); if (title.trim()) { void flowpilot.createProject({ title, description, deadline: deadline ? `${deadline}T18:00:00.000Z` : null }); title=''; description=''; deadline=''; } }}>
				<input class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" placeholder="Titre" bind:value={title} />
				<input class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" placeholder="Description" bind:value={description} />
				<input class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" type="date" bind:value={deadline} />
				<button class="rounded-2xl bg-[#3399FF] px-4 py-3 text-sm font-medium text-white" type="submit">Ajouter</button>
			</form>
		</div>
	</Card>

	<div class="grid gap-4 md:grid-cols-3">
		<Card>
			<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Actifs</p>
			<p class="mt-2 text-2xl font-semibold text-white">{activeCount}</p>
		</Card>
		<Card>
			<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Stagnants</p>
			<p class="mt-2 text-2xl font-semibold text-white">{stagnantCount}</p>
		</Card>
		<Card>
			<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Termines</p>
			<p class="mt-2 text-2xl font-semibold text-white">{doneCount}</p>
		</Card>
	</div>

	<div class="grid gap-4 lg:grid-cols-2">
		{#each $projectProgress as item}
			<Card tone={item.isStagnant ? 'warning' : 'default'}>
				<div class="flex items-start justify-between gap-4">
					<div>
						<h2 class="text-xl font-semibold text-white">{item.project.title}</h2>
						<p class="mt-2 text-sm text-zinc-400">{item.project.description ?? 'Pas de description'}</p>
						{#if item.project.deadline}
							<p class="mt-2 text-sm text-zinc-500">Deadline {item.project.deadline.slice(0, 10)}</p>
						{/if}
					</div>
					<div class="flex flex-col gap-2">
						<select class="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none" value={item.project.status} onchange={(event) => flowpilot.updateProject(item.project.id, { status: (event.currentTarget as HTMLSelectElement).value as typeof item.project.status })}>
							<option value="active">active</option>
							<option value="paused">paused</option>
							<option value="done">done</option>
							<option value="abandoned">abandoned</option>
						</select>
						<button class="rounded-2xl border border-red-500/20 px-3 py-2 text-sm text-red-300" type="button" onclick={() => flowpilot.deleteProject(item.project.id)}>
							Archiver
						</button>
					</div>
				</div>

				<div class="mt-4 h-2 rounded-full bg-white/6">
					<div class="h-2 rounded-full bg-[#3399FF]" style={`width: ${item.progress}%`}></div>
				</div>

				<div class="mt-4 flex items-center justify-between text-sm text-zinc-400">
					<span>{item.doneTasks}/{item.totalTasks} done</span>
					{#if item.isStagnant}
						<span class="text-red-300">stagnant</span>
					{/if}
				</div>

				<div class="mt-4 space-y-2">
					<form class="flex gap-2" onsubmit={(event) => { event.preventDefault(); void submitProjectTask(item.project.id); }}>
						<input class="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" placeholder="Ajouter une tache au projet" value={taskDrafts[item.project.id] ?? ''} oninput={(event) => setTaskDraft(item.project.id, (event.currentTarget as HTMLInputElement).value)} />
						<button class="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white" type="submit">+</button>
					</form>
				</div>

				<div class="mt-4 space-y-2">
					{#each $tasks.filter((task) => task.project_id === item.project.id && !task.deleted_at).slice(0, 5) as task}
						<div class="rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
							<p class="font-medium text-white">{task.title}</p>
							<p class="mt-1 text-sm text-zinc-400">{task.status} - {task.priority}</p>
						</div>
					{/each}
					{#if !$tasks.filter((task) => task.project_id === item.project.id && !task.deleted_at).length}
						<p class="text-sm text-zinc-500">Aucune tache liee pour le moment.</p>
					{/if}
				</div>

				<div class="mt-4 space-y-2">
					<p class="text-sm font-medium text-white">Notes</p>
					<form class="flex gap-2" onsubmit={(event) => { event.preventDefault(); void submitProjectNote(item.project.id); }}>
						<input class="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" placeholder="Ajouter une note rapide" value={noteDrafts[item.project.id] ?? ''} oninput={(event) => setNoteDraft(item.project.id, (event.currentTarget as HTMLInputElement).value)} />
						<button class="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white" type="submit">+</button>
					</form>
					{#each $notes.filter((note) => note.project_id === item.project.id && !note.deleted_at).slice(0, 4) as note}
						<div class="rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
							<div class="flex items-start justify-between gap-3">
								<div>
									<p class="font-medium text-white">{note.title}</p>
									<p class="mt-1 text-sm text-zinc-400">{note.content ?? 'Note vide'}</p>
								</div>
								<button class="rounded-full border border-red-500/20 px-2 py-1 text-xs text-red-300" type="button" onclick={() => flowpilot.deleteNote(note.id)}>
									x
								</button>
							</div>
						</div>
					{/each}
					{#if !$notes.filter((note) => note.project_id === item.project.id && !note.deleted_at).length}
						<p class="text-sm text-zinc-500">Aucune note associee.</p>
					{/if}
				</div>
			</Card>
		{/each}
	</div>

	<Card>
		<div class="mb-4">
			<p class="text-xs uppercase tracking-[0.2em] text-zinc-500">Notes</p>
			<h2 class="mt-2 text-xl font-semibold text-white">Notes hors projet</h2>
		</div>
		<form class="mb-4 flex gap-2" onsubmit={(event) => { event.preventDefault(); void submitStandaloneNote(); }}>
			<input class="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" placeholder="Nouvelle note hors projet" bind:value={standaloneNote} />
			<button class="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white" type="submit">Ajouter</button>
		</form>
		<div class="grid gap-3 md:grid-cols-2">
			{#if $notes.filter((note) => !note.project_id && !note.deleted_at).length}
				{#each $notes.filter((note) => !note.project_id && !note.deleted_at) as note}
					<div class="rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
						<div class="flex items-start justify-between gap-3">
							<div>
								<p class="font-medium text-white">{note.title}</p>
								<p class="mt-1 text-sm text-zinc-400">{note.content ?? 'Note vide'}</p>
							</div>
							<button class="rounded-full border border-red-500/20 px-2 py-1 text-xs text-red-300" type="button" onclick={() => flowpilot.deleteNote(note.id)}>
								x
							</button>
						</div>
					</div>
				{/each}
			{:else}
				<p class="text-sm text-zinc-500">Aucune note hors projet pour le moment.</p>
			{/if}
		</div>
	</Card>
</div>
