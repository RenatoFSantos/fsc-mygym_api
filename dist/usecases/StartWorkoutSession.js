import { ConflictError, NotFoundError, WorkoutPlanNotActiveError } from "../errors/index.js";
import { prisma } from "../lib/db.js";
export class StartWorkoutSession {
    async execute(dto) {
        const workoutPlan = await prisma.workoutPlan.findUnique({
            where: { id: dto.workoutPlanId },
        });
        if (!workoutPlan || workoutPlan.userId !== dto.userId) {
            throw new NotFoundError('WorkoutPlan not found');
        }
        if (!workoutPlan.isActive) {
            throw new WorkoutPlanNotActiveError();
        }
        const workoutDay = await prisma.workoutDay.findUnique({
            where: { id: dto.workoutDayId },
        });
        if (!workoutDay || workoutDay.workoutPlanId !== dto.workoutPlanId) {
            throw new NotFoundError('WorkoutDay not found');
        }
        const existingSession = await prisma.workoutSession.findFirst({
            where: {
                workoutDayId: dto.workoutDayId,
                startedAt: { not: undefined },
            },
        });
        if (existingSession) {
            throw new ConflictError('WorkoutDay already has a started session');
        }
        const session = await prisma.workoutSession.create({
            data: {
                workoutDayId: dto.workoutDayId,
                startedAt: new Date(),
            },
        });
        return { userWorkoutSessionId: session.id };
    }
}
