import type {GradingQueueItem} from '@/apis';
import {assignmentGradingPath} from '@/configs/coursePaths';

interface TeachingWorkItem {
  href: string;
  title: string;
  courseCode: string;
  type: 'assignment';
  gradingCount: number;
  releaseCount: number;
}

/** Current work is authoritative; historical activity cannot establish a pending task. */
export function buildTeachingWork(queue: GradingQueueItem[]) {
  const items = new Map<string, TeachingWorkItem>();
  let hasUnsupportedItems = false;
  for (const item of queue) {
    let type: TeachingWorkItem['type'];
    let action: 'gradingCount' | 'releaseCount';
    switch (item.kind) {
      case 'AssignmentUngraded': type = 'assignment'; action = 'gradingCount'; break;
      case 'AssignmentAwaitingRelease': type = 'assignment'; action = 'releaseCount'; break;
      // Legacy Quiz is outside the IELTS product scope, even if cached data contains it.
      case 'QuizManualPending':
      case 'QuizAwaitingRelease': continue;
      default: hasUnsupportedItems = true; continue;
    }
    const id = item.assignmentId;
    if (!id || !Number.isInteger(id) || id < 1 || !Number.isInteger(item.courseId) || item.courseId < 1 || !Number.isInteger(item.pendingCount) || item.pendingCount < 0) {
      hasUnsupportedItems = true;
      continue;
    }
    if (item.pendingCount === 0) continue;
    const href = assignmentGradingPath(item.courseId, id);
    const work = items.get(href) ?? {href, title: item.title, courseCode: item.courseCode, type, gradingCount: 0, releaseCount: 0};
    // The queue provides one aggregate per kind. Grading and release for the
    // same assignment share one destination, but retain separate counts.
    work[action] = item.pendingCount;
    items.set(href, work);
  }
  return {items: [...items.values()], hasUnsupportedItems};
}
