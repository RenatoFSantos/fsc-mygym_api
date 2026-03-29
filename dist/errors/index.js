export class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NotFoundError';
    }
}
;
export class WorkoutPlanNotActiveError extends Error {
    constructor() {
        super('WorkoutPlan is not active');
        this.name = 'WorkoutPlanNotActiveError';
    }
}
;
export class ConflictError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConflictError';
    }
}
;
