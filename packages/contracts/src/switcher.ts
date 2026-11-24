// The clinic chooser and switcher (A-01b criteria 10, 11; OD-90, OD-91): the signed-in person's
// own clinics, last used first, with role, last activity and the branches they hold a role in;
// their pending invitations (clinic name and roles only; answered on the invitation's own link);
// switching clinic and branch, checked on the server. A suspended clinic is listed but cannot be
// chosen.
import { z } from 'zod';
import { defineContract } from './define.ts';
import { ErrorEnvelope } from './errors.ts';
import { SessionRole } from './identity.ts';
import { ClinicStatus } from './platform.ts';
import { InvitationRole } from './team.ts';

export const MyBranch = z.object({ id: z.uuid(), name: z.string() }).meta({ id: 'MyBranch' });

export const MyClinic = z
  .object({
    tenantId: z.uuid(),
    name: z.string(),
    status: ClinicStatus,
    /** False for a suspended clinic; a clinic where no role is left is not listed at all. */
    selectable: z.boolean(),
    roles: z.array(SessionRole),
    /**
     * The person holds a tenant-wide role here. False with roles in two or more branches: the
     * chooser asks for a branch (`branch_required` otherwise).
     */
    tenantWide: z.boolean(),
    /** The person's last activity in this clinic; null if never. */
    lastActiveAt: z.iso.datetime().nullable(),
    /** One active branch: no branch screens or branch switcher (PLT-03). */
    solo: z.boolean(),
    /** Active branches the person holds a role in (all of them for a tenant-wide role). */
    branches: z.array(MyBranch),
  })
  .meta({ id: 'MyClinic' });
export type MyClinic = z.infer<typeof MyClinic>;

export const MyInvitation = z
  .object({
    /** The invitation's id. It is answered on its own link (OD-91), never by this id. */
    id: z.uuid(),
    clinicName: z.string(),
    roles: z.array(InvitationRole),
    expiresAt: z.iso.datetime(),
  })
  .meta({ id: 'MyInvitation' });
export type MyInvitation = z.infer<typeof MyInvitation>;

export const MyClinics = z
  .object({ clinics: z.array(MyClinic), invitations: z.array(MyInvitation) })
  .meta({ id: 'MyClinics' });
export type MyClinics = z.infer<typeof MyClinics>;

export const SwitchRequest = z
  .object({
    tenantId: z.uuid(),
    /**
     * Omitted or null: none (all branches) for a tenant-wide role, else the one branch the person
     * holds there; 400 `branch_required` for roles in two or more branches.
     */
    branchId: z.uuid().nullable().optional(),
  })
  .meta({ id: 'SwitchRequest' });
export type SwitchRequest = z.infer<typeof SwitchRequest>;

export const ActiveClinic = z
  .object({ tenantId: z.uuid(), branchId: z.uuid().nullable() })
  .meta({ id: 'ActiveClinic' });
export type ActiveClinic = z.infer<typeof ActiveClinic>;

export const meClinics = defineContract({
  operationId: 'meClinics',
  method: 'GET',
  path: '/me/clinics',
  summary: 'The signed-in person’s clinics and pending invitations (clinic chooser)',
  // 404 `no_clinic`: no clinic and no invitation.
  responses: { 200: MyClinics, 404: ErrorEnvelope },
});

export const meSwitch = defineContract({
  operationId: 'meSwitch',
  method: 'POST',
  path: '/me/switch',
  summary: 'Switch the session to one of the person’s clinics and branches',
  request: { body: SwitchRequest },
  // 400 `branch_required`; 403 `clinic_suspended` or `branch_not_held`; 404 not a clinic of the
  // person; 409 `branch_archived`.
  responses: {
    200: ActiveClinic,
    400: ErrorEnvelope,
    403: ErrorEnvelope,
    404: ErrorEnvelope,
    409: ErrorEnvelope,
  },
});
