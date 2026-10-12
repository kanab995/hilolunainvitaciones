-- One-time data fix, applied the same way as D-42 (aurora-xv), D-43 (celeste) and the Spider
-- Friends / Baby Bloom migrations so it can never be forgotten again: the "luz-de-fe", "mar-de-amor"
-- and "nova-grad" Template rows are inserted here, as a tracked migration, instead of depending on a
-- one-off script someone has to remember to run against production.
--
-- Values generated from lib/content/templates.ts via buildTemplateRows() (server/seed/demo-data.ts),
-- computed in-process (hermetic, no DATABASE_URL); the generator was first run on the already-applied
-- "baby-bloom" row and its scalar fields were identical to the existing migration (the two JSON columns
-- were equal ignoring key order, which jsonb does not preserve) before the three new rows were written. NOT applied by the assistant: the owner runs it (npm run db:deploy).
--
-- Touches ONLY the rows with slug IN ('luz-de-fe', 'mar-de-amor', 'nova-grad'). ON CONFLICT DO NOTHING:
-- if a row already exists for any reason, this is a no-op and never overwrites it (never touches
-- publicationStatus or minimumPlan on an existing row, matching upsertTemplates()'s own safety rule).
INSERT INTO public."Template"
  (id, slug, name, "eventType", style, "secondaryStyles", description, premium, "designStatus", "publicationStatus", features, "thumbnailSrc", "thumbnailAlt", "thumbnailTone", "previewSample", "previewScreens", "sortOrder", "createdAt", "updatedAt", "minimumPlan")
VALUES
  ('tpl_luz_de_fe', 'luz-de-fe', 'Luz de Fe', 'BAPTISM', 'ELEGANT', '{MINIMAL}',
   'Una invitación luminosa y ceremonial para una Primera Comunión: blanco cálido, dorado suave y luz natural, con ornamentos mínimos — paloma, lirios y olivo — y una composición limpia y emotiva. También sirve para otras celebraciones religiosas sobrias.',
   false, 'IMPLEMENTED', 'PUBLISHED', '{MUSIC,RSVP,GALLERY,COUNTDOWN,LOCATION,GIFTS}', NULL, 'Plantilla Luz de Fe', 'cream',
   '{"eyebrow":"Mi Primera Comunión","names":["Sofía"],"date":"8 de mayo de 2027","venue":["Parroquia de San Miguel Arcángel"],"button":"Abrir invitación"}',
   '[{"id":"cover","label":"Portada"},{"id":"story","label":"Nuestra historia"},{"id":"details","label":"Detalles"},{"id":"gallery","label":"Galería"}]',
   14, now(), now(), 'FREE'),
  ('tpl_mar_de_amor', 'mar-de-amor', 'Mar de Amor', 'WEDDING', 'DESTINATION', '{ROMANTIC}',
   'Una invitación fresca y editorial para una boda en la playa: lino, arena y atardecer sobre el mar, con palmas, conchas y una paleta marina — sin flores clásicas — para parejas que se casan con los pies en la arena.',
   false, 'IMPLEMENTED', 'PUBLISHED', '{MUSIC,RSVP,GALLERY,COUNTDOWN,LOCATION,GIFTS}', NULL, 'Plantilla Mar de Amor', 'sand',
   '{"eyebrow":"Nuestra boda","names":["Valeria","&","Mateo"],"date":"6 de noviembre de 2027","venue":["Playa Palmar del Sol","Tulum"],"button":"Abrir invitación"}',
   '[{"id":"cover","label":"Portada"},{"id":"story","label":"Nuestra historia"},{"id":"details","label":"Detalles"},{"id":"gallery","label":"Galería"}]',
   15, now(), now(), 'FREE'),
  ('tpl_nova_grad', 'nova-grad', 'Nova Grad', 'GRADUATION', 'MODERN', '{THEMED}',
   'Una invitación nocturna y juvenil para celebrar una graduación: negro, oro y champán, con destellos, reflectores y confeti, y una portada editorial que pone el nombre del graduado en el centro de la fiesta.',
   false, 'IMPLEMENTED', 'PUBLISHED', '{MUSIC,RSVP,GALLERY,COUNTDOWN,LOCATION,GIFTS}', NULL, 'Plantilla Nova Grad', 'sand',
   '{"eyebrow":"Graduación","names":["Camila"],"date":"17 de julio de 2027","venue":["Terraza Skyline","Guadalajara"],"button":"Abrir invitación"}',
   '[{"id":"cover","label":"Portada"},{"id":"story","label":"Nuestra historia"},{"id":"details","label":"Detalles"},{"id":"gallery","label":"Galería"}]',
   16, now(), now(), 'FREE')
ON CONFLICT (slug) DO NOTHING;
