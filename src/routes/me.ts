import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { auth } from "../lib/auth.js";
import { ErrorSchema } from "../schemas/index.js";
import { GetUserTrainData } from "../usecases/GetUserTrainData.js";
import { UpsertUserTrainData } from "../usecases/UpsertUserTrainData.js";

const UserTrainDataSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  weightInGrams: z.number(),
  heightInCentimeters: z.number(),
  age: z.number(),
  bodyFatPercentage: z.number(),
});

export const meRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/me",
    schema: {
      tags: ["Me"],
      summary: "Get current user train data",
      response: {
        200: UserTrainDataSchema.nullable(),
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
            error: "Unauthorized",
            code: "UNAUTHORIZED",
          });
        }
        const useCase = new GetUserTrainData();
        const result = await useCase.execute({ userId: session.user.id });
        return reply.status(200).send(result);
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "PUT",
    url: "/me",
    schema: {
      tags: ["Me"],
      summary: "Upsert current user train data",
      body: z.object({
        weightInGrams: z.number(),
        heightInCentimeters: z.number(),
        age: z.number(),
        bodyFatPercentage: z.number(),
      }),
      response: {
        200: z.object({
          userId: z.string(),
          weightInGrams: z.number(),
          heightInCentimeters: z.number(),
          age: z.number(),
          bodyFatPercentage: z.number(),
        }),
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
            error: "Unauthorized",
            code: "UNAUTHORIZED",
          });
        }
        const useCase = new UpsertUserTrainData();
        const result = await useCase.execute({
          userId: session.user.id,
          weightInGrams: request.body.weightInGrams,
          heightInCentimeters: request.body.heightInCentimeters,
          age: request.body.age,
          bodyFatPercentage: request.body.bodyFatPercentage,
        });
        return reply.status(200).send(result);
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });
};
