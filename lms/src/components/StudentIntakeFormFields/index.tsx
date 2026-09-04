import type {ChangeEvent} from 'react';
import type {StudentType} from '@/apis';
import type {StudentIntakeFormValue} from './model';
import styles from './index.module.scss';

interface StudentIntakeFormFieldsProps {
  value: StudentIntakeFormValue;
  onChange: (value: StudentIntakeFormValue) => void;
  emailDisabled?: boolean;
}

export const StudentIntakeFormFields = ({
  value,
  onChange,
  emailDisabled = false,
}: StudentIntakeFormFieldsProps) => {
  const field = (key: keyof StudentIntakeFormValue) => ({
    name: key,
    value: value[key],
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange({...value, [key]: event.target.value});
    },
  });

  return (
    <>
      <p className={styles.contractNote}><strong>Required fields are marked *</strong></p>
      <fieldset className={styles.section}><legend>Student identity</legend><div className={styles.fields}>
      <label><span>First name *</span><input required maxLength={100} autoComplete="given-name" {...field('firstName')}/></label>
      <label><span>Middle name <em className={styles.optional}>Optional</em></span><input maxLength={100} autoComplete="additional-name" {...field('middleName')}/></label>
      <label><span>Last name *</span><input required maxLength={100} autoComplete="family-name" {...field('lastName')}/></label>
      <label>
        <span>Email *</span>
        <input required type="email" spellCheck={false} maxLength={255} autoComplete="email" disabled={emailDisabled} {...field('email')}/>
      </label>
      <label>
        <span>Student type *</span>
        <select name="studentType"
          value={value.studentType}
          onChange={event => onChange({...value, studentType: event.target.value as StudentType})}
        >
          <option value="STANDARD">STANDARD</option>
          <option value="VIP">VIP</option>
        </select>
      </label>
      </div></fieldset>
      <fieldset className={styles.section}><legend>Learning context</legend><div className={styles.fields}>
      <label><span>Course request *</span><textarea required maxLength={2000} {...field('courseRequest')}/></label>
      <label><span>Contact phone <em className={styles.optional}>Optional</em></span><input type="tel" minLength={7} maxLength={64} autoComplete="tel" {...field('contactPhone')}/></label>
      <label><span>Basic background <em className={styles.optional}>Optional</em></span><textarea maxLength={4000} {...field('basicBackground')}/></label>
      </div></fieldset>
    </>
  );
};
