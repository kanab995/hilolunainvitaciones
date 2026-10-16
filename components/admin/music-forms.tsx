"use client";

import { useActionState, useId, useRef, useState, type ReactNode } from "react";
import {
  createMusicCategoryAction,
  createMusicTrackAction,
  finalizeMusicUploadAction,
  requestMusicUploadAction,
  setMusicTrackStatusAction,
  updateMusicCategoryAction,
  updateMusicLicenseAction,
  updateMusicTrackAction,
  verifyMusicLicenseAction,
  type MusicActionState,
} from "@/app/(site)/admin/music/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { controlStyles } from "@/components/ui/input";
import { adminCopy } from "@/lib/admin/copy";
import { MUSIC_AUDIO, MUSIC_TEXT_LIMITS, type MusicTrackStatusId } from "@/lib/music/limits";
import { cn } from "@/lib/utils";

/**
 * FORMULARIOS de la biblioteca musical en la consola (D-46). Todos envían a Server Actions que vuelven a comprobar el rol ADMIN y validan
 * la entrada en el servidor; aquí solo hay ergonomía (límites de longitud, `required`). La subida de audio va DIRECTO al almacenamiento con
 * una URL firmada y después el servidor comprueba el archivo (tamaño y firma MP3) antes de asignarlo.
 */
const copy = adminCopy.music;
const initial: MusicActionState = { status: "idle" };
const input = cn(controlStyles, "h-(--lu-h-md) font-lu-sans text-lu-base");
const area = cn(controlStyles, "min-h-28 py-2 font-lu-sans text-lu-base");

export interface CategoryOption {
  id: string;
  name: string;
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-lu-sm font-medium text-lu-text">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-lu-sm text-lu-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function CheckRow({ name, label, defaultChecked, disabled }: { name: string; label: string; defaultChecked: boolean; disabled?: boolean }) {
  return (
    <label className="flex items-start gap-3 text-lu-sm text-lu-text">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} disabled={disabled} className="mt-0.5 size-4 accent-[var(--lu-brown-600)]" />
      <span>{label}</span>
    </label>
  );
}

