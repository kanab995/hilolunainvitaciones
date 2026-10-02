-- One-time data fix (D-43), applied the same way as D-42 (aurora-xv) so it can never be forgotten
-- again: the "celeste" Template row is inserted here, as a tracked migration, instead of depending
-- on a one-off script someone has to remember to run against production. Values copied verbatim from
-- lib/content/templates.ts via buildTemplateRows() (server/seed/demo-data.ts), verified against a
-- real Postgres instance (via the project's own `prisma db seed`) before writing this file.
--
-- Touches ONLY the row with slug = 'celeste'. ON CONFLICT DO NOTHING: if that row already exists for
-- any reason, this is a no-op and never overwrites it (never touches publicationStatus or
-- minimumPlan on an existing row, matching upsertTemplates()'s own safety rule).
INSERT INTO public."Template"
  (id, slug, name, "eventType", style, "secondaryStyles", description, premium, "designStatus", "publicationStatus", features, "thumbnailSrc", "thumbnailAlt", "thumbnailTone", "previewSample", "previewScreens", "sortOrder", "createdAt", "updatedAt", "minimumPlan")
VALUES
  ('tpl_celeste', 'celeste', 'Celeste', 'BAPTISM', 'ELEGANT', '{ROMANTIC}',
   'Una invitación tierna y luminosa para un bautizo premium: marfil cálido, blanco perla y azul cielo muy suave, con flores blancas, velas y detalles dorados delicados.',
   false, 'IMPLEMENTED', 'PUBLISHED', '{MUSIC,RSVP,GALLERY,COUNTDOWN,LOCATION,GIFTS}', NULL, 'Plantilla Celeste', 'cream',
   '{"date": "14 de marzo de 2027", "names": ["Mateo"], "venue": ["Jardín Los Olivos", "Querétaro"], "button": "Abrir invitación", "eyebrow": "Mi bautizo"}',
   '[{"id": "cover", "label": "Portada"}, {"id": "story", "label": "Nuestra historia"}, {"id": "details", "label": "Detalles"}, {"id": "gallery", "label": "Galería"}]',
   5, now(), now(), 'FREE')
ON CONFLICT (slug) DO NOTHING;
