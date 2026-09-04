import {
  ApiResponse,
  CourseBrowseParams,
  CourseAnnouncement,
  CourseAnnouncementPayload,
  CourseAnnouncementSummary,
  CourseEvent,
  CourseEventPayload,
  CourseGroup,
  CourseGroupMembership,
  CourseGroupSet,
  BatchStudentEnrollResponse,
  CourseMember,
  CourseMemberPage,
  CourseMaterial,
  CoursePageResponse,
  CourseResponse,
  CourseSession,
  CourseSessionPayload,
  CourseSummary,
  CreateCourseRequest,
  CourseWeek,
  CourseWeekPayload,
  CreateGroupSetPayload,
  idempotent,
  MemberQueryParams,
  SyllabusState,
  TaPermissions,
  UpdateCourseRequest,
  PatchGroupSetPayload,
  UngroupedStudent,
  V2ApiClient
} from '@/apis';

export class CourseApiService {
  private apiClient = V2ApiClient;

  constructor(apiClient?: typeof V2ApiClient) {
    if (apiClient) {
      this.apiClient = apiClient;
    }
  }

  /**
   * Browses courses across the tenant.
   *
   * Admin and instructor only — a plain Student or TA gets 403 ACCESS_DENIED.
   * For a user's own courses use `GET /v2/me/courses`
   * (`dashboardApiService.getMyCourses`), which every USER account can call.
   */
  async browseCourses(params?: CourseBrowseParams): Promise<ApiResponse<CoursePageResponse>> {
    try {
      return await this.apiClient.get<CoursePageResponse>("/v2/courses", {params});
    } catch (error) {
      console.error(`Failed to browse courses`, error);
      throw error;
    }
  }

  /** The course's recurring weekly schedule. Visible to any enrolled member. */
  async getCourseSessions(courseId: number): Promise<ApiResponse<CourseSession[]>> {
    try {
      return await this.apiClient.get<CourseSession[]>(`/v2/courses/${courseId}/sessions`);
    } catch (error) {
      console.error(`Failed to get sessions for courseId: ${courseId}`, error);
      throw error;
    }
  }

  async createCourseSession(courseId: number, request: CourseSessionPayload, key: string = crypto.randomUUID()): Promise<ApiResponse<CourseSession>> {
    return this.apiClient.post(`/v2/courses/${courseId}/sessions`, request, idempotent(key));
  }

  async updateCourseSession(courseId: number, sessionId: number, request: CourseSessionPayload, key: string = crypto.randomUUID()): Promise<ApiResponse<CourseSession>> {
    return this.apiClient.put(`/v2/courses/${courseId}/sessions/${sessionId}`, request, idempotent(key));
  }

  async deleteCourseSession(courseId: number, sessionId: number): Promise<ApiResponse<void>> {
    return this.apiClient.delete(`/v2/courses/${courseId}/sessions/${sessionId}`);
  }

  /**
   * Archives a course. Course Manager only, and idempotent when it is already
   * archived.
   *
   * This is what retires a course — deletion is not. A course with any
   * dependency refuses to delete, and PRD INV-05 requires submissions,
   * attempts and grades to survive every V1 action, so archiving is the whole
   * lifecycle rather than a softer alternative to removal.
   */
  async archiveCourse(courseId: number): Promise<ApiResponse<CourseSummary>> {
    try {
      return await this.apiClient.post<CourseSummary>(
        `/v2/courses/${courseId}/archive`,
        undefined,
        idempotent()
      );
    } catch (error) {
      console.error(`Failed to archive course: ${courseId}`, error);
      throw error;
    }
  }

  async unarchiveCourse(courseId: number): Promise<ApiResponse<CourseSummary>> {
    try {
      return await this.apiClient.post<CourseSummary>(
        `/v2/courses/${courseId}/unarchive`,
        undefined,
        idempotent()
      );
    } catch (error) {
      console.error(`Failed to unarchive course: ${courseId}`, error);
      throw error;
    }
  }

  /**
   * A single course.
   *
   * Not `/detail`: that path does not exist and the server answers it with a
   * 500. There is no aggregate endpoint either — a course's weeks, materials,
   * assignments and members are each fetched separately.
   *
   * A course the caller cannot see returns 404 COURSE_NOT_FOUND rather than a
   * permission error, so membership cannot be probed by watching status codes.
   */
  async getCourse(courseId: number): Promise<ApiResponse<CourseResponse>> {
    try {
      return await this.apiClient.get<CourseResponse>(`/v2/courses/${courseId}`);
    } catch (error) {
      console.error(`Failed to get course: ${courseId}`, error);
      throw error;
    }
  }

