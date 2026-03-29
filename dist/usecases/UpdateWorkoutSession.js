import { NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";
export class UpdateWorkoutSession {
    async execute(dto) {
        const workoutPlan = await prisma.workoutPlan.findUnique({
            where: { id: dto.workoutPlanId },
        });
        if (!workoutPlan || workoutPlan.userId !== dto.userId) {
            throw new NotFoundError("WorkoutPlan not found");
        }
        const workoutDay = await prisma.workoutDay.findUnique({
            where: { id: dto.workoutDayId },
        });
        if (!workoutDay || workoutDay.workoutPlanId !== dto.workoutPlanId) {
            throw new NotFoundError("WorkoutDay not found");
        }
        const workoutSession = await prisma.workoutSession.findUnique({
            where: { id: dto.workoutSessionId },
        });
        if (!workoutSession || workoutSession.workoutDayId !== dto.workoutDayId) {
            throw new NotFoundError("WorkoutSession not found");
        }
        const updated = await prisma.workoutSession.update({
            where: { id: dto.workoutSessionId },
            data: { completedAt: new Date(dto.completedAt) },
        });
        return {
            id: updated.id,
            completedAt: updated.completedAt.toISOString(),
            startedAt: updated.startedAt.toISOString(),
        };
    }
}
