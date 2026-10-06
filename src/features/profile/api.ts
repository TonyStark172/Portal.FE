import { portalApi, type AvatarDto } from "@/shared/api/generated/portalApi";

/**
 * Avatar upload as multipart/form-data. The generated `updateMyAvatar` sends its body as JSON,
 * which the back end's file endpoint cannot read.
 */
export const profileApi = portalApi.injectEndpoints({
  endpoints: (build) => ({
    uploadMyAvatar: build.mutation<AvatarDto, File>({
      query: (file) => {
        const body = new FormData();
        body.append("file", file);
        return { url: "/api/Profiles/me/avatar", method: "PUT", body };
      },
      invalidatesTags: ["Profiles"],
    }),
  }),
});

export const { useUploadMyAvatarMutation } = profileApi;
