import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublishDialog } from "@/components/editor/publish-dialog";
import { SaveStatus } from "@/components/editor/save-status";
import { EditorTopbar } from "@/components/editor/editor-topbar";
import { ShareActionCard } from "@/components/dashboard/share-action-card";
import { ShareDialogProvider } from "@/components/dashboard/share-dialog";
import { EventHeader } from "@/components/dashboard/event-header";
import { createAutosaver, type AutosaveState } from "@/lib/editor/autosave";
import { SyncQueue } from "@/lib/editor/sync-queue";
import type { DashboardEvent } from "@/types/dashboard";
import { attachCoverImage, createImageUpload, deleteMediaAsset, finalizeImageUpload, releaseUnusedMedia, removeCoverImage } from "@/server/services/media-service";
import { makeWorld, pngBytes } from "../helpers/media-world";
import { visibleText } from "../invitation/helpers";

async function readyAsset(world: ReturnType<typeof makeWorld>) {
  const requested = await createImageUpload("evt_A", { filename: "x.png", mimeType: "image/png", sizeBytes: 100 }, world.deps);
  const id = requested.result.ok ? requested.result.upload.mediaAssetId : "";
  world.storage.put(world.repo.assets.get(id)!.storageKey, pngBytes(800, 600));
  await finalizeImageUpload("evt_A", id, world.deps);
  return id;
}

describe("(44/45/72) Retención de archivos: un archivo publicado no se borra físicamente", () => {
  it("72.1/72.2 quitar la portada del borrador NO borra el archivo mientras la publicación vigente lo usa", async () => {
    const world = makeWorld();
    const id = await readyAsset(world);
    await attachCoverImage("evt_A", id, "Portada", world.deps);
    world.repo.publishedAssetIds.add(id); // «publicado»: el snapshot vigente referencia el archivo
    const key = world.repo.assets.get(id)!.storageKey;

    const removed = await removeCoverImage("evt_A", world.deps);
    expect(removed.result.ok).toBe(true);
    expect(world.repo.cover.get("evt_A")?.assetId).toBeNull(); // la relación del borrador sí se quita
    expect(world.repo.assets.get(id)?.status).toBe("READY"); // pero el archivo sigue vivo
    expect(world.storage.objects.has(key)).toBe(true);
    expect(world.storage.deleted).toEqual([]);
  });

  it("borrar explícitamente un archivo publicado se rechaza (en uso)", async () => {
    const world = makeWorld();
    const id = await readyAsset(world);
    world.repo.publishedAssetIds.add(id);
    expect((await deleteMediaAsset("evt_A", id, world.deps)).result).toMatchObject({ ok: false, code: "in_use" });
    expect(world.storage.deleted).toEqual([]);
  });

  it("72.3 tras una publicación nueva que ya no lo usa, y sin referencias en el borrador, se libera y se borra físicamente", async () => {
    const world = makeWorld();
    const id = await readyAsset(world);
    await attachCoverImage("evt_A", id, "", world.deps);
    world.repo.publishedAssetIds.add(id);
    await removeCoverImage("evt_A", world.deps);
    expect(world.storage.deleted).toEqual([]);

    world.repo.publishedAssetIds.delete(id); // la versión nueva ya no lo referencia
    await releaseUnusedMedia("usr_A", "evt_A", [id], world.deps);
    expect(world.repo.assets.get(id)?.status).toBe("DELETED");
    expect(world.storage.deleted).toEqual([world.repo.assets.get(id)!.storageKey]);
  });

  it("si el borrador AÚN lo usa, publicar sin él no lo borra", async () => {
    const world = makeWorld();
    const id = await readyAsset(world);
    await attachCoverImage("evt_A", id, "", world.deps);
    await releaseUnusedMedia("usr_A", "evt_A", [id], world.deps);
    expect(world.repo.assets.get(id)?.status).toBe("READY");
    expect(world.storage.deleted).toEqual([]);
  });

  it("(3) las operaciones de imágenes devuelven la nueva revisión del borrador (el cliente la necesita para guardar)", async () => {
    const world = makeWorld();
    const id = await readyAsset(world);
    const attached = await attachCoverImage("evt_A", id, "", world.deps);
    expect(attached.result).toMatchObject({ ok: true, revision: 2 });
    expect((await removeCoverImage("evt_A", world.deps)).result).toMatchObject({ ok: true, revision: 3 });
  });
});

