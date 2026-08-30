import {ApiClient} from '@/apis/api-client';
import {idempotent} from '@/apis/types';
import type {
  AdvanceSessionRequest,
  RateCardRequest,
  StartSessionRequest,
  StudySessionResponse,
  VocabularyListCollectionResponse,
  VocabularyListDetailResponse,
  VocabularyUnitResponse,
} from '@/apis/types/vocabulary';
import {getAppEnv} from '@/config/env';

interface LibraryQuery {
  theme?: string;
  skillFocus?: string;
  difficulty?: string;
}

const env = getAppEnv();
const client = new ApiClient({
  baseURL: env.vocabularyBase,
  timeout: 10_000,
  withCredentials: true,
  preserveSessionOnAuthFailure: true,
});

const requestHeaders = (studentId: string, idempotencyKey?: string): Record<string, string> => ({
  ...(env.vocabularyLocalIdentityHeader ? {'X-Student-Id': studentId} : {}),
  ...(idempotencyKey ? idempotent(idempotencyKey).headers : {}),
});

export const vocabularyApi = {
  async list(studentId: string, query: LibraryQuery = {}): Promise<VocabularyListCollectionResponse> {
    const response = await client.getClient().get<VocabularyListCollectionResponse>('/v1/vocabulary/lists', {
      params: query,
      headers: requestHeaders(studentId),
    });
    return response.data;
  },

  async getList(studentId: string, listId: string): Promise<VocabularyListDetailResponse> {
    const response = await client.getClient().get<VocabularyListDetailResponse>(`/v1/vocabulary/lists/${listId}`, {
      headers: requestHeaders(studentId),
    });
    return response.data;
  },

  async getUnit(studentId: string, unitId: string): Promise<VocabularyUnitResponse> {
    const response = await client.getClient().get<VocabularyUnitResponse>(`/v1/vocabulary/units/${unitId}`, {
      headers: requestHeaders(studentId),
    });
    return response.data;
  },

  async startSession(studentId: string, unitId: string, request: StartSessionRequest, idempotencyKey: string): Promise<StudySessionResponse> {
    const response = await client.getClient().post<StudySessionResponse>(
      `/v1/vocabulary/units/${unitId}/sessions`,
      request,
      {headers: requestHeaders(studentId, idempotencyKey)},
    );
    return response.data;
  },

  async getSession(studentId: string, sessionId: string): Promise<StudySessionResponse> {
    const response = await client.getClient().get<StudySessionResponse>(`/v1/vocabulary/sessions/${sessionId}`, {
      headers: requestHeaders(studentId),
    });
    return response.data;
  },

  async rateCard(studentId: string, sessionId: string, request: RateCardRequest, idempotencyKey: string): Promise<StudySessionResponse> {
    const response = await client.getClient().post<StudySessionResponse>(
      `/v1/vocabulary/sessions/${sessionId}/ratings`,
      request,
      {headers: requestHeaders(studentId, idempotencyKey)},
    );
    return response.data;
  },

  async advance(studentId: string, sessionId: string, request: AdvanceSessionRequest, idempotencyKey: string): Promise<StudySessionResponse> {
    const response = await client.getClient().post<StudySessionResponse>(
      `/v1/vocabulary/sessions/${sessionId}/advance`,
      request,
      {headers: requestHeaders(studentId, idempotencyKey)},
    );
    return response.data;
  },

  async exit(studentId: string, sessionId: string, idempotencyKey: string): Promise<StudySessionResponse> {
    const response = await client.getClient().post<StudySessionResponse>(
      `/v1/vocabulary/sessions/${sessionId}/exit`,
      undefined,
      {headers: requestHeaders(studentId, idempotencyKey)},
    );
    return response.data;
  },
};
