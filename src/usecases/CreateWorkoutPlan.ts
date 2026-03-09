import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

// Data Transfer Object
interface InputDto {
    userId: string;
    name: string;
    workoutDays: Array<{
        name: string;
        weekDay: WeekDay;
        isRest: boolean;
        estimatedDurationInSeconds: number;
        coverImageUrl?: string | null;
        workoutExercises: Array<{
            name: string;
            order: number;
            sets: number;
            reps: number;
            restTimeInSeconds: number;
        }>;
    }>
}

export interface OutputDto {
    id: string;
    name: string;
    workoutDays: Array<{
        name: string;
        weekDay: WeekDay;
        isRest: boolean;
        estimatedDurationInSeconds: number;
        coverImageUrl?: string | null;
        workoutExercises: Array<{
            name: string;
            order: number;
            sets: number;
            reps: number;
            restTimeInSeconds: number;
        }>;
    }>;
}

export class CreateWorkoutPlan {
    async execute(dto: InputDto): Promise<OutputDto> {
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
                })
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
            })
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