function Feedback({ state }: { state: MusicActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <div role={state.status === "error" ? "alert" : "status"} className={cn("text-lu-sm", state.status === "error" ? "text-lu-error" : "text-lu-text-muted")}>
      <p>{state.message}</p>
      {state.problems?.length ? (
        <ul className="mt-1 list-disc pl-5">
          {state.problems.map((problem) => (
            <li key={problem}>{copy.detail.problems[problem] ?? problem}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ───────── Categorías ─────────

export function CategoryDialog({ category }: { category?: { id: string; name: string; slug: string; sortOrder: number; isActive: boolean } }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(category ? updateMusicCategoryAction : createMusicCategoryAction, initial);
  const id = useId();
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state.status === "saved") setOpen(false);
  }
  const c = copy.categories;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={category ? "secondary" : "primary"} size="sm" aria-label={category ? c.editTitle(category.name) : c.add}>
          {category ? c.edit : c.add}
        </Button>
      </DialogTrigger>
      <DialogContent size="md">
        <form action={formAction} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{category ? c.editTitle(category.name) : c.add}</DialogTitle>
            <DialogDescription>{c.visibleHint}</DialogDescription>
          </DialogHeader>
          {category ? <input type="hidden" name="categoryId" value={category.id} /> : null}
          <Field id={`${id}-name`} label={c.name}>
            <input id={`${id}-name`} name="name" required maxLength={MUSIC_TEXT_LIMITS.categoryName} defaultValue={category?.name} className={input} />
          </Field>
          {category ? null : (
            <Field id={`${id}-slug`} label={c.slug} hint={c.slugHint}>
              <input id={`${id}-slug`} name="slug" required maxLength={MUSIC_TEXT_LIMITS.categorySlug} pattern="[a-z0-9]+(-[a-z0-9]+)*" aria-describedby={`${id}-slug-hint`} className={input} />
            </Field>
          )}
          <Field id={`${id}-order`} label={c.order}>
            <input id={`${id}-order`} name="sortOrder" type="number" min={0} max={10000} required defaultValue={category?.sortOrder ?? 100} className={input} />
          </Field>
          <CheckRow name="isActive" label={c.visible} defaultChecked={category?.isActive ?? true} />
          <Feedback state={state} />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">{c.cancel}</Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              {pending ? c.saving : c.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───────── Pistas ─────────

export function NewTrackDialog({ categories }: { categories: CategoryOption[] }) {
  const [state, formAction, pending] = useActionState(createMusicTrackAction, initial);
  const id = useId();
  const t = copy.tracks;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">{t.add}</Button>
      </DialogTrigger>
      <DialogContent size="md">
        <form action={formAction} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{t.add}</DialogTitle>
            <DialogDescription>{t.createHint}</DialogDescription>
          </DialogHeader>
          <TrackFields id={id} categories={categories} />
          <Feedback state={state} />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">{copy.categories.cancel}</Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              {pending ? t.creating : t.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TrackFields({ id, categories, track }: { id: string; categories: CategoryOption[]; track?: { title: string; author: string; categoryId: string } }) {
  const t = copy.tracks;
  return (
    <>
      <Field id={`${id}-title`} label={t.name}>
        <input id={`${id}-title`} name="title" required maxLength={MUSIC_TEXT_LIMITS.title} defaultValue={track?.title} className={input} />
      </Field>
      <Field id={`${id}-author`} label={t.author}>
        <input id={`${id}-author`} name="author" required maxLength={MUSIC_TEXT_LIMITS.author} defaultValue={track?.author} className={input} />
      </Field>
      <Field id={`${id}-category`} label={t.category}>
        <select id={`${id}-category`} name="categoryId" required defaultValue={track?.categoryId ?? categories[0]?.id} className={input}>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

export function TrackMetadataForm({ trackId, track, categories }: { trackId: string; track: { title: string; author: string; categoryId: string }; categories: CategoryOption[] }) {
  const [state, formAction, pending] = useActionState(updateMusicTrackAction, initial);
  const id = useId();
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="trackId" value={trackId} />
      <TrackFields id={id} categories={categories} track={track} />
      <Feedback state={state} />
      <div>
        <Button type="submit" variant="secondary" loading={pending}>
          {copy.detail.saveMetadata}
        </Button>
      </div>
    </form>
  );
}

export interface LicenseValues {
  licenseSource: string | null;
  licenseName: string | null;
  licenseUrl: string | null;
  licenseTerms: string | null;
  licenseEvidenceRef: string | null;
  rightsHosting: boolean;
  rightsPublicPerformance: boolean;
  rightsCommercialUse: boolean;
  attributionRequired: boolean;
  attributionText: string | null;
  /** `AAAA-MM-DD` o vacío. */
  licenseExpiresAt: string;
}

export function LicenseForm({ trackId, values, locked }: { trackId: string; values: LicenseValues; locked: boolean }) {
  const [state, formAction, pending] = useActionState(updateMusicLicenseAction, initial);
  const id = useId();
  const d = copy.detail;
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="trackId" value={trackId} />
      {locked ? <p className="rounded-lu-card bg-lu-surface-tint p-3 text-lu-sm text-lu-text-secondary">{d.licenseLocked}</p> : null}
      <fieldset disabled={locked} className="flex flex-col gap-4 disabled:opacity-70">
        <Field id={`${id}-source`} label={d.licenseSource} hint={d.licenseSourceHint}>
          <input id={`${id}-source`} name="licenseSource" maxLength={MUSIC_TEXT_LIMITS.licenseSource} defaultValue={values.licenseSource ?? ""} aria-describedby={`${id}-source-hint`} className={input} />
        </Field>
        <Field id={`${id}-name`} label={d.licenseName}>
          <input id={`${id}-name`} name="licenseName" maxLength={MUSIC_TEXT_LIMITS.licenseName} defaultValue={values.licenseName ?? ""} className={input} />
        </Field>
        <Field id={`${id}-url`} label={d.licenseUrl}>
          <input id={`${id}-url`} name="licenseUrl" type="url" inputMode="url" placeholder="https://" maxLength={MUSIC_TEXT_LIMITS.licenseUrl} defaultValue={values.licenseUrl ?? ""} className={input} />
        </Field>
        <Field id={`${id}-terms`} label={d.licenseTerms} hint={d.licenseTermsHint}>
          <textarea id={`${id}-terms`} name="licenseTerms" maxLength={MUSIC_TEXT_LIMITS.licenseTerms} defaultValue={values.licenseTerms ?? ""} aria-describedby={`${id}-terms-hint`} className={area} />
        </Field>
        <Field id={`${id}-evidence`} label={d.licenseEvidenceRef} hint={d.licenseEvidenceHint}>
          <input id={`${id}-evidence`} name="licenseEvidenceRef" maxLength={MUSIC_TEXT_LIMITS.licenseEvidenceRef} defaultValue={values.licenseEvidenceRef ?? ""} aria-describedby={`${id}-evidence-hint`} className={input} />
        </Field>
        <div className="flex flex-col gap-2">
          <CheckRow name="rightsHosting" label={d.rightsHosting} defaultChecked={values.rightsHosting} />
          <CheckRow name="rightsPublicPerformance" label={d.rightsPublicPerformance} defaultChecked={values.rightsPublicPerformance} />
          <CheckRow name="rightsCommercialUse" label={d.rightsCommercialUse} defaultChecked={values.rightsCommercialUse} />
          <CheckRow name="attributionRequired" label={d.attributionRequired} defaultChecked={values.attributionRequired} />
        </div>
        <Field id={`${id}-attribution`} label={d.attributionText}>
          <input id={`${id}-attribution`} name="attributionText" maxLength={MUSIC_TEXT_LIMITS.attributionText} defaultValue={values.attributionText ?? ""} className={input} />
        </Field>
        <Field id={`${id}-expires`} label={d.licenseExpiresAt}>
          <input id={`${id}-expires`} name="licenseExpiresAt" type="date" defaultValue={values.licenseExpiresAt} className={input} />
        </Field>
      </fieldset>
      <Feedback state={state} />
      <div>
        <Button type="submit" variant="secondary" disabled={locked} loading={pending}>
          {d.saveLicense}
        </Button>
      </div>
    </form>
  );
}

export function VerifyForm({ trackId, disabled }: { trackId: string; disabled: boolean }) {
  const [state, formAction, pending] = useActionState(verifyMusicLicenseAction, initial);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="trackId" value={trackId} />
      <div>
        <Button type="submit" variant="secondary" disabled={disabled} loading={pending}>
          {copy.detail.verify}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function StatusForm({ trackId, status, canActivate }: { trackId: string; status: MusicTrackStatusId; canActivate: boolean }) {
  const [state, formAction, pending] = useActionState(setMusicTrackStatusAction, initial);
  const d = copy.detail;
  const button = (value: MusicTrackStatusId, label: string, variant: "primary" | "secondary" | "ghost", disabled = false) => (
    <Button type="submit" name="status" value={value} variant={variant} disabled={disabled || pending}>
      {label}
    </Button>
  );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="trackId" value={trackId} />
      <div className="flex flex-wrap gap-2">
        {status !== "ACTIVE" ? button("ACTIVE", d.activate, "primary", !canActivate) : null}
        {status === "ACTIVE" ? button("DISABLED", d.disable, "secondary") : null}
        {status === "DISABLED" ? button("DRAFT", d.toDraft, "ghost") : null}
      </div>
      <p className="text-lu-sm text-lu-text-muted">{status === "ACTIVE" ? d.disableHint : d.activateHint}</p>
      <Feedback state={state} />
    </form>
  );
}

/** Duración del MP3 elegido, medida por el navegador sin subirlo todavía. */
function measureDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("audio"));
    };
    audio.src = url;
  });
}

export function AudioUploader({ trackId, locked }: { trackId: string; locked: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string }>();
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const d = copy.detail;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMessage(undefined);
    if (file.type !== MUSIC_AUDIO.mimeType || file.size > MUSIC_AUDIO.maxBytes) {
      setMessage({ tone: "error", text: copy.errors.upload ?? "" });
      return;
    }
    setBusy(true);
    try {
      const durationSec = await measureDuration(file);
      const ticket = await requestMusicUploadAction({ trackId, sizeBytes: file.size, mimeType: file.type });
      if (!ticket.ok) {
        setMessage({ tone: "error", text: ticket.message });
        return;
      }
      const put = await fetch(ticket.upload.url, { method: ticket.upload.method, headers: ticket.upload.headers, body: file });
      if (!put.ok) {
        setMessage({ tone: "error", text: copy.errors.upload ?? "" });
        return;
      }
      const result = await finalizeMusicUploadAction({ trackId, key: ticket.key, durationSec: Math.round(durationSec) });
      setMessage({ tone: result.ok ? "ok" : "error", text: result.message });
    } catch {
      setMessage({ tone: "error", text: copy.errors.upload ?? "" });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={cn("inline-flex w-fit cursor-pointer", (locked || busy) && "pointer-events-none opacity-60")}>
        <span className="inline-flex h-(--lu-h-md) items-center rounded-lu-button border border-lu-border-outline px-4 text-lu-sm font-medium text-lu-text hover:bg-lu-selected">{busy ? d.uploading : d.upload}</span>
      </label>
      <input ref={inputRef} id={id} type="file" accept="audio/mpeg,.mp3" disabled={locked || busy} className="sr-only" aria-describedby={`${id}-hint`} onChange={(event) => void onFile(event.target.files?.[0])} />
      <p id={`${id}-hint`} className="text-lu-sm text-lu-text-muted">
        {locked ? d.audioLocked : d.audioHint}
      </p>
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={cn("text-lu-sm", message.tone === "error" ? "text-lu-error" : "text-lu-text-muted")}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
