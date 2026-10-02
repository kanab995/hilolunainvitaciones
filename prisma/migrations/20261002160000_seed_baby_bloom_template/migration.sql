-- One-time data fix, applied the same way as D-42 (aurora-xv), D-43 (celeste) and the Spider
-- Friends migration so it can never be forgotten again: the "baby-bloom" Template row is inserted
-- here, as a tracked migration, instead of depending on a one-off script someone has to remember
-- to run against production.
--
-- Values copied verbatim from lib/content/templates.ts via buildTemplateRows()
-- (server/seed/demo-data.ts): computed buildTemplateRows() in-process (hermetic, no DATABASE_URL)
-- and diffed its "baby-bloom" row field-by-field against this INSERT before writing it, instead of
-- running it against the shared dev/prod Postgres directly (reported here for the owner to run).
--
-- Touches ONLY the row with slug = 'baby-bloom'. ON CONFLICT DO NOTHING: if that row already exists
-- for any reason, this is a no-op and never overwrites it (never touches publicationStatus or
-- minimumPlan on an existing row, matching upsertTemplates()'s own safety rule).
INSERT INTO public."Template"
  (id, slug, name, "eventType", style, "secondaryStyles", description, premium, "designStatus", "publicationStatus", features, "thumbnailSrc", "thumbnailAlt", "thumbnailTone", "previewSample", "previewScreens", "sortOrder", "createdAt", "updatedAt", "minimumPlan")
VALUES
  ('tpl_baby_bloom', 'baby-bloom', 'Baby Bloom', 'BABY_SHOWER', 'ELEGANT', '{ROMANTIC}',
   'Una invitación tierna, elegante y luminosa para dar la bienvenida al bebé: marfil cálido, champagne y dorado suave, con flores delicadas, globos pastel y un osito — neutral para niño o niña.',
   false, 'IMPLEMENTED', 'PUBLISHED', '{MUSIC,RSVP,GALLERY,COUNTDOWN,LOCATION,GIFTS}', NULL, 'Plantilla Baby Bloom', 'cream',
   '{"date": "12 de junio de 2027", "names": ["Baby Mateo"], "venue": ["Jardín Luna Azul"], "button": "Abrir invitación", "eyebrow": "Baby Shower"}',
   '[{"id": "cover", "label": "Portada"}, {"id": "story", "label": "Nuestra historia"}, {"id": "details", "label": "Detalles"}, {"id": "gallery", "label": "Galería"}]',
   13, now(), now(), 'FREE')
ON CONFLICT (slug) DO NOTHING;
