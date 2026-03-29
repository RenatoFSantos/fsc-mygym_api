import { fromNodeHeaders } from 'better-auth/node';
import z from 'zod';
import { NotFoundError } from '../errors/index.js';
import { auth } from '../lib/auth.js';
import { ErrorSchema } from '../schemas/index.js';
import { GetStats } from '../usecases/GetStats.js';
export const statsRoutes = async (app) => {
    app.withTypeProvider().route({
        method: 'GET',
        url: '/',
        schema: {
            operationId: 'getUserWorkoutStats',
            tags: ['Stats'],
            summary: 'Get user workout statistics',
            querystring: z.object({
                from: z.iso.date(),
                to: z.iso.date(),
            }),
            response: {
                200: z.object({
                    workoutStreak: z.number(),
                    consistencyByDay: z.record(z.iso.date(), z.object({
                        workoutDayCompleted: z.boolean(),
                        workoutDayStarted: z.boolean(),
                    })),
                    completedWorkoutsCount: z.number(),
                    conclusionRate: z.number(),
                    totalTimeInSeconds: z.number(),
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
                const useCase = new GetStats();
                const result = await useCase.execute({
                    userId: session.user.id,
                    from: request.query.from,
                    to: request.query.to,
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
