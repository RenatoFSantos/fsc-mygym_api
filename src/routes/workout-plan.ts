import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { ConflictError, NotFoundError, WorkoutPlanNotActiveError } from "../errors/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { auth } from "../lib/auth.js";
import { ErrorSchema, WorkoutPlanSchema } from "../schemas/index.js";
import { CreateWorkoutPlan, OutputDto } from "../usecases/CreateWorkoutPlan.js";
import { GetWorkoutDay } from "../usecases/GetWorkoutDay.js";
import { GetWorkoutPlan } from "../usecases/GetWorkoutPlan.js";
import { GetWorkoutPlans } from "../usecases/GetWorkoutPlans.js";
import { StartWorkoutSession } from "../usecases/StartWorkoutSession.js";
import { UpdateWorkoutSession } from "../usecases/UpdateWorkoutSession.js";

export const workoutPlanRoutes = async (app: FastifyInstance) => {

    app.withTypeProvider<ZodTypeProvider>().route({
        method: 'GET',
        url: '/workout-plans',
        schema: {
            tags: ['Workout Plan'],
            summary: 'List workout plans',
            querystring: z.object({
                active: z.enum(['true', 'false']).optional(),
            }),
            response: {
                200: z.array(z.object({
                    id: z.string(),
                    name: z.string(),
                    isActive: z.boolean(),
                    workoutDays: z.array(z.object({
                        id: z.string(),
                        name: z.string(),
                        weekDay: z.enum(WeekDay),
                        isRest: z.boolean(),
                        estimatedDurationInSeconds: z.number(),
                        coverImageUrl: z.string().nullable(),
                        exercises: z.array(z.object({
                            id: z.string(),
                            name: z.string(),
                            order: z.number(),
                            sets: z.number(),
                            reps: z.number(),
                            restTimeInSeconds: z.number(),
                        })),
                    })),
                })),
                401: ErrorSchema,
                500: ErrorSchema,
            },
        },
        handler: async (request, reply) => {
            try {
                const session = await auth.api.getSession({
                    headers: fromNodeHeaders(request.headers),
                });
                if (!session) {
                    return reply.status(401).send({
                        error: 'Unauthorized',
                        code: 'UNAUTHORIZED',
                    });
                }
                const active = request.query.active === undefined
                    ? undefined
                    : request.query.active === 'true';
                const useCase = new GetWorkoutPlans();
                const result = await useCase.execute({
                    userId: session.user.id,
                    active,
                });
                return reply.status(200).send(result);
            } catch (error) {
                app.log.error(error);
                return reply.status(500).send({
                    error: 'Internal server error',
                    code: 'INTERNAL_SERVER_ERROR',
                });
            }
        },
    });

    app.withTypeProvider<ZodTypeProvider>().route({
        method: 'GET',
        url: '/workout-plans/:id',
        schema: {
            tags: ['Workout Plan'],
            summary: 'Get Workout Plan by ID',
            params: z.object({
                id: z.uuid(),
            }),
            response: {
                200: z.object({
                    id: z.string(),
                    name: z.string(),
                    workoutDays: z.array(z.object({
                        id: z.string(),
                        weekDay: z.enum(WeekDay),
                        name: z.string(),
                        isRest: z.boolean(),
                        coverImageUrl: z.string().nullable().optional(),
                        estimatedDurationInSeconds: z.number(),
                        exercisesCount: z.number(),
                    })),
                }),
                401: ErrorSchema,
                404: ErrorSchema,
                500: ErrorSchema,
            },
        },
        handler: async (request, reply) => {
            try {
                const session = await auth.api.getSession({
                    headers: fromNodeHeaders(request.headers),
                });
                if (!session) {
                    return reply.status(401).send({
                        error: 'Unauthorized',
                        code: 'UNAUTHORIZED',
                    });
                }
                const useCase = new GetWorkoutPlan();
                const result = await useCase.execute({
                    userId: session.user.id,
                    workoutPlanId: request.params.id,
                });
                return reply.status(200).send(result);
            } catch (error) {
                app.log.error(error);
                if (error instanceof NotFoundError) {
                    return reply.status(404).send({
                        error: error.message,
                        code: 'NOT_FOUND_ERROR',
                    });
                }
                return reply.status(500).send({
                    error: 'Internal server error',
                    code: 'INTERNAL_SERVER_ERROR',
                });
            }
        },
    });

    app.withTypeProvider<ZodTypeProvider>().route({
        method: 'POST',
        url: '/workout-plans',
        schema: {
            tags: ['Workout Plan'],
            summary: 'Create Workout Plan',
            body: WorkoutPlanSchema.omit({ id: true }),
            response: {
                201: WorkoutPlanSchema,
                400: ErrorSchema,
                401: ErrorSchema,
                404: ErrorSchema,
                500: ErrorSchema,
            },
        },
        handler: async (request, reply) => {
            try {
                const session = await auth.api.getSession({
                    headers: fromNodeHeaders(request.headers)
                })
                if (!session) {
                    return reply.status(401).send({
                        error: "Unauthorized",
                        code: "UNAUTHORIZED",
                    })
                }
                const createWorkoutPlan = new CreateWorkoutPlan();
                const result: OutputDto = await createWorkoutPlan.execute({
                    userId: session?.user.id || '',
                    name: request.body.name,
                    workoutDays: request.body.workoutDays,
                });
                return reply.status(201).send(result);
            } catch (error) {
                app.log.error(error);
                if (error instanceof NotFoundError) {
                    return reply.status(404).send({
                        error: error.message,
                        code: "NOT_FOUND_ERROR",
                    });
                }
            }
        }
    });

    app.withTypeProvider<ZodTypeProvider>().route({
        method: 'GET',
        url: '/workout-plans/:workoutPlanId/days/:workoutDayId',
        schema: {
            tags: ['Workout Plan'],
            summary: 'Get Workout Day by ID',
            params: z.object({
                workoutPlanId: z.uuid(),
                workoutDayId: z.uuid(),
            }),
            response: {
                200: z.object({
                    id: z.string(),
                    name: z.string(),
                    isRest: z.boolean(),
                    coverImageUrl: z.string().nullable().optional(),
                    estimatedDurationInSeconds: z.number(),
                    weekDay: z.enum(WeekDay),
                    exercises: z.array(z.object({
                        id: z.string(),
                        name: z.string(),
                        order: z.number(),
                        sets: z.number(),
                        reps: z.number(),
                        restTimeInSeconds: z.number(),
                        workoutDayId: z.string(),
                    })),
                    sessions: z.array(z.object({
                        id: z.string(),
                        workoutDayId: z.string(),
                        startedAt: z.string().optional(),
                        completedAt: z.string().optional(),
                    })),
                }),
                401: ErrorSchema,
                404: ErrorSchema,
                500: ErrorSchema,
            },
        },
        handler: async (request, reply) => {
            try {
                const session = await auth.api.getSession({
                    headers: fromNodeHeaders(request.headers),
                });
                if (!session) {
                    return reply.status(401).send({
                        error: 'Unauthorized',
                        code: 'UNAUTHORIZED',
                    });
                }
                const useCase = new GetWorkoutDay();
                const result = await useCase.execute({
                    userId: session.user.id,
                    workoutPlanId: request.params.workoutPlanId,
                    workoutDayId: request.params.workoutDayId,
                });
                return reply.status(200).send(result);
            } catch (error) {
                app.log.error(error);
                if (error instanceof NotFoundError) {
                    return reply.status(404).send({
                        error: error.message,
                        code: 'NOT_FOUND_ERROR',
                    });
                }
                return reply.status(500).send({
                    error: 'Internal server error',
                    code: 'INTERNAL_SERVER_ERROR',
                });
            }
        },
    });

    app.withTypeProvider<ZodTypeProvider>().route({
        method: 'POST',
        url: '/workout-plans/:workoutPlanId/days/:workoutDayId/sessions',
        schema: {
            tags: ['Workout Plan'],
            summary: 'Start Workout Session',
            params: z.object({
                workoutPlanId: z.uuid(),
                workoutDayId: z.uuid(),
            }),
            response: {
                201: z.object({ userWorkoutSessionId: z.string() }),
                401: ErrorSchema,
                404: ErrorSchema,
                409: ErrorSchema,
                422: ErrorSchema,
                500: ErrorSchema,
            },
        },
        handler: async (request, reply) => {
            try {
                const session = await auth.api.getSession({
                    headers: fromNodeHeaders(request.headers)
                });
                if (!session) {
                    return reply.status(401).send({
                        error: "Unauthorized",
                        code: "UNAUTHORIZED",
                    });
                }
                const useCase = new StartWorkoutSession();
                const result = await useCase.execute({
                    userId: session.user.id,
                    workoutPlanId: request.params.workoutPlanId,
                    workoutDayId: request.params.workoutDayId,
                });
                return reply.status(201).send(result);
            } catch (error) {
                app.log.error(error);
                if (error instanceof NotFoundError) {
                    return reply.status(404).send({
                        error: error.message,
                        code: "NOT_FOUND_ERROR",
                    });
                }
                if (error instanceof WorkoutPlanNotActiveError) {
                    return reply.status(422).send({
                        error: error.message,
                        code: "WORKOUT_PLAN_NOT_ACTIVE",
                    });
                }
                if (error instanceof ConflictError) {
                    return reply.status(409).send({
                        error: error.message,
                        code: "CONFLICT_ERROR",
                    });
                }
            }
        }
    });

    app.withTypeProvider<ZodTypeProvider>().route({
        method: 'PUT',
        url: '/workout-plans/:workoutPlanId/days/:workoutDayId/sessions/:workoutSessionId',
        schema: {
            tags: ['Workout Plan'],
            summary: 'Update Workout Session',
            params: z.object({
                workoutPlanId: z.uuid(),
                workoutDayId: z.uuid(),
                workoutSessionId: z.uuid(),
            }),
            body: z.object({
                completedAt: z.iso.datetime(),
            }),
            response: {
                200: z.object({
                    id: z.string(),
                    completedAt: z.string(),
                    startedAt: z.string(),
                }),
                401: ErrorSchema,
                404: ErrorSchema,
                500: ErrorSchema,
            },
        },
        handler: async (request, reply) => {
            try {
                const session = await auth.api.getSession({
                    headers: fromNodeHeaders(request.headers),
                });
                if (!session) {
                    return reply.status(401).send({
                        error: "Unauthorized",
                        code: "UNAUTHORIZED",
                    });
                }
                const useCase = new UpdateWorkoutSession();
                const result = await useCase.execute({
                    userId: session.user.id,
                    workoutPlanId: request.params.workoutPlanId,
                    workoutDayId: request.params.workoutDayId,
                    workoutSessionId: request.params.workoutSessionId,
                    completedAt: request.body.completedAt,
                });
                return reply.status(200).send(result);
            } catch (error) {
                app.log.error(error);
                if (error instanceof NotFoundError) {
                    return reply.status(404).send({
                        error: error.message,
                        code: "NOT_FOUND_ERROR",
                    });
                }
                return reply.status(500).send({
                    error: "Internal server error",
                    code: "INTERNAL_SERVER_ERROR",
                });
            }
        },
    });
}