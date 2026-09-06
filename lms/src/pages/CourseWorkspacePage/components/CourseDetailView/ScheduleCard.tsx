import {formatClockTime, formatWeekday} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';
import { useTranslation } from 'react-i18next';
import React from "react";
import styles from "./index.module.scss";
import {CourseSession, SessionDayOfWeek} from "@/apis";
import {Link} from 'react-router-dom';

interface ScheduleCardProps {
  sessions: CourseSession[];
  failed: boolean;
  courseId: number;
  canManage: boolean;
}

/** Monday to Friday, as the design's grid shows. */
const DAYS: SessionDayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

/** 09:00 to 16:00. The design skips 12:00, so the lunch hour is left out. */
const HOURS = [9, 10, 11, 13, 14, 15, 16];

const hourOf = (time: string) => parseInt(time.slice(0, 2), 10);

/** Pale fills keyed by session type, matching the design's coloured chips. */
const TYPE_TONE: Record<CourseSession['type'], string> = {
  Lecture: styles.chipCyan,
  Lab: styles.chipGreen,
  Tutorial: styles.chipOrange,
};

/**
 * The weekly Schedule grid.
 *
 * Sessions recur by day of week, so the grid is a week template rather than
 * specific dates. The design's header steps through calendar weeks
 * ("June 2 - June 6 2025"), which would imply per-date sessions; the API has
 * none, and paging through weeks that all render identically would suggest
 * the schedule changes when it does not. The navigation is therefore left out.
 *
 * Chips show the location verbatim. The design splits it into a building
 * badge and a room ("I-A" + "Room #200") but nothing defines how a building
 * name becomes that abbreviation (open-decisions.md Q-13).
 */
export const ScheduleCard: React.FC<ScheduleCardProps> = ({sessions, failed, courseId, canManage}) => {
  const { t: translate } = useTranslation();
  const at = (day: SessionDayOfWeek, hour: number) =>
    sessions.find((s) => s.dayOfWeek === day && hourOf(s.startTime) === hour);

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>{translate("course:schedule.title")}</h2>
        <Link to={`/course/${courseId}/schedule`} className={styles.addButton}>{canManage ? translate("course:workspace.manageSchedule") : translate("common:actions.viewAll")}</Link>
      </div>

      {failed ? (
        <p className={styles.cardEmpty} role="alert">{translate("course:workspace.scheduleFailed")}</p>
      ) : sessions.length === 0 ? (
        <p className={styles.cardEmpty}>{translate("course:workspace.scheduleEmpty")}</p>
      ) : (
        <div className={styles.gridScroll}>
          <div className={styles.grid}>
            <div/>
            {DAYS.map((day) => (
              <div key={day} className={styles.dayHeader}>{formatWeekday(day)}</div>
            ))}

            {HOURS.map((hour) => (
              <React.Fragment key={hour}>
                <div className={styles.hourLabel}>{formatClockTime(`${String(hour).padStart(2, '0')}:00`)}</div>
                {DAYS.map((day) => {
                  const session = at(day, hour);
                  return (
                    <div key={`${day}-${hour}`} className={styles.cell}>
                      {session && (
                        <div className={`${styles.chip} ${TYPE_TONE[session.type]}`}>
                          <span className={styles.chipType}>{statusLabel(session.type)}</span>
                          {session.location && (
                            <span className={styles.chipRoom}>{session.location}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
