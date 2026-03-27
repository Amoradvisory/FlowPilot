<script lang="ts">
	import type { SessionIdentity } from '$lib/types';

	let { user, compact = false } = $props<{ user: SessionIdentity | null; compact?: boolean }>();

	const primaryLabel = $derived(user?.displayName ?? user?.email ?? 'Compte actif');
	const secondaryLabel = $derived(
		user?.provider === 'google'
			? 'Compte Google connecte'
			: user?.provider === 'email'
				? 'Connexion email active'
				: 'Session active'
	);
	const initials = $derived.by(() => {
		const raw = user?.displayName || user?.email || 'FP';
		const parts = raw
			.split(/[\s@._-]+/)
			.map((part: string) => part.trim())
			.filter(Boolean)
			.slice(0, 2);

		return parts.map((part: string) => part[0]?.toUpperCase() ?? '').join('') || 'FP';
	});
</script>

<div class={`flex items-center ${compact ? 'gap-2' : 'gap-3'}`}>
	{#if user?.avatarUrl}
		<img
			class={`${compact ? 'h-9 w-9' : 'h-12 w-12'} rounded-full border border-white/10 object-cover shadow-[0_0_18px_rgba(51,153,255,0.08)]`}
			src={user.avatarUrl}
			alt={`Avatar de ${primaryLabel}`}
			loading="lazy"
			referrerpolicy="no-referrer"
		/>
	{:else}
		<div
			class={`flex ${compact ? 'h-9 w-9 text-xs' : 'h-12 w-12 text-sm'} items-center justify-center rounded-full border border-white/10 bg-[#161616] font-semibold text-white shadow-[0_0_18px_rgba(51,153,255,0.08)]`}
			aria-label={`Initiales de ${primaryLabel}`}
		>
			{initials}
		</div>
	{/if}

	<div class="min-w-0">
		<p class={`${compact ? 'max-w-28 text-xs' : 'text-sm'} truncate font-medium text-white`}>
			{primaryLabel}
		</p>
		{#if user?.email}
			<p class={`${compact ? 'hidden sm:block text-[11px]' : 'text-xs'} truncate text-zinc-400`}>
				{user.email}
			</p>
		{/if}
		{#if !compact}
			<p class="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#3399FF]/80">
				{secondaryLabel}
			</p>
		{/if}
	</div>
</div>
