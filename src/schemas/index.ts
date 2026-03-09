import z from 'zod';

import { WeekDay } from '../generated/prisma/enums.js';

export const ErrorSchema = z.object({
    error: z.string(),
    code: z.string()
})

export const WorkoutPlanSchema = z.object({
    id: z.uuid(),
    name: z.string().trim().min(1, {
        error: 'Name is required',
    }),
    workoutDays: z.array(z.object({
        name: z.string().trim().min(1, {
            error: 'Day name is required',
        }),
        weekDay: z.enum(WeekDay).default(WeekDay.MONDAY),
        isRest: z.boolean().default(false),
        estimatedDurationInSeconds: z.number().min(1),
        coverImageUrl: z.url().optional().nullable(),
        workoutExercises: z.array(
            z.object({
                name: z.string().trim().min(1, { error: 'Exercise name is required' }),
                order: z.number().min(1),
                sets: z.number().min(1),
                reps: z.number().min(1),
                restTimeInSeconds: z.number().min(1),
            })),
    })),
});