import { portalApi } from "@/shared/api/generated/portalApi";

/**
 * The Roles tab shows how many people hold each role, and DeleteRoleDialog asks "confirm" or "choose a replacement"
 * from that number. Every change to the users can move it, so the user mutations (which the generated client tags
 * `Users` only) also invalidate `Roles`. The same changes move the departments (head counts, member counts, the chart),
 * so they invalidate `Departments` too. Imported by the components that send those mutations.
 *
 * The other way round, a member of a department is a user whose assignments show on the users page, so every
 * department mutation (the generated client tags them `Departments` only) also invalidates `Users`.
 */
portalApi.enhanceEndpoints({
  endpoints: {
    createUser: { invalidatesTags: ["Users", "Roles", "Departments"] },
    updateUser: { invalidatesTags: ["Users", "Roles", "Departments"] },
    deleteUser: { invalidatesTags: ["Users", "Roles", "Departments"] },
    deactivateUser: { invalidatesTags: ["Users", "Roles", "Departments"] },
    reactivateUser: { invalidatesTags: ["Users", "Roles", "Departments"] },

    createDepartment: { invalidatesTags: ["Departments", "Users"] },
    updateDepartment: { invalidatesTags: ["Departments", "Users"] },
    moveDepartment: { invalidatesTags: ["Departments", "Users"] },
    setDepartmentActive: { invalidatesTags: ["Departments", "Users"] },
    deleteDepartment: { invalidatesTags: ["Departments", "Users"] },
    addDepartmentMembers: { invalidatesTags: ["Departments", "Users"] },
    updateDepartmentMember: { invalidatesTags: ["Departments", "Users"] },
    removeDepartmentMember: { invalidatesTags: ["Departments", "Users"] },
    setPrimaryDepartment: { invalidatesTags: ["Departments", "Users"] },
  },
});
