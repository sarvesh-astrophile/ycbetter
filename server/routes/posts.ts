import { Hono } from "hono";
import type { Context } from "@/context";
import { loggedin } from "@/middleware/loggedin";
import { zValidator } from "@/utils/validator";
import { createCommentSchema, createPostSchema, paginationSchema, type PaginatedResponse, type Post, type SuccessResponse, type Comment } from "@/shared/types";
import { postsTable } from "@/db/schema/posts";
import { db } from "@/adapter";
import { asc, desc, countDistinct, and, sql, isNull } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { getISOFormatDateQuery } from "@/utils/postformat";
import { userTable } from "@/db/schema/auth";
import { commentUpvotesTable, postUpvotesTable } from "@/db/schema/upvotes";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { commentsTable } from "@/db/schema/comments";

export const postRoutes = new Hono<Context>()

postRoutes.post("/", loggedin, zValidator("form", createPostSchema), async (c) => {
    const { title, url, content } = c.req.valid("form");
    const user = c.get("user")!;
    const [post] = await db.insert(postsTable).values({
        userId: user.id,
        title,
        url,
        content,
    }).returning(
        {
            id: postsTable.id,
        }
    );
    return c.json<SuccessResponse<{ postId: number }>>({
        success: true,
        message: "Post created successfully",
        data: {
            postId: post!.id,
        },
    });
});

postRoutes.get("/", zValidator("query", paginationSchema), async (c) => {
    const { limit, page, sortBy, order, author, site } = c.req.valid("query");
    const user = c.get("user");

    const offset = (page - 1) * limit;

    const sortByColumn = sortBy === "points" ? postsTable.points : postsTable.createdAt;

    const sortOrder = order === "desc" ? desc(sortByColumn) : asc(sortByColumn);

    const [count] = await db
        .select({ count: countDistinct(postsTable.id)})
        .from(postsTable)
        .where(
            and(
                author ? eq(postsTable.userId, author) : undefined, 
                site ? eq(postsTable.url, site) : undefined
            )
        );
    
    // Build the base query
    let postsQuery = db
    .select({
        id: postsTable.id,
        title: postsTable.title,
        url: postsTable.url,
        content: postsTable.content,
      points: postsTable.points,
      createdAt: getISOFormatDateQuery(postsTable.createdAt),
      commentCount: postsTable.commentCount,
      author: {
        username: userTable.username,
        id: userTable.id,
      },
      idUpvoted: user
        ? sql<boolean>`CASE WHEN ${postUpvotesTable.userId} IS NOT NULL THEN true ELSE false END`
        : sql<boolean>`false`,
    })
    .from(postsTable)
    .leftJoin(userTable, eq(postsTable.userId, userTable.id))
    .orderBy(sortOrder)
    .limit(limit)
    .offset(offset)
    .where(
      and(
        author ? eq(postsTable.userId, author) : undefined,
        site ? eq(postsTable.url, site) : undefined,
      ),
    );

    // Conditionally add the upvotes join
    if (user) {
        postsQuery = postsQuery.leftJoin(
            postUpvotesTable,
            and(
                eq(postUpvotesTable.postId, postsTable.id),
                eq(postUpvotesTable.userId, user.id),
            )
        );
    }

    const posts = await postsQuery;

    return c.json<PaginatedResponse<Post[]>>({
        success: true,
        message: "Posts fetched successfully",
        data: posts as Post[],
        pagination: {
            page,
            totalPages: Math.ceil(count?.count ?? 0 / limit) as number,
        },
    }, 200);
});

postRoutes.post("/:id/upvote", loggedin, zValidator("param", z.object({ id: z.coerce.number() })), async (c) => {
    const { id } = c.req.valid("param");
    const user = c.get("user")!;
    let pointsChange: -1 | 1 = 1;

    const points = await db.transaction(async (tx) => {
        const [existingUpvote] = await tx
            .select()
            .from(postUpvotesTable)
            .where(
                and(
                    eq(postUpvotesTable.postId, id), 
                    eq(postUpvotesTable.userId, user.id)
                )
            ).limit(1);
        pointsChange = existingUpvote ? -1 : 1;

        const [updated] = await tx
            .update(postsTable)
            .set({
                points: sql`${postsTable.points} + ${pointsChange}`,
            })
            .where(
                eq(postsTable.id, id)
            )
            .returning({
                points: postsTable.points,
            })
            
        if (!updated) {
            throw new HTTPException(404, {
                message: "Post not found",
            });
        }

        if (existingUpvote) {
            await tx
                .delete(postUpvotesTable)
                .where(eq(postUpvotesTable.id, existingUpvote.id));
        } else {
            await tx
                .insert(postUpvotesTable)
                .values({
                    postId: id,
                    userId: user.id,
                });
        }

        return updated.points;
    });

    return c.json<SuccessResponse<{ count: number, isUpvoted: boolean }>>({
        success: true,
        message: "Post updated successfully",
        data: { count: points, isUpvoted: pointsChange === 1 },
    }, 200);
});

