-- One-time data fix (D-42): the "aurora-xv" Template row was never written to production (the
-- catalog entry existed in code, lib/content/templates.ts, but the upsert script that was supposed
-- to create it in the database was never run there), so /templates/aurora-xv and /templates
-- couldn't find it. Values copied verbatim from lib/content/templates.ts via buildTemplateRows()
-- (server/seed/demo-data.ts), verified against a real Postgres instance before writing this file.
--
-- Touches ONLY the row with slug = 'aurora-xv'. ON CONFLICT DO NOTHING: if that row already exists
-- for any reason, this is a no-op and never overwrites it (never touches publicationStatus or
-- minimumPlan on an existing row, matching upsertTemplates()'s own safety rule).
INSERT INTO public."Template"
  (id, slug, name, "eventType", style, "secondaryStyles", description, premium, "designStatus", "publicationStatus", features, "thumbnailSrc", "thumbnailAlt", "thumbnailTone", "previewSample", "previewScreens", "sortOrder", "createdAt", "updatedAt", "minimumPlan")
VALUES
  ('tpl_aurora_xv', 'aurora-xv', 'Aurora XV', 'QUINCEANERA', 'ELEGANT', '{ROMANTIC}',
   'Una invitación romántica y luminosa para unos XV años premium: marfil cálido, rosa empolvado y dorado suave, con flores claras y detalles de lujo discreto.',
   false, 'IMPLEMENTED', 'PUBLISHED', '{MUSIC,RSVP,GALLERY,COUNTDOWN,LOCATION,GIFTS}', NULL, 'Plantilla Aurora XV', 'blush',
   '{"date": "14 de febrero de 2027", "names": ["Valentina"], "venue": ["Salón Aurora", "Querétaro"], "button": "Abrir invitación", "eyebrow": "Mis XV años"}',
   '[{"id": "cover", "label": "Portada"}, {"id": "story", "label": "Nuestra historia"}, {"id": "details", "label": "Detalles"}, {"id": "gallery", "label": "Galería"}]',
   4, now(), now(), 'FREE')
ON CONFLICT (slug) DO NOTHING;
