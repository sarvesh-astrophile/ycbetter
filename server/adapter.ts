import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";

const EnvSchema = z.object({
    DATABASE_URL: z.url(),
});

const processEnv = EnvSchema.parse(process.env);
const queryClient = postgres(processEnv.DATABASE_URL);

export const db = drizzle(queryClient);