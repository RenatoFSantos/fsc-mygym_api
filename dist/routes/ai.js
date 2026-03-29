import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, tool } from "ai";
import { fromNodeHeaders } from "better-auth/node";
import z from "zod";
import { WeekDay } from "../generated/prisma/enums.js";
import { auth } from "../lib/auth.js";
import { ErrorSchema } from "../schemas/index.js";
import { CreateWorkoutPlan } from "../usecases/CreateWorkoutPlan.js";
import { GetUserTrainData } from "../usecases/GetUserTrainData.js";
import { GetWorkoutPlans } from "../usecases/GetWorkoutPlans.js";
import { UpsertUserTrainData } from "../usecases/UpsertUserTrainData.js";
const SYSTEM_PROMPT = `Você é um personal trainer virtual especialista em montagem de planos de treino. Seu papel é ajudar pessoas comuns a treinar de forma eficiente e segura, mesmo sem nenhum conhecimento prévio de academia.

## Comportamento geral
- Tom amigável, motivador e linguagem simples. Evite jargões técnicos.
- Respostas curtas e objetivas — vá direto ao ponto.
- **SEMPRE** chame a tool \`getUserTrainData\` antes de qualquer interação com o usuário.

## Primeiro contato
- Se o usuário **não tem dados cadastrados** (retornou null): pergunte nome, peso (kg), altura (cm), idade e % de gordura corporal. Faça isso em uma única mensagem, com perguntas simples e diretas. Após receber as respostas, salve com a tool \`updateUserTrainData\` (converta o peso de kg para gramas multiplicando por 1000).
- Se o usuário **já tem dados cadastrados**: cumprimente-o pelo nome.

## Criação de plano de treino
Quando o usuário quiser criar um plano de treino:
1. Pergunte: objetivo principal, quantos dias por semana pode treinar e se tem alguma restrição física ou lesão. Faça tudo em uma única mensagem curta.
2. Monte o plano com base nas respostas e chame a tool \`createWorkoutPlan\`.

### Regras do plano
- O plano DEVE ter exatamente 7 dias (MONDAY a SUNDAY).
- Dias sem treino: \`isRest: true\`, \`workoutExercises: []\`, \`estimatedDurationInSeconds: 0\`.
- Nomes descritivos para cada dia (ex: "Superior A - Peito e Tríceps", "Inferior - Pernas", "Descanso").
- SEMPRE forneça um \`coverImageUrl\` para cada dia.

### Divisões de treino (Splits) por dias disponíveis
- **2-3 dias/semana**: Full Body ou ABC (A: Peito+Tríceps, B: Costas+Bíceps, C: Pernas+Ombros)
- **4 dias/semana**: Upper/Lower (recomendado, cada grupo 2x/semana) ou ABCD (A: Peito+Tríceps, B: Costas+Bíceps, C: Pernas, D: Ombros+Abdômen)
- **5 dias/semana**: PPLUL — Push/Pull/Legs + Upper/Lower (superior 3x, inferior 2x/semana)
- **6 dias/semana**: PPL 2x — Push/Pull/Legs repetido

### Princípios de montagem
- Músculos sinérgicos juntos (peito+tríceps, costas+bíceps)
- Exercícios compostos primeiro, isoladores depois
- 4 a 8 exercícios por sessão
- 3-4 séries por exercício; 8-12 reps (hipertrofia) ou 4-6 reps (força)
- Descanso entre séries: 60-90s (hipertrofia), 2-3min (compostos pesados)
- Evitar treinar o mesmo grupo muscular em dias consecutivos

### Imagens de capa (coverImageUrl)
SEMPRE forneça uma URL de imagem para cada dia de treino, escolhendo com base no foco muscular:

**Dias superiores** (peito, costas, ombros, bíceps, tríceps, push, pull, upper, full body, descanso):
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO3y8pQ6GBg8iqe9pP2JrHjwd1nfKtVSQskI0v
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOW3fJmqZe4yoUcwvRPQa8kmFprzNiC30hqftL

**Dias inferiores** (pernas, glúteos, quadríceps, posterior, panturrilha, legs, lower):
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOgCHaUgNGronCvXmSzAMs1N3KgLdE5yHT6Ykj
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO85RVu3morROwZk5NPhs1jzH7X8TyEvLUCGxY

Alterne entre as duas opções de cada categoria para variar.`;
export const aiRoutes = async (app) => {
    app.withTypeProvider().route({
        method: "POST",
        url: "/",
        schema: {
            tags: ["AI"],
            summary: "Chat with the AI personal trainer",
            body: z.object({
                messages: z.array(z.any()),
            }),
            response: {
                200: z.unknown(),
                401: ErrorSchema,
            },
        },
        handler: async (request, reply) => {
            const session = await auth.api.getSession({
                headers: fromNodeHeaders(request.headers),
            });
            if (!session) {
                return reply.status(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
            }
            const userId = session.user.id;
            const { messages } = request.body;
            const result = streamText({
                model: openai("gpt-4o-mini"),
                system: SYSTEM_PROMPT,
                tools: {
                    getUserTrainData: tool({
                        description: "Busca os dados de treino do usuário (nome, peso, altura, idade, % gordura). Deve ser chamada antes de qualquer interação.",
                        inputSchema: z.object({}),
                        execute: async () => {
                            const useCase = new GetUserTrainData();
                            return useCase.execute({ userId });
                        },
                    }),
                    updateUserTrainData: tool({
                        description: "Salva ou atualiza os dados físicos do usuário.",
                        inputSchema: z.object({
                            weightInGrams: z.number().describe("Peso em gramas (kg × 1000)").min(1),
                            heightInCentimeters: z.number().describe("Altura em centímetros").min(1),
                            age: z.number().describe("Idade em anos").min(1),
                            bodyFatPercentage: z.number().describe("Percentual de gordura corporal").min(0).max(100),
                        }),
                        execute: async (input) => {
                            const useCase = new UpsertUserTrainData();
                            return useCase.execute({ userId, ...input });
                        },
                    }),
                    getWorkoutPlans: tool({
                        description: "Lista os planos de treino do usuário.",
                        inputSchema: z.object({}),
                        execute: async () => {
                            const useCase = new GetWorkoutPlans();
                            return useCase.execute({ userId });
                        },
                    }),
                    createWorkoutPlan: tool({
                        description: "Cria um novo plano de treino completo com exatamente 7 dias (MONDAY a SUNDAY).",
                        inputSchema: z.object({
                            name: z.string().describe("Nome do plano de treino").trim().min(1),
                            workoutDays: z.array(z.object({
                                name: z.string().describe("Nome descritivo do dia (ex: Superior A - Peito e Tríceps, Descanso)").trim().min(1),
                                weekDay: z.enum(WeekDay).describe("Dia da semana (MONDAY a SUNDAY)"),
                                isRest: z.boolean().describe("true se for dia de descanso, false se for dia de treino"),
                                estimatedDurationInSeconds: z.number().describe("Duração estimada do treino em segundos (0 para dias de descanso)").min(0),
                                coverImageUrl: z.url().describe("URL da imagem de capa do dia de treino"),
                                workoutExercises: z.array(z.object({
                                    name: z.string().describe("Nome do exercício").trim().min(1),
                                    order: z.number().describe("Ordem do exercício na sessão").min(1),
                                    sets: z.number().describe("Número de séries").min(1),
                                    reps: z.number().describe("Número de repetições por série").min(1),
                                    restTimeInSeconds: z.number().describe("Tempo de descanso entre séries em segundos").min(1),
                                })).describe("Lista de exercícios (array vazio para dias de descanso)"),
                            })).length(7).describe("Array com exatamente 7 dias de treino, de MONDAY a SUNDAY"),
                        }),
                        execute: async (input) => {
                            const useCase = new CreateWorkoutPlan();
                            return useCase.execute({ userId, ...input });
                        },
                    }),
                },
                stopWhen: stepCountIs(5),
                messages: await convertToModelMessages(messages),
            });
            const response = result.toUIMessageStreamResponse();
            response.headers.forEach((value, key) => reply.header(key, value));
            return reply.send(response.body);
        },
    });
};
