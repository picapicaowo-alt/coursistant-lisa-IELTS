export interface ProfileResponse {
  userId: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  role: string;
  level: string | null;
  avatarUrl: string | null;
  phone: string | null;
  emailNotifications: boolean;
}

export interface UpdateProfileRequest {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phone?: string | null;
  emailNotifications?: boolean;
}
