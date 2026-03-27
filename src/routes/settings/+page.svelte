<script lang="ts">
	import AccountBadge from '$lib/components/AccountBadge.svelte';
	import Card from '$lib/components/Card.svelte';
	import { REVIEW_DAY_OPTIONS } from '$lib/constants';
	import { authState, conflictLogs, flowpilot, profile, syncState } from '$lib/flowpilot';

	let displayName = $state('');
	let pomodoro = $state(25);
	let breakMinutes = $state(5);
	let focusGoal = $state(240);
	let reviewDay = $state('sunday');

	$effect(() => {
		if (!$profile) return;
		displayName = $profile.display_name ?? '';
		pomodoro = $profile.settings.pomodoro_minutes;
		breakMinutes = $profile.settings.break_minutes;
		focusGoal = $profile.settings.daily_focus_goal_minutes;
		reviewDay = $profile.settings.review_day;
	});

	const save = async () => {
		await flowpilot.saveProfileSettings({
			display_name: displayName,
			settings: {
				...($profile?.settings ?? {}),
				pomodoro_minutes: pomodoro,
				break_minutes: breakMinutes,
				daily_focus_goal_minutes: focusGoal,
				review_day: reviewDay
			}
		});
	};
</script>

<div class="space-y-4">
	<Card tone="active">
		<div class="flex items-center justify-between gap-4">
			<div>
				<p class="text-xs uppercase tracking-[0.2em] text-[#3399FF]">Parametres</p>
				<h1 class="mt-2 text-2xl font-semibold text-white">Compte, sync, conflits</h1>
			</div>
			{#if $authState.configured}
				<button class="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white" type="button" onclick={() => flowpilot.signOut()}>
					Se deconnecter
				</button>
			{/if}
		</div>
	</Card>

	<div class="grid gap-4 xl:grid-cols-2">
		{#if $authState.user}
			<Card>
				<div class="space-y-4">
					<h2 class="text-xl font-semibold text-white">Compte connecte</h2>
					<AccountBadge user={$authState.user} />
					<div class="rounded-2xl border border-white/6 bg-black/20 px-4 py-3 text-sm text-zinc-300">
						<p>
							Compte actif:
							<span class="font-medium text-white">{$authState.user.email ?? 'adresse inconnue'}</span>
						</p>
						<p class="mt-2 text-xs text-zinc-500">
							Verifie ici le compte avant de tester la synchronisation entre PC et Android.
						</p>
					</div>
				</div>
			</Card>
		{/if}

		<Card>
			<div class="space-y-4">
				<h2 class="text-xl font-semibold text-white">Profil</h2>
				<input class="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" bind:value={displayName} />
				<div class="grid gap-3 md:grid-cols-2">
					<input class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" type="number" bind:value={pomodoro} />
					<input class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" type="number" bind:value={breakMinutes} />
					<input class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" type="number" bind:value={focusGoal} />
					<select class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none" bind:value={reviewDay}>
						{#each REVIEW_DAY_OPTIONS as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>
				<button class="rounded-2xl bg-[#3399FF] px-4 py-3 text-sm font-medium text-white" type="button" onclick={save}>
					Enregistrer
				</button>
			</div>
		</Card>

		<Card>
			<div class="space-y-4">
				<h2 class="text-xl font-semibold text-white">Sync</h2>
				<p class="text-sm text-zinc-400">Mode: {$syncState.mode}</p>
				<p class="text-sm text-zinc-400">Pending: {$syncState.pending}</p>
				{#if $syncState.lastSyncedAt}
					<p class="text-sm text-zinc-400">Derniere sync: {$syncState.lastSyncedAt}</p>
				{/if}
				{#if $syncState.lastError}
					<p class="text-sm text-red-300">Erreur: {$syncState.lastError}</p>
				{/if}
				<div class="flex flex-wrap gap-2">
					<button class="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white" type="button" onclick={() => flowpilot.syncNow()}>
						Sync maintenant
					</button>
					<button class="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white" type="button" onclick={() => flowpilot.requestNotificationPermission()}>
						Notifications
					</button>
				</div>
			</div>
		</Card>
	</div>

	<Card>
		<h2 class="text-xl font-semibold text-white">Conflits resolus automatiquement</h2>
		<div class="mt-4 space-y-3">
			{#if $conflictLogs.length}
				{#each $conflictLogs as conflict}
					<div class="rounded-2xl border border-white/6 bg-black/20 px-4 py-3">
						<p class="font-medium text-white">{conflict.table_name} - {conflict.record_id.slice(0, 8)}</p>
						<p class="mt-1 text-sm text-zinc-400">Champs: {conflict.fields.join(', ')}</p>
					</div>
				{/each}
			{:else}
				<p class="text-sm text-zinc-500">Aucun conflit enregistre pour l instant.</p>
			{/if}
		</div>
	</Card>
</div>
