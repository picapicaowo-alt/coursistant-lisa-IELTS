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
import {V2ApiClient} from '@/apis/v2-api-client';
import {
  isStudySession,
  isVocabularyListCollection,
  isVocabularyListDetail,
  isVocabularyUnit,
  requireVocabularyPayload,
} from './vocabulary-contract';

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
  refreshDelegate: () => V2ApiClient.recoverSession(),
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
    return requireVocabularyPayload(response.data, isVocabularyListCollection, 'library');
  },

  async getList(studentId: string, listId: string): Promise<VocabularyListDetailResponse> {
    const response = await client.getClient().get<VocabularyListDetailResponse>(`/v1/vocabulary/lists/${listId}`, {
      headers: requestHeaders(studentId),
    });
    return requireVocabularyPayload(response.data, isVocabularyListDetail, 'list detail');
  },

  async getUnit(studentId: string, unitId: string): Promise<VocabularyUnitResponse> {
    const response = await client.getClient().get<VocabularyUnitResponse>(`/v1/vocabulary/units/${unitId}`, {
      headers: requestHeaders(studentId),
    });
    return requireVocabularyPayload(response.data, isVocabularyUnit, 'unit');
  },

  async startSession(studentId: string, unitId: string, request: StartSessionRequest, idempotencyKey: string): Promise<StudySessionResponse> {
    const response = await client.getClient().post<StudySessionResponse>(
      `/v1/vocabulary/units/${unitId}/sessions`,
      request,
      {headers: requestHeaders(studentId, idempotencyKey)},
    );
    return requireVocabularyPayload(response.data, isStudySession, 'study session');
  },

  async getSession(studentId: string, sessionId: string): Promise<StudySessionResponse> {
    const response = await client.getClient().get<StudySessionResponse>(`/v1/vocabulary/sessions/${sessionId}`, {
      headers: requestHeaders(studentId),
    });
    return requireVocabularyPayload(response.data, isStudySession, 'study session');
  },

  async revealCard(studentId: string, sessionId: string, idempotencyKey: string): Promise<StudySessionResponse> {
    const response = await client.getClient().post<StudySessionResponse>(
      `/v1/vocabulary/sessions/${sessionId}/reveal`,
      undefined,
      {headers: requestHeaders(studentId, idempotencyKey)},
    );
    return requireVocabularyPayload(response.data, isStudySession, 'study session');
  },

  async rateCard(studentId: string, sessionId: string, request: RateCardRequest, idempotencyKey: string): Promise<StudySessionResponse> {
    const response = await client.getClient().post<StudySessionResponse>(
      `/v1/vocabulary/sessions/${sessionId}/ratings`,
      request,
      {headers: requestHeaders(studentId, idempotencyKey)},
    );
    return requireVocabularyPayload(response.data, isStudySession, 'study session');
  },

  async advance(studentId: string, sessionId: string, request: AdvanceSessionRequest, idempotencyKey: string): Promise<StudySessionResponse> {
    const response = await client.getClient().post<StudySessionResponse>(
      `/v1/vocabulary/sessions/${sessionId}/advance`,
      request,
      {headers: requestHeaders(studentId, idempotencyKey)},
    );
    return requireVocabularyPayload(response.data, isStudySession, 'study session');
  },

  async exit(studentId: string, sessionId: string, idempotencyKey: string): Promise<StudySessionResponse> {
    const response = await client.getClient().post<StudySessionResponse>(
      `/v1/vocabulary/sessions/${sessionId}/exit`,
      undefined,
      {headers: requestHeaders(studentId, idempotencyKey)},
    );
    return requireVocabularyPayload(response.data, isStudySession, 'study session');
  },

  async endSession(studentId: string, sessionId: string, idempotencyKey: string): Promise<StudySessionResponse> {
    const response = await client.getClient().post<StudySessionResponse>(
      `/v1/vocabulary/sessions/${sessionId}/end`,
      undefined,
      {headers: requestHeaders(studentId, idempotencyKey)},
    );
    return requireVocabularyPayload(response.data, isStudySession, 'study session');
  },
};
