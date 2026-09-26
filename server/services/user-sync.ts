import { AuthSyncError } from "@/server/auth/errors";

/**
 * SINCRONIZACIÓN Clerk ↔ perfil interno (`User`). Regla: la identidad estable es `clerkUserId`; el email
 * NUNCA es la identidad. Flujo:
 *  1. Existe un User con ese `clerkUserId` → se devuelve (sin consultar a Clerk).
 *  2. Si no, se pide el perfil a Clerk y, SOLO si el email está verificado, se vincula un User existente
 *     con ese email que aún no tenga `clerkUserId` y no sea el usuario demo.
 *  3. En otro caso se crea un User nuevo.
 * Ante peticiones simultáneas (misma cuenta desde varias pestañas) la restricción única de `clerkUserId`
 * decide: quien pierde la carrera relee al ganador. Nunca se duplican usuarios.
 * Lógica pura sobre un `UserStore`: se prueba sin base de datos.
 */
export interface AppUser {
  id: string;
  email: string;
  name: string | null;
}

export interface StoredUser extends AppUser {
  clerkUserId: string | null;
}

export interface ClerkProfile {
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

export interface UserStore {
  findByClerkId(clerkUserId: string): Promise<StoredUser | null>;
  findByEmail(email: string): Promise<StoredUser | null>;
  /** Vincula solo si el usuario sigue sin `clerkUserId` (compare-and-set). `false` si otro lo vinculó antes. */
  linkClerkId(userId: string, clerkUserId: string): Promise<boolean>;
  /** Crea el usuario. Lanza `UniqueViolation` si `clerkUserId` o `email` ya existen. */
  create(input: { clerkUserId: string; email: string; name: string | null }): Promise<StoredUser>;
}

/** Lo lanza `UserStore.create` ante una restricción única (campos afectados en `fields`). */
export class UniqueViolation extends Error {
  readonly fields: string[];
  constructor(fields: string[]) {
    super(`unique violation: ${fields.join(",")}`);
    this.name = "UniqueViolation";
    this.fields = fields;
  }
}

/** Correos reservados al usuario demo del seed: nunca se vinculan a una cuenta real. */
export const RESERVED_EMAIL_DOMAIN = "@hiloluna.local";

const toAppUser = ({ id, email, name }: StoredUser): AppUser => ({ id, email, name });
const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function syncUser(store: UserStore, clerkUserId: string, loadProfile: () => Promise<ClerkProfile>): Promise<AppUser> {
  const existing = await store.findByClerkId(clerkUserId);
  if (existing) return toAppUser(existing);

  const profile = await loadProfile();
  if (!profile.email) throw new AuthSyncError("no_email", "La cuenta de Clerk no tiene correo electrónico.");
  const email = normalizeEmail(profile.email);

  // Vinculación inicial por email: solo con email verificado, usuario sin identidad y que no sea el demo.
  if (profile.emailVerified && !email.endsWith(RESERVED_EMAIL_DOMAIN)) {
    const byEmail = await store.findByEmail(email);
    if (byEmail && byEmail.clerkUserId === null && (await store.linkClerkId(byEmail.id, clerkUserId))) return toAppUser(byEmail);
    if (byEmail && byEmail.clerkUserId === clerkUserId) return toAppUser(byEmail);
  }

  try {
    return toAppUser(await store.create({ clerkUserId, email, name: profile.name }));
  } catch (error) {
    if (!(error instanceof UniqueViolation)) throw error;
    // Carrera: otra petición creó/vinculó a este mismo usuario entre la lectura y la escritura.
    const winner = await store.findByClerkId(clerkUserId);
    if (winner) return toAppUser(winner);
    throw new AuthSyncError("email_conflict", "Ya existe otra cuenta con este correo.");
  }
}
