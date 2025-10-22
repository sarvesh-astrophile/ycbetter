import { hc } from "hono/client";
import type { AppRoutes, ErrorResponse, SuccessResponse } from "@/shared/types";

const client = hc<AppRoutes>("/", {
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, {
        ...init,
        credentials: "include",
      }),
  }) as AppRoutes;


  export const postSignup = async (username: string, password: string) => {
    try {
      const res = await client.api.auth.signup.$post({
        form: {
          username,
          password,
        },
      });
      if (res.ok) {
        const data = (await res.json()) as SuccessResponse;
        return data;
      }
      const data = (await res.json()) as unknown as ErrorResponse;
      return data;
    } catch (e) {
      return {
        success: false,
        error: String(e),
        isFormError: false,
      } as ErrorResponse;
    }
  };