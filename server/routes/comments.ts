import { Hono } from "hono";
import type { Context } from "@/context";
import { zValidator } from "@/utils/validator";
import { z } from "zod";
import { createCommentSchema, paginationSchema, type Comment, type PaginatedResponse, type SuccessResponse } from "@/shared/types";
import { loggedin } from "@/middleware/loggedin";
import { postsTable } from "@/db/schema/posts";
import { db } from "@/adapter";
import { commentsTable } from "@/db/schema/comments";
import { eq, and, sql, asc, desc, countDistinct, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { getISOFormatDateQuery } from "@/utils/postformat";
import { commentUpvotesTable } from "@/db/schema/upvotes";

export const commentRoutes = new Hono<Context>();

commentRoutes.post("/:id", loggedin, zValidator("param", z.object({ id: z.coerce.number() })), zValidator("form", createCommentSchema), async (c) => {
    const { id } = c.req.valid("param");
    const { content } = c.req.valid("form");
    const user = c.get("user")!;

    const [comment] = await db.transaction(async (tx) => {
        const [parentComment] = await tx.
            select({ 
                id: commentsTable.id, 
                postId: commentsTable.postId, 
                depth: commentsTable.depth 
            })
            .from(commentsTable)
            .where(eq(commentsTable.id, id))
            .limit(1);

        if (!parentComment) {
            throw new HTTPException(404, {
                message: "Comment not found",
            });
        }

        const postId = parentComment.postId;

        const [updateParentComment] = await tx
            .update(commentsTable)  
            .set({
                commentCount: sql`${commentsTable.commentCount} + 1`,
            })
            .where(eq(commentsTable.id, parentComment.id))
            .returning({
                commentCount: commentsTable.commentCount,
            });

        const [updatedPost] = await tx
            .update(postsTable)
            .set({
                commentCount: sql`${postsTable.commentCount} + 1`,
            })
            .where(eq(postsTable.id, postId))
            .returning({
                commentCount: postsTable.commentCount,
            });

        if (!updatedPost || !updateParentComment) {
            throw new HTTPException(404, {
                message: "Error creating comment",
            });
        }

        return await tx
            .insert(commentsTable)
            .values({
                postId: parentComment.postId,
                userId: user.id,
                content: content,
                depth: parentComment.depth + 1,
                parentCommentId: parentComment.id,
            })
            .returning({
                id: commentsTable.id,
                userId: commentsTable.userId,
                postId: commentsTable.postId,
                content: commentsTable.content,
                points: commentsTable.points,
                depth: commentsTable.depth,
                parentCommentId: commentsTable.parentCommentId,
                createdAt: getISOFormatDateQuery(commentsTable.createdAt).as("created_at"),
                commentCount: commentsTable.commentCount,
            });
    });

    return c.json<SuccessResponse<Comment>>({
        success: true,
        message: "Comment created successfully",
        data: {
            ...comment!,
            childComments: [],
            commentUpvotes: [],
            author: {
                id: user.id,
                username: user.username,
            },
        } as Comment,
    }, 200);
});

commentRoutes.post("/:id/upvote", loggedin, zValidator("param", z.object({ id: z.coerce.number() })), async (c) => {
    const { id } = c.req.valid("param");
    const user = c.get("user")!;
    let pointsChange: -1 | 1 = 1;

    const points = await db.transaction(async (tx) => {
        const [existingUpvote] = await tx
            .select()
            .from(commentUpvotesTable)
            .where(
                and(
                    eq(commentUpvotesTable.commentId, id), 
                    eq(commentUpvotesTable.userId, user.id)
                )
            ).limit(1);
        pointsChange = existingUpvote ? -1 : 1;

        const [updated] = await tx
            .update(commentsTable)
            .set({
                points: sql`${commentsTable.points} + ${pointsChange}`,
            })
            .where(
                eq(commentsTable.id, id)
            )
            .returning({
                points: commentsTable.points,
            })
        if (!updated) {
            throw new HTTPException(404, {
                message: "Comment not found",
            });
        }

        if (existingUpvote) {
            await tx
                .delete(commentUpvotesTable)
                .where(eq(commentUpvotesTable.id, existingUpvote.id));
        } else {
            await tx
                .insert(commentUpvotesTable)
                .values({
                    commentId: id,
                    userId: user.id,
                });
        }

        return updated.points;
    });

    return c.json<SuccessResponse<{ count: number, commentUpvotes: { userId: string }[] }>>({
        success: true,
        message: "Comment updated successfully",
        data: { count: points, commentUpvotes: pointsChange === 1 ? [{ userId: user.id }] : [] },
    }, 200);
});


commentRoutes.get("/:id/comments", zValidator("param", z.object({ id: z.coerce.number() })), zValidator("query", paginationSchema), async (c) => {
    const { id } = c.req.valid("param");
    const user = c.get("user");
    const { limit, page, sortBy, order } = c.req.valid("query");

    const offset = (page - 1) * limit;

    const sortByColumn = sortBy === "points" ? commentsTable.points : commentsTable.createdAt;

    const sortOrder = order === "desc" ? desc(sortByColumn) : asc(sortByColumn);

    const [count] = await db
        .select({ count: countDistinct(commentsTable.id)})
        .from(commentsTable)
        .where(eq(commentsTable.parentCommentId, id));

    const comments = await db
    .query
    .comments
    .findMany({
        where: and(
            eq(commentsTable.parentCommentId, id)        
        ),
        orderBy: sortOrder,
        limit: limit,
        offset: offset,
        with: {
            author: {
                columns: {
                    id: true,
                    username: true,
                },
            },
            commentUpvotes: {
                columns: {
                    userId: true,
                },
                where: eq(commentUpvotesTable.userId, user?.id ?? ""),
                limit: 1,
            }
        },
        extras: {
            createdAt: getISOFormatDateQuery(commentsTable.createdAt).as("created_at"),
        },
    })
    return c.json<PaginatedResponse<Comment[]>>({
        success: true,
        message: "Comment fetched successfully",
        data: comments as Comment[],
        pagination: {
            page,
            totalPages: Math.ceil(count?.count ?? 0 / limit) as number,
        }
    }, 200);
});

