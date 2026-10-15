import { portalApi } from "@/shared/api/generated/portalApi";

/**
 * The Roles tab shows how many people hold each role, and DeleteRoleDialog asks "confirm" or "choose a replacement"
 * from that number. Every change to the users can move it, so the user mutations (which the generated client tags
 * `Users` only) also invalidate `Roles`. Imported by the components that send those mutations.
 */
portalApi.enhanceEndpoints({
  endpoints: {
    createUser: { invalidatesTags: ["Users", "Roles"] },
    updateUser: { invalidatesTags: ["Users", "Roles"] },
    deleteUser: { invalidatesTags: ["Users", "Roles"] },
    deactivateUser: { invalidatesTags: ["Users", "Roles"] },
    reactivateUser: { invalidatesTags: ["Users", "Roles"] },
  },
});
