import { prisma } from '../lib/db.js';
export class GetWorkoutPlans {
    async execute(dto) {
        const plans = await prisma.workoutPlan.findMany({
            where: {
                userId: dto.userId,
                ...(dto.active !== undefined ? { isActive: dto.active } : {}),
            },
            include: {
                workoutDays: {
                    include: {
                        workoutExercises: {
                            orderBy: { order: 'asc' },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return plans.map((plan) => ({
            id: plan.id,
            name: plan.name,
            isActive: plan.isActive,
            workoutDays: plan.workoutDays.map((day) => ({
                id: day.id,
                name: day.name,
                weekDay: day.weekDay,
                isRest: day.isRest,
                estimatedDurationInSeconds: day.estimatedDurationInSeconds,
                coverImageUrl: day.coverImageUrl ?? null,
                exercises: day.workoutExercises.map((exercise) => ({
                    id: exercise.id,
                    name: exercise.name,
                    order: exercise.order,
                    sets: exercise.sets,
                    reps: exercise.reps,
                    restTimeInSeconds: exercise.restTimeInSeconds,
                })),
            })),
        }));
    }
}
