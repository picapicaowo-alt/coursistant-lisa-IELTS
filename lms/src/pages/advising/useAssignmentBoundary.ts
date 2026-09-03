import {useEffect} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useNavigate} from 'react-router-dom';
import {getApiErrorCode, isNotFound} from '@/utils/apiError';

/** Ownership can disappear on any workspace read or write, even while another tab is cached. */
export function useAssignmentBoundary(studentUserId: number) {
  const client = useQueryClient();
  const navigate = useNavigate();
  useEffect(() => {
    let leaving = false;
    const check = (meta: Record<string, unknown> | undefined, error: unknown) => {
      if (leaving || meta?.advisingStudentId !== studentUserId || !isNotFound(error)) return;
      // Missing aggregates are valid first-use states while the student remains assigned.
      if (['STUDENT_PROFILE_NOT_FOUND', 'STUDY_PLAN_NOT_FOUND'].includes(getApiErrorCode(error) ?? '')) return;
      leaving = true;
      navigate('/advisor/students', {replace: true});
      void client.cancelQueries({predicate: query => query.meta?.advisingStudentId === studentUserId}).then(() => {
        client.removeQueries({predicate: query => query.meta?.advisingStudentId === studentUserId});
        void client.invalidateQueries({queryKey: ['advisor', 'students']});
      });
    };
    const unsubscribeQuery = client.getQueryCache().subscribe(event => check(event.query.meta, event.query.state.error));
    const unsubscribeMutation = client.getMutationCache().subscribe(event => {
      if (event.mutation) check(event.mutation.options.meta, event.mutation.state.error);
    });
    return () => {unsubscribeQuery(); unsubscribeMutation();};
  }, [client, navigate, studentUserId]);
}
