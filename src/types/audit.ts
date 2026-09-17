import type { EntityId, IsoDateTime } from "./core";

/** Stable reference to the user or system actor responsible for a change. */
export type AuditActorId = EntityId;

/** Minimum audit fields for any persisted entity. */
export interface TimestampAuditFields {
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/**
 * Actor-aware fields. A null actor means the operation was performed by a
 * trusted system process rather than an authenticated user.
 */
export interface ActorAuditFields {
  createdByUserId: AuditActorId | null;
  updatedByUserId: AuditActorId | null;
}

/**
 * Archive/soft-delete metadata. All fields are null while the record is
 * active. An archived record must provide `archivedAt`; actor and reason may
 * remain null for system actions or when no reason was supplied.
 */
export interface ArchiveAuditFields {
  archivedAt: IsoDateTime | null;
  archivedByUserId: AuditActorId | null;
  archiveReason: string | null;
}

/** Optional administrative context represented explicitly as nullable data. */
export interface AdministrativeAuditFields {
  administrativeNote: string | null;
}

/** Full audit shape for actor-aware, archivable persisted entities. */
export interface FullAuditFields
  extends TimestampAuditFields,
    ActorAuditFields,
    ArchiveAuditFields,
    AdministrativeAuditFields {}
