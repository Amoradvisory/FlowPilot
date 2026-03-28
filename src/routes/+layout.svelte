<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import './layout.css';
	import { onMount } from 'svelte';
	import { Plus } from 'lucide-svelte';
	import AccountBadge from '$lib/components/AccountBadge.svelte';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import favicon from '$lib/assets/favicon.svg';
	import AuthGate from '$lib/components/AuthGate.svelte';
	import { NAV_ITEMS, SECONDARY_ITEMS } from '$lib/constants';
	import { authState, flowpilot, shellState, syncState } from '$lib/flowpilot';

	let { children } = $props();
	type DensityMode = 'compact' | 'cozy' | 'airy';

	let commandPaletteOpen = $state(false);
	let densityMode = $state<DensityMode>('cozy');

	const applyDensityMode = (mode: DensityMode) => {
		densityMode = mode;
		if (!browser) return;
		document.documentElement.dataset.density = mode;
		localStorage.setItem('nexus-density', mode);
	};

	const cycleDensity = () => {
		const order: DensityMode[] = ['compact', 'cozy', 'airy'];
		const nextIndex = (order.indexOf(densityMode) + 1) % order.length;
		applyDensityMode(order[nextIndex]);
	};

	onMount(() => {
		if (browser) {
			const storedDensity = localStorage.getItem('nexus-density');
			if (storedDensity === 'compact' || storedDensity === 'cozy' || storedDensity === 'airy') {
				applyDensityMode(storedDensity);
			} else {
				document.documentElement.dataset.density = densityMode;
			}
		}

		const isEditableTarget = (target: EventTarget | null) =>
			target instanceof HTMLElement &&
			(target.tagName === 'INPUT' ||
				target.tagName === 'TEXTAREA' ||
				target.tagName === 'SELECT' ||
				target.isContentEditable);

		const handleKeydown = (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
				if (isEditableTarget(event.target)) return;
				event.preventDefault();
				commandPaletteOpen = true;
				return;
			}

			if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'n') {
				if (isEditableTarget(event.target)) return;
				event.preventDefault();
				void goto('/vault?new=1&focus=title');
				return;
			}

			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
				if (isEditableTarget(event.target)) return;
				event.preventDefault();
				cycleDensity();
				return;
			}

			if (event.key === 'Escape' && commandPaletteOpen) {
				commandPaletteOpen = false;
			}
		};

		window.addEventListener('keydown', handleKeydown);
		void flowpilot.init();
		return () => {
			window.removeEventListener('keydown', handleKeydown);
			flowpilot.destroy();
		};
	});

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	const pageLabel = () =>
		page.url.pathname === '/'
			? 'Accueil'
			: ([...NAV_ITEMS, ...SECONDARY_ITEMS].find((item) => isActive(item.href))?.label ??
				page.url.pathname.slice(1));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="/manifest.json" />
	<meta name="theme-color" content="#0A0E1A" />
</svelte:head>

{#if !$authState.ready}
	<div class="flex min-h-screen items-center justify-center text-sm text-zinc-400">
		Initialisation de Nexus Notes...
	</div>
{:else if $authState.configured && !$authState.user}
	<AuthGate />
{:else}
	<div class="shell-grid bg-transparent">
		<aside class="glass-panel hidden border-r border-white/6 bg-black/20 p-5 lg:flex lg:flex-col">
			<div class="mb-8">
				<p class="text-xs tracking-[0.2em] text-[#00D4FF] uppercase">Nexus Notes</p>
				<h1 class="mt-2 text-2xl font-semibold text-white">Neural notebook</h1>
				<p class="mt-2 text-sm text-zinc-500">
					Capturer, connecter et retrouver une pensee avec precision.
				</p>
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
					{@const Icon = item.icon}
					<a
						class={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm transition ${isActive(item.href) ? 'bg-[#00D4FF]/12 text-white shadow-[0_0_18px_rgba(0,212,255,0.12)]' : 'text-zinc-400 hover:bg-white/4 hover:text-white'}`}
						href={item.href}
					>
						<span>{item.label}</span>
						<Icon size={18} strokeWidth={1.8} />
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

			<div class="glass-panel mt-auto rounded-3xl border border-white/6 bg-[#111]/80 p-4">
				<p class="text-sm font-medium text-white">Sync</p>
				<p class="mt-2 text-sm text-zinc-400">
					{$syncState.running
						? 'Synchronisation...'
						: `${$syncState.pending} changement(s) en attente`}
				</p>
				{#if $syncState.lastSyncedAt}
					<p class="mt-1 text-xs text-zinc-500">
						Derniere sync: {$syncState.lastSyncedAt.slice(11, 16)}
					</p>
				{/if}
			</div>
		</aside>

		<div class="relative flex min-h-screen flex-col">
			<header
				class="glass-panel sticky top-0 z-30 flex items-center justify-between border-b border-white/6 bg-[#0A0E1A]/86 px-4 py-3 md:px-6"
			>
				<div>
					<p class="text-sm font-semibold text-white md:text-base">{pageLabel()}</p>
				</div>

				<div class="flex items-center">
					{#if $authState.user}
						<a
							class="transition hover:opacity-90"
							href="/settings"
							aria-label="Voir le compte connecte"
						>
							<AccountBadge user={$authState.user} compact />
						</a>
					{/if}
				</div>
			</header>

			<main class="flex-1 px-4 pt-4 pb-28 md:px-6 md:pb-10">
				{@render children()}
			</main>

			<nav
				class="glass-panel fixed inset-x-0 bottom-0 z-30 border-t border-white/6 bg-[#0A0E1A]/92 px-2 pt-2 pb-4 lg:hidden"
			>
				<div
					class="grid items-center"
					style={`grid-template-columns: repeat(${NAV_ITEMS.length}, minmax(0, 1fr));`}
				>
					{#each NAV_ITEMS as item}
						{@const Icon = item.icon}
						<a
							class={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs ${isActive(item.href) ? 'text-white' : 'text-zinc-500'}`}
							href={item.href}
						>
							<Icon size={18} strokeWidth={1.8} />
							<span>{item.short}</span>
						</a>
					{/each}
				</div>
			</nav>

			<a class="fab-note-create" href="/vault?new=1&focus=title" aria-label="Nouvelle note">
				<Plus size={22} strokeWidth={2.2} />
			</a>

			{#if $shellState.secondaryMenuOpen}
				<div class="fixed inset-0 z-40 bg-black/70 lg:hidden">
					<button
						class="absolute inset-0"
						type="button"
						aria-label="Fermer le menu"
						onclick={() => flowpilot.closeSecondaryMenu()}
					></button>
					<div class="absolute top-0 left-0 h-full w-72 border-r border-white/6 bg-[#0c0c0d] p-5">
						<div class="mb-6 flex items-center justify-between">
							<p class="text-sm font-semibold text-white">Modules</p>
							<button
								class="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300"
								type="button"
								onclick={() => flowpilot.closeSecondaryMenu()}
							>
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
									<span class="flex items-center gap-3">
										{#if 'icon' in item}
											{@const Icon = item.icon}
											<Icon size={18} strokeWidth={1.8} />
										{/if}
										<span>{item.label}</span>
									</span>
								</a>
							{/each}
						</div>
					</div>
				</div>
			{/if}

			<CommandPalette open={commandPaletteOpen} onClose={() => (commandPaletteOpen = false)} />
		</div>
	</div>
{/if}
