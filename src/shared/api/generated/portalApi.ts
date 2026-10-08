import { baseApi as api } from "../baseApi";
export const addTagTypes = [
  "Auth",
  "Dashboard",
  "Departments",
  "Organization",
  "Permissions",
  "Positions",
  "Posts",
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
      forgotPassword: build.mutation<
        ForgotPasswordApiResponse,
        ForgotPasswordApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Auth/forgot-password`,
          method: "POST",
          body: queryArg.forgotPasswordCommand,
        }),
        invalidatesTags: ["Auth"],
      }),
      resetPassword: build.mutation<
        ResetPasswordApiResponse,
        ResetPasswordApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Auth/reset-password`,
          method: "POST",
          body: queryArg.resetPasswordCommand,
        }),
        invalidatesTags: ["Auth"],
      }),
      getStaffDashboard: build.query<
        GetStaffDashboardApiResponse,
        GetStaffDashboardApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Dashboard/staff`,
          params: {
            Period: queryArg.period,
          },
        }),
        providesTags: ["Dashboard"],
      }),
      getStaffEmployees: build.query<
        GetStaffEmployeesApiResponse,
        GetStaffEmployeesApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Dashboard/staff/employees`,
          params: {
            Search: queryArg.search,
            SortBy: queryArg.sortBy,
            Descending: queryArg.descending,
            PageNumber: queryArg.pageNumber,
            PageSize: queryArg.pageSize,
          },
        }),
        providesTags: ["Dashboard"],
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
      getPosts: build.query<GetPostsApiResponse, GetPostsApiArg>({
        query: (queryArg) => ({
          url: `/api/Posts`,
          params: {
            Cursor: queryArg.cursor,
            PageSize: queryArg.pageSize,
          },
        }),
        providesTags: ["Posts"],
      }),
      createPost: build.mutation<CreatePostApiResponse, CreatePostApiArg>({
        query: (queryArg) => ({
          url: `/api/Posts`,
          method: "POST",
          body: queryArg.createPostCommand,
        }),
        invalidatesTags: ["Posts"],
      }),
      getPinnedPosts: build.query<
        GetPinnedPostsApiResponse,
        GetPinnedPostsApiArg
      >({
        query: () => ({ url: `/api/Posts/pinned` }),
        providesTags: ["Posts"],
      }),
      getPost: build.query<GetPostApiResponse, GetPostApiArg>({
        query: (queryArg) => ({ url: `/api/Posts/${queryArg.id}` }),
        providesTags: ["Posts"],
      }),
      updatePost: build.mutation<UpdatePostApiResponse, UpdatePostApiArg>({
        query: (queryArg) => ({
          url: `/api/Posts/${queryArg.id}`,
          method: "PUT",
          body: queryArg.updatePostCommand,
        }),
        invalidatesTags: ["Posts"],
      }),
      deletePost: build.mutation<DeletePostApiResponse, DeletePostApiArg>({
        query: (queryArg) => ({
          url: `/api/Posts/${queryArg.id}`,
          method: "DELETE",
        }),
        invalidatesTags: ["Posts"],
      }),
      pinPost: build.mutation<PinPostApiResponse, PinPostApiArg>({
        query: (queryArg) => ({
          url: `/api/Posts/${queryArg.id}/pin`,
          method: "PUT",
          body: queryArg.pinPostCommand,
        }),
        invalidatesTags: ["Posts"],
      }),
      unpinPost: build.mutation<UnpinPostApiResponse, UnpinPostApiArg>({
        query: (queryArg) => ({
          url: `/api/Posts/${queryArg.id}/pin`,
          method: "DELETE",
        }),
        invalidatesTags: ["Posts"],
      }),
      getPostReactions: build.query<
        GetPostReactionsApiResponse,
        GetPostReactionsApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Posts/${queryArg.id}/reactions`,
          params: {
            Kind: queryArg.kind,
            Cursor: queryArg.cursor,
            PageSize: queryArg.pageSize,
          },
        }),
        providesTags: ["Posts"],
      }),
      reactToPost: build.mutation<ReactToPostApiResponse, ReactToPostApiArg>({
        query: (queryArg) => ({
          url: `/api/Posts/${queryArg.id}/reaction`,
          method: "PUT",
          body: queryArg.reactToPostCommand,
        }),
        invalidatesTags: ["Posts"],
      }),
      removePostReaction: build.mutation<
        RemovePostReactionApiResponse,
        RemovePostReactionApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Posts/${queryArg.id}/reaction`,
          method: "DELETE",
        }),
        invalidatesTags: ["Posts"],
      }),
      uploadPostFile: build.mutation<
        UploadPostFileApiResponse,
        UploadPostFileApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Posts/files`,
          method: "POST",
          body: queryArg.body,
        }),
        invalidatesTags: ["Posts"],
      }),
      getPostFile: build.query<GetPostFileApiResponse, GetPostFileApiArg>({
        query: (queryArg) => ({ url: `/api/Posts/files/${queryArg.id}` }),
        providesTags: ["Posts"],
      }),
      getPostFileUrl: build.query<
        GetPostFileUrlApiResponse,
        GetPostFileUrlApiArg
      >({
        query: (queryArg) => ({ url: `/api/Posts/files/${queryArg.id}/url` }),
        providesTags: ["Posts"],
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
      requestEmailChange: build.mutation<
        RequestEmailChangeApiResponse,
        RequestEmailChangeApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Profiles/me/email/verification`,
          method: "POST",
          body: queryArg.requestEmailChangeCommand,
        }),
        invalidatesTags: ["Profiles"],
      }),
      confirmEmailChange: build.mutation<
        ConfirmEmailChangeApiResponse,
        ConfirmEmailChangeApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Profiles/me/email`,
          method: "PUT",
          body: queryArg.confirmEmailChangeCommand,
        }),
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
      deactivateUser: build.mutation<
        DeactivateUserApiResponse,
        DeactivateUserApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Users/${queryArg.id}/deactivate`,
          method: "PUT",
          body: queryArg.deactivateUserCommand,
        }),
        invalidatesTags: ["Users"],
      }),
      reactivateUser: build.mutation<
        ReactivateUserApiResponse,
        ReactivateUserApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Users/${queryArg.id}/reactivate`,
          method: "PUT",
          body: queryArg.reactivateUserCommand,
        }),
        invalidatesTags: ["Users"],
      }),
      getEmploymentPeriods: build.query<
        GetEmploymentPeriodsApiResponse,
        GetEmploymentPeriodsApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Users/${queryArg.id}/employment-periods`,
        }),
        providesTags: ["Users"],
      }),
      updateEmploymentPeriod: build.mutation<
        UpdateEmploymentPeriodApiResponse,
        UpdateEmploymentPeriodApiArg
      >({
        query: (queryArg) => ({
          url: `/api/Users/${queryArg.id}/employment-periods/${queryArg.periodId}`,
          method: "PUT",
          body: queryArg.updateEmploymentPeriodCommand,
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
export type ForgotPasswordApiResponse =
  /** status 202 Accepted */ VerificationSentDto;
export type ForgotPasswordApiArg = {
  forgotPasswordCommand: ForgotPasswordCommand;
};
export type ResetPasswordApiResponse = unknown;
export type ResetPasswordApiArg = {
  resetPasswordCommand: ResetPasswordCommand;
};
export type GetStaffDashboardApiResponse =
  /** status 200 OK */ StaffDashboardDto;
export type GetStaffDashboardApiArg = {
  period?: DashboardPeriod;
};
export type GetStaffEmployeesApiResponse =
  /** status 200 OK */ PaginatedListOfStaffEmployeeDto;
export type GetStaffEmployeesApiArg = {
  search?: string;
  sortBy?: StaffEmployeeSort;
  descending?: boolean;
  pageNumber?: number;
  pageSize?: number;
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
export type GetPostsApiResponse = /** status 200 OK */ PostPage;
export type GetPostsApiArg = {
  cursor?: string;
  pageSize?: number;
};
export type CreatePostApiResponse = /** status 201 Created */ number;
export type CreatePostApiArg = {
  createPostCommand: CreatePostCommand;
};
export type GetPinnedPostsApiResponse = /** status 200 OK */ PostDto[];
export type GetPinnedPostsApiArg = void;
export type GetPostApiResponse = /** status 200 OK */ PostDto;
export type GetPostApiArg = {
  id: number;
};
export type UpdatePostApiResponse = unknown;
export type UpdatePostApiArg = {
  id: number;
  updatePostCommand: UpdatePostCommand;
};
export type DeletePostApiResponse = unknown;
export type DeletePostApiArg = {
  id: number;
};
export type PinPostApiResponse = unknown;
export type PinPostApiArg = {
  id: number;
  pinPostCommand: PinPostCommand;
};
export type UnpinPostApiResponse = unknown;
export type UnpinPostApiArg = {
  id: number;
};
export type GetPostReactionsApiResponse = /** status 200 OK */ ReactionPage;
export type GetPostReactionsApiArg = {
  id: number;
  kind?: ReactionKind;
  cursor?: string;
  pageSize?: number;
};
export type ReactToPostApiResponse = /** status 200 OK */ ReactionSummaryDto;
export type ReactToPostApiArg = {
  id: number;
  reactToPostCommand: ReactToPostCommand;
};
export type RemovePostReactionApiResponse =
  /** status 200 OK */ ReactionSummaryDto;
export type RemovePostReactionApiArg = {
  id: number;
};
export type UploadPostFileApiResponse = /** status 201 Created */ PostFileDto;
export type UploadPostFileApiArg = {
  body: {
    file: IFormFile;
  } & {
    kind: PostFileKind;
  };
};
export type GetPostFileApiResponse = unknown;
export type GetPostFileApiArg = {
  id: string;
};
export type GetPostFileUrlApiResponse = /** status 200 OK */ PostFileUrlDto;
export type GetPostFileUrlApiArg = {
  id: string;
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
export type RequestEmailChangeApiResponse =
  /** status 202 Accepted */ VerificationSentDto;
export type RequestEmailChangeApiArg = {
  requestEmailChangeCommand: RequestEmailChangeCommand;
};
export type ConfirmEmailChangeApiResponse = unknown;
export type ConfirmEmailChangeApiArg = {
  confirmEmailChangeCommand: ConfirmEmailChangeCommand;
};
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
export type DeactivateUserApiResponse = unknown;
export type DeactivateUserApiArg = {
  id: number;
  deactivateUserCommand: DeactivateUserCommand;
};
export type ReactivateUserApiResponse = unknown;
export type ReactivateUserApiArg = {
  id: number;
  reactivateUserCommand: ReactivateUserCommand;
};
export type GetEmploymentPeriodsApiResponse =
  /** status 200 OK */ EmploymentPeriodDto[];
export type GetEmploymentPeriodsApiArg = {
  id: number;
};
export type UpdateEmploymentPeriodApiResponse = unknown;
export type UpdateEmploymentPeriodApiArg = {
  id: number;
  periodId: number;
  updateEmploymentPeriodCommand: UpdateEmploymentPeriodCommand;
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
  employeeCode?: null | string;
  fullName: string;
  email?: null | string;
  emailConfirmed: boolean;
  phoneNumber?: null | string;
  isActive: boolean;
  lastLoginAt?: null | string;
  joinedOn?: null | string;
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
export type VerificationSentDto = {
  expiresInSeconds: number;
  resendAfterSeconds: number;
};
export type ForgotPasswordCommand = {
  email: string;
};
export type ResetPasswordCommand = {
  email: string;
  code: string;
  newPassword: string;
};
export type GenderStatsDto = {
  male: number;
  female: number;
  unspecified: number;
  total: number;
};
export type StaffChangesDto = {
  joined: number;
  left: number;
};
export type StaffTrendPointDto = {
  from: string;
  to: string;
  joined: number;
  left: number;
};
export type DepartmentHeadcountDto = {
  departmentId: number;
  name: string;
  count: number;
};
export type DepartmentStatsDto = {
  items: DepartmentHeadcountDto[];
  withoutDepartment: number;
};
export type StaffDashboardDto = {
  from: string;
  to: string;
  gender: GenderStatsDto;
  staffChanges: StaffChangesDto;
  trend: StaffTrendPointDto[];
  departments: DepartmentStatsDto;
};
export type DashboardPeriod = "Month" | "Quarter" | "Year";
export type Gender = "Male" | "Female" | null;
export type StaffEmployeeDto = {
  userId: number;
  employeeCode: null | string;
  fullName: string;
  email: null | string;
  avatarUrl: null | string;
  positionName: null | string;
  departmentName: null | string;
  dateOfBirth: null | string;
  seniorityDays: null | number;
  gender: null | Gender;
  phoneNumber: null | string;
  hometown: null | string;
};
export type PaginatedListOfStaffEmployeeDto = {
  items: StaffEmployeeDto[];
  pageNumber: number;
  totalPages: number;
  totalCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};
export type StaffEmployeeSort =
  "EmployeeCode" | "FullName" | "DateOfBirth" | "Seniority";
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
export type PostKind = "Normal" | "Announcement";
export type PostAuthorDto = {
  id: number;
  fullName: string;
  avatarUrl: null | string;
  positionName: null | string;
};
export type PostFileKind = "Image" | "Attachment" | "Video";
export type PostMediaDto = {
  id: string;
  kind: PostFileKind;
  fileName: string;
  contentType: string;
  size: number;
  caption: null | string;
};
export type PostFileDto = {
  id: string;
  kind: PostFileKind;
  fileName: string;
  contentType: string;
  size: number;
};
export type PostMentionDto = {
  userId: number;
  fullName: string;
};
export type ReactionKind = "Like" | "Love" | "Haha" | "Wow" | "Sad" | "Angry";
export type ReactionCountDto = {
  kind: ReactionKind;
  count: number;
};
export type PostDto = {
  id: number;
  kind: PostKind;
  subject?: null | string;
  subhead?: null | string;
  bannerColor?: null | string;
  bannerImageId?: null | string;
  contentHtml: string;
  author: PostAuthorDto;
  createdAt: string;
  editedAt?: null | string;
  media: PostMediaDto[];
  attachments: PostFileDto[];
  mentions: PostMentionDto[];
  mentionsEveryone: boolean;
  reactions: ReactionCountDto[];
  myReaction: null | ReactionKind;
  pinnedAt?: null | string;
  pinnedUntil?: null | string;
  isPinned: boolean;
  canPin: boolean;
  canEdit: boolean;
  canDelete: boolean;
  version: number;
};
export type PostPage = {
  items: PostDto[];
  nextCursor: null | string;
};
export type PostMediaInput = {
  id: string;
  caption: null | string;
};
export type CreatePostCommand = {
  kind: PostKind;
  subject?: null | string;
  subhead?: null | string;
  bannerColor?: null | string;
  bannerImageId?: null | string;
  contentHtml: string;
  media: PostMediaInput[];
  attachmentIds: string[];
};
export type UpdatePostCommand = {
  kind: PostKind;
  subject?: null | string;
  subhead?: null | string;
  bannerColor?: null | string;
  bannerImageId?: null | string;
  contentHtml: string;
  media: PostMediaInput[];
  attachmentIds: string[];
  version: number;
};
export type PinPostCommand = {
  until?: null | string;
};
export type PostReactionDto = {
  userId: number;
  fullName: string;
  avatarUrl: null | string;
  positionName: null | string;
  kind: ReactionKind;
  reactedAt: string;
};
export type ReactionPage = {
  items: PostReactionDto[];
  nextCursor: null | string;
};
export type ReactionSummaryDto = {
  reactions: ReactionCountDto[];
  myReaction: null | ReactionKind;
};
export type ReactToPostCommand = {
  kind: ReactionKind;
};
export type IFormFile = Blob;
export type PostFileUrlDto = {
  url: string;
  expiresAt: string;
};
export type ProfileDto = {
  userId: number;
  userName?: null | string;
  employeeCode?: null | string;
  fullName: string;
  email?: null | string;
  emailConfirmed: boolean;
  phoneNumber?: null | string;
  dateOfBirth?: null | string;
  gender: null | Gender;
  hometown?: null | string;
  joinedOn?: null | string;
  seniorityDays?: null | number;
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
  phoneNumber?: null | string;
  dateOfBirth?: null | string;
  gender: null | Gender;
  hometown?: null | string;
};
export type AvatarDto = {
  avatarUrl: string;
};
export type ProblemDetails = {
  type?: null | string;
  title?: null | string;
  status?: null | number;
  detail?: null | string;
  instance?: null | string;
};
export type RequestEmailChangeCommand = {
  email: string;
};
export type ConfirmEmailChangeCommand = {
  code: string;
};
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
  phoneNumber?: null | string;
  assignments: UserAssignmentInput[];
  roleIds: number[];
  joinedOn?: null | string;
  employeeCode?: null | string;
};
export type UpdateUserCommand = {
  fullName: string;
  phoneNumber?: null | string;
  assignments: UserAssignmentInput[];
  roleIds: number[];
  joinedOn?: null | string;
  employeeCode?: null | string;
};
export type ResetUserPasswordCommand = {
  newPassword: string;
};
export type DeactivateUserCommand = {
  leftOn?: null | string;
};
export type ReactivateUserCommand = {
  rejoinedOn?: null | string;
};
export type EmploymentPeriodDto = {
  id: number;
  startedOn: null | string;
  endedOn: null | string;
  isEndEstimated: boolean;
};
export type UpdateEmploymentPeriodCommand = {
  startedOn?: null | string;
  endedOn?: null | string;
};
export const {
  useLoginMutation,
  useRefreshTokenMutation,
  useLogoutMutation,
  useGetCurrentUserQuery,
  useChangePasswordMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useGetStaffDashboardQuery,
  useGetStaffEmployeesQuery,
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
  useGetPostsQuery,
  useCreatePostMutation,
  useGetPinnedPostsQuery,
  useGetPostQuery,
  useUpdatePostMutation,
  useDeletePostMutation,
  usePinPostMutation,
  useUnpinPostMutation,
  useGetPostReactionsQuery,
  useReactToPostMutation,
  useRemovePostReactionMutation,
  useUploadPostFileMutation,
  useGetPostFileQuery,
  useGetPostFileUrlQuery,
  useGetProfilesQuery,
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
  useUpdateMyAvatarMutation,
  useDeleteMyAvatarMutation,
  useRequestEmailChangeMutation,
  useConfirmEmailChangeMutation,
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
  useDeactivateUserMutation,
  useReactivateUserMutation,
  useGetEmploymentPeriodsQuery,
  useUpdateEmploymentPeriodMutation,
} = injectedRtkApi;
