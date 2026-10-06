import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./baseQuery";

/**
 * Root RTK Query API. Endpoints are added by the generated client
 * (`./generated/portalApi.ts`) and by features through `injectEndpoints`.
 */
export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  endpoints: () => ({}),
});
