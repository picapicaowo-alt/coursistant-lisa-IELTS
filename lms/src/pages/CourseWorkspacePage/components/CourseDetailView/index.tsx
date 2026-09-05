import {formatInstructorName} from '@/utils/personName';
import { useTranslation } from 'react-i18next';
import React, {useState} from "react";
import {Search} from 'lucide-react';
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
import {formatNumber} from '@/i18n/formatting';
import {formatInputDate} from '@/i18n/dateInput';
import {statusLabel} from '@/i18n/presentation';
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
  const { t: translate } = useTranslation();
  const {
    course, weeks, sessions, assignments, quizzes, events, groupSets, announcements,
    isLoading, isError, isUnavailable, sessionsFailed, assignmentsFailed, quizzesFailed, eventsFailed, groupSetsFailed, announcementsFailed, refetch,
  } = useCourseWorkspaceData();

  const [searchParams, setSearchParams] = useSearchParams();
  const materialId = Number(searchParams.get('materialId'));
  const selectedUnitId = searchParams.get('unitId') ?? '';
  const materialSearch = searchParams.get('materialSearch') ?? '';
  const updateMaterialFilter = (key: 'unitId' | 'materialSearch', value: string) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, {replace: true});
    setCollapsedWeeks(new Set());
  };
  const openMaterial = (id?: number) => setSearchParams(current => {const next = new URLSearchParams(current); if (id) next.set('materialId', String(id)); else next.delete('materialId'); return next;});
  const [activeTab, setActiveTab] = useState<'courses' | 'assignments' | 'announcements' | 'schedule' | 'discussion'>('courses');
  const [activeWeekId, setActiveWeekId] = useState<number | null | undefined>(undefined);
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<number>>(() => new Set());

  const studentProgress = useStudentProgress(canViewOwnGrades);

  if (isLoading) {
    return <div className={styles.status} role="status">{translate("course:learning.loading")}</div>;
  }

  if (isError || !course) {
    return (
      <div className={styles.status} role="alert">
        <p>{translate(isUnavailable ? 'course:learning.unavailable' : 'course:learning.loadFailed')}</p>
        {!isUnavailable ? <button type="button" className={styles.retry} onClick={refetch}>{translate("common:actions.tryAgain")}</button> : null}
      </div>
    );
  }

  // Weeks are the contract's ordered learning units; titles may describe chapters or sections.
  // Filtering uses the already-loaded course contents and does not invent a search endpoint.
  const search = materialSearch.trim().toLocaleLowerCase();
  const filteredWeeks = weeks
    .filter(week => !selectedUnitId || String(week.id) === selectedUnitId)
    .map(week => !search || week.title.toLocaleLowerCase().includes(search)
      ? week
      : {...week, materials: week.materials.filter(material =>
        `${material.displayName} ${material.originalFilename ?? ''}`.toLocaleLowerCase().includes(search))})
    .filter(week => !search || week.title.toLocaleLowerCase().includes(search) || week.materials.length > 0);
  const showMaterialFilters = !instructorView && (weeks.length > 1 || weeks.some(week => week.materials.length > 1));
  const displayedWeeks = instructorView ? weeks : filteredWeeks;
  const activeWeek = displayedWeeks.find(week => week.id === activeWeekId) ?? displayedWeeks[0] ?? null;
  const resultCount = displayedWeeks.reduce((total, week) => total + week.materials.length, 0);
  const clearMaterialFilters = () => {
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      next.delete('materialSearch');
      next.delete('unitId');
      return next;
    }, {replace: true});
    setCollapsedWeeks(new Set());
  };
  const expandedWeekId = activeWeekId === undefined ? weeks[0]?.id : activeWeekId;

  if (materialId > 0) return <MaterialReader courseId={course.id} title={course.title ?? course.name} weeks={weeks} materialId={materialId} onSelect={openMaterial} onClose={() => openMaterial()} onDiscussion={() => {openMaterial(); setActiveTab('discussion');}}/>;

  return (
    <div className={`${styles.learningWorkspace} ${instructorView ? styles.instructorWorkspace : styles.studentWorkspace}`}>
      <header className={styles.learningHeader}>
        <div><h1 className={styles.courseTitle}>{course.title || course.name || course.courseCode}</h1>{course.description ? <p className={styles.description}>{course.description}</p> : null}
          <div className={styles.courseContext}><div><span>{translate("course:form.codeLabel")}</span><strong>{course.courseCode}</strong></div><div><span>{translate("common:people.instructor")}</span><strong>{formatInstructorName(course.primaryInstructor, translate("course:learning.notAssigned"))}</strong></div><div><span>{translate("course:learning.term")}</span><strong>{[course.termStartDate, course.termEndDate].filter((value): value is string => Boolean(value)).map(formatInputDate).join(' – ') || translate('common:feedback.notProvided')}</strong></div>{instructorView ? <TeachingBadge value={course.state}>{statusLabel(course.state)}</TeachingBadge> : <div><span>{translate("course:learning.status")}</span><strong>{statusLabel(course.state)}</strong></div>}</div>
        </div>
        {activeTab === 'courses' && (activeWeek || weeks.length === 0) ? <section className={styles.currentLesson} aria-label={translate("course:learning.selectedContent")}><img src="/icons/figma-dashboard/study-plan.svg" alt="" width={48} height={48}/><div><span>{translate("course:learning.content")}</span><h2>{activeWeek?.title || translate("course:learning.noContent")}</h2><p>{translate("course:materials.learningCount", {count: activeWeek?.materials.length ?? 0, total: formatNumber(activeWeek?.materials.length ?? 0)})}</p></div>{activeWeek ? <a href={`#week-${activeWeek.id}`} className={styles.addButton} onClick={() => {setActiveTab('courses'); setActiveWeekId(activeWeek.id); setCollapsedWeeks(current => {const next = new Set(current); next.delete(activeWeek.id); return next;});}}>{translate("course:materials.openLearning")}</a> : null}</section> : null}
      </header>
      <nav className={styles.learningTabs} aria-label={translate("course:learning.sections")}>
        {([{id: 'courses', label: 'course:learning.tabs.courses'}, {id: 'assignments', label: 'course:learning.tabs.assignments'}, {id: 'discussion', label: 'course:learning.tabs.discussion'}, {id: 'announcements', label: 'course:learning.tabs.announcements'}, {id: 'schedule', label: 'course:learning.tabs.schedule'}] as const).map(tab => <button type="button" key={tab.id} aria-pressed={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>{translate(tab.label)}</button>)}
      </nav>
      <div className={styles.learningBody}>
        <div className={styles.cards}>
          {activeTab === 'courses' ? <>
            {showMaterialFilters ? <div className={styles.materialFilters}>
              {weeks.length > 1 ? <label className={styles.unitFilter}>
                <span>{translate('course:materials.unit')}</span>
                <select name="unitId" value={selectedUnitId} onChange={event => updateMaterialFilter('unitId', event.target.value)}>
                  <option value="">{translate('course:materials.allUnits')}</option>
                  {weeks.map(week => <option key={week.id} value={week.id}>{week.title}</option>)}
                </select>
              </label> : null}
              <label className={styles.materialSearch}>
                <span>{translate('course:materials.searchLabel')}</span>
                <span className={styles.searchControl}>
                  <Search size={18} aria-hidden="true"/>
                  <input type="search" name="materialSearch" autoComplete="off" value={materialSearch}
                    placeholder={translate('course:materials.searchPlaceholder')}
                    onChange={event => updateMaterialFilter('materialSearch', event.target.value)}/>
                </span>
              </label>
            </div> : null}
            {search ? <p className={styles.materialResults} role="status">{translate('course:materials.results', {count: resultCount, total: formatNumber(resultCount)})}</p> : null}
            {weeks.length === 0 ? <p className={styles.cardEmpty}>{translate("course:learning.noMaterials")}</p> : displayedWeeks.length === 0 ? <div className={styles.materialEmpty}><p>{translate('course:materials.noMatches')}</p><button type="button" onClick={clearMaterialFilters}>{translate('course:materials.clearFilters')}</button></div> : displayedWeeks.map(week => {
              const expanded = instructorView ? expandedWeekId === week.id : !collapsedWeeks.has(week.id);
              return <section className={styles.learningUnit} key={week.id} id={`week-${week.id}`}>
              <h2 className={styles.unitHeading}><button type="button" className={styles.unitHeader} aria-expanded={expanded} aria-controls={`week-content-${week.id}`} onClick={() => {
                setActiveWeekId(expanded ? null : week.id);
                if (!instructorView) setCollapsedWeeks(current => {
                  const next = new Set(current);
                  if (expanded) next.add(week.id); else next.delete(week.id);
                  return next;
                });
              }}><span className={styles.unitNumber}>{formatNumber(weeks.findIndex(item => item.id === week.id) + 1)}</span><span><small>{translate("course:materials.count", {count: week.materials.length, total: formatNumber(week.materials.length)})} · {statusLabel(week.state)}</small><strong>{week.title}</strong></span><img src="/icons/figma-dashboard/arrow-right.svg" alt="" width={20} height={20}/></button></h2>
              <div id={`week-content-${week.id}`} hidden={!expanded}>{expanded ? <ContentCard embedded compact={instructorView} showDownloadAll={!search} week={week} onOpenMaterial={openMaterial}/> : null}</div>
            </section>;})}
          </> : null}
          {activeTab === 'assignments' ? <><AssignmentsCard courseId={course.id} assignments={assignments} failed={assignmentsFailed} canCreate={canCreateAssignments}/><QuizzesCard courseId={course.id} quizzes={quizzes} failed={quizzesFailed} canCreate={canCreateAssignments}/></> : null}
          {activeTab === 'discussion' ? <DiscussionPanel courseId={course.id}/> : null}
          {activeTab === 'announcements' ? <AnnouncementsCard courseId={course.id} announcements={announcements} failed={announcementsFailed} canManage={canPostAnnouncements}/> : null}
          {activeTab === 'schedule' ? <><ScheduleCard sessions={sessions} failed={sessionsFailed} courseId={course.id} canManage={canManageEvents}/><EventsCard courseId={course.id} events={events} failed={eventsFailed} canManage={canManageEvents}/><GroupsCard courseId={course.id} groupSets={groupSets} failed={groupSetsFailed} canManage={canManageGroups}/>{canCreateAssignments ? <RosterCard courseId={course.id}/> : null}</> : null}
        </div>
        <aside className={styles.learningRail} aria-label={translate("course:learning.information")}>
          {canViewOwnGrades ? <GradesCard courseId={course.id}/> : <section className={styles.card}><h2 className={styles.cardTitle}>{translate("course:learning.overview")}</h2><dl className={styles.overviewCounts}><div><dt>{translate("course:learning.units")}</dt><dd>{formatNumber(weeks.length)}</dd></div><div><dt>{translate("course:detail.assignments")}</dt><dd>{assignmentsFailed ? translate('course:learning.dataUnavailable') : formatNumber(assignments.length)}</dd></div><div><dt>{translate("course:detail.quizzes")}</dt><dd>{quizzesFailed ? translate('course:learning.dataUnavailable') : formatNumber(quizzes.length)}</dd></div></dl></section>}
          {canViewOwnGrades ? <section className={styles.card}><h2 className={styles.cardTitle}>{translate("course:learning.assignmentProgress")}</h2><AssignmentProgress progress={studentProgress.data?.courses?.find(item => item.courseId === course.id)} loading={studentProgress.isFetching} failed={studentProgress.isError}/></section> : null}
        </aside>
      </div>
    </div>

  );
};