describe("(3/4/55) Autoguardado: debounce, esperar guardados y publicar solo lo guardado", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = (saveMs = 450) => {
    const states: AutosaveState[] = [];
    const save = vi.fn((value: string) => new Promise<void>((resolve) => setTimeout(resolve, saveMs)).then(() => void value));
    const saver = createAutosaver<string>({ initial: "a", save, delayMs: 800, onChange: (state) => states.push(state) });
    return { saver, save, states };
  };

  it("(4) NO guarda por pulsación: 30 cambios seguidos reinician el debounce y producen UN solo guardado con el último valor", async () => {
    const { saver, save } = setup();
    for (let i = 0; i < 30; i += 1) {
      saver.notify(`texto ${i}`);
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("texto 29");
  });

  it("(21) «Sin cambios» hasta el primer guardado, luego «Guardado»; «dirty» mientras hay cambios sin guardar", async () => {
    const { saver, states } = setup();
    expect(saver.getState().status).toBe("idle");
    saver.notify("b");
    expect(saver.getState().status).toBe("dirty");
    await vi.advanceTimersByTimeAsync(800 + 450);
    expect(states.at(-1)?.status).toBe("saved");
  });

  it("(55) flush() espera al guardado en curso Y guarda lo que llegó mientras tanto antes de resolver", async () => {
    const { saver, save } = setup();
    saver.notify("b");
    await vi.advanceTimersByTimeAsync(800); // empieza a guardar «b»
    saver.notify("c"); // llega otro cambio durante el guardado
    let done = false;
    const flushed = saver.flush().then(() => (done = true));
    await vi.advanceTimersByTimeAsync(100);
    expect(done).toBe(false); // aún guardando
    await vi.advanceTimersByTimeAsync(450 + 450);
    await flushed;
    expect(save.mock.calls.map((call) => call[0])).toEqual(["b", "c"]);
    expect(saver.getState().status).toBe("saved");
  });

  it("flush() sin esperar el debounce guarda de inmediato lo pendiente", async () => {
    const { saver, save } = setup();
    saver.notify("b");
    const flushed = saver.flush();
    await vi.advanceTimersByTimeAsync(450);
    await flushed;
    expect(save).toHaveBeenCalledWith("b");
    expect(saver.getState().status).toBe("saved");
  });

  it("(22) si el guardado falla: estado de error con el mensaje, el borrador local no se pierde y se puede reintentar", async () => {
    const states: AutosaveState[] = [];
    let attempts = 0;
    const save = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("No pudimos guardar los cambios. Inténtalo de nuevo.");
    });
    const saver = createAutosaver<string>({ initial: "a", save, delayMs: 800, onChange: (state) => states.push(state) });
    saver.notify("b");
    await vi.advanceTimersByTimeAsync(800);
    expect(saver.getState()).toMatchObject({ status: "error", message: "No pudimos guardar los cambios. Inténtalo de nuevo." });
    await saver.flush(); // «Reintentar»
    expect(save).toHaveBeenCalledTimes(2);
    expect(saver.getState().status).toBe("saved");
  });

  it("flush() resuelve (no se cuelga) cuando el guardado falla: publicar puede detenerse y avisar", async () => {
    const save = vi.fn(async () => {
      throw new Error("falló");
    });
    const saver = createAutosaver<string>({ initial: "a", save, delayMs: 800, onChange: () => undefined });
    saver.notify("b");
    await saver.flush();
    expect(saver.getState().status).toBe("error");
  });
});

describe("SyncQueue: una sola cola y la última revisión conocida", () => {
  it("ejecuta las tareas de una en una, en orden, aunque una falle", async () => {
    const queue = new SyncQueue(1);
    const order: string[] = [];
    const slow = queue.enqueue(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push("guardar");
    });
    const failing = queue.enqueue(async () => {
      order.push("imagen");
      throw new Error("x");
    });
    const last = queue.enqueue(async () => order.push("publicar"));
    await slow;
    await expect(failing).rejects.toThrow();
    await last;
    expect(order).toEqual(["guardar", "imagen", "publicar"]);
  });

  it("la revisión solo avanza (una respuesta tardía no la hace retroceder)", () => {
    const queue = new SyncQueue(4);
    queue.advance(6);
    queue.advance(5);
    queue.advance(Number.NaN);
    expect(queue.getRevision()).toBe(6);
  });
});

