"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { baseApi } from "@/shared/api/baseApi";
import { endSession } from "@/shared/session/sessionClient";
import { selectAccessToken, signedOut } from "@/shared/session/sessionSlice";

/** Signs out: revokes the session, forgets all cached data and goes to the login page. */
export function useLogout() {
  const router = useRouter();
  const dispatch = useDispatch();
  const accessToken = useSelector(selectAccessToken);

  return useCallback(async () => {
    await endSession(accessToken);
    dispatch(signedOut());
    dispatch(baseApi.util.resetApiState());
    router.replace("/login");
  }, [accessToken, dispatch, router]);
}
