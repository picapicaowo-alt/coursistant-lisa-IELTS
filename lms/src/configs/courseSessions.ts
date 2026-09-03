import type {SessionDayOfWeek, SessionType} from '@/apis/types/course';

export const COURSE_SESSION_DAYS: {value: SessionDayOfWeek; label: string}[] = [
  {value: 'MON', label: 'Monday'}, {value: 'TUE', label: 'Tuesday'}, {value: 'WED', label: 'Wednesday'},
  {value: 'THU', label: 'Thursday'}, {value: 'FRI', label: 'Friday'}, {value: 'SAT', label: 'Saturday'}, {value: 'SUN', label: 'Sunday'},
];
export const COURSE_SESSION_TYPES: SessionType[] = ['Lecture', 'Lab', 'Tutorial'];
