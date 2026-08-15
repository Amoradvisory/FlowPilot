/** Stable, product-facing storage errors. Keep the French instructions out of UI code. */
export class TeacherFlowStorageError extends Error {
	constructor(
		readonly code: 'StorageUnavailable' | 'StorageFull' | 'InvalidStoredData' | 'MigrationFailed',
		readonly recoveryInstruction: string,
		cause?: unknown
	) {
		super(recoveryInstruction, cause === undefined ? undefined : { cause });
		this.name = code;
	}
}

export class StorageUnavailable extends TeacherFlowStorageError {
	constructor(cause?: unknown) {
		super(
			'StorageUnavailable',
			'Le stockage local est indisponible. Réessayez ou exportez vos données avant de continuer.',
			cause
		);
	}
}

export class StorageFull extends TeacherFlowStorageError {
	constructor(cause?: unknown) {
		super(
			'StorageFull',
			'Le stockage local est plein. Exportez vos données puis libérez de l’espace avant de réessayer.',
			cause
		);
	}
}

export class InvalidStoredData extends TeacherFlowStorageError {
	constructor(cause?: unknown) {
		super(
			'InvalidStoredData',
			'Les données stockées ne peuvent pas être lues. Conservez une sauvegarde puis réessayez.',
			cause
		);
	}
}

export class MigrationFailed extends TeacherFlowStorageError {
	constructor(cause?: unknown) {
		super(
			'MigrationFailed',
			'La migration a échoué. La source et la sauvegarde sont conservées ; réessayez ou téléchargez-les.',
			cause
		);
	}
}

export function mapStorageError(error: unknown): Error {
	if (error instanceof TeacherFlowStorageError) return error;
	const name = error instanceof Error ? error.name : '';
	if (name === 'QuotaExceededError') return new StorageFull(error);
	if (name === 'SecurityError' || name === 'InvalidStateError' || name === 'NotAllowedError') {
		return new StorageUnavailable(error);
	}
	if (name === 'DataError' || name === 'ConstraintError' || name === 'SyntaxError') {
		return new InvalidStoredData(error);
	}
	return error instanceof Error ? error : new StorageUnavailable(error);
}
