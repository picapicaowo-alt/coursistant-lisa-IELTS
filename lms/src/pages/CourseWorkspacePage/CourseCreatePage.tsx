import {getApiErrorMessage} from '@/utils/apiError';
import { useTranslation } from 'react-i18next';
import React, {useState} from 'react';
import {useMutation} from '@tanstack/react-query';
import {useNavigate} from 'react-router-dom';
import {unwrapData} from '@/apis';
import {courseApiService} from '@/apis/services/course-api';
import {EnglishDateInput} from '@/components/EnglishDateInput';
import {RichTextEditor} from '@/components/RichTextEditor';
import styles from './CourseCreatePage.module.scss';

interface FormState {
  courseCode: string;
  title: string;
  termStartDate: string;
  termEndDate: string;
  description: string;
  location: string;
}

const EMPTY_FORM: FormState = {
  courseCode: '',
  title: '',
  termStartDate: '',
  termEndDate: '',
  description: '',
  location: '',
};

const CourseCreatePage: React.FC = () => {
  const { t: translate } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const createCourse = useMutation({
    mutationFn: async () => unwrapData(
      await courseApiService.createCourse({
        courseCode: form.courseCode.trim(),
        title: form.title.trim(),
        termStartDate: form.termStartDate,
        termEndDate: form.termEndDate,
        description: form.description.trim() || undefined,
        location: form.location.trim() || undefined,
      }),
      'createCourse',
    ),
    onSuccess: course => navigate(`/course/${course.id}`),
  });

  const updateField = (field: keyof FormState) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const value = event.target.value;
    setForm(current => ({...current, [field]: value}));
  };

  const datesOutOfOrder = Boolean(
    form.termStartDate && form.termEndDate && form.termEndDate < form.termStartDate,
  );
  const canSubmit = Boolean(
    form.courseCode.trim()
    && form.title.trim()
    && form.termStartDate
    && form.termEndDate
    && !datesOutOfOrder
    && !createCourse.isPending,
  );
  const failure = createCourse.isError ? getApiErrorMessage(createCourse.error, translate("course:workspace.createFailed")) : null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.back}
          onClick={() => navigate('/course')}
          aria-label={translate("course:detail.backToCourses")} title={translate("course:detail.backToCourses")}
        >
          <span aria-hidden="true">←</span>
        </button>
        <div>
          <p className={styles.eyebrow}>{translate("course:workspace.setup")}</p>
          <h1 className={styles.title}>{translate("course:workspace.newCourse")}</h1>
        </div>
      </header>

      <form
        noValidate
        className={styles.form}
        onSubmit={event => {
          event.preventDefault();
          if (canSubmit) createCourse.mutate();
        }}
      >
        <label className={styles.field}>
          <span className={styles.label}>{translate("course:form.codeLabel")}</span>
          <input className={styles.input} value={form.courseCode} onChange={updateField('courseCode')} maxLength={32} placeholder={translate("course:workspace.codeExample")} required/>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{translate("course:form.titleLabel")}</span>
          <input className={styles.input} value={form.title} onChange={updateField('title')} placeholder={translate("course:workspace.titleExample")} required/>
        </label>

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>{translate("course:workspace.termStarts")}</span>
            <EnglishDateInput className={styles.input} value={form.termStartDate} onChangeValue={value => setForm(current => ({...current, termStartDate: value}))} required/>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{translate("course:workspace.termEnds")}</span>
            <EnglishDateInput className={styles.input} value={form.termEndDate} onChangeValue={value => setForm(current => ({...current, termEndDate: value}))} required/>
          </label>
        </div>

        {datesOutOfOrder ? <p className={styles.error}>{translate("course:workspace.invalidTerm")}</p> : null}

        <label className={styles.field}>
          <span className={styles.label}>{translate("calendar:details.location")}{' '}<span className={styles.optional}>{translate("course:workspace.optional")}</span></span>
          <input className={styles.input} value={form.location} onChange={updateField('location')} placeholder={translate("course:workspace.locationExample")}/>
        </label>

        <div className={styles.field}>
          <span className={styles.label}>{translate("common:fields.description")}<span className={styles.optional}>{translate("course:workspace.optional")}</span></span>
          <RichTextEditor
            content={form.description}
            onChange={description => setForm(current => ({...current, description}))}
            placeholder={translate("course:workspace.descriptionPlaceholder")}
            ariaLabel={translate("course:workspace.descriptionLabel")}
          />
        </div>

        {failure ? <p className={styles.error} role="alert">{failure}</p> : null}

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={() => navigate('/course')}>{translate("common:actions.cancel")}</button>
          <button type="submit" className={styles.submit} disabled={!canSubmit}>
            {createCourse.isPending ? translate("common:actions.creating") : translate("course:list.createCourse")}
          </button>
        </div>
      </form>
    </main>
  );
};

export default CourseCreatePage;