postRoutes.post("/:id/comment", loggedin, zValidator("param", z.object({ id: z.coerce.number() })), zValidator("form", createCommentSchema), async (c) => {
        const { id } = c.req.valid("param");
        const { content } = c.req.valid("form");
        const user = c.get("user")!;

        const [comment] = await db.transaction(async (tx) => {
            const [updatedPost] = await tx
                .update(postsTable)
                .set({
                    commentCount: sql`${postsTable.commentCount} + 1`,
                })
                .where(eq(postsTable.id, id))
                .returning({
                    commentCount: postsTable.commentCount,
                });
            
            if (!updatedPost) {
                throw new HTTPException(404, {
                    message: "Post not found",
                });
            }
            
            return await tx
                .insert(commentsTable)
                .values({
                    postId: id,
                    userId: user.id,
                    content,
                }).returning({
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
                commentUpvotes: [],
                author: {
                    id: user.id,
                    username: user.username,
                },
                childComments: [],
            } as Comment,
        }, 200);
    }
);

postRoutes.get("/:id/comments", zValidator("param", z.object({ id: z.coerce.number() })), zValidator("query", paginationSchema.extend({ includeChildren: z.coerce.boolean().optional() })), async (c) => {
    const { id } = c.req.valid("param");
    const user = c.get("user");
    const { limit, page, sortBy, order, includeChildren } = c.req.valid("query");

    const offset = (page - 1) * limit;
    const [postExists] = await db
        .select({exists: sql`1`})
        .from(postsTable)
        .where(eq(postsTable.id, id))
        .limit(1);

    if (!postExists) {
        throw new HTTPException(404, {
            message: "Post not found",
        });
    }

    const sortByColumn = sortBy === "points" ? commentsTable.points : commentsTable.createdAt;
    const sortOrder = order === "desc" ? desc(sortByColumn) : asc(sortByColumn);
    
    const [count] = await db
        .select({count: countDistinct(commentsTable.id)})
        .from(commentsTable)
        .where(
            and(
                eq(commentsTable.postId, id),
                isNull(commentsTable.parentCommentId)
            )
        );

    const comments = await db
        .query
        .comments
        .findMany({
            where: and(
                eq(commentsTable.postId, id),
                isNull(commentsTable.parentCommentId)
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
                },
                childComments: {
                    limit: includeChildren ? 2 : 0,
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
                        },
                    },
                    orderBy: sortOrder,
                    extras: {
                        createdAt: getISOFormatDateQuery(commentsTable.createdAt).as("created_at"),
                    },
                },
            },
            extras: {
                createdAt: getISOFormatDateQuery(commentsTable.createdAt).as("created_at"),
            },
        })
    
    return c.json<PaginatedResponse<Comment[]>>({
        success: true,
        message: "Comments fetched successfully",
        data: comments as Comment[],
        pagination: {
            page,
            totalPages: Math.ceil(count?.count ?? 0 / limit) as number,
        }
    }, 200);
});

postRoutes.get("/:id", zValidator("param", z.object({ id: z.coerce.number() })), async (c) => {
    const { id } = c.req.valid("param");
    const user = c.get("user");

    const postsQuery = db
    .select({
        id: postsTable.id,
        title: postsTable.title,
        url: postsTable.url,
        points: postsTable.points,
        content: postsTable.content,
        createdAt: getISOFormatDateQuery(postsTable.createdAt),
        commentCount: postsTable.commentCount,
        author: {
            username: userTable.username,
            id: userTable.id,
        },
        idUpvoted: user
        ? sql<boolean>`CASE WHEN ${postUpvotesTable.userId} IS NOT NULL THEN true ELSE false END`
        : sql<boolean>`false`,
    })
    .from(postsTable)
    .leftJoin(userTable, eq(postsTable.userId, userTable.id))
    .where(eq(postsTable.id, id));

    if (user) {
        postsQuery.leftJoin(
        postUpvotesTable,
            and(
                eq(postUpvotesTable.postId, postsTable.id),
                eq(postUpvotesTable.userId, user.id),
            ),
        );
    }

    const [post] = await postsQuery;

    if (!post) {
        throw new HTTPException(404, {
            message: "Post not found",
        });
    }

    return c.json<SuccessResponse<Post>>({
        success: true,
        message: "Post fetched successfully",
        data: post as Post,
    }, 200);
});

