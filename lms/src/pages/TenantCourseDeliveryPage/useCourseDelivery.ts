import {useEffect, useState} from 'react';
import {useIsMutating, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {unwrapData, type CourseDeliveryConfigResponse} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {courseApiService} from '@/apis/services/course-api';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {getApiErrorCode, isNotFound} from '@/utils/apiError';
import {courseManagementKeys as keys, hasVersionedGroupConfig, validDeliveryDraft} from '../advising/courseManagement';
import type {DeliveryDraft} from './CourseDeliveryForm';

const toDraft = (config?: CourseDeliveryConfigResponse | null): DeliveryDraft => ({
  catalogCode: config?.catalogCode ?? '', capacity: config?.capacity == null ? '' : String(config.capacity),
});

export function useCourseDelivery(id: number) {
  const client = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const schedulePending = useIsMutating({mutationKey: keys.scheduleWrites(id)}) > 0;
  const [reviewedVersion, setReviewedVersion] = useState<number>();
  const [reloadRequired, setReloadRequired] = useState(false);
  const [draft, setDraft] = useState<DeliveryDraft>(toDraft);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const course = useQuery({queryKey: keys.course(id), queryFn: async () => unwrapData(await courseApiService.getCourse(id), 'courseGetById'), retry: false});
  const config = useQuery({
    queryKey: keys.delivery(id),
    queryFn: async (): Promise<CourseDeliveryConfigResponse | null> => {
      try { return unwrapData(await advisorApiService.getCourseDeliveryConfig(id), 'advisorCourseDelivery'); }
      catch (error) {
        // A missing course or denied read is never permission to create a configuration.
        if (isNotFound(error) && getApiErrorCode(error) === 'COURSE_DELIVERY_CONFIG_NOT_FOUND') return null;
        throw error;
      }
    },
    enabled: course.isSuccess,
    retry: false,
  });
  const sessions = useQuery({queryKey: keys.sessions(id), queryFn: async () => unwrapData(await courseApiService.getCourseSessions(id), 'courseSessions'), enabled: course.isSuccess && config.isSuccess, retry: false});

  useEffect(() => {
    if (!config.isSuccess || draftLoaded) return;
    setReviewedVersion(config.data?.courseLaunchVersion);
    setDraft(toDraft(config.data));
    setDraftLoaded(true);
  }, [config.data, config.isSuccess, draftLoaded]);

  const versionChanged = draftLoaded && reviewedVersion !== config.data?.courseLaunchVersion;
  const knownConfig = course.isSuccess && config.isSuccess && !config.isFetching && draftLoaded;
  const groupConfig = knownConfig && hasVersionedGroupConfig(config.data);
  const canEdit = knownConfig && (config.data === null || groupConfig) && !reloadRequired && !versionChanged && !schedulePending;
  // Dev locks recurring templates once delivery is configured. Prepare at least
  // one session first so new group courses cannot enter an unschedulable draft.
  const canSaveDelivery = canEdit && (config.data !== null || (sessions.isSuccess && !sessions.isFetching && sessions.data.length > 0));
  const acceptConfig = async (next: CourseDeliveryConfigResponse) => {
    client.setQueryData(keys.delivery(id), next);
    setReviewedVersion(next.courseLaunchVersion);
    setDraft(toDraft(next));
    setReloadRequired(false);
    await client.invalidateQueries({queryKey: keys.owned});
  };
  const onError = (error: unknown) => {
    if (getApiErrorCode(error)?.endsWith('VERSION_CONFLICT')) setReloadRequired(true);
  };
  const save = useMutation({
    mutationFn: async () => {
      if (!canSaveDelivery || !validDeliveryDraft(draft)) throw new Error('Add a recurring session, then enter a valid catalog code and capacity.');
      return unwrapData(await idempotency.run('putCourseDeliveryConfig', [id, {catalogCode: draft.catalogCode.trim(), capacity: Number(draft.capacity), expectedCourseLaunchVersion: reviewedVersion}] satisfies Parameters<typeof advisorApiService.putCourseDeliveryConfig>, (key, args) => advisorApiService.putCourseDeliveryConfig(...args, key)), 'advisorPutCourseDeliveryConfig');
    }, onError, onSuccess: acceptConfig,
  });
  const canReady = groupConfig && !reloadRequired && !versionChanged && !save.isPending && !schedulePending && config.data?.launchState !== 'PUBLISHED' && Boolean(config.data?.catalogCode && config.data.capacity);
  const canPublish = canReady && config.data?.launchState === 'READY';
  const transition = useMutation({
    mutationFn: async (action: 'ready' | 'publish') => {
      if (!(action === 'ready' ? canReady : canPublish)) throw new Error('Load and review the current group-course configuration first.');
      return unwrapData(action === 'ready'
        ? await idempotency.run('readyCourseLaunch', [id, {expectedCourseLaunchVersion: reviewedVersion}] satisfies Parameters<typeof advisorApiService.readyCourseLaunch>, (key, args) => advisorApiService.readyCourseLaunch(...args, key))
        : await idempotency.run('publishCourseLaunch', [id, {expectedCourseLaunchVersion: reviewedVersion}] satisfies Parameters<typeof advisorApiService.publishCourseLaunch>, (key, args) => advisorApiService.publishCourseLaunch(...args, key)), `advisor${action}CourseLaunch`);
    }, onError, onSuccess: acceptConfig,
  });
  const reload = async () => {
    const result = await config.refetch();
    if (result.isSuccess) {setReviewedVersion(result.data?.courseLaunchVersion); setReloadRequired(false); save.reset(); transition.reset();}
  };
  return {
    course, config, sessions, draft, setDraft, save, transition, reload,
    canEdit: canSaveDelivery && !transition.isPending,
    canReady: canReady && !transition.isPending,
    canPublish: canPublish && !transition.isPending,
    canSchedule: knownConfig && config.data === null && !reloadRequired && !versionChanged && !transition.isPending && !save.isPending,
    canGenerateDates: groupConfig && config.data?.launchState !== 'PUBLISHED' && !reloadRequired && !versionChanged && !transition.isPending && !save.isPending,
    reloadRequired: reloadRequired || versionChanged,
    error: course.error || config.error || sessions.error || save.error || transition.error,
  };
}
