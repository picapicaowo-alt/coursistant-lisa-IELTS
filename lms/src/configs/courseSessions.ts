import type {SessionDayOfWeek, SessionType} from '@/apis/types/course';

export const COURSE_SESSION_DAYS: {value: SessionDayOfWeek}[] = [
  {value: 'MON'}, {value: 'TUE'}, {value: 'WED'},
  {value: 'THU'}, {value: 'FRI'}, {value: 'SAT'}, {value: 'SUN'},
];
export const COURSE_SESSION_TYPES: SessionType[] = ['Lecture', 'Lab', 'Tutorial'];
