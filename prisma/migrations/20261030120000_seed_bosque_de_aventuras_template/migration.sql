-- D-50: fila de catálogo de la plantilla "bosque-de-aventuras", como migración versionada (mismo patrón que
-- D-42/D-43, Spider Friends, Baby Bloom y Luz de Fe/Mar de Amor/Nova Grad) en vez de un script suelto.
-- Valores copiados de lib/content/templates.ts vía buildTemplateRows() (server/seed/demo-data.ts), calculados en
-- proceso SIN base de datos y comparados campo por campo con este INSERT.
--
-- DIFERENCIA DELIBERADA con el seed: "publicationStatus" = 'DRAFT' (el seed usa 'PUBLISHED'). La plantilla entra
-- con el diseño aprobado ('IMPLEMENTED') pero NO visible para clientes: su publicación comercial la autoriza el
-- propietario y la activa un administrador en /admin/templates.
--
-- Solo toca la fila con slug = 'bosque-de-aventuras'. ON CONFLICT DO NOTHING: si la fila ya existiera, no hace nada
-- (nunca sobrescribe "publicationStatus" ni "minimumPlan" de una fila existente).
-- NO aplicada: la aplica el propietario cuando autorice la publicación (`npm run db:deploy` o el build de Vercel).
INSERT INTO public."Template"
  (id, slug, name, "eventType", style, "secondaryStyles", description, premium, "designStatus", "publicationStatus", features, "thumbnailSrc", "thumbnailAlt", "thumbnailTone", "previewSample", "previewScreens", "sortOrder", "createdAt", "updatedAt", "minimumPlan")
VALUES
  ('tpl_bosque_de_aventuras', 'bosque-de-aventuras', 'Bosque de Aventuras', 'BIRTHDAY', 'KIDS', '{RUSTIC}',
   'Una celebración mágica entre flores, animalitos y aventuras en un bosque encantado. Ideal para cumpleaños llenos de ternura y diversión.',
   false, 'IMPLEMENTED', 'DRAFT', '{MUSIC,RSVP,GALLERY,COUNTDOWN,LOCATION,GIFTS}', NULL, 'Plantilla Bosque de Aventuras', 'sage',
   '{"date": "12 de junio de 2027", "names": ["Lucía"], "venue": ["Jardín El Bosque Encantado", "Valle de Bravo"], "button": "Abrir invitación", "eyebrow": "¡Lucía cumple 5!"}',
   '[{"id": "cover", "label": "Portada"}, {"id": "story", "label": "Nuestra historia"}, {"id": "details", "label": "Detalles"}, {"id": "gallery", "label": "Galería"}]',
   17, now(), now(), 'FREE')
ON CONFLICT (slug) DO NOTHING;
