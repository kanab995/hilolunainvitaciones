-- One-time data fix, applied the same way as D-42 (aurora-xv) and D-43 (celeste) so it can never be
-- forgotten again: the "spider-friends" Template row is inserted here, as a tracked migration,
-- instead of depending on a one-off script someone has to remember to run against production.
-- Values copied verbatim from lib/content/templates.ts via buildTemplateRows()
-- (server/seed/demo-data.ts): computed buildTemplateRows() in-process (hermetic, no DATABASE_URL)
-- and diffed its "spider-friends" row field-by-field against this INSERT before writing it, instead
-- of running it against the shared dev/prod Postgres directly (the task asked to report the exact
-- command and not run it unsupervised in production).
--
-- Touches ONLY the row with slug = 'spider-friends'. ON CONFLICT DO NOTHING: if that row already
-- exists for any reason, this is a no-op and never overwrites it (never touches publicationStatus
-- or minimumPlan on an existing row, matching upsertTemplates()'s own safety rule).
INSERT INTO public."Template"
  (id, slug, name, "eventType", style, "secondaryStyles", description, premium, "designStatus", "publicationStatus", features, "thumbnailSrc", "thumbnailAlt", "thumbnailTone", "previewSample", "previewScreens", "sortOrder", "createdAt", "updatedAt", "minimumPlan")
VALUES
  ('tpl_spider_friends', 'spider-friends', 'Spider Friends', 'BIRTHDAY', 'THEMED', '{KIDS}',
   'Una invitación infantil llena de energía para una fiesta de superhéroes arácnidos originales: ciudad, telarañas, globos y mucha aventura para festejar como todo un héroe.',
   false, 'IMPLEMENTED', 'PUBLISHED', '{MUSIC,RSVP,GALLERY,COUNTDOWN,LOCATION,GIFTS}', NULL, 'Plantilla Spider Friends', 'sand',
   '{"date": "15 de mayo de 2027", "names": ["Nico"], "venue": ["Salón Ciudad Aventura"], "button": "Abrir invitación", "eyebrow": "¡Nico cumple 6!"}',
   '[{"id": "cover", "label": "Portada"}, {"id": "story", "label": "Nuestra historia"}, {"id": "details", "label": "Detalles"}, {"id": "gallery", "label": "Galería"}]',
   12, now(), now(), 'FREE')
ON CONFLICT (slug) DO NOTHING;
