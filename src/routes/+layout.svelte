<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import AccountBadge from '$lib/components/AccountBadge.svelte';
	import favicon from '$lib/assets/favicon.svg';
	import AuthGate from '$lib/components/AuthGate.svelte';
	import QuickCaptureModal from '$lib/components/QuickCaptureModal.svelte';
	import { NAV_ITEMS, SECONDARY_ITEMS } from '$lib/constants';
	import {
		authState,
		flowpilot,
		notificationCenter,
		pendingInboxItems,
		shellState,
		syncState
	} from '$lib/flowpilot';

	let { children } = $props();

	onMount(() => {
		void flowpilot.init();
		return () => flowpilot.destroy();
	});

	const isActive = (href: string) => href === '/' ? $page.url.pathname === '/' : $page.url.pathname.startsWith(href);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="/manifest.json" />
	<meta name="theme-color" content="#0a0a0a" />
</svelte:head>

{#if !$authState.ready}
	<div class="flex min-h-screen items-center justify-center text-sm text-zinc-400">Initialisation de FlowPilot...</div>
{:else if $authState.configured && !$authState.user}
	<AuthGate />
{:else}
	<div class="shell-grid bg-transparent">
		<aside class="hidden border-r border-white/6 bg-black/20 p-5 lg:flex lg:flex-col">
			<div class="mb-8">
				<p class="text-xs uppercase tracking-[0.2em] text-[#3399FF]">FlowPilot</p>
				<h1 class="mt-2 text-2xl font-semibold text-white">Cockpit</h1>
				<p class="mt-2 text-sm text-zinc-500">Inbox -> clarifier -> planifier -> focus -> revue.</p>
			</div>

			{#if $authState.user}
				<a
					class="mb-6 block rounded-3xl border border-white/8 bg-[#111] p-4 transition hover:border-white/12 hover:bg-white/[0.03]"
					href="/settings"
				>
					<AccountBadge user={$authState.user} />
				</a>
			{/if}

			<nav class="space-y-2">
				{#each NAV_ITEMS as item}
					<a
						class={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm transition ${isActive(item.href) ? 'bg-[#3399FF]/12 text-white shadow-[0_0_18px_rgba(51,153,255,0.12)]' : 'text-zinc-400 hover:bg-white/4 hover:text-white'}`}
						href={item.href}
					>
						<span>{item.label}</span>
						<span class="text-xs text-zinc-500">{item.icon}</span>
					</a>
				{/each}
			</nav>

			<div class="my-6 h-px bg-white/6"></div>

			<nav class="space-y-2">
				{#each SECONDARY_ITEMS as item}
					<a
						class={`block rounded-2xl px-4 py-3 text-sm transition ${isActive(item.href) ? 'bg-white/6 text-white' : 'text-zinc-400 hover:bg-white/4 hover:text-white'}`}
						href={item.href}
					>
						{item.label}
					</a>
				{/each}
			</nav>

			<div class="mt-auto rounded-3xl border border-white/6 bg-[#111] p-4">
				<p class="text-sm font-medium text-white">Sync</p>
				<p class="mt-2 text-sm text-zinc-400">
					{$syncState.running ? 'Synchronisation...' : `${$syncState.pending} changement(s) en attente`}
				</p>
				{#if $syncState.lastSyncedAt}
					<p class="mt-1 text-xs text-zinc-500">Derniere sync: {$syncState.lastSyncedAt.slice(11, 16)}</p>
				{/if}
			</div>
		</aside>

		<div class="relative flex min-h-screen flex-col">
			<header class="sticky top-0 z-30 flex items-center justify-between border-b border-white/6 bg-[#0a0a0a]/92 px-4 py-3 backdrop-blur md:px-6">
				<div class="flex items-center gap-3">
					<button
						class="rounded-2xl border border-white/10 px-3 py-2 text-sm text-zinc-300 lg:hidden"
						type="button"
						onclick={() => flowpilot.toggleSecondaryMenu()}
					>
						Menu
					</button>
					<div>
						<p class="text-sm font-semibold text-white">{$page.url.pathname === '/' ? 'Dashboard' : $page.url.pathname.slice(1)}</p>
						<p class="text-xs text-zinc-500">{$syncState.running ? 'sync active' : 'local-first'}</p>
					</div>
				</div>

				<div class="flex items-center gap-2">
					{#if $authState.user}
						<a
							class="rounded-full border border-white/10 bg-[#111] px-2 py-1.5 transition hover:border-white/20"
							href="/settings"
							aria-label="Voir le compte connecte"
						>
							<AccountBadge user={$authState.user} compact />
						</a>
					{/if}
					<a class="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300" href="/inbox">
						Inbox {$pendingInboxItems.length}
					</a>
					<button
						class="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300 transition hover:border-white/20 hover:text-white"
						type="button"
						onclick={() => flowpilot.syncNow()}
					>
						Sync
					</button>
				</div>
			</header>

			<main class="flex-1 px-4 pb-28 pt-4 md:px-6 md:pb-10">
				{@render children()}
			</main>

			<button
				class="fixed bottom-20 left-1/2 z-40 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full bg-[#3399FF] text-3xl text-white shadow-[0_0_24px_rgba(51,153,255,0.22)] transition hover:bg-[#4aa5ff] lg:bottom-8"
				type="button"
				aria-label="Ajouter dans l inbox"
				onclick={() => flowpilot.openQuickCapture()}
			>
				+
			</button>

			<nav class="fixed inset-x-0 bottom-0 z-30 border-t border-white/6 bg-[#0a0a0a]/96 px-2 pb-4 pt-2 backdrop-blur lg:hidden">
				<div class="grid grid-cols-5 items-center">
					<a class={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs ${isActive('/') ? 'text-white' : 'text-zinc-500'}`} href="/">
						<span>H</span>
						<span>Home</span>
					</a>
					<a class={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs ${isActive('/tasks') ? 'text-white' : 'text-zinc-500'}`} href="/tasks">
						<span>T</span>
						<span>Taches</span>
					</a>
					<div></div>
					<a class={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs ${isActive('/agenda') ? 'text-white' : 'text-zinc-500'}`} href="/agenda">
						<span>A</span>
						<span>Agenda</span>
					</a>
					<a class={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs ${isActive('/focus') ? 'text-white' : 'text-zinc-500'}`} href="/focus">
						<span>F</span>
						<span>Focus</span>
					</a>
				</div>
			</nav>

			{#if $shellState.secondaryMenuOpen}
				<div class="fixed inset-0 z-40 bg-black/70 lg:hidden">
					<button class="absolute inset-0" type="button" aria-label="Fermer le menu" onclick={() => flowpilot.closeSecondaryMenu()}></button>
					<div class="absolute left-0 top-0 h-full w-72 border-r border-white/6 bg-[#0c0c0d] p-5">
						<div class="mb-6 flex items-center justify-between">
							<p class="text-sm font-semibold text-white">Modules</p>
							<button class="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300" type="button" onclick={() => flowpilot.closeSecondaryMenu()}>
								Fermer
							</button>
						</div>

						<div class="space-y-2">
							{#each [...NAV_ITEMS, ...SECONDARY_ITEMS] as item}
								<a
									class={`block rounded-2xl px-4 py-3 text-sm ${isActive(item.href) ? 'bg-white/6 text-white' : 'text-zinc-400'}`}
									href={item.href}
									onclick={() => flowpilot.closeSecondaryMenu()}
								>
									{item.label}
								</a>
							{/each}
						</div>
					</div>
				</div>
			{/if}

			<div class="pointer-events-none fixed right-4 top-20 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3">
				{#each $notificationCenter.filter((item) => !item.dismissed).slice(0, 3) as item}
					<div class="pointer-events-auto rounded-3xl border border-white/10 bg-[#111]/96 p-4 shadow-lg">
						<div class="flex items-start justify-between gap-3">
							<div>
								<p class="text-sm font-medium text-white">{item.title}</p>
								<p class="mt-1 text-sm text-zinc-400">{item.body}</p>
							</div>
							<button class="rounded-full border border-white/10 px-2 py-1 text-xs text-zinc-400" type="button" onclick={() => flowpilot.dismissNotification(item.id)}>
								x
							</button>
						</div>
					</div>
				{/each}
			</div>

			<QuickCaptureModal />
		</div>
	</div>
{/if}
