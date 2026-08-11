<script lang="ts">
	import Card from '$lib/components/Card.svelte';

	const priorities = [
		{
			label: 'À préparer',
			value: '2 séquences',
			detail: 'Objectifs, supports et consignes à verrouiller avant les prochains cours.'
		},
		{
			label: 'À améliorer',
			value: '3 points',
			detail: 'Éléments issus du retour terrain à retravailler avant réutilisation.'
		},
		{
			label: 'Évaluations',
			value: '1 à revoir',
			detail: 'Consigne à rendre plus robuste face aux usages de l’IA générative.'
		},
		{
			label: 'Capitalisation',
			value: '4 captures',
			detail: 'Observations courtes à transformer en connaissance pédagogique réutilisable.'
		}
	];

	const sessions = [
		{
			course: 'Économie — groupe A',
			when: 'Prochaine séance',
			before: 'Clarifier l’objectif observable et préparer un exemple concret.',
			during: 'Repérer où les élèves bloquent et noter une formulation efficace.',
			after: 'Conserver une observation : garder / modifier / tester.'
		},
		{
			course: 'Gestion — groupe B',
			when: 'Cette semaine',
			before: 'Revoir la consigne d’activité et le niveau d’autonomie demandé.',
			during: 'Observer les stratégies utilisées plutôt que seulement le résultat.',
			after: 'Identifier un élément à réutiliser dans la prochaine version.'
		}
	];

	let quickNote = '';
</script>

<div class="space-y-5">
	<section class="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(0,212,255,0.14),transparent_38%),#101010] p-6">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div class="max-w-3xl">
				<p class="text-xs tracking-[0.22em] text-cyan-300 uppercase">TeacherFlow · prototype éducatif</p>
				<h1 class="mt-3 text-3xl font-semibold text-white">Cockpit de travail pédagogique</h1>
				<p class="mt-3 text-sm leading-6 text-zinc-400">
					Une adaptation de FlowPilot pensée pour aider un enseignant à préparer, agir, capturer
					un retour terrain et décider ce qui mérite d’être amélioré — sans transformer le métier
					en usine à tâches.
				</p>
			</div>
			<div class="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
				Démo sans données élèves
			</div>
		</div>
	</section>

	<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
		{#each priorities as item}
			<Card>
				<p class="text-xs tracking-[0.18em] text-zinc-500 uppercase">{item.label}</p>
				<p class="mt-2 text-2xl font-semibold text-white">{item.value}</p>
				<p class="mt-3 text-sm leading-5 text-zinc-400">{item.detail}</p>
			</Card>
		{/each}
	</div>

	<div class="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
		<Card>
			<div>
				<p class="text-xs tracking-[0.18em] text-zinc-500 uppercase">Séances à piloter</p>
				<h2 class="mt-2 text-xl font-semibold text-white">Avant → pendant → après</h2>
				<p class="mt-2 text-sm text-zinc-400">
					Le cockpit garde la continuité entre préparation et retour d’expérience.
				</p>
			</div>

			<div class="mt-5 space-y-4">
				{#each sessions as session}
					<article class="rounded-2xl border border-white/8 bg-black/20 p-4">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<h3 class="font-medium text-white">{session.course}</h3>
							<span class="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-400">
								{session.when}
							</span>
						</div>
						<div class="mt-4 grid gap-3 md:grid-cols-3">
							<div class="rounded-xl border border-white/8 p-3">
								<p class="text-xs font-medium text-cyan-300 uppercase">Avant</p>
								<p class="mt-2 text-sm text-zinc-400">{session.before}</p>
							</div>
							<div class="rounded-xl border border-white/8 p-3">
								<p class="text-xs font-medium text-violet-300 uppercase">Pendant</p>
								<p class="mt-2 text-sm text-zinc-400">{session.during}</p>
							</div>
							<div class="rounded-xl border border-white/8 p-3">
								<p class="text-xs font-medium text-emerald-300 uppercase">Après</p>
								<p class="mt-2 text-sm text-zinc-400">{session.after}</p>
							</div>
						</div>
					</article>
				{/each}
			</div>
		</Card>

		<Card>
			<p class="text-xs tracking-[0.18em] text-zinc-500 uppercase">Retour terrain express</p>
			<h2 class="mt-2 text-xl font-semibold text-white">Capturer avant d’oublier</h2>
			<p class="mt-2 text-sm leading-6 text-zinc-400">
				Une trace courte après le cours suffit : ce qui a fonctionné, ce qui a bloqué, ce qu’il
				faut tester la prochaine fois. La version complète pourra ensuite envoyer ces éléments
				vers une mémoire pédagogique structurée.
			</p>

			<label class="mt-5 block text-sm font-medium text-zinc-300" for="teacherflow-note">
				Observation de démonstration
			</label>
			<textarea
				id="teacherflow-note"
				bind:value={quickNote}
				rows="7"
				placeholder="Ex. : l’exemple concret a débloqué le groupe ; garder la structure mais raccourcir la consigne."
				class="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-cyan-400/40"
			></textarea>
			<div class="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/5 p-3 text-xs leading-5 text-amber-100/80">
				Prototype : cette zone n’enregistre encore rien. Aucune donnée réelle d’élève ne doit être
				utilisée dans la démo publique.
			</div>
		</Card>
	</div>

	<Card>
		<p class="text-xs tracking-[0.18em] text-zinc-500 uppercase">Ce que cette variante cherche à prouver</p>
		<div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
			{#each [
				['Terrain', 'Partir des frictions réelles du métier, pas d’une technologie à placer.'],
				['Système', 'Relier préparation, séance, retour d’expérience et amélioration continue.'],
				['IA / agents', 'Préparer une architecture où l’IA assiste sans supprimer la validation humaine.'],
				['Transférabilité', 'Créer un dispositif explicable à un enseignant, un formateur ou un responsable pédagogique.']
			] as proof}
				<div class="rounded-2xl border border-white/8 bg-black/20 p-4">
					<p class="font-medium text-white">{proof[0]}</p>
					<p class="mt-2 text-sm leading-5 text-zinc-400">{proof[1]}</p>
				</div>
			{/each}
		</div>
	</Card>
</div>
