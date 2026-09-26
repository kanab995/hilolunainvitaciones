import { describe, expect, it } from "vitest";
import { AuthSyncError } from "@/server/auth/errors";
import { RESERVED_EMAIL_DOMAIN, syncUser, UniqueViolation, type ClerkProfile, type StoredUser, type UserStore } from "@/server/services/user-sync";

/** Almacén en memoria con las mismas restricciones únicas que la BD y una latencia que provoca carreras. */
function fakeStore(seed: StoredUser[] = []): UserStore & { users: StoredUser[]; profileCalls: number } {
  const users = [...seed];
  let nextId = 1;
  const tick = () => new Promise((resolve) => setTimeout(resolve, Math.random() * 4));
  const store = {
    users,
    profileCalls: 0,
    async findByClerkId(clerkUserId: string) {
      await tick();
      return users.find((user) => user.clerkUserId === clerkUserId) ?? null;
    },
    async findByEmail(email: string) {
      await tick();
      return users.find((user) => user.email === email) ?? null;
    },
    async linkClerkId(userId: string, clerkUserId: string) {
      await tick();
      const user = users.find((candidate) => candidate.id === userId);
      if (!user || user.clerkUserId !== null || users.some((candidate) => candidate.clerkUserId === clerkUserId)) return false;
      user.clerkUserId = clerkUserId;
      return true;
    },
    async create(input: { clerkUserId: string; email: string; name: string | null }) {
      await tick();
      const fields = [users.some((user) => user.clerkUserId === input.clerkUserId) ? "clerkUserId" : "", users.some((user) => user.email === input.email) ? "email" : ""].filter(Boolean);
      if (fields.length > 0) throw new UniqueViolation(fields);
      const user: StoredUser = { id: `usr_${nextId++}`, ...input };
      users.push(user);
      return user;
    },
  };
  return store;
}

const profile = (email: string | null, extra: Partial<ClerkProfile> = {}) => async (): Promise<ClerkProfile> => ({ email, emailVerified: true, name: "Persona", ...extra });

describe("6. getOrCreateCurrentUser (syncUser) no crea duplicados", () => {
  it("peticiones simultáneas de la misma cuenta producen un solo usuario", async () => {
    const store = fakeStore();
    const results = await Promise.all(Array.from({ length: 25 }, () => syncUser(store, "user_1", profile("ana@example.com"))));
    expect(new Set(results.map((user) => user.id)).size).toBe(1);
    expect(store.users).toHaveLength(1);
    expect(store.users[0]).toMatchObject({ clerkUserId: "user_1", email: "ana@example.com" });
  });

  it("varias cuentas distintas a la vez producen un usuario cada una", async () => {
    const store = fakeStore();
    const ids = await Promise.all(Array.from({ length: 10 }, (_, i) => syncUser(store, `user_${i}`, profile(`u${i}@example.com`))));
    expect(new Set(ids.map((user) => user.id)).size).toBe(10);
    expect(store.users).toHaveLength(10);
  });
});

describe("7. clerkUserId es la identidad; el email no", () => {
  it("un usuario ya vinculado se encuentra por clerkUserId sin pedir el perfil a Clerk", async () => {
    const store = fakeStore([{ id: "usr_a", clerkUserId: "user_1", email: "ana@example.com", name: "Ana" }]);
    const user = await syncUser(store, "user_1", async () => {
      throw new Error("no debe pedir el perfil");
    });
    expect(user.id).toBe("usr_a");
  });

  it("si la persona cambia de email en Clerk sigue siendo el mismo usuario", async () => {
    const store = fakeStore([{ id: "usr_a", clerkUserId: "user_1", email: "ana@example.com", name: "Ana" }]);
    const user = await syncUser(store, "user_1", profile("ana.nuevo@example.com"));
    expect(user.id).toBe("usr_a");
    expect(store.users).toHaveLength(1);
  });

  it("otra cuenta de Clerk con el mismo email NO hereda el usuario ni crea un duplicado", async () => {
    const store = fakeStore([{ id: "usr_a", clerkUserId: "user_1", email: "ana@example.com", name: "Ana" }]);
    await expect(syncUser(store, "user_2", profile("ana@example.com"))).rejects.toMatchObject({ code: "email_conflict" });
    expect(store.users).toHaveLength(1);
    expect(store.users[0]?.clerkUserId).toBe("user_1");
  });
});

describe("Vinculación inicial por email y usuario demo", () => {
  it("vincula un usuario existente sin identidad solo con email verificado", async () => {
    const store = fakeStore([{ id: "usr_prev", clerkUserId: null, email: "prev@example.com", name: "Previa" }]);
    const user = await syncUser(store, "user_9", profile("Prev@Example.com"));
    expect(user.id).toBe("usr_prev");
    expect(store.users[0]?.clerkUserId).toBe("user_9");

    const other = fakeStore([{ id: "usr_prev", clerkUserId: null, email: "prev@example.com", name: "Previa" }]);
    await expect(syncUser(other, "user_9", profile("prev@example.com", { emailVerified: false }))).rejects.toBeInstanceOf(AuthSyncError);
    expect(other.users[0]?.clerkUserId).toBeNull();
  });

  it("9. nunca se vincula ni se asigna el usuario demo a una persona real", async () => {
    const demo: StoredUser = { id: "usr_demo", clerkUserId: null, email: `demo${RESERVED_EMAIL_DOMAIN}`, name: "Andrea" };
    const store = fakeStore([demo]);
    await expect(syncUser(store, "user_real", profile(`demo${RESERVED_EMAIL_DOMAIN}`))).rejects.toMatchObject({ code: "email_conflict" });
    expect(demo.clerkUserId).toBeNull();

    // Una persona real cualquiera recibe un usuario NUEVO, distinto del demo.
    const created = await syncUser(store, "user_real", profile("real@example.com"));
    expect(created.id).not.toBe("usr_demo");
    expect(store.users).toHaveLength(2);
  });

  it("una cuenta sin email no se sincroniza", async () => {
    await expect(syncUser(fakeStore(), "user_x", profile(null))).rejects.toMatchObject({ code: "no_email" });
  });
});
