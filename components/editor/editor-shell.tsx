"use client";

import { Eye, X } from "lucide-react";
import Image from "next/image";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { publishInvitationAction, saveDraftAction } from "@/app/(site)/dashboard/(editor)/events/[id]/edit/actions";
import { EditorPanel } from "@/components/editor/editor-panel";
import { EditorProvider, type EditorContextValue } from "@/components/editor/editor-context";
import { EditorTopbar } from "@/components/editor/editor-topbar";
import { PublishDialog } from "@/components/editor/publish-dialog";
import { ShareInvitationDialog } from "@/components/share/share-invitation-dialog";
import { PreviewPanel } from "@/components/editor/preview-panel";
import { SectionRail } from "@/components/editor/section-rail";
import { TemplateDialog } from "@/components/editor/template-dialog";
import { useAutosave } from "@/components/editor/use-autosave";
import { useInvitationDraft } from "@/components/editor/use-invitation-draft";
import { useMediaController } from "@/components/editor/use-media-controller";
import { useMediaQuery } from "@/components/editor/use-media-query";
import { Button } from "@/components/ui/button";
import { createObjectUrlRegistry } from "@/lib/editor/local-images";
import { buildEditorRows } from "@/lib/editor/rows";
import type { EditorEvent } from "@/lib/editor/load-event";
import { invitationToDraftPayload } from "@/lib/editor/draft-payload";
import { saveDraftLocally } from "@/lib/editor/save-draft";
import { SyncQueue } from "@/lib/editor/sync-queue";
import { validateInvitation } from "@/lib/editor/validation";
import { defaultInvitationTemplate, getInvitationTemplate } from "@/lib/invitation/templates";
import { displayNames } from "@/lib/invitation/format";
import { publishCopy } from "@/lib/publishing/copy";
import { publicationLabels, publishActionLabel } from "@/lib/publishing/state";
import type { Invitation } from "@/types/invitation";

/**
 * EDITOR DE INVITACIÓN (mockup 04). Tres paneles en escritorio (≥ 1280): lista de secciones (352) ·
 * edición · vista previa (464). Tablet (768–1279): lista + edición y la vista previa bajo demanda.
 * Móvil: una columna (lista → sección) con el botón fijo «Vista previa».
 *
 * Arquitectura: `initialInvitation` (props, nunca se muta) → `draft` (`useInvitationDraft`, única API
 * de edición) → `InvitationRenderer` dentro del iframe de vista previa. Autoguardado REAL (D-29): con base de datos
 * guarda TODO el borrador con la Server Action `saveDraftAction` (con debounce, sin escribir por tecla) y sin ella
 * usa `saveDraftLocally` (simulado, «Modo demostración»). Guardar, imágenes y publicar comparten una cola
 * (`SyncQueue`) y la revisión del borrador; «Guardado» (dirty) y «Cambios sin publicar» (unpublished) son estados distintos.
 */
