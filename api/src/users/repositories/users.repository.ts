export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  mustChangePassword: boolean;
  role: string;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  mustChangePassword?: boolean;
  role?: string;
}

export abstract class UsersRepository {
  abstract count(): Promise<number>;
  abstract findByEmail(email: string): Promise<UserRecord | null>;
  abstract findById(id: string): Promise<UserRecord | null>;
  abstract create(input: CreateUserInput): Promise<UserRecord>;
  abstract updatePassword(
    id: string,
    passwordHash: string,
  ): Promise<UserRecord | null>;
}
