import React, {useState} from "react";
import {useSearchParams} from 'react-router-dom';
import {MaterialReader} from './MaterialReader';
import styles from "./index.module.scss";
import {useCourseWorkspaceData} from "../../hooks/useCourseWorkspaceData";

import {ContentCard} from "./ContentCard";
import {AssignmentsCard} from "./AssignmentsCard";
import {ScheduleCard} from "./ScheduleCard";
import {QuizzesCard} from './QuizzesCard';
import {EventsCard} from './EventsCard';
import {GroupsCard} from './GroupsCard';
import {RosterCard} from './RosterCard';
import {AnnouncementsCard} from './AnnouncementsCard';
import {GradesCard} from './GradesCard';
import {DiscussionPanel} from './DiscussionPanel';
import {AssignmentProgress} from '@/components/AssignmentProgress';
import {useStudentProgress} from '@/hooks/useStudentProgress';
import {TeachingBadge} from '@/components/TeachingWorkspace';

interface CourseDetailViewProps {
  instructorView?: boolean;
  canCreateAssignments?: boolean;
  canManageEvents?: boolean;
  canManageGroups?: boolean;
  canPostAnnouncements?: boolean;
  canViewOwnGrades?: boolean;
}

export const CourseDetailView: React.FC<CourseDetailViewProps> = ({instructorView = false, canCreateAssignments = false, canManageEvents = false, canManageGroups = false, canPostAnnouncements = false, canViewOwnGrades = false}) => {
  const {
    course, weeks, sessions, assignments, quizzes, events, groupSets, announcements,
    isLoading, isError, isUnavailable, sessionsFailed, assignmentsFailed, quizzesFailed, eventsFailed, groupSetsFailed, announcementsFailed, refetch,
  } = useCourseWorkspaceData();

  const [searchParams, setSearchParams] = useSearchParams();
  const materialId = Number(searchParams.get('materialId'));
  const openMaterial = (id?: number) => setSearchParams(current => {const next = new URLSearchParams(current); if (id) next.set('materialId', String(id)); else next.delete('materialId'); return next;});
  const [activeTab, setActiveTab] = useState<'courses' | 'assignments' | 'announcements' | 'schedule' | 'discussion'>('courses');
  const [activeWeekId, setActiveWeekId] = useState<number | null | undefined>(instructorView ? undefined : null);

  const studentProgress = useStudentProgress(canViewOwnGrades);

  if (isLoading) {
    return <div className={styles.status}>Loading course…</div>;
  }

  if (isError || !course) {
    return (
      <div className={styles.status} role="alert">
        <p>{isUnavailable ? 'This course does not exist, or you do not have access.' : 'This course couldn\'t be loaded.'}</p>
        {!isUnavailable ? <button type="button" className={styles.retry} onClick={refetch}>Try again</button> : null}
      </div>
    );
  }

  const activeWeek = weeks.find((week) => week.id === activeWeekId) ?? weeks[0] ?? null;
  const expandedWeekId = activeWeekId === undefined ? weeks[0]?.id : activeWeekId;

  if (materialId > 0) return <MaterialReader courseId={course.id} title={course.title ?? course.name} weeks={weeks} materialId={materialId} onSelect={openMaterial} onClose={() => openMaterial()} onDiscussion={() => {openMaterial(); setActiveTab('discussion');}}/>;

  return (
    <div className={`${styles.learningWorkspace} ${instructorView ? styles.instructorWorkspace : ''}`}>
      <header className={styles.learningHeader}>
        <div><h1 className={styles.courseTitle}>{course.title || course.name || course.courseCode}</h1>{course.description ? <p className={styles.description}>{course.description}</p> : null}
          <div className={styles.courseContext}><div><span>Course code</span><strong>{course.courseCode}</strong></div>{canViewOwnGrades ? <AssignmentProgress progress={studentProgress.data?.courses?.find(item => item.courseId === course.id)} loading={studentProgress.isFetching} failed={studentProgress.isError}/> : null}<div><span>Instructor</span><strong>{course.primaryInstructor?.name || 'Not assigned'}</strong></div><div><span>Term</span><strong>{[course.termStartDate, course.termEndDate].filter(Boolean).join(' – ') || 'Not provided'}</strong></div>{instructorView ? <TeachingBadge value={course.state}>{course.state}</TeachingBadge> : <div><span>Course status</span><strong>{course.state}</strong></div>}</div>
        </div>
        <section className={styles.currentLesson} aria-label="Selected course content"><img src="/icons/figma-dashboard/study-plan.svg" alt=""/><div><span>Course content</span><h2>{activeWeek?.title || 'No content published yet'}</h2><p>{activeWeek?.materials.length ?? 0} learning {activeWeek?.materials.length === 1 ? 'material' : 'materials'}</p></div>{activeWeek ? <a href={`#week-${activeWeek.id}`} className={styles.addButton} onClick={() => {setActiveTab('courses'); setActiveWeekId(activeWeek.id);}}>Open learning materials</a> : null}</section>
      </header>
      <nav className={styles.learningTabs} aria-label="Course sections">
        {([{id: 'courses', label: 'Courses'}, {id: 'assignments', label: 'Assignments'}, {id: 'discussion', label: 'Discussion'}, {id: 'announcements', label: 'Announcements'}, {id: 'schedule', label: 'Schedule & Groups'}] as const).map(tab => <button type="button" key={tab.id} aria-pressed={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
      </nav>
      <div className={styles.learningBody}>
        <div className={styles.cards}>
          {activeTab === 'courses' ? <>
            {weeks.length === 0 ? <p className={styles.cardEmpty}>No course materials have been published yet.</p> : weeks.map((week, index) => <section className={styles.learningUnit} key={week.id} id={`week-${week.id}`}>
              <button type="button" className={styles.unitHeader} aria-expanded={expandedWeekId === week.id} aria-controls={`week-content-${week.id}`} onClick={() => setActiveWeekId(expandedWeekId === week.id ? null : week.id)}><span className={styles.unitNumber}>{index + 1}</span><span><small>{week.materials.length} {week.materials.length === 1 ? 'material' : 'materials'} · {week.state}</small><strong>{week.title}</strong></span><img src="/icons/figma-dashboard/arrow-right.svg" alt=""/></button>
              {expandedWeekId === week.id ? <div id={`week-content-${week.id}`}><ContentCard compact={instructorView} week={week} onOpenMaterial={openMaterial}/></div> : null}
            </section>)}
          </> : null}
          {activeTab === 'assignments' ? <><AssignmentsCard courseId={course.id} assignments={assignments} failed={assignmentsFailed} canCreate={canCreateAssignments}/><QuizzesCard courseId={course.id} quizzes={quizzes} failed={quizzesFailed} canCreate={canCreateAssignments}/></> : null}
          {activeTab === 'discussion' ? <DiscussionPanel courseId={course.id}/> : null}
          {activeTab === 'announcements' ? <AnnouncementsCard courseId={course.id} announcements={announcements} failed={announcementsFailed} canManage={canPostAnnouncements}/> : null}
          {activeTab === 'schedule' ? <><ScheduleCard sessions={sessions} failed={sessionsFailed} courseId={course.id} canManage={canManageEvents}/><EventsCard courseId={course.id} events={events} failed={eventsFailed} canManage={canManageEvents}/><GroupsCard courseId={course.id} groupSets={groupSets} failed={groupSetsFailed} canManage={canManageGroups}/>{canCreateAssignments ? <RosterCard courseId={course.id}/> : null}</> : null}
        </div>
        <aside className={styles.learningRail} aria-label="Learning information">
          {canViewOwnGrades ? <GradesCard courseId={course.id}/> : <section className={styles.card}><h2 className={styles.cardTitle}>Course Overview</h2><dl className={styles.overviewCounts}><div><dt>Learning units</dt><dd>{weeks.length}</dd></div><div><dt>Assignments</dt><dd>{assignmentsFailed ? 'Unavailable' : assignments.length}</dd></div><div><dt>Quizzes</dt><dd>{quizzesFailed ? 'Unavailable' : quizzes.length}</dd></div></dl></section>}
          {canViewOwnGrades ? <section className={styles.card}><h2 className={styles.cardTitle}>Assignment progress</h2><AssignmentProgress progress={studentProgress.data?.courses?.find(item => item.courseId === course.id)} loading={studentProgress.isFetching} failed={studentProgress.isError}/></section> : null}
        </aside>
      </div>
    </div>

  );
};
