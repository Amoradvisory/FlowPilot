export type IsoUtcString = string;
export type WorkspaceId = string;
export type EntityId = string;

export type Clock = () => Date;
export type IdFactory = () => string;

export type SessionStatus = 'planned' | 'taught' | 'completed';
export type ObservationSignal = 'keep' | 'adjust' | 'verify';
export type DecisionStatus = 'to_prepare' | 'ready' | 'applied';

export interface Course {
	readonly id: EntityId;
	readonly workspaceId: WorkspaceId;
	readonly name: string;
	readonly subject?: string;
	readonly colorToken: string;
	readonly archivedAt?: IsoUtcString;
	readonly createdAt: IsoUtcString;
	readonly updatedAt: IsoUtcString;
}

export interface Session {
	readonly id: EntityId;
	readonly workspaceId: WorkspaceId;
	readonly courseId: EntityId;
	readonly title: string;
	readonly scheduledFor?: IsoUtcString;
	readonly status: SessionStatus;
	readonly createdAt: IsoUtcString;
	readonly updatedAt: IsoUtcString;
}

export interface Observation {
	readonly id: EntityId;
	readonly workspaceId: WorkspaceId;
	readonly sessionId: EntityId;
	readonly signal: ObservationSignal;
	readonly note: string;
	readonly createdAt: IsoUtcString;
	readonly updatedAt: IsoUtcString;
}

export interface Decision {
	readonly id: EntityId;
	readonly workspaceId: WorkspaceId;
	readonly observationId: EntityId;
	readonly targetSessionId?: EntityId;
	readonly text: string;
	readonly status: DecisionStatus;
	readonly appliedAt?: IsoUtcString;
	readonly createdAt: IsoUtcString;
	readonly updatedAt: IsoUtcString;
}

export interface CourseDraft {
	readonly workspaceId: WorkspaceId;
	readonly name: string;
	readonly subject?: string;
	readonly colorToken: string;
}

export interface SessionDraft {
	readonly workspaceId: WorkspaceId;
	readonly courseId: EntityId;
	readonly title: string;
	readonly scheduledFor?: IsoUtcString;
	readonly status?: SessionStatus;
}

export interface ObservationDraft {
	readonly workspaceId: WorkspaceId;
	readonly sessionId: EntityId;
	readonly signal: ObservationSignal;
	readonly note: string;
}

export interface DecisionDraft {
	readonly workspaceId: WorkspaceId;
	readonly observationId: EntityId;
	readonly targetSessionId?: EntityId;
	readonly text: string;
}

export interface WorkspaceSnapshot {
	readonly workspaceId: WorkspaceId;
	readonly courses: readonly Course[];
	readonly sessions: readonly Session[];
	readonly observations: readonly Observation[];
	readonly decisions: readonly Decision[];
}

export interface DeletionSet {
	readonly courseIds: readonly EntityId[];
	readonly sessionIds: readonly EntityId[];
	readonly observationIds: readonly EntityId[];
	readonly decisionIds: readonly EntityId[];
}

export interface DeletionIntent {
	readonly kind: 'delete_observation' | 'delete_course';
	readonly workspaceId: WorkspaceId;
	readonly delete: DeletionSet;
	readonly clearDecisionTargetIds: readonly EntityId[];
	readonly requiresDetailedConfirmation: boolean;
}

export interface TodaySelection {
	readonly nextSession?: Session;
	readonly unscheduledDecisions: readonly Decision[];
	readonly sessionDecisions: readonly Decision[];
}

export interface MemoryFilters {
	readonly courseId?: EntityId;
	readonly signal?: ObservationSignal;
	readonly decisionStatus?: DecisionStatus;
}

export interface MemoryEntry {
	readonly course: Course;
	readonly session: Session;
	readonly observation: Observation;
	readonly decision?: Decision;
}
