import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { NotFoundError } from '../errors/index.js';
import { WeekDay } from '../generated/prisma/enums.js';
import { prisma } from '../lib/db.js';
dayjs.extend(utc);
const dayIndexToWeekDay = {
    0: WeekDay.SUNDAY,
    1: WeekDay.MONDAY,
    2: WeekDay.TUESDAY,
    3: WeekDay.WEDNESDAY,
    4: WeekDay.THURSDAY,
    5: WeekDay.FRIDAY,
    6: WeekDay.SATURDAY,
};
export class GetStats {
    async execute(dto) {
        const activeWorkoutPlan = await prisma.workoutPlan.findFirst({
            where: { userId: dto.userId, isActive: true },
            include: { workoutDays: true },
        });
        if (!activeWorkoutPlan) {
            throw new NotFoundError('No active workout plan found');
        }
        const fromDate = dayjs.utc(dto.from).startOf('day');
        const toDate = dayjs.utc(dto.to).endOf('day');
        const sessions = await prisma.workoutSession.findMany({
            where: {
                startedAt: { gte: fromDate.toDate(), lte: toDate.toDate() },
                workoutDay: { workoutPlan: { userId: dto.userId } },
            },
        });
        const consistencyByDay = {};
        for (const session of sessions) {
            const dateStr = dayjs.utc(session.startedAt).format('YYYY-MM-DD');
            if (!consistencyByDay[dateStr]) {
                consistencyByDay[dateStr] = { workoutDayCompleted: false, workoutDayStarted: true };
            }
            if (session.completedAt) {
                consistencyByDay[dateStr].workoutDayCompleted = true;
            }
        }
        const completedWorkoutsCount = sessions.filter(s => s.completedAt !== null).length;
        const totalSessions = sessions.length;
        const conclusionRate = totalSessions === 0 ? 0 : completedWorkoutsCount / totalSessions;
        const totalTimeInSeconds = sessions
            .filter(s => s.completedAt !== null)
            .reduce((acc, s) => acc + dayjs.utc(s.completedAt).diff(dayjs.utc(s.startedAt), 'second'), 0);
        const allCompletedSessions = await prisma.workoutSession.findMany({
            where: {
                workoutDayId: { in: activeWorkoutPlan.workoutDays.map(d => d.id) },
                completedAt: { not: null },
            },
            select: { workoutDayId: true, startedAt: true },
        });
        const completedSessionsByDayId = new Map();
        for (const session of allCompletedSessions) {
            const dateStr = dayjs.utc(session.startedAt).format('YYYY-MM-DD');
            if (!completedSessionsByDayId.has(session.workoutDayId)) {
                completedSessionsByDayId.set(session.workoutDayId, new Set());
            }
            completedSessionsByDayId.get(session.workoutDayId).add(dateStr);
        }
        const workoutStreak = this.calculateStreak(dayjs.utc(dto.to), activeWorkoutPlan.workoutDays, completedSessionsByDayId);
        return {
            workoutStreak,
            consistencyByDay,
            completedWorkoutsCount,
            conclusionRate,
            totalTimeInSeconds,
        };
    }
    calculateStreak(fromDate, workoutDays, completedSessionsByDayId) {
        let streak = 0;
        let currentDate = fromDate;
        const maxDaysBack = 365;
        for (let i = 0; i < maxDaysBack; i++) {
            const weekDay = dayIndexToWeekDay[currentDate.day()];
            const planDay = workoutDays.find(d => d.weekDay === weekDay);
            if (planDay) {
                if (planDay.isRest) {
                    streak++;
                }
                else {
                    const dateStr = currentDate.format('YYYY-MM-DD');
                    const completedDates = completedSessionsByDayId.get(planDay.id);
                    if (completedDates?.has(dateStr)) {
                        streak++;
                    }
                    else {
                        break;
                    }
                }
            }
            currentDate = currentDate.subtract(1, 'day');
        }
        return streak;
    }
}
