import { portalApi } from "@/shared/api/generated/portalApi";

/** What every department mutation invalidates (see below). */
const DEPARTMENT_TAGS: ("Departments" | "Users" | "Profiles" | "Dashboard")[] = ["Departments", "Users", "Profiles", "Dashboard"];

/**
 * What every position mutation invalidates: a position's name and level show beside the people who hold it (the users
 * list, the members of a department, a person's profile, the staff dashboard), so those read again.
 */
const POSITION_TAGS: ("Positions" | "Departments" | "Users" | "Profiles" | "Dashboard")[] = ["Positions", ...DEPARTMENT_TAGS];

/**
 * The Roles tab shows how many people hold each role, and DeleteRoleDialog asks "confirm" or "choose a replacement"
 * from that number. Every change to the users can move it, so the user mutations (which the generated client tags
 * `Users` only) also invalidate `Roles`. The same changes move the departments (head counts, member counts, the chart),
 * so they invalidate `Departments` too. Imported by the components that send those mutations.
 *
 * The other way round, a member of a department is a user whose assignments show on the users page, so every
 * department mutation (the generated client tags them `Departments` only) also invalidates `Users`. A person's profile
 * (department, position, head or deputy) and the staff dashboard (headcounts and the employee list per department)
 * read the same assignments, so those are invalidated as well.
 */
portalApi.enhanceEndpoints({
  endpoints: {
    createUser: { invalidatesTags: ["Users", "Roles", "Departments"] },
    updateUser: { invalidatesTags: ["Users", "Roles", "Departments"] },
    deleteUser: { invalidatesTags: ["Users", "Roles", "Departments"] },
    deactivateUser: { invalidatesTags: ["Users", "Roles", "Departments"] },
    reactivateUser: { invalidatesTags: ["Users", "Roles", "Departments"] },

    createDepartment: { invalidatesTags: DEPARTMENT_TAGS },
    updateDepartment: { invalidatesTags: DEPARTMENT_TAGS },
    moveDepartment: { invalidatesTags: DEPARTMENT_TAGS },
    setDepartmentActive: { invalidatesTags: DEPARTMENT_TAGS },
    deleteDepartment: { invalidatesTags: DEPARTMENT_TAGS },
    addDepartmentMembers: { invalidatesTags: DEPARTMENT_TAGS },
    updateDepartmentMember: { invalidatesTags: DEPARTMENT_TAGS },
    removeDepartmentMember: { invalidatesTags: DEPARTMENT_TAGS },
    setPrimaryDepartment: { invalidatesTags: DEPARTMENT_TAGS },

    createPosition: { invalidatesTags: POSITION_TAGS },
    updatePosition: { invalidatesTags: POSITION_TAGS },
    deletePosition: { invalidatesTags: POSITION_TAGS },

    // The invitations show as rows of the users list, and accepting one makes a user (who holds a role): the list and
    // the role counts read again. Availability is no invitation's business, so the generated tag on it is dropped.
    getInvitationAvailability: { providesTags: [] },
    createInvitation: { invalidatesTags: ["Invitations", "Users"] },
    resendInvitation: { invalidatesTags: ["Invitations", "Users"] },
    revokeInvitation: { invalidatesTags: ["Invitations", "Users"] },
    acceptInvitation: { invalidatesTags: ["Invitations", "Users", "Roles", "Departments"] },

    // The chart carries the organization's name (its top card), so saving the company redraws it.
    updateOrganization: { invalidatesTags: ["Organization", "Departments"] },
  },
});
