import { configureStore } from "@reduxjs/toolkit";
import { baseApi } from "@/shared/api/baseApi";
import { sessionSlice } from "@/shared/session/sessionSlice";

/**
 * Creates the Redux store. With the App Router a new store is created per browser session
 * (see StoreProvider) instead of a module-level singleton, so state never leaks between requests.
 */
export const makeStore = () =>
  configureStore({
    reducer: {
      [sessionSlice.reducerPath]: sessionSlice.reducer,
      [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