  /** Creates an Active course using the current v2 contract. */
  async createCourse(request: CreateCourseRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<CourseResponse>> {
    return this.apiClient.post<CourseResponse>('/v2/courses', request, idempotent(key));
  }

  /**
   * The course outline. Materials come embedded in each week.
   * Students receive only Published weeks; staff see drafts too.
   */
  async getCourseWeeks(courseId: number): Promise<ApiResponse<CourseWeek[]>> {
    try {
      return await this.apiClient.get<CourseWeek[]>(`/v2/courses/${courseId}/weeks`);
    } catch (error) {
      console.error(`Failed to get weeks for courseId: ${courseId}`, error);
      throw error;
    }
  }

  async getAnnouncement(
    courseId: number,
    announcementId: number
  ): Promise<ApiResponse<CourseAnnouncement>> {
    return this.apiClient.get<CourseAnnouncement>(
      `/v2/courses/${courseId}/announcements/${announcementId}`
    );
  }

  async listAnnouncements(courseId: number): Promise<ApiResponse<CourseAnnouncementSummary[]>> {
    return this.apiClient.get(`/v2/courses/${courseId}/announcements`);
  }

  async createAnnouncement(courseId: number, request: CourseAnnouncementPayload): Promise<ApiResponse<CourseAnnouncement>> {
    return this.apiClient.post(`/v2/courses/${courseId}/announcements`, request, idempotent());
  }

  async updateAnnouncement(courseId: number, announcementId: number, request: CourseAnnouncementPayload): Promise<ApiResponse<CourseAnnouncement>> {
    return this.apiClient.patch(`/v2/courses/${courseId}/announcements/${announcementId}`, request, idempotent());
  }

  async deleteAnnouncement(courseId: number, announcementId: number): Promise<void> {
    await this.apiClient.getClient().delete(`/v2/courses/${courseId}/announcements/${announcementId}`, {params: {confirm: true}});
  }

  async getCourseEvent(
    courseId: number,
    eventId: number
  ): Promise<ApiResponse<CourseEvent>> {
    return this.apiClient.get<CourseEvent>(`/v2/courses/${courseId}/events/${eventId}`);
  }

  async listCourseEvents(courseId: number): Promise<ApiResponse<CourseEvent[]>> {
    return this.apiClient.get<CourseEvent[]>(`/v2/courses/${courseId}/events`);
  }

  async createCourseEvent(
    courseId: number,
    request: CourseEventPayload,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<ApiResponse<CourseEvent>> {
    return this.apiClient.post<CourseEvent>(
      `/v2/courses/${courseId}/events`,
      request,
      idempotent(idempotencyKey),
    );
  }

  async updateCourseEvent(
    courseId: number,
    eventId: number,
    request: CourseEventPayload,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<ApiResponse<CourseEvent>> {
    return this.apiClient.put<CourseEvent>(
      `/v2/courses/${courseId}/events/${eventId}`,
      request,
      idempotent(idempotencyKey),
    );
  }

  async deleteCourseEvent(
    courseId: number,
    eventId: number,
    expectedVersion?: number,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<ApiResponse<void>> {
    return this.apiClient.delete<void>(`/v2/courses/${courseId}/events/${eventId}`, {
      params: expectedVersion !== undefined ? {expectedVersion} : undefined,
      ...idempotent(idempotencyKey),
    });
  }

  async getGroupSet(
    courseId: number,
    groupSetId: number
  ): Promise<ApiResponse<CourseGroupSet>> {
    return this.apiClient.get<CourseGroupSet>(
      `/v2/courses/${courseId}/group-sets/${groupSetId}`
    );
  }

  async listGroupSets(courseId: number): Promise<ApiResponse<CourseGroupSet[]>> {
    return this.apiClient.get<CourseGroupSet[]>(`/v2/courses/${courseId}/group-sets`);
  }

  async createGroupSet(
    courseId: number,
    request: CreateGroupSetPayload,
  ): Promise<ApiResponse<CourseGroupSet>> {
    return this.apiClient.post<CourseGroupSet>(`/v2/courses/${courseId}/group-sets`, request);
  }

  async patchGroupSet(
    courseId: number,
    groupSetId: number,
    request: PatchGroupSetPayload,
  ): Promise<ApiResponse<CourseGroupSet>> {
    return this.apiClient.patch<CourseGroupSet>(
      `/v2/courses/${courseId}/group-sets/${groupSetId}`,
      request,
    );
  }

  async deleteGroupSet(courseId: number, groupSetId: number): Promise<ApiResponse<void>> {
    return this.apiClient.delete<void>(`/v2/courses/${courseId}/group-sets/${groupSetId}`);
  }

  async createGroup(
    courseId: number,
    groupSetId: number,
    request: {name: string; capacityOverride?: number | null},
  ): Promise<ApiResponse<CourseGroup>> {
    return this.apiClient.post<CourseGroup>(
      `/v2/courses/${courseId}/group-sets/${groupSetId}/groups`,
      request,
    );
  }

  async batchCreateGroups(
    courseId: number,
    groupSetId: number,
    request: {count: number; namePrefix: string},
  ): Promise<ApiResponse<CourseGroup[]>> {
    return this.apiClient.post<CourseGroup[]>(
      `/v2/courses/${courseId}/group-sets/${groupSetId}/groups/batch`,
      request,
    );
  }

  async patchGroup(
    courseId: number,
    groupSetId: number,
    groupId: number,
    request: {
      name?: string;
      capacityOverride?: number | null;
      clearCapacityOverride?: boolean;
      confirmCapacityShorten?: boolean;
    },
  ): Promise<ApiResponse<CourseGroup>> {
    return this.apiClient.patch<CourseGroup>(
      `/v2/courses/${courseId}/group-sets/${groupSetId}/groups/${groupId}`,
      request,
    );
  }

  async deleteGroup(courseId: number, groupSetId: number, groupId: number): Promise<ApiResponse<void>> {
    return this.apiClient.delete<void>(
      `/v2/courses/${courseId}/group-sets/${groupSetId}/groups/${groupId}`,
    );
  }

  async joinGroup(
    courseId: number,
    groupSetId: number,
    groupId: number,
  ): Promise<ApiResponse<{membership: CourseGroupMembership; group: CourseGroup}>> {
    return this.apiClient.post(
      `/v2/courses/${courseId}/group-sets/${groupSetId}/groups/${groupId}/join`,
    );
  }

  async leaveGroup(
    courseId: number,
    groupSetId: number,
    groupId: number,
  ): Promise<ApiResponse<{membership: CourseGroupMembership; group: CourseGroup}>> {
    return this.apiClient.post(
      `/v2/courses/${courseId}/group-sets/${groupSetId}/groups/${groupId}/leave`,
    );
  }

  async switchGroup(
    courseId: number,
    groupSetId: number,
    targetGroupId: number,
  ): Promise<ApiResponse<{membership: CourseGroupMembership; group: CourseGroup}>> {
    return this.apiClient.post(
      `/v2/courses/${courseId}/group-sets/${groupSetId}/switch`,
      {targetGroupId},
    );
  }

  async listUngroupedStudents(
    courseId: number,
    groupSetId: number,
  ): Promise<ApiResponse<UngroupedStudent[]>> {
    return this.apiClient.get(
      `/v2/courses/${courseId}/group-sets/${groupSetId}/ungrouped-students`,
    );
  }

  async assignGroupMember(
    courseId: number,
    groupSetId: number,
    groupId: number,
    userId: number,
    confirmations: {confirmCapacityOverfill?: boolean; confirmAcademicImpact?: boolean} = {},
  ): Promise<ApiResponse<void>> {
    return this.apiClient.post(
      `/v2/courses/${courseId}/group-sets/${groupSetId}/groups/${groupId}/members`,
      {userId, ...confirmations},
    );
  }

  async moveGroupMember(
    courseId: number,
    groupSetId: number,
    userId: number,
    targetGroupId: number,
    confirmations: {confirmCapacityOverfill?: boolean; confirmAcademicImpact?: boolean} = {},
  ): Promise<ApiResponse<void>> {
    return this.apiClient.post(
      `/v2/courses/${courseId}/group-sets/${groupSetId}/members/${userId}/move`,
      {targetGroupId, ...confirmations},
    );
  }

  async removeGroupMember(
    courseId: number,
    groupSetId: number,
    groupId: number,
    userId: number,
    confirmAcademicImpact = false,
  ): Promise<ApiResponse<void>> {
    return this.apiClient.delete(
      `/v2/courses/${courseId}/group-sets/${groupSetId}/groups/${groupId}/members/${userId}`,
      {params: {confirmAcademicImpact}},
    );
  }

  async distributeGroupsRandomly(
    courseId: number,
    groupSetId: number,
  ): Promise<ApiResponse<CourseGroupMembership[]>> {
    return this.apiClient.post(
      `/v2/courses/${courseId}/group-sets/${groupSetId}/distribute-random`,
    );
  }

  async listCourseMembers(
    courseId: number,
    params?: MemberQueryParams,
  ): Promise<ApiResponse<CourseMemberPage>> {
    return this.apiClient.get(`/v2/courses/${courseId}/members`, {params});
  }

  async enrolStudents(
    courseId: number,
    identifiers: {userIds?: number[]; emails?: string[]},
  ): Promise<ApiResponse<BatchStudentEnrollResponse>> {
    return this.apiClient.post(
      `/v2/courses/${courseId}/students/batch`,
      identifiers,
      idempotent(),
    );
  }

  async enrolStudent(courseId: number, userId: number): Promise<ApiResponse<CourseMember>> {
    return this.apiClient.post(`/v2/courses/${courseId}/students`, {userId}, idempotent());
  }

  async withdrawStudent(courseId: number, userId: number): Promise<ApiResponse<CourseMember>> {
    return this.apiClient.delete(`/v2/courses/${courseId}/students/${userId}`);
  }

  async promoteToTa(courseId: number, userId: number): Promise<ApiResponse<CourseMember>> {
    return this.apiClient.post(`/v2/courses/${courseId}/tas`, {userId}, idempotent());
  }

  async demoteTa(courseId: number, userId: number): Promise<ApiResponse<CourseMember>> {
    return this.apiClient.delete(`/v2/courses/${courseId}/tas/${userId}`);
  }

  async updateTaPermissions(
    courseId: number,
    userId: number,
    permissions: TaPermissions,
  ): Promise<ApiResponse<CourseMember>> {
    return this.apiClient.patch(
      `/v2/courses/${courseId}/tas/${userId}/permissions`,
      permissions,
      idempotent(),
    );
  }

  async getSyllabus(courseId: number): Promise<ApiResponse<SyllabusState>> {
    return this.apiClient.get(`/v2/courses/${courseId}/syllabus`);
  }

  async uploadSyllabus(courseId: number, file: File): Promise<ApiResponse<SyllabusState>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.apiClient.post(
      `/v2/courses/${courseId}/syllabus`,
      formData,
      idempotent(),
    );
  }

  async restoreSyllabus(courseId: number): Promise<ApiResponse<SyllabusState>> {
    return this.apiClient.post(
      `/v2/courses/${courseId}/syllabus/restore`,
      undefined,
      idempotent(),
    );
  }

  async clearSyllabus(courseId: number): Promise<ApiResponse<SyllabusState>> {
    return this.apiClient.delete(`/v2/courses/${courseId}/syllabus`);
  }

  async downloadSyllabus(courseId: number, inline = false): Promise<Blob> {
    const response = await this.apiClient.getClient().get<Blob>(
      `/v2/courses/${courseId}/syllabus/${inline ? 'preview' : 'download'}`,
      {responseType: 'blob'},
    );
    return response.data;
  }

  /**
   * Fetches material bytes with the current Bearer token.
   *
   * These endpoints return raw binary rather than an ApiResponse envelope.
   * A plain anchor cannot attach Authorization, so the UI downloads a Blob
   * through this authenticated client and then opens/saves an object URL.
   * Storage stays opaque to the browser (S3 today, another provider later).
   */
  private async getMaterialBlob(
    courseId: number,
    weekId: number,
    materialId: number,
    action: 'download' | 'preview'
  ): Promise<Blob> {
    const response = await this.apiClient.getClient().get<Blob>(
      `/v2/courses/${courseId}/weeks/${weekId}/materials/${materialId}/${action}`,
      {responseType: 'blob'}
    );
    return response.data;
  }

  async downloadMaterial(courseId: number, weekId: number, materialId: number): Promise<Blob> {
    return this.getMaterialBlob(courseId, weekId, materialId, 'download');
  }

  /** Downloads every file in a week as one server-generated ZIP archive. */
  async downloadWeekMaterials(courseId: number, weekId: number): Promise<Blob> {
    const response = await this.apiClient.getClient().get<Blob>(
      `/v2/courses/${courseId}/weeks/${weekId}/download.zip`,
      {responseType: 'blob'},
    );
    return response.data;
  }

  async previewMaterial(courseId: number, weekId: number, materialId: number): Promise<Blob> {
    return this.getMaterialBlob(courseId, weekId, materialId, 'preview');
  }

  /** Uploads files, creates a link, or does both in one multipart request. */
  async createMaterials(
    courseId: number,
    weekId: number,
    request: {files?: File[]; linkUrl?: string; linkDisplayName?: string},
    idempotencyKey: string = crypto.randomUUID()
  ): Promise<ApiResponse<CourseMaterial[]>> {
    const formData = new FormData();
    request.files?.forEach(file => formData.append('files', file));
    if (request.linkUrl) formData.append('linkUrl', request.linkUrl);
    if (request.linkDisplayName) formData.append('linkDisplayName', request.linkDisplayName);

    return this.apiClient.post<CourseMaterial[]>(
      `/v2/courses/${courseId}/weeks/${weekId}/materials`,
      formData,
      idempotent(idempotencyKey)
    );
  }

  async renameMaterial(
    courseId: number,
    weekId: number,
    materialId: number,
    displayName: string,
    idempotencyKey: string = crypto.randomUUID()
  ): Promise<ApiResponse<CourseMaterial>> {
    return this.apiClient.patch<CourseMaterial>(
      `/v2/courses/${courseId}/weeks/${weekId}/materials/${materialId}`,
      {displayName},
      idempotent(idempotencyKey)
    );
  }

  async deleteMaterial(
    courseId: number,
    weekId: number,
    materialId: number,
    idempotencyKey: string = crypto.randomUUID()
  ): Promise<ApiResponse<void>> {
    return this.apiClient.delete<void>(
      `/v2/courses/${courseId}/weeks/${weekId}/materials/${materialId}`,
      idempotent(idempotencyKey)
    );
  }

  async publishMaterial(
    courseId: number,
    weekId: number,
    materialId: number,
    idempotencyKey: string = crypto.randomUUID()
  ): Promise<ApiResponse<CourseMaterial>> {
    return this.apiClient.post<CourseMaterial>(
      `/v2/courses/${courseId}/weeks/${weekId}/materials/${materialId}/publish`,
      undefined,
      idempotent(idempotencyKey)
    );
  }

  async unpublishMaterial(
    courseId: number,
    weekId: number,
    materialId: number,
    idempotencyKey: string = crypto.randomUUID()
  ): Promise<ApiResponse<CourseMaterial>> {
    return this.apiClient.post<CourseMaterial>(
      `/v2/courses/${courseId}/weeks/${weekId}/materials/${materialId}/unpublish`,
      undefined,
      idempotent(idempotencyKey)
    );
  }

  async moveMaterial(
    courseId: number,
    weekId: number,
    materialId: number,
    targetWeekId: number,
    idempotencyKey: string = crypto.randomUUID()
  ): Promise<ApiResponse<CourseMaterial>> {
    return this.apiClient.post<CourseMaterial>(
      `/v2/courses/${courseId}/weeks/${weekId}/materials/${materialId}/move`,
      {targetWeekId},
      idempotent(idempotencyKey)
    );
  }

  /** `materialIds` must be a full permutation of the materials in the week. */
  async reorderMaterials(
    courseId: number,
    weekId: number,
    materialIds: number[],
    idempotencyKey: string = crypto.randomUUID()
  ): Promise<ApiResponse<CourseMaterial[]>> {
    return this.apiClient.put<CourseMaterial[]>(
      `/v2/courses/${courseId}/weeks/${weekId}/materials/reorder`,
      {materialIds},
      idempotent(idempotencyKey)
    );
  }

  /**
   * Edits a course. Course Manager only.
   *
   * PATCH, not PUT, and partial — send only what changed. Tenant and primary
   * instructor are rejected here; reassigning the instructor is an admin-only
   * call of its own. Editing an archived course fails with COURSE_ARCHIVED.
   */
  async updateCourse(
    courseId: number,
    request: UpdateCourseRequest
  ): Promise<ApiResponse<CourseResponse>> {
    try {
      return await this.apiClient.patch<CourseResponse>(
        `/v2/courses/${courseId}`,
        request,
        idempotent()
      );
    } catch (error) {
      console.error(`Failed to update course: ${courseId}`, error);
      throw error;
    }
  }

  /**
   * Deletes a course outright.
   *
   * Only succeeds on a course with no dependencies and a single instructor
   * enrolment; anything else returns 409 and must be archived instead. Prefer
   * archiveCourse — INV-05 requires submissions, attempts and grades to
   * survive every V1 action.
   */
  async deleteCourse(courseId: number): Promise<ApiResponse<void>> {
    try {
      return await this.apiClient.delete<void>(`/v2/courses/${courseId}`);
    } catch (error) {
      console.error(`Failed to delete course: ${courseId}`, error);
      throw error;
    }
  }

  // ---------------------------------------------------------------- weeks
  //
  // Weeks are the course outline. All writes are Course Manager only and fail
  // with COURSE_ARCHIVED once the course is archived. A new week starts as a
  // Draft and stays invisible to students until it is published.

  async getCourseWeek(courseId: number, weekId: number): Promise<ApiResponse<CourseWeek>> {
    return this.apiClient.get<CourseWeek>(`/v2/courses/${courseId}/weeks/${weekId}`);
  }

  async createWeek(
    courseId: number,
    title: string,
    idempotencyKey: string = crypto.randomUUID(),
    summary?: string,
  ): Promise<ApiResponse<CourseWeek>> {
    try {
      return await this.apiClient.post<CourseWeek>(
        `/v2/courses/${courseId}/weeks`,
        {title, ...(summary === undefined ? {} : {summary})},
        idempotent(idempotencyKey)
      );
    } catch (error) {
      console.error(`Failed to create week for courseId: ${courseId}`, error);
      throw error;
    }
  }

  async renameWeek(
    courseId: number,
    weekId: number,
    title: string
  ): Promise<ApiResponse<CourseWeek>> {
    try {
      return await this.apiClient.patch<CourseWeek>(
        `/v2/courses/${courseId}/weeks/${weekId}`,
        {title},
        idempotent()
      );
    } catch (error) {
      console.error(`Failed to rename week: ${weekId}`, error);
      throw error;
    }
  }

  /** Partial writes preserve fields not edited by the teacher. */
  async updateWeek(courseId: number, weekId: number, request: CourseWeekPayload, key: string): Promise<ApiResponse<CourseWeek>> {
    return this.apiClient.patch<CourseWeek>(`/v2/courses/${courseId}/weeks/${weekId}`, request, idempotent(key));
  }

  /** Only an empty week can be deleted; one holding materials is refused. */
  async deleteWeek(courseId: number, weekId: number): Promise<ApiResponse<void>> {
    try {
      return await this.apiClient.delete<void>(`/v2/courses/${courseId}/weeks/${weekId}`);
    } catch (error) {
      console.error(`Failed to delete week: ${weekId}`, error);
      throw error;
    }
  }

  /** Makes the week and its materials visible to students. */
  async publishWeek(courseId: number, weekId: number): Promise<ApiResponse<CourseWeek>> {
    try {
      return await this.apiClient.post<CourseWeek>(
        `/v2/courses/${courseId}/weeks/${weekId}/publish`,
        undefined,
        idempotent()
      );
    } catch (error) {
      console.error(`Failed to publish week: ${weekId}`, error);
      throw error;
    }
  }

  async unpublishWeek(courseId: number, weekId: number): Promise<ApiResponse<CourseWeek>> {
    try {
      return await this.apiClient.post<CourseWeek>(
        `/v2/courses/${courseId}/weeks/${weekId}/unpublish`,
        undefined,
        idempotent()
      );
    } catch (error) {
      console.error(`Failed to unpublish week: ${weekId}`, error);
      throw error;
    }
  }

  /** `weekIds` must be a full permutation of the course's weeks. */
  async reorderWeeks(courseId: number, weekIds: number[]): Promise<ApiResponse<CourseWeek[]>> {
    try {
      return await this.apiClient.put<CourseWeek[]>(
        `/v2/courses/${courseId}/weeks/reorder`,
        {weekIds},
        idempotent()
      );
    } catch (error) {
      console.error(`Failed to reorder weeks for courseId: ${courseId}`, error);
      throw error;
    }
  }
}

export const courseApiService = new CourseApiService();
