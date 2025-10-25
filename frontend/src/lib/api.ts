import type { ApiRoutes } from "@/shared/types";
import { hc } from "hono/client";

const client = hc("/api", {
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, {
      ...init,
      credentials: "include",
    }),
}).api;

export default client;