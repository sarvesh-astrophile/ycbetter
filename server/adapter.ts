import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";
import { sessionTable, userTable } from "./db/schema/auth";

const EnvSchema = z.object({
    DATABASE_URL: z.url(),
});

const processEnv = EnvSchema.parse(process.env);
const queryClient = postgres(processEnv.DATABASE_URL);

export const db = drizzle(queryClient, { 
    schema: { 
        user: userTable, 
        session: sessionTable 
    } 
});

export const adapter = new DrizzlePostgreSQLAdapter(db, sessionTable, userTable);