<script lang="ts">
	import { browser } from '$app/environment';
	import {
		addObservation,
		createObservation,
		MAX_NOTE_LENGTH,
		restoreObservations,
		type DemoObservation,
		type ObservationSignal
	} from '$lib/teacherflow-demo';
	import {
		ArrowDown,
		ArrowRight,
		Check,
		CheckCircle2,
		Code2,
		ExternalLink,
		RotateCcw,
		Save,
		ShieldCheck,
		Sparkles
	} from 'lucide-svelte';
	import { onMount } from 'svelte';

	const STORAGE_KEY = 'teacherflow-public-demo-observations-v1';

	const workflow = [
		{
			step: '01',
			label: 'Préparer',
			detail: 'Objectif, support et preuve attendue.'
		},
		{
			step: '02',
			label: 'Enseigner',
			detail: 'Conduire la séance sans quitter le terrain.'
		},
		{
			step: '03',
			label: 'Observer',
			detail: 'Saisir un signal avant qu’il ne s’évapore.'
		},
		{
			step: '04',
			label: 'Capitaliser',
			detail: 'Conserver ce qui mérite d’être réutilisé.'
		},
		{
			step: '05',
			label: 'Améliorer',
			detail: 'Transformer le signal en prochaine action.'
		}
	];

	const sessions = [
		{
			time: '08:25',
			course: 'Économie · groupe Horizon',
			status: 'À préparer',
			statusClass: 'bg-[#fff0e8] text-[#a74324]',
			focus: 'Faire distinguer besoin, désir et demande à partir d’un cas de vente.',
			proof: 'Chaque groupe justifie un classement à l’oral.',
			next: 'Simplifier la consigne d’ouverture.'
		},
		{
			time: '13:10',
			course: 'Gestion · groupe Atlas',
			status: 'Prête',
			statusClass: 'bg-[#e2f6ec] text-[#176746]',
			focus: 'Construire un budget simple à partir de données fictives.',
			proof: 'La stratégie de calcul est explicitée avant le résultat.',
			next: 'Observer les confusions entre charges fixes et variables.'
		}
	];

	const signalOptions: Array<{
		value: ObservationSignal;
		label: string;
		detail: string;
		activeClass: string;
	}> = [
		{
			value: 'worked',
			label: 'A fonctionné',
			detail: 'À conserver',
			activeClass: 'border-[#207052] bg-[#e2f6ec] text-[#124c38]'
		},
		{
			value: 'blocked',
			label: 'A bloqué',
			detail: 'À clarifier',
			activeClass: 'border-[#c55838] bg-[#fff0e8] text-[#8b321d]'
		},
		{
			value: 'try',
			label: 'À tester',
			detail: 'Prochaine séance',
			activeClass: 'border-[#2958a6] bg-[#e9f0ff] text-[#173f7e]'
		}
	];

	const demoPrompts = [
		'L’exemple concret a débloqué le groupe ; garder la structure.',
		'La consigne mélange deux opérations ; la découper en deux étapes.',
		'Faire verbaliser la stratégie avant de montrer la correction.'
	];

	const seededImprovements = [
		'Reformuler l’amorce du cas Horizon en une seule question observable.',
		'Ajouter un contre-exemple dans la séquence « charges fixes / variables ».',
		'Préparer une version courte de la grille de justification orale.'
	];

	const proofCards = [
		{
			title: 'Partir du métier',
			body: 'Le flux suit le travail réel de l’enseignant ; la technologie reste à sa place, c’est-à-dire pas sur le trône.'
		},
		{
			title: 'Réemployer avec discernement',
			body: 'La base local-first du prototype est conservée, tandis que sa navigation généraliste disparaît de la preuve publique.'
		},
		{
			title: 'Rendre la décision visible',
			body: 'Une observation ne termine pas dans un cimetière de notes : elle produit une action à capitaliser, clarifier ou tester.'
		},
		{
			title: 'Garder l’humain au centre',
			body: 'Aucune recommandation n’est appliquée automatiquement. Le jugement pédagogique demeure le point de passage obligatoire.'
		}
	];

	let selectedSignal = $state<ObservationSignal>('blocked');
	let quickNote = $state('');
	let observations = $state<DemoObservation[]>([]);
	let successMessage = $state('');
	let errorMessage = $state('');

	let improvementQueue = $derived(
		[...observations.map((observation) => observation.nextAction), ...seededImprovements].slice(
			0,
			4
		)
	);

	onMount(() => {
		if (!browser) return;
		observations = restoreObservations(localStorage.getItem(STORAGE_KEY));
	});

	const persist = (next: DemoObservation[]) => {
		if (!browser) return;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	};

	const selectSignal = (signal: ObservationSignal) => {
		selectedSignal = signal;
		successMessage = '';
		errorMessage = '';
	};

	const captureObservation = (event: SubmitEvent) => {
		event.preventDefault();
		successMessage = '';
		errorMessage = '';

		try {
			const observation = createObservation({
				id: globalThis.crypto?.randomUUID?.() ?? `demo-${Date.now()}`,
				signal: selectedSignal,
				note: quickNote,
				capturedAt: new Date().toISOString()
			});
			const next = addObservation(observations, observation);
			observations = next;
			persist(next);
			quickNote = '';
			successMessage = 'Capture enregistrée dans ce navigateur et transformée en prochaine action.';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'La capture n’a pas pu être créée.';
		}
	};

	const resetDemo = () => {
		observations = [];
		quickNote = '';
		selectedSignal = 'blocked';
		successMessage = 'Démonstration réinitialisée. Les exemples de départ sont restaurés.';
		errorMessage = '';
		if (browser) localStorage.removeItem(STORAGE_KEY);
	};

	const formatCaptureTime = (capturedAt: string) =>
		new Intl.DateTimeFormat('fr-BE', {
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(capturedAt));

	const signalLabel = (signal: ObservationSignal) =>
		signalOptions.find((option) => option.value === signal)?.label ?? signal;
</script>

<svelte:head>
	<title>TeacherFlow — cockpit pédagogique local-first</title>
	<meta
		name="description"
		content="Démonstrateur public d’un cockpit enseignant : préparer, enseigner, observer, capitaliser et améliorer, sans données réelles d’élèves."
	/>
	<meta name="theme-color" content="#f6f2e8" />
	<meta
		property="og:title"
		content="TeacherFlow — du retour terrain à l’amélioration pédagogique"
	/>
	<meta
		property="og:description"
		content="Une preuve interactive, locale et sans données élèves, conçue pour rendre visible la boucle d’amélioration du travail enseignant."
	/>
	<link rel="canonical" href="https://amoradvisory.github.io/FlowPilot/teacher/" />
</svelte:head>

<div class="teacherflow-shell min-h-screen overflow-hidden bg-[#f6f2e8] text-[#13233f]">
	<a
		href="#demonstration"
		class="sr-only z-[100] rounded-full bg-[#13233f] px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
	>
		Aller à la démonstration
	</a>

	<header class="relative z-40 border-b border-[#13233f]/10 bg-[#f6f2e8]/92 backdrop-blur-xl">
		<div class="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4 lg:px-8">
			<a href="#top" class="group flex items-center gap-3" aria-label="TeacherFlow — haut de page">
				<span
					class="grid size-10 place-items-center rounded-xl bg-[#173f7e] text-sm font-black tracking-tight text-white shadow-[0_8px_20px_rgba(23,63,126,0.24)] transition-transform group-hover:-rotate-3"
				>
					TF
				</span>
				<span>
					<span class="block text-[0.7rem] font-bold tracking-[0.18em] text-[#c55838] uppercase">
						Prototype public
					</span>
					<span class="block text-base font-black tracking-[-0.02em]">TeacherFlow</span>
				</span>
			</a>

			<nav
				class="hidden items-center gap-7 text-sm font-semibold text-[#43506a] md:flex"
				aria-label="Navigation principale"
			>
				<a class="transition hover:text-[#173f7e]" href="#demonstration">Démonstration</a>
				<a class="transition hover:text-[#173f7e]" href="#cas">Étude de cas</a>
				<a
					class="inline-flex items-center gap-2 rounded-full border border-[#13233f]/15 bg-white/60 px-4 py-2 text-[#13233f] transition hover:-translate-y-0.5 hover:border-[#173f7e]/40 hover:bg-white"
					href="https://github.com/Amoradvisory/FlowPilot/pull/1"
					target="_blank"
					rel="noreferrer"
				>
					<Code2 size={16} aria-hidden="true" />
					Voir la PR
				</a>
			</nav>

			<a
				href="#capture"
				class="inverse-link inline-flex items-center gap-2 rounded-full bg-[#173f7e] px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_22px_rgba(23,63,126,0.22)] md:hidden"
			>
				Tester
				<ArrowDown size={15} aria-hidden="true" />
			</a>
		</div>
	</header>

	<main id="top">
		<section class="relative isolate px-5 pt-16 pb-14 lg:px-8 lg:pt-24 lg:pb-20">
			<div
				class="pointer-events-none absolute top-10 left-[55%] -z-10 size-[32rem] rounded-full bg-[#dce8ff] opacity-70 blur-3xl"
			></div>
			<div
				class="mx-auto grid max-w-[1200px] items-center gap-12 lg:grid-cols-[1.12fr_0.88fr] lg:gap-16"
			>
				<div>
					<div
						class="inline-flex items-center gap-2 rounded-full border border-[#207052]/20 bg-[#e2f6ec] px-3.5 py-2 text-xs font-bold tracking-[0.08em] text-[#176746] uppercase"
					>
						<ShieldCheck size={16} aria-hidden="true" />
						Données 100 % fictives · stockage local
					</div>

					<h1
						class="mt-7 max-w-[850px] text-[clamp(2.8rem,7vw,5.9rem)] leading-[0.94] font-black tracking-[-0.065em] text-[#13233f]"
					>
						Le retour de cours devient la
						<span class="relative inline-block text-[#173f7e]">
							prochaine amélioration.
							<svg
								class="absolute -bottom-2 left-0 h-3 w-full text-[#e87652]"
								viewBox="0 0 420 14"
								fill="none"
								aria-hidden="true"
							>
								<path
									d="M3 10C108 2 295 3 417 8"
									stroke="currentColor"
									stroke-width="6"
									stroke-linecap="round"
								/>
							</svg>
						</span>
					</h1>

					<p class="mt-8 max-w-2xl text-lg leading-8 text-[#526078] lg:text-xl lg:leading-9">
						TeacherFlow relie préparation, séance et retour terrain dans un cockpit enseignant. Une
						capture de trente secondes ne disparaît plus dans une note isolée : elle nourrit une
						décision pédagogique explicite.
					</p>

					<div class="mt-9 flex flex-col gap-3 sm:flex-row">
						<a
							href="#demonstration"
							class="inverse-link inline-flex items-center justify-center gap-2 rounded-full bg-[#173f7e] px-6 py-3.5 font-bold text-white shadow-[0_14px_34px_rgba(23,63,126,0.26)] transition hover:-translate-y-0.5 hover:bg-[#102f62]"
						>
							Lancer la visite guidée
							<ArrowRight size={18} aria-hidden="true" />
						</a>
						<a
							href="#cas"
							class="inline-flex items-center justify-center rounded-full border border-[#13233f]/15 bg-white/55 px-6 py-3.5 font-bold text-[#13233f] transition hover:-translate-y-0.5 hover:bg-white"
						>
							Lire l’étude de cas
						</a>
					</div>

					<p class="mt-5 text-sm leading-6 text-[#6a7487]">
						Prototype fonctionnel, pas produit institutionnel. Aucun compte, aucune donnée élève,
						aucune métrique d’impact inventée.
					</p>
				</div>

				<aside
					class="relative rounded-[2rem] border border-[#13233f]/10 bg-[#13233f] p-6 text-white shadow-[0_28px_80px_rgba(19,35,63,0.25)] sm:p-8"
					aria-label="Visite guidée en 90 secondes"
				>
					<div class="absolute top-6 right-6 size-24 rounded-full bg-[#e87652]/25 blur-2xl"></div>
					<p class="text-xs font-bold tracking-[0.22em] text-[#9ebdf3] uppercase">
						Démo en 90 secondes
					</p>
					<h2 class="mt-3 text-2xl font-black tracking-[-0.03em]">
						Suivez le signal, pas le logiciel.
					</h2>
					<ol class="mt-7 space-y-5">
						{#each [['01', 'Choisissez un signal de fin de cours.'], ['02', 'Saisissez une observation fictive.'], ['03', 'Voyez la prochaine action apparaître.']] as item}
							<li class="grid grid-cols-[2.2rem_1fr] items-start gap-3">
								<span
									class="grid size-9 place-items-center rounded-full bg-white/10 text-xs font-black text-[#ffad91]"
								>
									{item[0]}
								</span>
								<p class="pt-1.5 text-sm leading-6 text-[#d8e0ef]">{item[1]}</p>
							</li>
						{/each}
					</ol>

					<div class="mt-8 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
						<div class="flex items-center gap-2 text-sm font-bold text-[#a9c5f7]">
							<Sparkles size={16} aria-hidden="true" />
							Principe de conception
						</div>
						<p class="mt-2 text-sm leading-6 text-[#d8e0ef]">
							L’IA pourra assister la reformulation ou la différenciation. Elle ne remplace ni
							l’observation ni la validation de l’enseignant.
						</p>
					</div>
				</aside>
			</div>
		</section>

		<section
			class="border-y border-[#13233f]/10 bg-white/45 px-5 py-10 lg:px-8 lg:py-14"
			aria-labelledby="loop-title"
		>
			<div class="mx-auto max-w-[1200px]">
				<div class="max-w-2xl">
					<p class="eyebrow">La boucle métier</p>
					<h2 id="loop-title" class="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
						Une continuité, pas cinq outils qui s’ignorent poliment.
					</h2>
				</div>

				<ol class="mt-8 grid gap-3 md:grid-cols-5">
					{#each workflow as item, index}
						<li
							class="loop-card relative rounded-2xl border border-[#13233f]/10 bg-[#fffdf8] p-5 shadow-[0_10px_28px_rgba(19,35,63,0.06)]"
						>
							<div class="flex items-center justify-between">
								<span class="text-xs font-black tracking-[0.16em] text-[#c55838]">{item.step}</span>
								{#if index < workflow.length - 1}
									<ArrowRight class="hidden text-[#9da6b4] md:block" size={17} aria-hidden="true" />
								{/if}
							</div>
							<h3 class="mt-7 text-lg font-black">{item.label}</h3>
							<p class="mt-2 text-sm leading-6 text-[#647086]">{item.detail}</p>
						</li>
					{/each}
				</ol>
			</div>
		</section>

		<section
			id="demonstration"
			class="scroll-mt-4 px-5 py-16 lg:px-8 lg:py-24"
			aria-labelledby="today-title"
		>
			<div class="mx-auto max-w-[1200px]">
				<div class="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
					<div class="max-w-3xl">
						<p class="eyebrow">Cockpit · aujourd’hui</p>
						<h2 id="today-title" class="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
							Ce qui mérite votre attention. Rien de plus.
						</h2>
						<p class="mt-4 max-w-2xl text-base leading-7 text-[#647086]">
							Les noms de groupes, horaires et contenus ci-dessous sont fictifs. Le parcours, lui,
							est entièrement manipulable.
						</p>
					</div>
					<div
						class="inline-flex w-fit items-center gap-2 rounded-full border border-[#207052]/20 bg-[#e2f6ec] px-4 py-2 text-sm font-bold text-[#176746]"
					>
						<span class="size-2 animate-pulse rounded-full bg-[#20845f]"></span>
						Démo prête
					</div>
				</div>

				<div class="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{#each [['À préparer', '1 séquence', 'Avant 08:25'], ['À observer', '2 signaux', 'Pendant les séances'], ['À améliorer', `${improvementQueue.length} actions`, 'Issues du terrain'], ['Capitalisation', `${4 + observations.length} captures`, 'Mémoire pédagogique']] as metric}
						<article
							class="rounded-2xl border border-[#13233f]/10 bg-[#fffdf8] p-5 shadow-[0_10px_28px_rgba(19,35,63,0.05)]"
						>
							<p class="text-xs font-bold tracking-[0.14em] text-[#718097] uppercase">
								{metric[0]}
							</p>
							<p class="mt-3 text-2xl font-black tracking-[-0.035em]">{metric[1]}</p>
							<p class="mt-1 text-sm text-[#718097]">{metric[2]}</p>
						</article>
					{/each}
				</div>

				<div class="mt-6 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
					<section
						class="rounded-[2rem] border border-[#13233f]/10 bg-[#fffdf8] p-5 shadow-[0_20px_50px_rgba(19,35,63,0.07)] sm:p-7"
						aria-labelledby="sessions-title"
					>
						<div class="flex items-center justify-between gap-4">
							<div>
								<p class="eyebrow">Séances à piloter</p>
								<h3 id="sessions-title" class="mt-2 text-2xl font-black tracking-[-0.035em]">
									Avant → pendant → après
								</h3>
							</div>
							<span class="rounded-full bg-[#edf1f6] px-3 py-1.5 text-xs font-bold text-[#59667a]"
								>2 séances fictives</span
							>
						</div>

						<div class="mt-7 space-y-4">
							{#each sessions as session}
								<article class="rounded-2xl border border-[#13233f]/10 bg-white p-5">
									<div class="flex flex-wrap items-center justify-between gap-3">
										<div class="flex items-center gap-3">
											<span
												class="rounded-lg bg-[#13233f] px-2.5 py-1.5 text-xs font-black text-white"
												>{session.time}</span
											>
											<h4 class="font-black">{session.course}</h4>
										</div>
										<span class={`rounded-full px-3 py-1 text-xs font-bold ${session.statusClass}`}
											>{session.status}</span
										>
									</div>

									<div class="mt-5 grid gap-3 sm:grid-cols-3">
										<div class="rounded-xl bg-[#f3f6fb] p-3.5">
											<p class="mini-label text-[#2958a6]">Préparer</p>
											<p class="mt-2 text-sm leading-5 text-[#536177]">{session.focus}</p>
										</div>
										<div class="rounded-xl bg-[#f3f6fb] p-3.5">
											<p class="mini-label text-[#7d4a1b]">Observer</p>
											<p class="mt-2 text-sm leading-5 text-[#536177]">{session.proof}</p>
										</div>
										<div class="rounded-xl bg-[#f3f6fb] p-3.5">
											<p class="mini-label text-[#176746]">Après</p>
											<p class="mt-2 text-sm leading-5 text-[#536177]">{session.next}</p>
										</div>
									</div>
								</article>
							{/each}
						</div>
					</section>

					<section
						id="capture"
						class="scroll-mt-4 rounded-[2rem] bg-[#13233f] p-5 text-white shadow-[0_22px_58px_rgba(19,35,63,0.2)] sm:p-7"
						aria-labelledby="capture-title"
					>
						<p class="text-xs font-black tracking-[0.18em] text-[#9ebdf3] uppercase">
							Retour terrain express
						</p>
						<h3 id="capture-title" class="mt-2 text-2xl font-black tracking-[-0.035em]">
							Capturer avant d’oublier
						</h3>
						<p class="mt-3 text-sm leading-6 text-[#c9d4e5]">
							Testez avec une observation fictive. Elle restera uniquement dans ce navigateur.
						</p>

						<form class="mt-6" onsubmit={captureObservation}>
							<fieldset>
								<legend class="text-sm font-bold text-white">1. Quel signal retenez-vous ?</legend>
								<div class="mt-3 grid gap-2 sm:grid-cols-3">
									{#each signalOptions as option}
										<button
											type="button"
											aria-pressed={selectedSignal === option.value}
											onclick={() => selectSignal(option.value)}
											class={`rounded-xl border px-3 py-3 text-left transition ${selectedSignal === option.value ? option.activeClass : 'border-white/12 bg-white/[0.05] text-[#d7dfec] hover:bg-white/[0.09]'}`}
										>
											<span class="block text-sm font-black">{option.label}</span>
											<span class="mt-1 block text-[0.7rem] opacity-75">{option.detail}</span>
										</button>
									{/each}
								</div>
							</fieldset>

							<div class="mt-5">
								<div class="flex items-center justify-between gap-3">
									<label for="teacherflow-note" class="text-sm font-bold"
										>2. Votre observation fictive</label
									>
									<span class="text-xs text-[#8fa2bf]">{quickNote.length}/{MAX_NOTE_LENGTH}</span>
								</div>
								<textarea
									id="teacherflow-note"
									bind:value={quickNote}
									maxlength={MAX_NOTE_LENGTH}
									rows="4"
									placeholder="Ex. : la consigne mélange deux opérations ; la découper."
									class="mt-2 w-full resize-y rounded-2xl border border-white/14 bg-white/[0.07] p-4 text-sm leading-6 text-white outline-none placeholder:text-[#8090aa] focus:border-[#8fb2ef] focus:ring-4 focus:ring-[#8fb2ef]/10"
								></textarea>
							</div>

							<div class="mt-3 flex flex-wrap gap-2" aria-label="Exemples de démonstration">
								{#each demoPrompts as prompt, index}
									<button
										type="button"
										onclick={() => (quickNote = prompt)}
										class="rounded-full border border-white/10 px-3 py-1.5 text-left text-[0.7rem] text-[#aebbd0] transition hover:border-white/25 hover:text-white"
									>
										Exemple {index + 1}
									</button>
								{/each}
							</div>

							<button
								type="submit"
								disabled={!quickNote.trim()}
								class="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#ff8b65] px-5 py-3.5 font-black text-[#382017] shadow-[0_12px_28px_rgba(232,118,82,0.23)] transition enabled:hover:-translate-y-0.5 enabled:hover:bg-[#ff9b7b] disabled:cursor-not-allowed disabled:opacity-45"
							>
								<Save size={18} aria-hidden="true" />
								Transformer en prochaine action
							</button>
						</form>

						<div class="mt-4 min-h-6" aria-live="polite">
							{#if successMessage}
								<p class="flex items-start gap-2 text-sm leading-5 text-[#93e3c1]">
									<CheckCircle2 class="mt-0.5 shrink-0" size={16} aria-hidden="true" />
									{successMessage}
								</p>
							{:else if errorMessage}
								<p class="text-sm leading-5 text-[#ffb39b]">{errorMessage}</p>
							{/if}
						</div>
					</section>
				</div>

				<div class="mt-6 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
					<section
						class="rounded-[2rem] border border-[#13233f]/10 bg-[#fffdf8] p-5 shadow-[0_18px_44px_rgba(19,35,63,0.06)] sm:p-7"
						aria-labelledby="improvements-title"
					>
						<div class="flex items-start justify-between gap-4">
							<div>
								<p class="eyebrow">Sortie du système</p>
								<h3 id="improvements-title" class="mt-2 text-2xl font-black tracking-[-0.035em]">
									File « à améliorer »
								</h3>
							</div>
							<span
								class="grid size-10 place-items-center rounded-full bg-[#e9f0ff] font-black text-[#2958a6]"
								>{improvementQueue.length}</span
							>
						</div>

						<ol class="mt-6 space-y-3">
							{#each improvementQueue as improvement, index}
								<li class="flex gap-3 rounded-xl border border-[#13233f]/8 bg-white p-4">
									<span
										class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[#edf1f6] text-[0.65rem] font-black text-[#536177]"
									>
										{index + 1}
									</span>
									<p class="text-sm leading-6 text-[#4f5c70]">{improvement}</p>
								</li>
							{/each}
						</ol>
					</section>

					<section
						class="rounded-[2rem] border border-[#13233f]/10 bg-[#fffdf8] p-5 shadow-[0_18px_44px_rgba(19,35,63,0.06)] sm:p-7"
						aria-labelledby="journal-title"
					>
						<div class="flex flex-wrap items-start justify-between gap-4">
							<div>
								<p class="eyebrow">Mémoire locale</p>
								<h3 id="journal-title" class="mt-2 text-2xl font-black tracking-[-0.035em]">
									Vos captures de démonstration
								</h3>
							</div>
							<button
								type="button"
								onclick={resetDemo}
								class="inline-flex items-center gap-2 rounded-full border border-[#13233f]/12 px-3.5 py-2 text-xs font-bold text-[#536177] transition hover:border-[#c55838]/40 hover:text-[#a74324]"
							>
								<RotateCcw size={14} aria-hidden="true" />
								Réinitialiser
							</button>
						</div>

						{#if observations.length === 0}
							<div
								class="mt-6 rounded-2xl border border-dashed border-[#13233f]/18 bg-white/65 p-7 text-center"
							>
								<p class="font-black">Aucune capture ajoutée — pour l’instant.</p>
								<p class="mt-2 text-sm leading-6 text-[#6b778a]">
									Choisissez un exemple, enregistrez-le et regardez la boucle se refermer.
								</p>
							</div>
						{:else}
							<ul class="mt-6 space-y-3">
								{#each observations as observation}
									<li class="rounded-2xl border border-[#13233f]/9 bg-white p-4">
										<div class="flex flex-wrap items-center justify-between gap-2">
											<span
												class="rounded-full bg-[#edf1f6] px-2.5 py-1 text-[0.7rem] font-black text-[#536177]"
											>
												{signalLabel(observation.signal)}
											</span>
											<time class="text-xs text-[#7a8596]" datetime={observation.capturedAt}>
												{formatCaptureTime(observation.capturedAt)}
											</time>
										</div>
										<p class="mt-3 text-sm leading-6 text-[#4f5c70]">{observation.note}</p>
									</li>
								{/each}
							</ul>
						{/if}
					</section>
				</div>
			</div>
		</section>

		<section
			id="cas"
			class="scroll-mt-4 bg-[#13233f] px-5 py-16 text-white lg:px-8 lg:py-24"
			aria-labelledby="case-title"
		>
			<div class="mx-auto max-w-[1200px]">
				<div class="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
					<div>
						<p class="text-xs font-black tracking-[0.2em] text-[#9ebdf3] uppercase">Étude de cas</p>
						<h2 id="case-title" class="mt-4 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
							D’un prototype à une preuve technopédagogique.
						</h2>
						<p class="mt-6 text-base leading-8 text-[#c9d4e5]">
							La décision clé n’a pas été de construire plus. Elle a été de retirer ce qui empêchait
							un décideur de voir le raisonnement métier.
						</p>
						<a
							href="https://github.com/Amoradvisory/FlowPilot/pull/1"
							target="_blank"
							rel="noreferrer"
							class="mt-7 inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/[0.07] px-5 py-3 text-sm font-bold transition hover:-translate-y-0.5 hover:bg-white/[0.12]"
						>
							<Code2 size={17} aria-hidden="true" />
							Examiner le travail dans GitHub
							<ExternalLink size={14} aria-hidden="true" />
						</a>
					</div>

					<div class="grid gap-3 sm:grid-cols-2">
						{#each [['Problème', 'Les observations post-cours sont précieuses, brèves et souvent perdues avant la prochaine préparation.'], ['Utilisateurs', 'Enseignants, formateurs et responsables pédagogiques qui veulent installer une amélioration continue explicable.'], ['Contrainte centrale', 'Rester assez rapide pour le terrain, sans collecter de données personnelles ni inventer une automatisation magique.'], ['Choix d’architecture', 'Réemployer une base SvelteKit local-first, puis isoler une coque publique TeacherFlow sans authentification.'], ['Données', 'Deux séances et tous les groupes sont fictifs. Les captures saisies restent dans le localStorage du visiteur.'], ['Rôle de l’IA', 'Prévu comme assistance contrôlée à la reformulation et à la différenciation ; volontairement non branché dans cette preuve.'], ['Ce qui fonctionne', 'Sélection du signal, validation, normalisation, persistance locale, file d’amélioration et remise à zéro.'], ['Ce qui est simulé', 'Les priorités du jour, les séances, les compteurs de départ et les contenus pédagogiques exemples.'], ['Limites', 'Pas de compte, pas de synchronisation, pas de validation terrain multi-utilisateurs et aucune mesure de gain de temps.'], ['Prochaine expérience', 'Faire tester la capture en moins de 30 secondes par trois enseignants et mesurer clarté, effort et réutilisation réelle.']] as item}
							<article class="rounded-2xl border border-white/10 bg-white/[0.055] p-5">
								<h3 class="text-sm font-black text-[#ffad91]">{item[0]}</h3>
								<p class="mt-2 text-sm leading-6 text-[#cbd6e7]">{item[1]}</p>
							</article>
						{/each}
					</div>
				</div>
			</div>
		</section>

		<section class="px-5 py-16 lg:px-8 lg:py-24" aria-labelledby="proof-title">
			<div class="mx-auto max-w-[1200px]">
				<div class="max-w-3xl">
					<p class="eyebrow">Ce que la preuve rend visible</p>
					<h2 id="proof-title" class="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
						Un prototype n’a pas besoin de tout faire. Il doit prouver la bonne chose.
					</h2>
				</div>

				<div class="mt-9 grid gap-4 md:grid-cols-2">
					{#each proofCards as proof}
						<article
							class="rounded-[1.6rem] border border-[#13233f]/10 bg-[#fffdf8] p-6 shadow-[0_14px_34px_rgba(19,35,63,0.05)]"
						>
							<div class="grid size-9 place-items-center rounded-full bg-[#e2f6ec] text-[#176746]">
								<Check size={18} strokeWidth={3} aria-hidden="true" />
							</div>
							<h3 class="mt-5 text-xl font-black tracking-[-0.025em]">{proof.title}</h3>
							<p class="mt-3 text-sm leading-7 text-[#5f6c80]">{proof.body}</p>
						</article>
					{/each}
				</div>

				<div class="mt-10 rounded-[2rem] bg-[#dfeaff] p-6 sm:p-9">
					<div class="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
						<div>
							<p class="text-xs font-black tracking-[0.18em] text-[#2958a6] uppercase">
								Lecture terminée ?
							</p>
							<h2 class="mt-3 text-3xl font-black tracking-[-0.04em]">
								Testez une capture. Le produit doit finir la phrase.
							</h2>
							<p class="mt-3 max-w-2xl text-sm leading-7 text-[#536177]">
								Vous apportez le signal ; TeacherFlow le rend actionnable. Le reste demeure sous
								contrôle humain.
							</p>
						</div>
						<a
							href="#capture"
							class="inverse-link inline-flex items-center justify-center gap-2 rounded-full bg-[#173f7e] px-6 py-3.5 font-black text-white shadow-[0_12px_26px_rgba(23,63,126,0.22)] transition hover:-translate-y-0.5"
						>
							Revenir à la démo
							<ArrowRight size={18} aria-hidden="true" />
						</a>
					</div>
				</div>
			</div>
		</section>
	</main>

	<footer class="border-t border-[#13233f]/10 bg-[#efe9dd] px-5 py-8 lg:px-8">
		<div
			class="mx-auto flex max-w-[1200px] flex-col justify-between gap-4 text-sm text-[#687487] sm:flex-row sm:items-center"
		>
			<p>
				<strong class="text-[#13233f]">TeacherFlow</strong> · prototype conçu par Amor El Hamrouni
			</p>
			<p>Enseignant · formateur · conception pédagogique · CAP</p>
		</div>
	</footer>
</div>

<style>
	:global(html) {
		scroll-behavior: smooth;
	}

	.teacherflow-shell {
		color-scheme: light;
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
	}

	.eyebrow,
	.mini-label {
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	.eyebrow {
		color: #c55838;
	}

	.inverse-link {
		color: #fff;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(html) {
			scroll-behavior: auto;
		}

		.teacherflow-shell *,
		.teacherflow-shell *::before,
		.teacherflow-shell *::after {
			scroll-behavior: auto !important;
			animation-duration: 0.01ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0.01ms !important;
		}
	}
</style>
