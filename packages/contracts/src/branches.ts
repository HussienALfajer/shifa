// Branches (A-01b criterion 9, PLT-03, PLT-04): the owner creates, edits and archives the
// clinic's locations. Hours, prices and cash boxes come with A-04/A-06. An archived branch is
// listed apart and leaves switchers and role pickers; the last active branch stays.
import { z } from 'zod';
import { defineContract } from './define.ts';
import { ErrorEnvelope } from './errors.ts';

/** A name as typed: 1 to 200 characters, not only spaces. */
const BranchName = z.string().max(200).regex(/\S/);
/** As typed; normalised to E.164 by the server (400 on body.phone when invalid). */
const BranchPhoneInput = z.string().min(1).max(32);
const BranchAddress = z.string().max(300).regex(/\S/);

export const Branch = z
  .object({
    id: z.uuid(),
    name: z.string(),
    address: z.string().nullable(),
    /** E.164. */
    phone: z.string().nullable(),
    archivedAt: z.iso.datetime().nullable(),
    /** Active members with a role in this branch (tenant-wide roles not counted). */
    memberCount: z.int().min(0),
  })
  .meta({ id: 'Branch' });
export type Branch = z.infer<typeof Branch>;

export const BranchList = z
  .object({ active: z.array(Branch), archived: z.array(Branch) })
  .meta({ id: 'BranchList' });
export type BranchList = z.infer<typeof BranchList>;

export const CreateBranchRequest = z
  .object({
    name: BranchName,
    address: BranchAddress.nullable().optional(),
    phone: BranchPhoneInput.nullable().optional(),
  })
  .meta({ id: 'CreateBranchRequest' });
export type CreateBranchRequest = z.infer<typeof CreateBranchRequest>;

/** Only the fields given change; `null` clears the address or phone. */
export const UpdateBranchRequest = z
  .object({
    name: BranchName.optional(),
    address: BranchAddress.nullable().optional(),
    phone: BranchPhoneInput.nullable().optional(),
  })
  .meta({ id: 'UpdateBranchRequest' });
export type UpdateBranchRequest = z.infer<typeof UpdateBranchRequest>;

export const ArchivedMember = z
  .object({ id: z.uuid(), name: z.string() })
  .meta({ id: 'ArchivedMember' });

/** Before archiving: is it the last active branch, and whose sessions end (criterion 4). */
export const ArchiveBranchPreview = z
  .object({ lastBranch: z.boolean(), members: z.array(ArchivedMember) })
  .meta({ id: 'ArchiveBranchPreview' });
export type ArchiveBranchPreview = z.infer<typeof ArchiveBranchPreview>;

export const BranchIdParams = z.object({ id: z.uuid() }).meta({ id: 'BranchIdParams' });

export const branchesList = defineContract({
  operationId: 'branchesList',
  method: 'GET',
  path: '/branches',
  summary: 'The clinic’s active and archived branches',
  responses: { 200: BranchList },
});

export const branchesCreate = defineContract({
  operationId: 'branchesCreate',
  method: 'POST',
  path: '/branches',
  summary: 'Add a branch',
  request: { body: CreateBranchRequest },
  // 400 `validation_failed`: an empty name or an invalid phone; 409 `limit_reached` (the branch
  // limit, with `limitReached`; A-02-03).
  responses: { 201: Branch, 400: ErrorEnvelope, 409: ErrorEnvelope },
});

export const branchesUpdate = defineContract({
  operationId: 'branchesUpdate',
  method: 'PATCH',
  path: '/branches/:id',
  summary: 'Rename a branch or change its address and phone',
  request: { params: BranchIdParams, body: UpdateBranchRequest },
  // 400 `validation_failed`; 409 `branch_archived`.
  responses: { 200: Branch, 400: ErrorEnvelope, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

export const branchesArchivePreview = defineContract({
  operationId: 'branchesArchivePreview',
  method: 'GET',
  path: '/branches/:id/archive-preview',
  summary: 'Whether a branch can be archived and whose sessions would end',
  request: { params: BranchIdParams },
  responses: { 200: ArchiveBranchPreview, 404: ErrorEnvelope },
});

export const branchesArchive = defineContract({
  operationId: 'branchesArchive',
  method: 'POST',
  path: '/branches/:id/archive',
  summary: 'Archive a branch; members left without an active branch are signed out here',
  request: { params: BranchIdParams },
  // 409 `last_branch` or `branch_archived`.
  responses: { 200: Branch, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

/**
 * OD-105: the branch returns to switchers and role pickers; the roles that pointed at it stand
 * again (sessions the archive ended stay ended). 409 `branch_not_archived`; `limit_reached` (the
 * branch limit, A-02-03).
 */
export const branchesRestore = defineContract({
  operationId: 'branchesRestore',
  method: 'POST',
  path: '/branches/:id/restore',
  summary: 'Restore an archived branch',
  request: { params: BranchIdParams },
  responses: { 200: Branch, 404: ErrorEnvelope, 409: ErrorEnvelope },
});
