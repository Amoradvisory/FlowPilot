<script lang="ts">
	import ConfirmDialog from '$lib/teacherflow/components/ConfirmDialog.svelte';
	import StatusMessage from '$lib/teacherflow/components/StatusMessage.svelte';
	import {
		exportWorkspace,
		parseTeacherFlowBackup,
		type TeacherFlowBackup
	} from '$lib/teacherflow/data/backup';
	import { DEMO_WORKSPACE_ID, PERSONAL_WORKSPACE_ID } from '$lib/teacherflow/demo/seed';
	import { getTeacherFlowState } from '$lib/teacherflow/state/context';

	const teacherFlow = getTeacherFlowState();
	let preview = $state<TeacherFlowBackup>();
	let importError = $state<string>();
	let resetPersonal = $state(false);
	let resetDemo = $state(false);

	async function usePersonal() {
		await teacherFlow.switchWorkspace(PERSONAL_WORKSPACE_ID);
	}

	function download() {
		try {
			const backup = exportWorkspace(teacherFlow.snapshot, '0.0.1');
			const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
			const href = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = href;
			link.download = `teacherflow-backup-${backup.exportedAt.slice(0, 10)}.json`;
			link.click();
			setTimeout(() => URL.revokeObjectURL(href), 0);
		} catch {
			importError =
				'L’export n’a pas pu être préparé. Vos données existantes n’ont pas été modifiées.';
		}
	}

	async function previewImport(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		preview = undefined;
		importError = undefined;
		if (!file) return;
		const parsed = parseTeacherFlowBackup(await file.text());
		if (!parsed.ok) {
			importError =
				parsed.reason === 'too_large'
					? 'Ce fichier dépasse la taille maximale autorisée.'
					: 'Ce fichier n’est pas une sauvegarde TeacherFlow valide.';
			return;
		}
		preview = parsed.value;
	}

	async function restoreImport() {
		if (!preview) return;
		await teacherFlow.replacePersonal(preview);
		preview = undefined;
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
				<button class="button button--secondary" type="button" onclick={() => (resetDemo = true)}
					>Réinitialiser la démonstration</button
				><button class="button button--primary" type="button" onclick={usePersonal}
					>Utiliser mon espace personnel</button
				>
			</div>
		</section>
	{:else}
		<section class="management-section">
			<h2>Sauvegarder votre espace personnel</h2>
			<p>
				{teacherFlow.snapshot.courses.length} cours · {teacherFlow.snapshot.sessions.length} séances ·
				{teacherFlow.snapshot.observations.length} observations · {teacherFlow.snapshot.decisions
					.length} décisions
			</p>
			<button class="button button--primary" type="button" onclick={download}
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
						Exportée le {new Date(preview.exportedAt).toLocaleString('fr-FR')} · {preview.courses
							.length} cours · {preview.sessions.length} séances · {preview.observations.length} observations
						· {preview.decisions.length} décisions.
					</p>
					<button class="button button--primary" type="button" onclick={restoreImport}
						>Remplacer mon espace avec cette sauvegarde</button
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
			<button class="button button--quiet" type="button" onclick={() => (resetPersonal = true)}
				>Réinitialiser mes données</button
			>
		</section>
	{/if}
	<StatusMessage kind={teacherFlow.status?.kind ?? 'info'} message={teacherFlow.status?.message} />
</div>

<ConfirmDialog
	open={resetDemo}
	title="Régénérer les données de démonstration ?"
	description="Les modifications apportées aux données fictives seront remplacées par le scénario de démonstration."
	confirmLabel="Régénérer la démonstration"
	onconfirm={async () => {
		await teacherFlow.resetDemo();
		resetDemo = false;
	}}
	oncancel={() => (resetDemo = false)}
/>
<ConfirmDialog
	open={resetPersonal}
	title="Supprimer toutes vos données locales ?"
	description="Cours, séances, observations, décisions et sauvegardes de récupération seront supprimés de cet appareil. Cette action ne peut pas être annulée."
	confirmLabel="Supprimer définitivement"
	danger={true}
	onconfirm={async () => {
		await teacherFlow.resetPersonal();
		resetPersonal = false;
	}}
	oncancel={() => (resetPersonal = false)}
/>
