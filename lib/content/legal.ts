import { siteConfig } from "@/lib/site-config";

/**
 * TEXTOS LEGALES MÍNIMOS (BORRADOR). NO son textos legales definitivos ni asesoría jurídica: describen cómo funciona hoy el producto para que
 * un abogado los revise y complete antes del lanzamiento. Todo lo marcado «[PENDIENTE …]» es una decisión legal o comercial abierta.
 * Módulo de copy central del área. Cuando cambie el producto (nuevos proveedores, analítica, cookies), este texto debe revisarse de nuevo.
 */
export const LEGAL_DRAFT_NOTICE = "DRAFT — requiere revisión legal antes de lanzamiento";
export const LEGAL_DRAFT_EXPLANATION = "Este documento es un borrador informativo, no un texto legal definitivo. Describe cómo funciona hoy el servicio y debe ser revisado por un profesional antes de publicarse como versión final.";

export interface LegalSection {
  id: string;
  title: string;
  paragraphs: readonly string[];
  /** Puntos de la sección (opcional). */
  items?: readonly string[];
}

export interface LegalDocument {
  slug: "privacy" | "terms";
  title: string;
  description: string;
  updated: string;
  sections: readonly LegalSection[];
}

const CONTACT_PENDING = "[PENDIENTE: definir el responsable del tratamiento, su domicilio y el correo de contacto para asuntos de privacidad]";

export const privacyDocument: LegalDocument = {
  slug: "privacy",
  title: "Aviso de privacidad",
  description: `Cómo ${siteConfig.name} trata los datos personales de quienes crean invitaciones y de quienes las reciben.`,
  updated: "[PENDIENTE: fecha de la versión aprobada]",
  sections: [
    { id: "responsable", title: "Responsable", paragraphs: [CONTACT_PENDING] },
    {
      id: "cuentas",
      title: "Cuentas",
      paragraphs: [`Para crear invitaciones necesitas una cuenta. El acceso (inicio de sesión, contraseñas y verificación del correo) lo gestiona Clerk. ${siteConfig.name} guarda un perfil interno con tu nombre y correo electrónico, y un identificador que lo vincula con tu cuenta de Clerk. No guardamos tu contraseña.`],
    },
    {
      id: "eventos",
      title: "Eventos e invitaciones",
      paragraphs: ["Guardamos el contenido que escribes para tu evento: nombres, fecha y hora, lugares, itinerario, historia, mesa de regalos y demás textos de la invitación. Puedes editarlo mientras es un borrador; lo que publicas se guarda como una versión publicada, visible para quien tenga el enlace."],
    },
    {
      id: "invitados",
      title: "Personas invitadas",
      paragraphs: ["Tú (la persona anfitriona) decides qué datos de tus invitados registras: nombre y, si quieres, correo, teléfono y grupo. Cada invitado tiene un enlace personalizado con un código aleatorio que no contiene sus datos. Nunca mostramos correos o teléfonos de tus invitados a otras personas, y el equipo de operación solo ve totales, no esos datos."],
    },
    {
      id: "rsvp",
      title: "Confirmaciones (RSVP)",
      paragraphs: ["Cuando una persona invitada responde, guardamos su respuesta (asistirá, no asistirá o tal vez), el número de asistentes, el mensaje opcional y las respuestas a las preguntas del evento. Solo la persona anfitriona del evento puede consultar estas respuestas. No pedimos cuenta a los invitados para responder."],
    },
    {
      id: "imagenes",
      title: "Imágenes",
      paragraphs: ["Las fotos que subes se guardan en un servicio de almacenamiento de objetos (S3 compatible; hoy, Cloudflare R2) y se sirven públicamente cuando forman parte de una invitación publicada. Antes de guardarlas eliminamos los metadatos EXIF (por ejemplo, la ubicación GPS y el modelo del dispositivo). Declaras tener derecho a usar las imágenes que subes."],
    },
    {
      id: "pagos",
      title: "Pagos",
      paragraphs: ["Las compras se procesan con Stripe en su página de pago. Hilo Luna no recibe ni guarda datos de tarjeta. Guardamos el registro de la compra (evento, plan, importe, moneda, fecha y estado) y un identificador de cliente de Stripe. Los recibos y datos de facturación los gestiona Stripe. [PENDIENTE: definir el tratamiento de impuestos y datos fiscales]"],
    },
    {
      id: "proveedores",
      title: "Proveedores que tratan datos",
      paragraphs: ["Para prestar el servicio usamos estos proveedores:"],
      items: ["Clerk: identidad, sesiones y correo de la cuenta.", "Stripe: pagos.", "Cloudflare R2 (u otro almacenamiento S3 compatible): imágenes.", "Proveedor de base de datos PostgreSQL y de alojamiento de la aplicación. [PENDIENTE: nombrar los proveedores definitivos y su ubicación]"],
    },
    {
      id: "cookies",
      title: "Cookies y analítica",
      paragraphs: ["Hoy usamos solo las cookies técnicas necesarias para mantener tu sesión. No usamos analítica ni publicidad de terceros. Si esto cambia, actualizaremos este aviso y, cuando corresponda, pediremos tu consentimiento."],
    },
    {
      id: "conservacion",
      title: "Conservación",
      paragraphs: [
        "Los eventos de pago están disponibles públicamente hasta 30 días después de la fecha del evento; después la invitación deja de mostrarse, pero por ahora los datos no se borran automáticamente. [PENDIENTE: definir plazos de conservación y borrado, y el procedimiento para solicitar la eliminación de una cuenta o de un evento]",
      ],
    },
    { id: "derechos", title: "Tus derechos", paragraphs: ["Puedes solicitar acceso, corrección o eliminación de tus datos. [PENDIENTE: describir el procedimiento y los plazos según la legislación aplicable]"] },
  ],
};

