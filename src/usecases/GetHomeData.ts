import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';

import { NotFoundError } from '../errors/index.js';
import { WeekDay } from '../generated/prisma/enums.js';
import { prisma } from '../lib/db.js';

dayjs.extend(utc);

interface InputDto {
    userId: string;
    date: string; // YYYY-MM-DD
}

interface OutputDto {
    activeWorkoutPlanId: string;
    todayWorkoutDay: {
        workoutPlanId: string;
        id: string;
        name: string;
        isRest: boolean;
        weekDay: WeekDay;
        estimatedDurationInSeconds: number;
        coverImageUrl?: string | null;
        exercisesCount: number;
    };
    workoutStreak: number;
    consistencyByDay: Record<string, {
        workoutDayCompleted: boolean;
        workoutDayStarted: boolean;
    }>;
}

const dayIndexToWeekDay: Record<number, WeekDay> = {
    0: WeekDay.SUNDAY,
    1: WeekDay.MONDAY,
    2: WeekDay.TUESDAY,
    3: WeekDay.WEDNESDAY,
    4: WeekDay.THURSDAY,
    5: WeekDay.FRIDAY,
    6: WeekDay.SATURDAY,
};

export class GetHomeData {
    async execute(dto: InputDto): Promise<OutputDto> {
        const activeWorkoutPlan = await prisma.workoutPlan.findFirst({
            where: { userId: dto.userId, isActive: true },
            include: {
                workoutDays: {
                    include: { workoutExercises: true },
                },
            },
        });

        if (!activeWorkoutPlan) {
            throw new NotFoundError('No active workout plan found');
        }

        const date = dayjs.utc(dto.date);
        const todayWeekDay = dayIndexToWeekDay[date.day()];
        const todayWorkoutDay = activeWorkoutPlan.workoutDays.find(d => d.weekDay === todayWeekDay);

        if (!todayWorkoutDay) {
            throw new NotFoundError('No workout day found for today');
        }

        const weekStart = date.startOf('week');
        const weekEnd = date.endOf('week');

        const sessions = await prisma.workoutSession.findMany({
            where: {
                startedAt: { gte: weekStart.toDate(), lte: weekEnd.toDate() },
                workoutDay: { workoutPlan: { userId: dto.userId } },
            },
        });

        const consistencyByDay: Record<string, { workoutDayCompleted: boolean; workoutDayStarted: boolean }> = {};

        for (let i = 0; i < 7; i++) {
            const day = weekStart.add(i, 'day').format('YYYY-MM-DD');
            consistencyByDay[day] = { workoutDayCompleted: false, workoutDayStarted: false };
        }

        for (const session of sessions) {
            const sessionDate = dayjs.utc(session.startedAt).format('YYYY-MM-DD');
            if (consistencyByDay[sessionDate]) {
                consistencyByDay[sessionDate].workoutDayStarted = true;
                if (session.completedAt) {
                    consistencyByDay[sessionDate].workoutDayCompleted = true;
                }
            }
        }

        const allCompletedSessions = await prisma.workoutSession.findMany({
            where: {
                workoutDayId: { in: activeWorkoutPlan.workoutDays.map(d => d.id) },
                completedAt: { not: null },
            },
            select: { workoutDayId: true, startedAt: true },
        });

        const completedSessionsByDayId = new Map<string, Set<string>>();
        for (const session of allCompletedSessions) {
            const dateStr = dayjs.utc(session.startedAt).format('YYYY-MM-DD');
            if (!completedSessionsByDayId.has(session.workoutDayId)) {
                completedSessionsByDayId.set(session.workoutDayId, new Set());
            }
            completedSessionsByDayId.get(session.workoutDayId)!.add(dateStr);
        }

        const workoutStreak = this.calculateStreak(date, activeWorkoutPlan.workoutDays, completedSessionsByDayId);

        return {
            activeWorkoutPlanId: activeWorkoutPlan.id,
            todayWorkoutDay: {
                workoutPlanId: todayWorkoutDay.workoutPlanId,
                id: todayWorkoutDay.id,
                name: todayWorkoutDay.name,
                isRest: todayWorkoutDay.isRest,
                weekDay: todayWorkoutDay.weekDay,
                estimatedDurationInSeconds: todayWorkoutDay.estimatedDurationInSeconds,
                coverImageUrl: todayWorkoutDay.coverImageUrl,
                exercisesCount: todayWorkoutDay.workoutExercises.length,
            },
            workoutStreak,
            consistencyByDay,
        };
    }

    private calculateStreak(
        fromDate: dayjs.Dayjs,
        workoutDays: Array<{ weekDay: WeekDay; isRest: boolean; id: string }>,
        completedSessionsByDayId: Map<string, Set<string>>,
    ): number {
        let streak = 0;
        let currentDate = fromDate;
        const maxDaysBack = 365;

        for (let i = 0; i < maxDaysBack; i++) {
            const weekDay = dayIndexToWeekDay[currentDate.day()];
            const planDay = workoutDays.find(d => d.weekDay === weekDay);

            if (planDay) {
                if (planDay.isRest) {
                    streak++;
                } else {
                    const dateStr = currentDate.format('YYYY-MM-DD');
                    const completedDates = completedSessionsByDayId.get(planDay.id);
                    if (completedDates?.has(dateStr)) {
                        streak++;
                    } else {
                        break;
                    }
                }
            }

            currentDate = currentDate.subtract(1, 'day');
        }

        return streak;
    }
}
