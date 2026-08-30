// Auth types — see docs/api/auth_module-api_en.md

/**
 * Which account table the login should be resolved against. This is not an
 * authorization role: the JWT carries its own RoleEnum, and the platform
 * standing lives in `level`. Course roles (Student / TA / Instructor) are a
 * third, separate concept that never appears here.
 */
export type LoginAccountType = 'USER' | 'TENANT_ADMIN' | 'SYSTEM_ADMIN' | 'ADMIN';

/** Platform standing. Course TAs are not represented here — TA is per-course. */
export type UserLevel =
  | 'STUDENT'
  | 'INSTRUCTOR'
  | 'COUNSELLOR'
  | 'ADVISOR'
  | 'PARENT'
  | 'INSTRUCTOR_ADVISOR'
  | 'NOT_APPLICABLE';

export const USER_LEVELS: UserLevel[] = [
  'STUDENT',
  'INSTRUCTOR',
  'COUNSELLOR',
  'ADVISOR',
  'PARENT',
  'INSTRUCTOR_ADVISOR',
  'NOT_APPLICABLE',
];

export const MANAGED_USER_LEVELS: Exclude<UserLevel, 'NOT_APPLICABLE'>[] = [
  'STUDENT',
  'INSTRUCTOR',
  'COUNSELLOR',
  'ADVISOR',
  'PARENT',
  'INSTRUCTOR_ADVISOR',
];

export interface LoginRequest {
  email: string;
  password: string;
  /** Must match the account type or login fails. */
  role: LoginAccountType;
}

/** Public self-registration payload for `POST /v1/auth/register`.
 * Do not send tenantId: the backend ignores a client tenant and binds public
 * registration to the platform tenant from the request host.
 */
export interface RegisterRequest {
  email: string;
  verificationCode: string;
  password: string;
  name: string;
  /** Optional. The backend derives it from the email when omitted. */
  username?: string;
}

export interface PasswordResetRequest {
  email: string;
  verificationCode: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * `data` of a successful `POST /v1/auth/login` (and of `register`).
 *
 * `refreshToken` is deliberately absent: the server returns it as an HttpOnly
 * cookie and never in JSON, so only `accessToken` is ours to store.
 */
export interface AuthResult {
  userId: number;
  email: string;
  name: string;
  username: string;
  role: LoginAccountType;
  /** Admin account tables do not have a student/instructor standing. */
  level: UserLevel | null;
  /** May be null. */
  avatar: string | null;
  accessToken: string;
  /** Null or omitted means false. */
  mustChangePassword?: boolean | null;
}

/**
 * The authenticated user as the app stores it.
 *
 * Mostly `AuthResult`, plus `id` because a lot of existing code keys off
 * `user.id`. The RocketChat fields are populated by the chat integration, not
 * by login.
 */
export interface LoginResponse extends AuthResult {
  id: number;
  rocketChatToken?: string;
  rocketChatUserId?: string;
}

/** Error `code` values login can return. */
export const AUTH_ERROR_CODES = {
  invalidCredentials: 'INVALID_CREDENTIALS',
  passwordChangeRequired: 'PASSWORD_CHANGE_REQUIRED',
  serviceUnavailable: 'AUTH_SERVICE_TEMPORARILY_UNAVAILABLE',
  paramMissing: 'PARAM_MISSING',
  tokenCreationFailed: 'TOKEN_CREATION_FAILED',
  invalidPasswordFormat: 'INVALID_PASSWORD_FORMAT',
  invalidVerificationCode: 'INVALID_VERIFICATION_CODE',
  verificationCodeExpired: 'VERIFICATION_CODE_EXPIRED',
  verificationAttemptsExceeded: 'VERIFICATION_ATTEMPTS_EXCEEDED',
  verificationResendCooldown: 'VERIFICATION_RESEND_COOLDOWN',
  verificationHourlyLimit: 'VERIFICATION_HOURLY_LIMIT',
  emailSendFailed: 'EMAIL_SEND_FAILED',
} as const;
