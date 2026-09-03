import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { unwrapData, type TenantAlertRuleResponse } from "@/apis";
import { courseOperationsApiService } from "@/apis/services/course-operations-api";
import {
  formIsDirty,
  toAlertForm,
  toAlertRequest,
  type AlertForm,
} from "./alertRules";

const QUERY_KEY = ["tenant", "alert-rules"] as const;
type Draft = { form: AlertForm; baseline: TenantAlertRuleResponse };

export function useAlertRules() {
  const client = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const rules = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () =>
      unwrapData(
        await courseOperationsApiService.getTenantAlertRules(),
        "tenantAlertRules",
      ),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const save = useMutation({
    onMutate: () => client.cancelQueries({ queryKey: QUERY_KEY }),
    mutationFn: async ({ form, baseline }: Draft) =>
      unwrapData(
        await courseOperationsApiService.putTenantAlertRules(
          toAlertRequest(form, baseline.version),
        ),
        "tenantPutAlertRules",
      ),
    onSuccess: (latest) => {
      client.setQueryData(QUERY_KEY, latest);
      setDraft(null);
    },
  });
  const baseline = draft?.baseline ?? rules.data;
  const form = draft?.form ?? (rules.data ? toAlertForm(rules.data) : null);
  const dirty = Boolean(
    form && baseline && formIsDirty(form, toAlertForm(baseline)),
  );
  const update = (next: (current: AlertForm) => AlertForm) => {
    if (!rules.data || save.isPending) return;
    const latest = rules.data;
    save.reset();
    // Pin the version on first edit. Refetches must not silently rebase an
    // unsaved policy onto somebody else's version or discard local changes.
    setDraft((current) => ({
      baseline: current?.baseline ?? latest,
      form: next(current?.form ?? toAlertForm(latest)),
    }));
  };
  const discard = () => {
    setDraft(null);
    save.reset();
  };
  const submit = () => {
    if (draft && dirty && !save.isPending) save.mutate(draft);
  };
  const refresh = () => {
    if (dirty || save.isPending) return;
    // An unchanged editor snapshot must not hide a newer fetched policy.
    discard();
    void rules.refetch();
  };
  return {
    rules,
    form,
    baseline,
    dirty,
    save,
    update,
    discard,
    submit,
    refresh,
  };
}