describe("Estados y botones del editor (D-29)", () => {
  const saved: AutosaveState = { status: "saved", savedAt: 1 };
  const html = (node: React.ReactElement) => renderToStaticMarkup(node);

  it("(21/64/66) «Guardado» y el estado de publicación se muestran por separado; nunca «Modo demostración» con base de datos", () => {
    const real = html(<SaveStatus state={saved} publicationLabel="Cambios sin publicar" />);
    expect(visibleText(real)).toContain("Guardado");
    expect(visibleText(real)).toContain("Cambios sin publicar");
    expect(real).not.toContain("Modo demostración");
    expect(visibleText(html(<SaveStatus state={{ status: "idle" }} publicationLabel="Borrador" />))).toContain("Sin cambios");
    expect(visibleText(html(<SaveStatus state={{ status: "saving" }} publicationLabel="Borrador" />))).toContain("Guardando…");
    const failed = html(<SaveStatus state={{ status: "error", message: "No pudimos guardar" }} onRetry={() => undefined} publicationLabel="Borrador" />);
    expect(visibleText(failed)).toContain("Error al guardar");
    expect(visibleText(failed)).toContain("Reintentar");
    expect(visibleText(html(<SaveStatus state={saved} demo />))).toContain("Modo demostración");
  });

  it("(65) el botón principal dice «Publicar» la primera vez, «Publicar cambios» después y «Publicando...» mientras publica", () => {
    const bar = (props: Partial<React.ComponentProps<typeof EditorTopbar>>) => html(<EditorTopbar eventTitle="Evento" saveState={saved} onRetry={() => undefined} onPreview={() => undefined} onPublish={() => undefined} {...props} />);
    expect(visibleText(bar({}))).toContain("Publicar");
    expect(visibleText(bar({ publishLabel: "Publicar cambios" }))).toContain("Publicar cambios");
    const busy = bar({ publishing: true });
    expect(visibleText(busy)).toContain("Publicando...");
    expect(busy).toMatch(/<button[^>]*disabled[^>]*>[^<]*<[^>]*>[^<]*<\/[^>]*>Publicando|<button[^>]*disabled/);
  });

  const dialog = (props: Partial<React.ComponentProps<typeof PublishDialog>>) =>
    renderToStaticMarkup(<PublishDialog open onOpenChange={() => undefined} state="draft" slug="sofia-y-diego" demo={false} publishing={false} justPublished={false} onConfirm={() => undefined} {...props} />);
  // Radix Dialog renderiza en un portal: en HTML estático no aparece; se comprueba la lógica de copy con `publishCopy`.

  it("(37/38) el copy acordado de la primera publicación y de la republicación", async () => {
    const { publishCopy } = await import("@/lib/publishing/copy");
    expect(publishCopy.first).toMatchObject({ description: "Tu invitación estará disponible públicamente.", confirm: "Publicar invitación" });
    expect(publishCopy.republish).toMatchObject({ title: "¿Publicar los cambios?", description: "Las personas que abran tu invitación verán la nueva versión.", confirm: "Publicar cambios" });
    expect(publishCopy.publishing).toBe("Publicando...");
    expect(() => dialog({})).not.toThrow();
  });
});

describe("(39/40) Compartir y estado en el dashboard", () => {
  const event = (state: "draft" | "published" | "changes"): DashboardEvent => ({ id: "evt_1", title: "Sofía & Diego", startsAt: "2027-05-17T17:00:00-06:00", timezone: "America/Mexico_City", publicSlug: "sofia-y-diego", publication: { state, version: state === "draft" ? 0 : 2 } });

  it("(39) borrador: la tarjeta Compartir explica que hay que publicar y NO muestra un enlace", () => {
    const html = renderToStaticMarkup(
      <ShareDialogProvider slug="sofia-y-diego" title="Sofía & Diego" state="draft" eventId="evt_1">
        <ShareActionCard slug="sofia-y-diego" />
      </ShareDialogProvider>,
    );
    expect(visibleText(html)).toContain("Publica tu invitación para poder compartirla.");
    expect(html).not.toContain("/i/sofia-y-diego");
  });

  it("(39) publicado: muestra la URL pública real", () => {
    const html = renderToStaticMarkup(
      <ShareDialogProvider slug="sofia-y-diego" title="Sofía & Diego" state="published" eventId="evt_1">
        <ShareActionCard slug="sofia-y-diego" />
      </ShareDialogProvider>,
    );
    expect(html).toContain("/i/sofia-y-diego");
  });

  it("(32/40) el encabezado del evento muestra el estado real: Borrador · Publicado · Cambios sin publicar", () => {
    for (const [state, label] of [["draft", "Borrador"], ["published", "Publicado"], ["changes", "Cambios sin publicar"]] as const) {
      const html = renderToStaticMarkup(
        <ShareDialogProvider slug="s" title="t" state={state} eventId="evt_1">
          <EventHeader event={event(state)} now={Date.parse("2026-09-26T00:00:00Z")} />
        </ShareDialogProvider>,
      );
      expect(html).toContain(`data-publication-state="${state}"`);
      expect(visibleText(html)).toContain(label);
    }
  });
});
