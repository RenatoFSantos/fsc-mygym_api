import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, tool, UIMessage } from "ai";
import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import z from "zod";

import { WeekDay } from "../generated/prisma/enums.js";
import { auth } from "../lib/auth.js";
import { CreateWorkoutPlan } from "../usecases/CreateWorkoutPlan.js";

export const aiRoutes = async(app: FastifyInstance) => {
    app.post("/ai", async function (request, reply) {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(request.headers),
        });
        const { messages } = request.body as {messages: UIMessage[]};
        const result = streamText({
            model: openai("gpt-4o-mini"),
            system: "",
            tools: {
                getUserTrainData: tool({}),
                updateUserTrainData: tool({}),
                getWorkoutPlans: tool({}),
                createWorkoutPlan: tool({
                    description: "Cria um novo plano de treino completo.",
                    inputSchema: z.object({
                        name: z.string().describe("Nome do plano de treino:").trim().min(1, {
                            error: 'Name is required',
                        }),
                        workoutDays: z.array(z.object({
                            name: z.string().describe("Nome do dia (ex: Peito e Tríceps, Descanso)").trim().min(1, {
                                error: 'Day name is required',
                            }),
                            weekDay: z.enum(WeekDay).describe("Dia da semana (MONDAY a SUNDAY)").default(WeekDay.MONDAY),
                            isRest: z.boolean().describe("Se é dia de descanso (true) ou treino (false)").default(false),
                            estimatedDurationInSeconds: z.number().describe("Estima de duração do treino").min(1),
                            coverImageUrl: z.url().describe("Imagem ilustrativa do treino").optional().nullable(),
                            workoutExercises: z.array(
                                z.object({
                                    name: z.string().describe("Nome do exercício").trim().min(1, { error: 'Exercise name is required' }),
                                    order: z.number().describe("Ordem do exercício no dia").min(1),
                                    sets: z.number().describe("Número de séries").min(1),
                                    reps: z.number().describe("Número das repetições").min(1),
                                    restTimeInSeconds: z.number().describe("Tempo de intervalo em segundos entre séries").min(1),
                                })).describe("Lista de exercícios (vazia para dias de descanso"),
                        })).describe("Array com exatamente 7 dias de treino (MONDAY a SUNDAY)"),
                    }),
                    execute: async (input) => {
                        const createWorkoutPlan = new CreateWorkoutPlan();
                        const result = await createWorkoutPlan.execute({
                            userId: session?.user?.id || "",
                            name: input.name,
                            workoutDays: input.workoutDays
                        });
                        return result;
                    }
                }),
            },
            stopWhen: stepCountIs(5),
            messages: await convertToModelMessages(messages),
        });
        const response = result.toUIMessageStreamResponse();
        reply.status(response.status);
        response.headers.forEach((value, key) => reply.header(key, value));
        return reply.send(response.body);
    });
};