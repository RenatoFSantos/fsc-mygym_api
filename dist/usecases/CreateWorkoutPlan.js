import { prisma } from "../lib/db.js";
export class CreateWorkoutPlan {
    async execute(dto) {
        const existingWorkoutPlan = await prisma.workoutPlan.findFirst({
            where: {
                isActive: true,
            },
        });
        // Transaction
        return prisma.$transaction(async (tx) => {
            if (existingWorkoutPlan) {
                await tx.workoutPlan.update({
                    where: { id: existingWorkoutPlan.id },
                    data: {
                        isActive: false
                    }
                });
            }
            const workoutPlan = await tx.workoutPlan.create({
                data: {
                    name: dto.name,
                    userId: dto.userId,
                    isActive: true,
                    workoutDays: {
                        create: dto.workoutDays.map((workoutDay) => ({
                            name: workoutDay.name,
                            weekDay: workoutDay.weekDay,
                            isRest: workoutDay.isRest,
                            estimatedDurationInSeconds: workoutDay.estimatedDurationInSeconds,
                            coverImageUrl: workoutDay.coverImageUrl,
                            workoutExercises: {
                                create: workoutDay.workoutExercises.map((exercise) => ({
                                    name: exercise.name,
                                    order: exercise.order,
                                    sets: exercise.sets,
                                    reps: exercise.reps,
                                    restTimeInSeconds: exercise.restTimeInSeconds
                                })),
                            },
                        })),
                    },
                }
            });
            const result = await tx.workoutPlan.findUnique({
                where: {
                    id: workoutPlan.id
                },
                include: {
                    workoutDays: {
                        include: {
                            workoutExercises: true
                        }
                    }
                }
            });
            if (!result) {
                throw new Error('WorkoutPlan plan not found.');
            }
            return {
                id: result.id,
                name: result.name,
                workoutDays: result.workoutDays.map((day) => ({
                    name: day.name,
                    weekDay: day.weekDay,
                    isRest: day.isRest,
                    estimatedDurationInSeconds: day.estimatedDurationInSeconds,
                    coverImageUrl: day.coverImageUrl,
                    workoutExercises: day.workoutExercises.map((exercise) => ({
                        name: exercise.name,
                        order: exercise.order,
                        sets: exercise.sets,
                        reps: exercise.reps,
                        restTimeInSeconds: exercise.restTimeInSeconds,
                    })),
                })),
            };
        });
    }
}