export const termsDocument: LegalDocument = {
  slug: "terms",
  title: "Términos y condiciones",
  description: `Condiciones para usar ${siteConfig.name} y comprar planes para tus eventos.`,
  updated: "[PENDIENTE: fecha de la versión aprobada]",
  sections: [
    { id: "servicio", title: "El servicio", paragraphs: [`${siteConfig.name} te permite crear, personalizar, publicar y compartir invitaciones digitales, recibir confirmaciones de asistencia y administrar tu lista de invitados. [PENDIENTE: datos de la empresa que presta el servicio]`] },
    { id: "cuenta", title: "Tu cuenta", paragraphs: ["Eres responsable de la actividad de tu cuenta y de mantener la confidencialidad de tu acceso. Debes proporcionar información veraz."] },
    {
      id: "contenido",
      title: "Contenido que subes",
      paragraphs: ["Conservas los derechos sobre el contenido que subes (textos e imágenes). Nos concedes una licencia limitada para almacenarlo, procesarlo y mostrarlo únicamente para prestarte el servicio. Declaras que tienes derecho a usarlo y que no infringe derechos de terceros, ni contiene datos personales de otras personas sin la base legal adecuada."],
    },
    {
      id: "compras",
      title: "Compras por evento",
      paragraphs: ["Cada plan (Esencial, Premium) se compra con un pago único por evento, sin cargos recurrentes. Los precios y los límites de cada plan se muestran antes de pagar. Una mejora de Esencial a Premium cobra solo la diferencia. [PENDIENTE: impuestos y comprobantes fiscales]"],
    },
    {
      id: "acceso",
      title: "Ventana de acceso",
      paragraphs: ["Un evento de pago está disponible hasta 30 días después de la fecha del evento (o 30 días después de la compra, si es posterior). Si cambias la fecha del evento hacia adelante, el acceso se extiende; nunca se acorta. Al terminar, la invitación pública deja de mostrarse. Un evento en el plan Gratis no expira por ahora."],
    },
    { id: "reembolsos", title: "Reembolsos", paragraphs: ["Los reembolsos están sujetos a la política vigente. [PENDIENTE: definir la política de reembolsos]"] },
    {
      id: "uso",
      title: "Uso prohibido",
      paragraphs: ["No puedes usar el servicio para:"],
      items: ["Publicar contenido ilegal, engañoso, ofensivo o que infrinja derechos de terceros.", "Enviar comunicaciones masivas no solicitadas o suplantar a otras personas.", "Intentar acceder sin autorización a cuentas, datos o sistemas, ni interferir con el servicio.", "Subir archivos que no sean imágenes o que contengan código malicioso."],
    },
    { id: "cambios", title: "Cambios y contacto", paragraphs: ["Podemos actualizar estos términos; te avisaremos de los cambios relevantes. [PENDIENTE: ley aplicable, jurisdicción y medio de contacto]"] },
  ],
};
