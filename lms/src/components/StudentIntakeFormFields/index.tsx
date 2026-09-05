import { useTranslation } from 'react-i18next';
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
  const { t: translate } = useTranslation();
  const field = (key: keyof StudentIntakeFormValue) => ({
    name: key,
    value: value[key],
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange({...value, [key]: event.target.value});
    },
  });

  return (
    <>
      <p className={styles.contractNote}><strong>{translate("advising:intake.requiredFields")}</strong></p>
      <fieldset className={styles.section}><legend>{translate("advising:intake.identity")}</legend><div className={styles.fields}>
      <label><span>{translate("advising:intake.firstName")}</span><input required maxLength={100} autoComplete="given-name" {...field('firstName')}/></label>
      <label><span>{translate("common:fields.middleName")} <em className={styles.optional}>{translate("common:fields.optional")}</em></span><input maxLength={100} autoComplete="additional-name" {...field('middleName')}/></label>
      <label><span>{translate("advising:intake.lastName")}</span><input required maxLength={100} autoComplete="family-name" {...field('lastName')}/></label>
      <label>
        <span>{translate("advising:intake.email")}</span>
        <input required type="email" spellCheck={false} maxLength={255} autoComplete="email" disabled={emailDisabled} {...field('email')}/>
      </label>
      <label>
        <span>{translate("advising:intake.studentType")}</span>
        <select name="studentType"
          value={value.studentType}
          onChange={event => onChange({...value, studentType: event.target.value as StudentType})}
        >
          <option value="STANDARD">{translate("common:status.STANDARD")}</option>
          <option value="VIP">{translate("common:status.VIP")}</option>
        </select>
      </label>
      </div></fieldset>
      <fieldset className={styles.section}><legend>{translate("advising:intake.learningContext")}</legend><div className={styles.fields}>
      <label><span>{translate("advising:intake.courseRequest")}</span><textarea required maxLength={2000} {...field('courseRequest')}/></label>
      <label><span>{translate("advising:intake.phone")} <em className={styles.optional}>{translate("common:fields.optional")}</em></span><input type="tel" minLength={7} maxLength={64} autoComplete="tel" {...field('contactPhone')}/></label>
      <label><span>{translate("advising:intake.background")} <em className={styles.optional}>{translate("common:fields.optional")}</em></span><textarea maxLength={4000} {...field('basicBackground')}/></label>
      </div></fieldset>
    </>
  );
};
