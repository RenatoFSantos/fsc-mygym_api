import { fromNodeHeaders } from 'better-auth/node';
import z from 'zod';
import { NotFoundError } from '../errors/index.js';
import { WeekDay } from '../generated/prisma/enums.js';
import { auth } from '../lib/auth.js';
import { ErrorSchema } from '../schemas/index.js';
import { GetHomeData } from '../usecases/GetHomeData.js';
export const homeRoutes = async (app) => {
    app.withTypeProvider().route({
        method: 'GET',
        url: '/:date',
        schema: {
            operationId: 'getHomePageData',
            tags: ['Home'],
            summary: 'Get home page data',
            params: z.object({
                date: z.iso.date(),
            }),
            response: {
                200: z.object({
                    activeWorkoutPlanId: z.string(),
                    todayWorkoutDay: z.object({
                        workoutPlanId: z.string(),
                        id: z.string(),
                        name: z.string(),
                        isRest: z.boolean(),
                        weekDay: z.enum(WeekDay),
                        estimatedDurationInSeconds: z.number(),
                        coverImageUrl: z.string().nullable().optional(),
                        exercisesCount: z.number(),
                    }).optional(),
                    workoutStreak: z.number(),
                    consistencyByDay: z.record(z.iso.date(), z.object({
                        workoutDayCompleted: z.boolean(),
                        workoutDayStarted: z.boolean(),
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
                const useCase = new GetHomeData();
                const result = await useCase.execute({
                    userId: session.user.id,
                    date: request.params.date,
                });
                return reply.status(200).send(result);
            }
            catch (error) {
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
};
