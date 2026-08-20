<script lang="ts">
	import ConfirmDialog from '$lib/teacherflow/components/ConfirmDialog.svelte';
	import StatusMessage from '$lib/teacherflow/components/StatusMessage.svelte';
	import {
		exportWorkspace,
		parseTeacherFlowBackup,
		serializeTeacherFlowBackup,
		TEACHERFLOW_BACKUP_MAX_BYTES,
		type TeacherFlowBackup
	} from '$lib/teacherflow/data/backup';
	import { DEMO_WORKSPACE_ID, PERSONAL_WORKSPACE_ID } from '$lib/teacherflow/demo/seed';
	import { getTeacherFlowState } from '$lib/teacherflow/state/context';
	import { TEACHERFLOW_APP_VERSION } from '$lib/teacherflow/version';

	const teacherFlow = getTeacherFlowState();
	let preview = $state.raw<TeacherFlowBackup>();
	let importError = $state<string>();
	let resetPersonal = $state(false);
	let resetDemo = $state(false);
	let busy = $state(false);
	let resetPersonalTrigger = $state<HTMLButtonElement>();
	let resetDemoTrigger = $state<HTMLButtonElement>();
	const count = (value: number, singular: string, plural: string) =>
		`${value} ${value === 1 ? singular : plural}`;
	const snapshotCounts = () =>
		[
			count(teacherFlow.snapshot.courses.length, 'cours', 'cours'),
			count(teacherFlow.snapshot.sessions.length, 'séance', 'séances'),
			count(teacherFlow.snapshot.observations.length, 'observation', 'observations'),
			count(teacherFlow.snapshot.decisions.length, 'décision', 'décisions')
		].join(', ');

	async function usePersonal() {
		if (busy) return;
		busy = true;
		try {
			await teacherFlow.switchWorkspace(PERSONAL_WORKSPACE_ID);
		} finally {
			busy = false;
		}
	}

	async function download() {
		if (busy) return;
		busy = true;
		importError = undefined;
		let href: string | undefined;
		try {
			const backup = exportWorkspace(teacherFlow.snapshot, TEACHERFLOW_APP_VERSION);
			const blob = new Blob([serializeTeacherFlowBackup(backup)], { type: 'application/json' });
			href = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = href;
			link.download = `teacherflow-backup-${backup.exportedAt.slice(0, 10)}.json`;
			link.click();
			await teacherFlow.markPersonalExportedAt(backup.exportedAt);
		} catch {
			importError =
				'L’export n’a pas pu être préparé. Vos données existantes n’ont pas été modifiées.';
		} finally {
			if (href) {
				const objectUrl = href;
				setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
			}
			busy = false;
		}
	}

	async function previewImport(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		preview = undefined;
		importError = undefined;
		if (!file) return;
		busy = true;
		try {
			if (file.size > TEACHERFLOW_BACKUP_MAX_BYTES) {
				importError = 'File exceeds the 1 MB import limit.';
				return;
			}
			let parsed;
			try {
				parsed = parseTeacherFlowBackup(await file.text());
			} catch {
				importError = 'File could not be read. Retry with a valid local backup.';
				return;
			}
			if (!parsed.ok) {
				importError =
					parsed.reason === 'too_large'
						? 'Ce fichier dépasse la taille maximale autorisée.'
						: 'Ce fichier n’est pas une sauvegarde TeacherFlow valide.';
				return;
			}
			preview = parsed.value;
		} finally {
			busy = false;
		}
	}

	async function restoreImport() {
		if (!preview || busy) return;
		busy = true;
		try {
			if (await teacherFlow.replacePersonal(preview)) preview = undefined;
		} finally {
			busy = false;
		}
	}

	async function confirmDemoReset() {
		if (busy) return;
		busy = true;
		try {
			await teacherFlow.resetDemo();
			resetDemo = false;
		} finally {
			busy = false;
		}
	}

	async function confirmPersonalReset() {
		if (busy) return;
		busy = true;
		try {
			await teacherFlow.resetPersonal();
			resetPersonal = false;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Données · TeacherFlow</title></svelte:head>

<div class="page-shell data-page">
	<section class="page-intro">
		<p class="eyebrow">Données</p>
		<h1>Votre mémoire reste dans ce navigateur.</h1>
		<p>
			Pas de compte, de cloud, de synchronisation ou d’analyse. Sur un appareil partagé, fermez
			votre session système ou utilisez un navigateur séparé : ce navigateur garde les données
			locales.
		</p>
	</section>

	{#if teacherFlow.workspaceId === DEMO_WORKSPACE_ID}
		<section class="management-section">
			<h2>Données de démonstration</h2>
			<p>Le contenu est fictif. Vous pouvez le régénérer sans toucher à votre espace personnel.</p>
			<div class="form-actions">
				<button
					bind:this={resetDemoTrigger}
					class="button button--secondary"
					type="button"
					disabled={busy}
					onclick={() => (resetDemo = true)}>Réinitialiser la démonstration</button
				><button class="button button--primary" type="button" disabled={busy} onclick={usePersonal}
					>Utiliser mon espace personnel</button
				>
			</div>
		</section>
	{:else}
		<p class="quiet-note" aria-live="polite">
			{teacherFlow.lastExportedAt
				? `Dernier export : ${new Date(teacherFlow.lastExportedAt).toLocaleString('fr-FR')}. ${teacherFlow.hasChangesSinceLastExport ? 'Des modifications existent depuis cet export.' : 'Aucune modification depuis cet export.'}`
				: 'Aucun export enregistré sur cet appareil.'}
		</p>
		<section class="management-section">
			<h2>Sauvegarder votre espace personnel</h2>
			<p>
				{count(teacherFlow.snapshot.courses.length, 'cours', 'cours')} · {count(
					teacherFlow.snapshot.sessions.length,
					'séance',
					'séances'
				)} · {count(teacherFlow.snapshot.observations.length, 'observation', 'observations')} · {count(
					teacherFlow.snapshot.decisions.length,
					'décision',
					'décisions'
				)}
			</p>
			<button class="button button--primary" type="button" disabled={busy} onclick={download}
				>Exporter mes données</button
			>
		</section>

		<section class="management-section">
			<h2>Restaurer une sauvegarde</h2>
			<p>
				L’import remplace entièrement votre espace personnel ; il ne fusionne jamais deux
				historiques au hasard.
			</p>
			<label
				>Fichier de sauvegarde TeacherFlow <input
					type="file"
					accept="application/json,.json"
					disabled={busy}
					onchange={previewImport}
				/></label
			>
			{#if importError}<p class="status-message status-message--error" role="alert">
					{importError}
				</p>{/if}
			{#if preview}
				<section class="import-preview" aria-live="polite">
					<h3>Aperçu avant remplacement</h3>
					<p>
						Exportée le {new Date(preview.exportedAt).toLocaleString('fr-FR')} · {count(
							preview.courses.length,
							'cours',
							'cours'
						)} · {count(preview.sessions.length, 'séance', 'séances')} · {count(
							preview.observations.length,
							'observation',
							'observations'
						)} · {count(preview.decisions.length, 'décision', 'décisions')}.
					</p>
					<button
						class="button button--primary"
						type="button"
						disabled={busy}
						onclick={restoreImport}>Remplacer mon espace avec cette sauvegarde</button
					>
				</section>
			{/if}
		</section>

		<section class="management-section management-section--danger">
			<h2>Effacer l’espace personnel</h2>
			<p>
				Cette action supprime cours, séances, observations, décisions et sauvegardes de récupération
				de cet appareil.
			</p>
			<button
				bind:this={resetPersonalTrigger}
				class="button button--quiet"
				type="button"
				disabled={busy}
				onclick={() => (resetPersonal = true)}>Réinitialiser mes données</button
			>
		</section>
	{/if}
	<StatusMessage kind={teacherFlow.status?.kind ?? 'info'} message={teacherFlow.status?.message} />
</div>

<ConfirmDialog
	id="data-reset-demo"
	open={resetDemo}
	title="Régénérer les données de démonstration ?"
	description={`${snapshotCounts()} seront remplacés par le scénario de démonstration d’origine.`}
	confirmLabel="Régénérer la démonstration"
	{busy}
	returnFocus={resetDemoTrigger}
	onconfirm={confirmDemoReset}
	oncancel={() => (resetDemo = false)}
/>
<ConfirmDialog
	id="data-reset-personal"
	open={resetPersonal}
	title="Supprimer toutes vos données locales ?"
	description={`${snapshotCounts()}, ainsi que les sauvegardes de récupération associées, seront supprimés de cet appareil. Cette action ne peut pas être annulée.`}
	confirmLabel="Supprimer définitivement"
	danger={true}
	typedPhrase="SUPPRIMER"
	{busy}
	returnFocus={resetPersonalTrigger}
	onconfirm={confirmPersonalReset}
	oncancel={() => (resetPersonal = false)}
/>
