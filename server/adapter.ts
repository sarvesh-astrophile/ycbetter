import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";
import { sessionTable, userRelations, userTable } from "./db/schema/auth";
import { commentUpvotesTable, commentUpvoteRelations, postUpvoteRelations, postUpvotesTable } from "./db/schema/upvotes";
import { postsRelations, postsTable } from "./db/schema/posts";
import { commentsTable, commentRelations } from "./db/schema/comments";

const EnvSchema = z.object({
    DATABASE_URL: z.url(),
});

const processEnv = EnvSchema.parse(process.env);
const queryClient = postgres(processEnv.DATABASE_URL);

export const db = drizzle(queryClient, { 
    schema: { 
        user: userTable, 
        posts: postsTable,
        postUpvotes: postUpvotesTable,
        session: sessionTable,
        comments: commentsTable,
        commentUpvotes: commentUpvotesTable,
        
        postRelations: postsRelations,
        commentRelations: commentRelations,
        commentUpvoteRelations: commentUpvoteRelations,
        postUpvoteRelations: postUpvoteRelations,
        userRelations: userRelations,
    } 
});

export const adapter = new DrizzlePostgreSQLAdapter(db, sessionTable, userTable);