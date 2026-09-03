import { useQuery } from "@tanstack/react-query";
import { unwrapData } from "@/apis";
import type {ParentStudentSummary} from '@/apis/types/parentReadModels';
import { parentApiService } from "@/apis/services/parent-api";

/** Follow the contracted pages so a parent's selector is not limited to page one. */
export function useLinkedStudents() {
  return useQuery({
    queryKey: ["parent", "linked-students"],
    queryFn: async () => {
      const items: ParentStudentSummary[] = [];
      let page = 0;
      while (true) {
        const result = unwrapData(
          await parentApiService.listLinkedStudents(page),
          "parentLinkedStudents",
        );
        if (Array.isArray(result)) return result as ParentStudentSummary[];
        items.push(...result.items);
        const nextPage = result.page + 1;
        if (
          items.length >= result.total ||
          result.items.length === 0 ||
          nextPage <= page
        )
          return items;
        page = nextPage;
      }
    },
    retry: false,
  });
}
