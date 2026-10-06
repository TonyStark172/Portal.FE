import { baseApi as api } from "../baseApi";
export const addTagTypes = [
  "Auth",
  "Departments",
  "Organization",
  "Permissions",
  "Positions",
  "Profiles",
  "Roles",
  "Users",
] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      login: build.mutation<LoginApiResponse, LoginApiArg>({
        query: (queryArg) => ({
          url: `/api/Auth/login`,
          method: "POST",
          body: queryArg.loginCommand,
        }),
        invalidatesTags: ["Auth"],
      }),
      refreshToken: build.mutation<RefreshTokenApiResponse, RefreshTokenApiArg>(
        {
          query: (queryArg) => ({
            url: `/api/Auth/refresh`,
            method: "POST",
            body: queryArg.refreshTokenCommand,
          }),
          invalidatesTags: ["Auth"],
        },
      ),
      logout: build.mutation<LogoutApiResponse, LogoutApiArg>({
        query: (queryArg) => ({
          url: `/api/Auth/logout`,
          method: "POST",
          body: queryArg.logoutCommand,
        }),
        invalidatesTags: ["Auth"],
      }),
      getCurrentUser: build.query<
        GetCurrentUserApiResponse,
        GetCurrentUserApiArg
      >({
        query: () => ({ url: `/api/Auth/me` }),
        providesTags: ["Auth"],
      }),
      changePassword: build.mutation<
        ChangePasswordApiResponse,
        ChangePasswordApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Auth/change-password`,
          method: "POST",
          body: queryArg.changePasswordCommand,
        }),
        invalidatesTags: ["Auth"],
      }),
      getDepartments: build.query<
        GetDepartmentsApiResponse,
        GetDepartmentsApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Departments`,
          params: {
            Search: queryArg.search,
            IsActive: queryArg.isActive,
          },
        }),
        providesTags: ["Departments"],
      }),
      createDepartment: build.mutation<
        CreateDepartmentApiResponse,
        CreateDepartmentApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Departments`,
          method: "POST",
          body: queryArg.createDepartmentCommand,
        }),
        invalidatesTags: ["Departments"],
      }),
      getDepartmentTree: build.query<
        GetDepartmentTreeApiResponse,
        GetDepartmentTreeApiArg
      >({
        query: () => ({ url: `/api/Departments/tree` }),
        providesTags: ["Departments"],
      }),
      getDepartment: build.query<GetDepartmentApiResponse, GetDepartmentApiArg>(
        {
          query: (queryArg) => ({ url: `/api/Departments/${queryArg.id}` }),
          providesTags: ["Departments"],
        },
      ),
      updateDepartment: build.mutation<
        UpdateDepartmentApiResponse,
        UpdateDepartmentApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Departments/${queryArg.id}`,
          method: "PUT",
          body: queryArg.updateDepartmentCommand,
        }),
        invalidatesTags: ["Departments"],
      }),
      deleteDepartment: build.mutation<
        DeleteDepartmentApiResponse,
        DeleteDepartmentApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Departments/${queryArg.id}`,
          method: "DELETE",
        }),
        invalidatesTags: ["Departments"],
      }),
      getDepartmentMembers: build.query<
        GetDepartmentMembersApiResponse,
        GetDepartmentMembersApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Departments/${queryArg.id}/members`,
        }),
        providesTags: ["Departments"],
      }),
      getOrganization: build.query<
        GetOrganizationApiResponse,
        GetOrganizationApiArg
      >({
        query: () => ({ url: `/api/Organization` }),
        providesTags: ["Organization"],
      }),
      updateOrganization: build.mutation<
        UpdateOrganizationApiResponse,
        UpdateOrganizationApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Organization`,
          method: "PUT",
          body: queryArg.updateOrganizationCommand,
        }),
        invalidatesTags: ["Organization"],
      }),
      getPermissions: build.query<
        GetPermissionsApiResponse,
        GetPermissionsApiArg
      >({
        query: () => ({ url: `/api/Permissions` }),
        providesTags: ["Permissions"],
      }),
      getPositions: build.query<GetPositionsApiResponse, GetPositionsApiArg>({
        query: (queryArg) => ({
          url: `/api/Positions`,
          params: {
            IsActive: queryArg.isActive,
          },
        }),
        providesTags: ["Positions"],
      }),
      createPosition: build.mutation<
        CreatePositionApiResponse,
        CreatePositionApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Positions`,
          method: "POST",
          body: queryArg.createPositionCommand,
        }),
        invalidatesTags: ["Positions"],
      }),
      getPosition: build.query<GetPositionApiResponse, GetPositionApiArg>({
        query: (queryArg) => ({ url: `/api/Positions/${queryArg.id}` }),
        providesTags: ["Positions"],
      }),
      updatePosition: build.mutation<
        UpdatePositionApiResponse,
        UpdatePositionApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Positions/${queryArg.id}`,
          method: "PUT",
          body: queryArg.updatePositionCommand,
        }),
        invalidatesTags: ["Positions"],
      }),
      deletePosition: build.mutation<
        DeletePositionApiResponse,
        DeletePositionApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Positions/${queryArg.id}`,
          method: "DELETE",
        }),
        invalidatesTags: ["Positions"],
      }),
      getProfiles: build.query<GetProfilesApiResponse, GetProfilesApiArg>({
        query: (queryArg) => ({
          url: `/api/Profiles`,
          params: {
            Search: queryArg.search,
            DepartmentId: queryArg.departmentId,
            PageNumber: queryArg.pageNumber,
            PageSize: queryArg.pageSize,
          },
        }),
        providesTags: ["Profiles"],
      }),
      getMyProfile: build.query<GetMyProfileApiResponse, GetMyProfileApiArg>({
        query: () => ({ url: `/api/Profiles/me` }),
        providesTags: ["Profiles"],
      }),
      updateMyProfile: build.mutation<
        UpdateMyProfileApiResponse,
        UpdateMyProfileApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Profiles/me`,
          method: "PUT",
          body: queryArg.updateMyProfileCommand,
        }),
        invalidatesTags: ["Profiles"],
      }),
      updateMyAvatar: build.mutation<
        UpdateMyAvatarApiResponse,
        UpdateMyAvatarApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Profiles/me/avatar`,
          method: "PUT",
          body: queryArg.body,
        }),
        invalidatesTags: ["Profiles"],
      }),
      deleteMyAvatar: build.mutation<
        DeleteMyAvatarApiResponse,
        DeleteMyAvatarApiArg
      >({
        query: () => ({ url: `/api/Profiles/me/avatar`, method: "DELETE" }),
        invalidatesTags: ["Profiles"],
      }),
      getProfile: build.query<GetProfileApiResponse, GetProfileApiArg>({
        query: (queryArg) => ({ url: `/api/Profiles/${queryArg.userId}` }),
        providesTags: ["Profiles"],
      }),
      getAvatar: build.query<GetAvatarApiResponse, GetAvatarApiArg>({
        query: (queryArg) => ({
          url: `/api/Profiles/${queryArg.userId}/avatar`,
        }),
        providesTags: ["Profiles"],
      }),
      getRoles: build.query<GetRolesApiResponse, GetRolesApiArg>({
        query: () => ({ url: `/api/Roles` }),
        providesTags: ["Roles"],
      }),
      createRole: build.mutation<CreateRoleApiResponse, CreateRoleApiArg>({
        query: (queryArg) => ({
          url: `/api/Roles`,
          method: "POST",
          body: queryArg.createRoleCommand,
        }),
        invalidatesTags: ["Roles"],
      }),
      getRole: build.query<GetRoleApiResponse, GetRoleApiArg>({
        query: (queryArg) => ({ url: `/api/Roles/${queryArg.id}` }),
        providesTags: ["Roles"],
      }),
      updateRole: build.mutation<UpdateRoleApiResponse, UpdateRoleApiArg>({
        query: (queryArg) => ({
          url: `/api/Roles/${queryArg.id}`,
          method: "PUT",
          body: queryArg.updateRoleCommand,
        }),
        invalidatesTags: ["Roles"],
      }),
      deleteRole: build.mutation<DeleteRoleApiResponse, DeleteRoleApiArg>({
        query: (queryArg) => ({
          url: `/api/Roles/${queryArg.id}`,
          method: "DELETE",
        }),
        invalidatesTags: ["Roles"],
      }),
      getUsers: build.query<GetUsersApiResponse, GetUsersApiArg>({
        query: (queryArg) => ({
          url: `/api/Users`,
          params: {
            Search: queryArg.search,
            DepartmentId: queryArg.departmentId,
            PositionId: queryArg.positionId,
            IsActive: queryArg.isActive,
            PageNumber: queryArg.pageNumber,
            PageSize: queryArg.pageSize,
          },
        }),
        providesTags: ["Users"],
      }),
      createUser: build.mutation<CreateUserApiResponse, CreateUserApiArg>({
        query: (queryArg) => ({
          url: `/api/Users`,
          method: "POST",
          body: queryArg.createUserCommand,
        }),
        invalidatesTags: ["Users"],
      }),
      getUser: build.query<GetUserApiResponse, GetUserApiArg>({
        query: (queryArg) => ({ url: `/api/Users/${queryArg.id}` }),
        providesTags: ["Users"],
      }),
      updateUser: build.mutation<UpdateUserApiResponse, UpdateUserApiArg>({
        query: (queryArg) => ({
          url: `/api/Users/${queryArg.id}`,
          method: "PUT",
          body: queryArg.updateUserCommand,
        }),
        invalidatesTags: ["Users"],
      }),
      deleteUser: build.mutation<DeleteUserApiResponse, DeleteUserApiArg>({
        query: (queryArg) => ({
          url: `/api/Users/${queryArg.id}`,
          method: "DELETE",
        }),
        invalidatesTags: ["Users"],
      }),
      resetUserPassword: build.mutation<
        ResetUserPasswordApiResponse,
        ResetUserPasswordApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Users/${queryArg.id}/password`,
          method: "PUT",
          body: queryArg.resetUserPasswordCommand,
        }),
        invalidatesTags: ["Users"],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as portalApi };
export type LoginApiResponse = /** status 200 OK */ AuthTokens;
export type LoginApiArg = {
  loginCommand: LoginCommand;
};
export type RefreshTokenApiResponse = /** status 200 OK */ AuthTokens;
export type RefreshTokenApiArg = {
  refreshTokenCommand: RefreshTokenCommand;
};
export type LogoutApiResponse = unknown;
export type LogoutApiArg = {
  logoutCommand: LogoutCommand;
};
export type GetCurrentUserApiResponse = /** status 200 OK */ CurrentUserDto;
export type GetCurrentUserApiArg = void;
export type ChangePasswordApiResponse = unknown;
export type ChangePasswordApiArg = {
  changePasswordCommand: ChangePasswordCommand;
};
export type GetDepartmentsApiResponse = /** status 200 OK */ DepartmentDto[];
export type GetDepartmentsApiArg = {
  search?: string;
  isActive?: boolean;
};
export type CreateDepartmentApiResponse = /** status 201 Created */ number;
export type CreateDepartmentApiArg = {
  createDepartmentCommand: CreateDepartmentCommand;
};
export type GetDepartmentTreeApiResponse =
  /** status 200 OK */ DepartmentTreeNode[];
export type GetDepartmentTreeApiArg = void;
export type GetDepartmentApiResponse = /** status 200 OK */ DepartmentDto;
export type GetDepartmentApiArg = {
  id: number;
};
export type UpdateDepartmentApiResponse = unknown;
export type UpdateDepartmentApiArg = {
  id: number;
  updateDepartmentCommand: UpdateDepartmentCommand;
};
export type DeleteDepartmentApiResponse = unknown;
export type DeleteDepartmentApiArg = {
  id: number;
};
export type GetDepartmentMembersApiResponse =
  /** status 200 OK */ DepartmentMemberDto[];
export type GetDepartmentMembersApiArg = {
  id: number;
};
export type GetOrganizationApiResponse = /** status 200 OK */ OrganizationDto;
export type GetOrganizationApiArg = void;
export type UpdateOrganizationApiResponse = unknown;
export type UpdateOrganizationApiArg = {
  updateOrganizationCommand: UpdateOrganizationCommand;
};
export type GetPermissionsApiResponse =
  /** status 200 OK */ PermissionGroupDto[];
export type GetPermissionsApiArg = void;
export type GetPositionsApiResponse = /** status 200 OK */ PositionDto[];
export type GetPositionsApiArg = {
  isActive?: boolean;
};
export type CreatePositionApiResponse = /** status 201 Created */ number;
export type CreatePositionApiArg = {
  createPositionCommand: CreatePositionCommand;
};
export type GetPositionApiResponse = /** status 200 OK */ PositionDto;
export type GetPositionApiArg = {
  id: number;
};
export type UpdatePositionApiResponse = unknown;
export type UpdatePositionApiArg = {
  id: number;
  updatePositionCommand: UpdatePositionCommand;
};
export type DeletePositionApiResponse = unknown;
export type DeletePositionApiArg = {
  id: number;
};
export type GetProfilesApiResponse =
  /** status 200 OK */ PaginatedListOfProfileDto;
export type GetProfilesApiArg = {
  search?: string;
  departmentId?: number;
  pageNumber?: number;
  pageSize?: number;
};
export type GetMyProfileApiResponse = /** status 200 OK */ ProfileDto;
export type GetMyProfileApiArg = void;
export type UpdateMyProfileApiResponse = unknown;
export type UpdateMyProfileApiArg = {
  updateMyProfileCommand: UpdateMyProfileCommand;
};
export type UpdateMyAvatarApiResponse = /** status 200 OK */ AvatarDto;
export type UpdateMyAvatarApiArg = {
  body: {
    file: IFormFile;
  };
};
export type DeleteMyAvatarApiResponse = unknown;
export type DeleteMyAvatarApiArg = void;
export type GetProfileApiResponse = /** status 200 OK */ ProfileDto;
export type GetProfileApiArg = {
  userId: number;
};
export type GetAvatarApiResponse = unknown;
export type GetAvatarApiArg = {
  userId: number;
};
export type GetRolesApiResponse = /** status 200 OK */ RoleDto[];
export type GetRolesApiArg = void;
export type CreateRoleApiResponse = /** status 201 Created */ number;
export type CreateRoleApiArg = {
  createRoleCommand: CreateRoleCommand;
};
export type GetRoleApiResponse = /** status 200 OK */ RoleDto;
export type GetRoleApiArg = {
  id: number;
};
export type UpdateRoleApiResponse = unknown;
export type UpdateRoleApiArg = {
  id: number;
  updateRoleCommand: UpdateRoleCommand;
};
export type DeleteRoleApiResponse = unknown;
export type DeleteRoleApiArg = {
  id: number;
};
export type GetUsersApiResponse = /** status 200 OK */ PaginatedListOfUserDto;
export type GetUsersApiArg = {
  search?: string;
  departmentId?: number;
  positionId?: number;
  isActive?: boolean;
  pageNumber?: number;
  pageSize?: number;
};
export type CreateUserApiResponse = /** status 201 Created */ number;
export type CreateUserApiArg = {
  createUserCommand: CreateUserCommand;
};
export type GetUserApiResponse = /** status 200 OK */ UserDto;
export type GetUserApiArg = {
  id: number;
};
export type UpdateUserApiResponse = unknown;
export type UpdateUserApiArg = {
  id: number;
  updateUserCommand: UpdateUserCommand;
};
export type DeleteUserApiResponse = unknown;
export type DeleteUserApiArg = {
  id: number;
};
export type ResetUserPasswordApiResponse = unknown;
export type ResetUserPasswordApiArg = {
  id: number;
  resetUserPasswordCommand: ResetUserPasswordCommand;
};
export type AuthTokens = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};
export type LoginCommand = {
  userName: string;
  password: string;
};
export type RefreshTokenCommand = {
  refreshToken: string;
};
export type LogoutCommand = {
  refreshToken: string;
};
export type UserAssignmentDto = {
  departmentId: number;
  departmentName: string;
  positionId: number;
  positionName: string;
  positionLevel: number;
  isPrimary: boolean;
};
export type UserRoleDto = {
  id: number;
  name?: null | string;
};
export type UserDto = {
  id: number;
  userName?: null | string;
  fullName: string;
  email?: null | string;
  phoneNumber?: null | string;
  isActive: boolean;
  lastLoginAt?: null | string;
  assignments: UserAssignmentDto[];
  roles: UserRoleDto[];
};
export type CurrentUserDto = {
  user: UserDto;
  permissions: string[];
};
export type ChangePasswordCommand = {
  currentPassword: string;
  newPassword: string;
};
export type DepartmentDto = {
  id: number;
  code: string;
  name: string;
  parentId?: null | number;
  parentName?: null | string;
  isActive: boolean;
};
export type CreateDepartmentCommand = {
  code: string;
  name: string;
  parentId?: null | number;
};
export type DepartmentTreeNode = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  children?: null | DepartmentTreeNode[];
};
export type UpdateDepartmentCommand = {
  code: string;
  name: string;
  parentId?: null | number;
  isActive: boolean;
};
export type DepartmentMemberDto = {
  userId: number;
  userName: string;
  fullName: string;
  positionId: number;
  positionName: string;
  positionLevel: number;
  isPrimary: boolean;
  isHead: boolean;
};
export type OrganizationHeadDto = {
  userId: number;
  fullName: string;
  positionName: string;
  departmentName: string;
};
export type OrganizationDto = {
  name: string;
  shortName?: null | string;
  address?: null | string;
  phoneNumber?: null | string;
  email?: null | string;
  website?: null | string;
  heads: OrganizationHeadDto[];
};
export type UpdateOrganizationCommand = {
  name: string;
  shortName?: null | string;
  address?: null | string;
  phoneNumber?: null | string;
  email?: null | string;
  website?: null | string;
};
export type PermissionGroupDto = {
  group: string;
  permissions: string[];
};
export type PositionDto = {
  id: number;
  code: string;
  name: string;
  level: number;
  description?: null | string;
  isActive: boolean;
};
export type CreatePositionCommand = {
  code: string;
  name: string;
  level: number;
  description?: null | string;
};
export type UpdatePositionCommand = {
  code: string;
  name: string;
  level: number;
  description?: null | string;
  isActive: boolean;
};
export type Gender = "Male" | "Female" | "Other" | null;
export type ProfileDto = {
  userId: number;
  userName?: null | string;
  fullName: string;
  email?: null | string;
  phoneNumber?: null | string;
  dateOfBirth?: null | string;
  gender: null | Gender;
  hometown?: null | string;
  avatarUrl?: null | string;
  assignments: UserAssignmentDto[];
};
export type PaginatedListOfProfileDto = {
  items: ProfileDto[];
  pageNumber: number;
  totalPages: number;
  totalCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};
export type UpdateMyProfileCommand = {
  email?: null | string;
  phoneNumber?: null | string;
  dateOfBirth?: null | string;
  gender: null | Gender;
  hometown?: null | string;
};
export type AvatarDto = {
  avatarUrl: string;
};
export type IFormFile = Blob;
export type RoleDto = {
  id: number;
  name: string;
  description?: null | string;
  isAdmin: boolean;
  permissions: string[];
  userCount: number;
};
export type CreateRoleCommand = {
  name: string;
  description?: null | string;
  permissions: string[];
};
export type UpdateRoleCommand = {
  name: string;
  description?: null | string;
  permissions: string[];
};
export type PaginatedListOfUserDto = {
  items: UserDto[];
  pageNumber: number;
  totalPages: number;
  totalCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};
export type UserAssignmentInput = {
  departmentId: number;
  positionId: number;
  isPrimary: boolean;
};
export type CreateUserCommand = {
  userName: string;
  password: string;
  fullName: string;
  email?: null | string;
  phoneNumber?: null | string;
  assignments: UserAssignmentInput[];
  roleIds: number[];
};
export type UpdateUserCommand = {
  fullName: string;
  email?: null | string;
  phoneNumber?: null | string;
  assignments: UserAssignmentInput[];
  roleIds: number[];
  isActive: boolean;
};
export type ResetUserPasswordCommand = {
  newPassword: string;
};
export const {
  useLoginMutation,
  useRefreshTokenMutation,
  useLogoutMutation,
  useGetCurrentUserQuery,
  useChangePasswordMutation,
  useGetDepartmentsQuery,
  useCreateDepartmentMutation,
  useGetDepartmentTreeQuery,
  useGetDepartmentQuery,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
  useGetDepartmentMembersQuery,
  useGetOrganizationQuery,
  useUpdateOrganizationMutation,
  useGetPermissionsQuery,
  useGetPositionsQuery,
  useCreatePositionMutation,
  useGetPositionQuery,
  useUpdatePositionMutation,
  useDeletePositionMutation,
  useGetProfilesQuery,
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
  useUpdateMyAvatarMutation,
  useDeleteMyAvatarMutation,
  useGetProfileQuery,
  useGetAvatarQuery,
  useGetRolesQuery,
  useCreateRoleMutation,
  useGetRoleQuery,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useGetUsersQuery,
  useCreateUserMutation,
  useGetUserQuery,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useResetUserPasswordMutation,
} = injectedRtkApi;
