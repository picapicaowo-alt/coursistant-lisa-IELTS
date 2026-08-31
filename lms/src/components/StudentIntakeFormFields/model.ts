import type {StudentType} from '@/apis';

export interface StudentIntakeFormValue {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  studentType: StudentType;
  courseRequest: string;
  contactPhone: string;
  basicBackground: string;
}

export const emptyStudentIntakeForm: StudentIntakeFormValue = {
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  studentType: 'STANDARD',
  courseRequest: '',
  contactPhone: '',
  basicBackground: '',
};
