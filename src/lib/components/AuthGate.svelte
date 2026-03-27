<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import { authState, flowpilot } from '$lib/flowpilot';

	let email = $state('');
	let password = $state('');
	let displayName = $state('');
	let mode = $state<'login' | 'signup'>('login');

	const submit = async () => {
		if (mode === 'login') {
			await flowpilot.signInWithPassword(email, password);
			return;
		}

		await flowpilot.signUpWithPassword(email, password, displayName);
	};
</script>

<div class="flex min-h-screen items-center justify-center px-4 py-10">
	<Card class="w-full max-w-md" tone="active">
		<div class="mb-6 space-y-2">
			<p class="text-xs uppercase tracking-[0.2em] text-[#3399FF]">FlowPilot</p>
			<h1 class="text-3xl font-semibold text-white">Cockpit personnel</h1>
			<p class="text-sm text-zinc-400">
				Connexion email/mot de passe ou Google pour synchroniser Android et desktop.
			</p>
		</div>

		<div class="mb-4 inline-flex rounded-2xl border border-white/10 bg-black/20 p-1">
			<button
				class={`rounded-2xl px-3 py-2 text-sm transition ${mode === 'login' ? 'bg-white/10 text-white' : 'text-zinc-400'}`}
				type="button"
				onclick={() => (mode = 'login')}
			>
				Connexion
			</button>
			<button
				class={`rounded-2xl px-3 py-2 text-sm transition ${mode === 'signup' ? 'bg-white/10 text-white' : 'text-zinc-400'}`}
				type="button"
				onclick={() => (mode = 'signup')}
			>
				Creer un compte
			</button>
		</div>

		<form class="space-y-3" onsubmit={(event) => { event.preventDefault(); void submit(); }}>
			{#if mode === 'signup'}
				<input
					class="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-[#3399FF]/50"
					type="text"
					placeholder="Nom"
					bind:value={displayName}
				/>
			{/if}

			<input
				class="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-[#3399FF]/50"
				type="email"
				placeholder="Email"
				bind:value={email}
			/>
			<input
				class="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-[#3399FF]/50"
				type="password"
				placeholder="Mot de passe"
				bind:value={password}
			/>

			<button class="w-full rounded-2xl bg-[#3399FF] px-4 py-3 text-sm font-semibold text-white" type="submit">
				{mode === 'login' ? 'Se connecter' : 'Creer mon compte'}
			</button>
		</form>

		<button
			class="mt-3 w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:border-white/20"
			type="button"
			onclick={() => flowpilot.signInWithGoogle()}
		>
			Continuer avec Google
		</button>

		{#if $authState.message}
			<p class="mt-4 text-sm text-zinc-400">{$authState.message}</p>
		{/if}
	</Card>
</div>