export function EditorShell({ event }: { event: EditorEvent }) {
  // Fijo mientras dure la edición: las Server Actions revalidan páginas y `event` puede llegar renovado; el
  // borrador (y el autoguardado, que compara contra este valor) no debe reiniciarse por eso.
  const [initial] = useState(event.invitation);
  const { draft, api } = useInvitationDraft(initial);
  const [images] = useState(() => createObjectUrlRegistry());
  const [selectedId, setSelectedId] = useState(() => initial.sections[0]?.id ?? "");
  const [mobileView, setMobileView] = useState<"list" | "edit">("list");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // Sincronización con el servidor (D-29): una sola cola y la última revisión conocida del borrador.
  const persisted = event.media.persisted;
  const [queue] = useState(() => new SyncQueue(event.revision));
  const [revision, setRevision] = useState(event.revision);
  const [publication, setPublication] = useState(event.publication);
  const [publishedRevision, setPublishedRevision] = useState(event.publishedRevision);
  const [publishing, setPublishing] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const [publishError, setPublishError] = useState<string>();
  const sync = useCallback(() => setRevision(queue.getRevision()), [queue]);

  const isDesktop = useMediaQuery("(min-width: 80rem)");
  const isTabletUp = useMediaQuery("(min-width: 48rem)");

  const errors = useMemo(() => validateInvitation(draft), [draft]);
  // El payload se construye DENTRO de la tarea en cola: sale con la revisión más reciente (tras cualquier operación de imágenes).
  const [save] = useState(() =>
    persisted
      ? async (invitation: Invitation) => {
          const result = await queue.enqueue(() => saveDraftAction(event.id, invitationToDraftPayload(invitation, queue.getRevision())));
          if (!result.ok) throw new Error(result.message);
          queue.advance(result.revision);
          setRevision(queue.getRevision());
        }
      : saveDraftLocally,
  );
  const { state: saveState, retry, flush } = useAutosave(draft, { initial, save, errors });
  const ensureSaved = useCallback(async () => (await flush()).status !== "error", [flush]);
  const media = useMediaController({ eventId: event.id, capability: event.media, draft, api, queue, ensureSaved, onSynced: sync });

  // Cambios locales sin guardar (dirty): distintos de «Cambios sin publicar» (ya guardados en el borrador, pero no publicados).
  const unsaved = saveState.status === "dirty" || saveState.status === "saving" || saveState.status === "error";
  // Lo que se muestra y decide el botón: una edición pendiente de guardar también es un cambio que aún no está publicado
  // (publicar primero la guarda). El estado «dirty» en sí se sigue mostrando aparte, en el indicador de guardado.
  const publicationState = publication.state === "draft" ? "draft" : unsaved || revision > publishedRevision ? "changes" : "published";

  // Advertencia al salir SOLO si hay algo sin guardar (cambios locales pendientes, guardando o con error).
  useEffect(() => {
    if (!unsaved) return;
    const warn = (leaving: BeforeUnloadEvent) => {
      leaving.preventDefault();
      leaving.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const openPublish = () => {
    setPublishError(undefined);
    setJustPublished(false);
    setPublishOpen(true);
  };

  /** Publicar: primero guarda lo pendiente y ESPERA la confirmación; solo entonces publica (nunca una versión vieja). */
  const publish = async () => {
    if (publishing) return;
    setPublishing(true);
    setPublishError(undefined);
    try {
      const saved = await flush();
      if (saved.status === "error") {
        setPublishError(saved.message ? `${publishCopy.saveFailed} (${saved.message})` : publishCopy.saveFailed);
        return;
      }
      const result = await queue.enqueue(() => publishInvitationAction(event.id, queue.getRevision()));
      if (!result.ok) {
        setPublishError(result.message);
        return;
      }
      queue.advance(result.revision);
      setRevision(queue.getRevision());
      setPublication(result.publication);
      setPublishedRevision(result.revision);
      setJustPublished(true);
    } catch {
      setPublishError("No pudimos publicar tu invitación. Tu borrador sigue intacto; inténtalo de nuevo.");
    } finally {
      setPublishing(false);
    }
  };

  // Las URL de objeto (imágenes locales) se revocan al salir del editor.
  useEffect(() => () => images.revokeAll(), [images]);

  const template = getInvitationTemplate(draft.templateSlug) ?? defaultInvitationTemplate;
  const rows = useMemo(() => buildEditorRows(draft), [draft]);
  const selectedRow = rows.find((row) => row.id === selectedId) ?? rows[0];

  const selectRow = (id: string) => {
    setSelectedId(id);
    setMobileView("edit");
  };

  const context = useMemo<EditorContextValue>(() => ({ draft, api, errors, template, images, media, selectRow }), [draft, api, errors, template, images, media]);

  if (!selectedRow) return null;

  const backdrop = template.decor.heroBackdrop;
  const thumb = draft.cover.photo?.src ?? (backdrop?.kind === "image" ? backdrop.src : undefined);

  const railHeader = (
    <div className="flex items-center gap-4 px-1 pb-1">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-lu-input border border-lu-border-subtle bg-lu-surface-tint">
        {thumb ? <Image src={thumb} alt="" width={128} height={128} sizes="64px" unoptimized={thumb.startsWith("blob:") || undefined} className="size-full object-cover" /> : null}
      </div>
      <div className="flex min-w-0 flex-col items-start gap-0.5">
        <p className="font-lu-display text-lu-title-md leading-tight text-lu-text">{event.title}</p>
        <button
          type="button"
          onClick={() => setTemplateOpen(true)}
          className="rounded-lu-xs text-lu-xs text-lu-text-muted underline-offset-2 outline-none hover:text-lu-text hover:underline focus-visible:ring-2 focus-visible:ring-lu-brown-600"
        >
          Plantilla {template.name} · Cambiar plantilla
        </button>
      </div>
    </div>
  );

  return (
    <EditorProvider value={context}>
      <div className="flex h-svh flex-col overflow-hidden bg-lu-canvas">
        <EditorTopbar
          eventTitle={event.title}
          saveState={saveState}
          onRetry={retry}
          onPreview={() => setPreviewOpen(true)}
          onPublish={openPublish}
          publicationLabel={publicationLabels[publicationState]}
          publishLabel={publishActionLabel(publicationState)}
          publishing={publishing}
          demo={!persisted}
        />

        <div className="grid min-h-0 flex-1 md:grid-cols-[var(--lu-editor-rail-w)_minmax(0,1fr)] xl:grid-cols-[var(--lu-editor-rail-w)_minmax(0,1fr)_var(--lu-editor-preview-w)]">
          <aside className={`${mobileView === "list" ? "block" : "hidden"} relative min-h-0 overflow-y-auto border-r border-lu-border-subtle bg-lu-surface-muted p-4 pb-[calc(7rem+env(safe-area-inset-bottom))] md:block md:pb-6`}>
            <SectionRail rows={rows} sections={draft.sections} selectedId={selectedRow.id} onSelect={selectRow} api={api} header={railHeader} />
          </aside>

          <div data-editor-panel role="region" aria-label="Editor de sección" className={`${mobileView === "edit" ? "block" : "hidden"} relative min-h-0 overflow-y-auto pb-[calc(7rem+env(safe-area-inset-bottom))] md:block md:pb-6`}>
            <EditorPanel row={selectedRow} section={draft.sections.find((section) => section.id === selectedRow.id)} onBack={() => setMobileView("list")} />
          </div>

          <aside aria-label="Vista previa" className="relative hidden min-h-0 border-l border-lu-border-subtle bg-lu-surface-muted px-6 pt-7 pb-5 xl:block">
            {isDesktop ? <PreviewPanel eventId={event.id} draft={draft} /> : null}
          </aside>
        </div>

        {/* Móvil: acceso fijo a la vista previa (en tablet está en la barra superior). */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-lu-border-subtle bg-lu-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_16px_-12px_rgb(40_25_10/0.18)] md:hidden">
          <Button fullWidth size="lg" onClick={() => setPreviewOpen(true)}>
            <Eye aria-hidden="true" />
            Vista previa
          </Button>
        </div>
      </div>

      {/* Vista previa bajo demanda: pantalla completa en móvil, panel lateral en tablet y ventana grande en escritorio. */}
      <DialogPrimitive.Root open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-lu-ink/40" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-50 flex flex-col bg-lu-canvas outline-none md:inset-y-0 md:right-0 md:left-auto md:w-(--lu-editor-preview-w) md:border-l md:border-lu-border-subtle xl:inset-6 xl:w-auto xl:rounded-lu-modal xl:border xl:shadow-lu-modal"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-lu-border-subtle px-4">
              <DialogPrimitive.Title className="font-lu-display text-lu-title-sm text-lu-text">Vista previa</DialogPrimitive.Title>
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="sm">
                  <X aria-hidden="true" />
                  Volver al editor
                </Button>
              </DialogPrimitive.Close>
            </div>
            <div className="min-h-0 flex-1 p-0 md:p-6">
              {previewOpen ? <PreviewPanel eventId={event.id} draft={draft} fluid={!isTabletUp} /> : null}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <TemplateDialog open={templateOpen} onOpenChange={setTemplateOpen} activeSlug={draft.templateSlug} onSelect={api.selectTemplate} />

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        state={publicationState}
        slug={event.slug}
        demo={!persisted}
        publishing={publishing}
        justPublished={justPublished}
        error={publishError}
        onConfirm={() => void publish()}
        onShare={() => {
          setPublishOpen(false);
          setShareOpen(true);
        }}
      />
      {/* El mismo modal de compartir que el panel del evento (D-30): no hay un segundo. */}
      <ShareInvitationDialog open={shareOpen} onOpenChange={setShareOpen} title={displayNames(initial.names).join(" & ") || event.title} slug={event.slug} state={publicationState} eventId={event.id} />
    </EditorProvider>
  );
}
