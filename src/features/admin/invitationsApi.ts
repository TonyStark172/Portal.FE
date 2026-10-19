import { portalApi } from "@/shared/api/generated/portalApi";

/*
 * TEMPORARY — thay bằng hook sinh tự động khi BE xong.
 *
 * The invitation endpoints (docs/superpowers/specs/2026-10-19-invitations-contract.md) are not in the client generated
 * from OpenAPI (src/shared/api/generated/portalApi.ts) yet, so they are declared by hand here, typed as the contract
 * says. Once Portal.BE has them: `npm run api:fetch && npm run api:generate`, point the imports of this file at the
 * generated hooks and types (their names may differ), then delete this file. Accepting (POST
 * /api/Invitations/accept/{token}) is not here: it goes through the route handler src/app/api/session/invitation/[token]
 * so the refresh token lands in the httpOnly cookie, as signing in does.
 */

export type InvitationStatus = "Pending" | "Expired" | "Accepted" | "Revoked";

export type InvitationDto = {
  id: number;
  email: string;
  roleId: number;
  roleName: string;
  invitedByName: string;
  createdAt: string;
  expiresAt: string;
  status: InvitationStatus;
  lastSendFailedAt: string | null;
};

export type InvitationPreviewDto = { organizationName: string; email: string; roleName: string; expiresAt: string };

export type InvitationAvailabilityDto = { canSendEmail: boolean };

/** `roleId: null` is the default role; the server forces it for anyone but the administrator. */
export type CreateInvitationCommand = { email: string; roleId: number | null };

export type AcceptInvitationCommand = { fullName: string; userName: string; password: string };

const invitationsApi = portalApi.enhanceEndpoints({ addTagTypes: ["Invitations"] }).injectEndpoints({
  endpoints: (build) => ({
    getInvitationAvailability: build.query<InvitationAvailabilityDto, void>({
      query: () => ({ url: `/api/Invitations/availability` }),
    }),
    /** Without a status: the Pending and the Expired ones, newest first. */
    getInvitations: build.query<InvitationDto[], { status?: InvitationStatus }>({
      query: (queryArg) => ({ url: `/api/Invitations`, params: { status: queryArg.status } }),
      providesTags: ["Invitations"],
    }),
    /** 201 with the new invitation's id. */
    createInvitation: build.mutation<number, { createInvitationCommand: CreateInvitationCommand }>({
      query: (queryArg) => ({ url: `/api/Invitations`, method: "POST", body: queryArg.createInvitationCommand }),
      invalidatesTags: ["Invitations"],
    }),
    resendInvitation: build.mutation<void, { id: number }>({
      query: (queryArg) => ({ url: `/api/Invitations/${queryArg.id}/resend`, method: "POST" }),
      invalidatesTags: ["Invitations"],
    }),
    revokeInvitation: build.mutation<void, { id: number }>({
      query: (queryArg) => ({ url: `/api/Invitations/${queryArg.id}/revoke`, method: "POST" }),
      invalidatesTags: ["Invitations"],
    }),
    /** Anonymous: 404 for a token unknown or used, 410 for one expired or revoked. */
    getInvitationPreview: build.query<InvitationPreviewDto, { token: string }>({
      query: (queryArg) => ({ url: `/api/Invitations/accept/${encodeURIComponent(queryArg.token)}` }),
    }),
  }),
});

export const {
  useGetInvitationAvailabilityQuery,
  useGetInvitationsQuery,
  useCreateInvitationMutation,
  useResendInvitationMutation,
  useRevokeInvitationMutation,
  useGetInvitationPreviewQuery,
} = invitationsApi;
