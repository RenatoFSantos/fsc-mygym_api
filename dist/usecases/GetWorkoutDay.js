import { NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";
export class GetWorkoutDay {
    async execute(dto) {
        const workoutPlan = await prisma.workoutPlan.findUnique({
            where: { id: dto.workoutPlanId },
        });
        if (!workoutPlan || workoutPlan.userId !== dto.userId) {
            throw new NotFoundError("Workout plan not found");
        }
        const workoutDay = await prisma.workoutDay.findUnique({
            where: { id: dto.workoutDayId, workoutPlanId: dto.workoutPlanId },
            include: {
                workoutExercises: {
                    orderBy: { order: "asc" },
                },
                workoutSessions: {
                    orderBy: { startedAt: "desc" },
                },
            },
        });
        if (!workoutDay) {
            throw new NotFoundError("Workout day not found");
        }
        return {
            id: workoutDay.id,
            name: workoutDay.name,
            isRest: workoutDay.isRest,
            coverImageUrl: workoutDay.coverImageUrl,
            estimatedDurationInSeconds: workoutDay.estimatedDurationInSeconds,
            weekDay: workoutDay.weekDay,
            exercises: workoutDay.workoutExercises.map((exercise) => ({
                id: exercise.id,
                name: exercise.name,
                order: exercise.order,
                sets: exercise.sets,
                reps: exercise.reps,
                restTimeInSeconds: exercise.restTimeInSeconds,
                workoutDayId: exercise.workoutDayId,
            })),
            sessions: workoutDay.workoutSessions.map((session) => ({
                id: session.id,
                workoutDayId: session.workoutDayId,
                startedAt: session.startedAt?.toISOString(),
                completedAt: session.completedAt?.toISOString() ?? undefined,
            })),
        };
    }
}
