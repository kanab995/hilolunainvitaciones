import { siteConfig } from "@/lib/site-config";

/**
 * Textos legales aprobados por el propietario (30 de septiembre de 2026). Módulo de copy central del área: cuando cambie el
 * producto (nuevos proveedores, analítica, cookies, impuestos), este texto debe revisarse de nuevo con un abogado.
 */

const RESPONSIBLE_NAME = "Kanab Domínguez Siliceo";
const RESPONSIBLE_ADDRESS = "20 de Noviembre #25, colonia Centro, C.P. 91500, Coatepec, Veracruz";
const PRIVACY_EMAIL = "privacidad@hiloluna.com";
const SUPPORT_EMAIL = "soporte@hiloluna.com";
const LAST_UPDATED = "30 de septiembre de 2026";

export type LegalBlock = { type: "paragraph"; text: string } | { type: "list"; items: readonly string[] };

export interface LegalSection {
  id: string;
  title: string;
  blocks: readonly LegalBlock[];
}

export interface LegalDocument {
  slug: "privacy" | "terms";
  title: string;
  description: string;
  updated: string;
  intro?: readonly LegalBlock[];
  sections: readonly LegalSection[];
}

const p = (text: string): LegalBlock => ({ type: "paragraph", text });
const ul = (items: readonly string[]): LegalBlock => ({ type: "list", items });

export const privacyDocument: LegalDocument = {
  slug: "privacy",
  title: "Aviso de privacidad",
  description: `Cómo ${siteConfig.name} trata los datos personales de quienes crean invitaciones y de quienes las reciben.`,
  updated: LAST_UPDATED,
  sections: [
    {
      id: "identidad-responsable",
      title: "Identidad del responsable",
      blocks: [
        p(
          `${RESPONSIBLE_NAME}, operando comercialmente bajo la marca Hilo Luna, con domicilio en ${RESPONSIBLE_ADDRESS}, es responsable del tratamiento de los datos personales recabados a través del sitio hiloluna.com, sus subdominios, aplicaciones y servicios relacionados.`,
        ),
        p(`Para asuntos relacionados con privacidad y protección de datos personales puede contactarnos en: ${PRIVACY_EMAIL}`),
        p("En adelante, «Hilo Luna», «nosotros» o «la Plataforma»."),
      ],
    },
    {
      id: "alcance",
      title: "Alcance de este aviso",
      blocks: [
        p("Este Aviso de Privacidad aplica a las personas que:"),
        ul([
          "crean o administran una cuenta en Hilo Luna",
          "crean, editan, publican o administran una invitación digital",
          "realizan una compra",
          "son agregadas como invitadas a un evento",
          "responden una confirmación de asistencia o RSVP",
          "interactúan con una invitación publicada",
          "se comunican con soporte",
        ]),
        p(
          "En ciertos casos, cuando una persona anfitriona incorpora a Hilo Luna información de sus invitados, la persona anfitriona determina originalmente qué información incorpora y con qué finalidad. Hilo Luna trata dicha información para prestar las funcionalidades contratadas y conforme a las instrucciones y configuración del evento.",
        ),
      ],
    },
    {
      id: "datos-tratados",
      title: "Datos personales que podemos tratar",
      blocks: [
        p("Dependiendo de la forma en que utilice Hilo Luna, podemos tratar los siguientes datos."),
        p(
          "Datos de cuenta: nombre, correo electrónico, identificadores técnicos de autenticación y demás información necesaria para crear y mantener una cuenta. La autenticación puede ser proporcionada mediante Clerk y proveedores de identidad habilitados, como Google.",
        ),
      ],
    },
    {
      id: "datos-evento",
      title: "Datos del evento",
      blocks: [
        p(
          "Podemos tratar información proporcionada por la persona anfitriona, como: nombre del evento, nombres de los festejados, fecha y hora, ubicaciones, itinerarios, mensajes, fotografías, mesa de regalos, música configurada, código de vestimenta y demás contenido incorporado a la invitación.",
        ),
      ],
    },
    {
      id: "datos-invitados-rsvp",
      title: "Datos de invitados y RSVP",
      blocks: [
        p(
          "Cuando una persona anfitriona agrega invitados o una persona responde a una invitación, podemos tratar: nombre, grupo o familia, número de acompañantes permitidos, confirmación de asistencia, número de asistentes, respuestas a preguntas RSVP y, cuando corresponda, mensajes dirigidos al anfitrión.",
        ),
        p("Los enlaces personalizados pueden utilizar identificadores aleatorios destinados a relacionar al invitado con su invitación. Estos identificadores no deben compartirse públicamente."),
      ],
    },
    {
      id: "fotografias-archivos",
      title: "Fotografías y archivos",
      blocks: [
        p("Podemos tratar imágenes y archivos que la persona usuaria cargue a la Plataforma."),
        p("Hilo Luna aplica procesos técnicos destinados a eliminar metadatos de imagen como EXIF, ubicación GPS y otros metadatos cuando el formato y las condiciones técnicas lo permiten."),
      ],
    },
    {
      id: "datos-pago",
      title: "Datos de pago y compras",
      blocks: [
        p("Cuando se realiza una compra podemos tratar información relacionada con la transacción, como: plan adquirido, importe, moneda, fecha de pago, estado de la compra e identificadores técnicos de transacción."),
        p("Los datos completos de tarjeta, como número de tarjeta y CVC, no son almacenados por Hilo Luna. El procesamiento de pagos se realiza mediante Stripe."),
      ],
    },
    {
      id: "datos-tecnicos-seguridad",
      title: "Datos técnicos y de seguridad",
      blocks: [
        p(
          "Podemos tratar información técnica necesaria para operar y proteger el servicio, como: dirección IP, fecha y hora de acceso, tipo de dispositivo o navegador, registros técnicos, actividad de seguridad, errores del sistema, eventos de limitación de tasa y datos necesarios para prevenir abuso o fraude.",
        ),
        p("Estos datos serán tratados procurando minimizar la información que permita identificar directamente a una persona."),
      ],
    },
    {
      id: "datos-sensibles",
      title: "Datos personales sensibles",
      blocks: [
        p("Hilo Luna no está diseñado para solicitar de manera ordinaria datos personales sensibles."),
        p("Pedimos a anfitriones e invitados evitar incorporar información sensible que no sea estrictamente necesaria."),
        p(
          "Algunas preguntas personalizadas de RSVP podrían eventualmente revelar información considerada sensible —por ejemplo, determinados datos de salud—. La persona anfitriona es responsable de configurar sus preguntas de manera lícita y proporcional y de contar, cuando corresponda, con las bases y consentimientos necesarios.",
        ),
      ],
    },
    {
      id: "finalidades",
      title: "Finalidades primarias",
      blocks: [
        p(
          "Utilizamos los datos personales para: prestar y administrar Hilo Luna; crear y mantener cuentas; crear, guardar, publicar y mostrar invitaciones; administrar invitados; procesar RSVP; generar enlaces personalizados y códigos QR; crear archivos de calendario; almacenar imágenes; gestionar compras; activar planes; enviar comunicaciones transaccionales; prestar soporte; prevenir abuso, fraude y accesos no autorizados; mantener la seguridad; resolver errores; cumplir obligaciones legales, fiscales y contractuales.",
        ),
        p("Estas finalidades son necesarias para prestar el servicio solicitado."),
      ],
    },
    {
      id: "comunicaciones-correo",
      title: "Comunicaciones por correo electrónico",
      blocks: [
        p("Hilo Luna puede enviar comunicaciones estrictamente transaccionales, entre ellas notificaciones de RSVP, confirmaciones de activación de un plan y comunicaciones necesarias para la operación del servicio."),
        p("No utilizaremos estas comunicaciones transaccionales para enviar campañas comerciales sin la base correspondiente."),
        p("Actualmente Hilo Luna utiliza Resend como proveedor tecnológico para el envío de determinados correos."),
      ],
    },
    {
      id: "proveedores-tecnologicos",
      title: "Proveedores tecnológicos",
      blocks: [
        p("Para prestar el servicio utilizamos proveedores especializados que pueden tratar información por cuenta de Hilo Luna, incluyendo actualmente:"),
        ul([
          "Clerk, para autenticación",
          "Stripe, para procesamiento de pagos",
          "Cloudflare R2, para almacenamiento de imágenes y archivos",
          "Vercel, para infraestructura y alojamiento de la aplicación",
          "Prisma/PostgreSQL, para infraestructura de base de datos",
          "Upstash, para mecanismos de protección y limitación de abuso",
          "Resend, para correo transaccional",
          "y, cuando esté habilitado, Sentry, para monitoreo técnico de errores",
        ]),
        p("La participación de estos proveedores se limita a las funciones necesarias para prestar, mantener, asegurar o dar soporte al servicio."),
        p("Algunos proveedores pueden operar infraestructura fuera de México. Procuraremos que el tratamiento se realice conforme a obligaciones contractuales y medidas de protección aplicables."),
      ],
    },
    {
      id: "transferencias",
      title: "Transferencias de datos",
      blocks: [
        p(
          "Hilo Luna podrá comunicar datos personales cuando ello sea necesario para cumplir obligaciones contractuales o legales, proteger derechos, atender requerimientos de autoridad competente o en los demás supuestos permitidos por la legislación aplicable.",
        ),
        p("No vendemos datos personales a anunciantes."),
        p("Hilo Luna no comercializa bases de datos de anfitriones o invitados."),
        p("Cuando resulte legalmente necesario obtener consentimiento para una transferencia, se solicitará conforme a la normativa aplicable."),
      ],
    },
    {
      id: "publicacion-invitaciones",
      title: "Publicación de invitaciones",
      blocks: [
        p("Cuando una persona anfitriona publica una invitación, determinada información del evento queda disponible mediante una URL pública."),
        p("La persona anfitriona es responsable de decidir qué contenido incluye en esa invitación."),
        p("Los enlaces personalizados para invitados contienen un identificador destinado a personalizar la experiencia. Recomendamos no publicar dichos enlaces en sitios abiertos o redes sociales."),
        p(
          "Las invitaciones públicas están configuradas actualmente para no ser indexadas deliberadamente por motores de búsqueda, pero Hilo Luna no puede garantizar que un tercero no copie, capture o comparta contenido al que legítimamente haya tenido acceso.",
        ),
      ],
    },
    {
      id: "conservacion",
      title: "Conservación de datos",
      blocks: [
        p("Conservaremos los datos durante el tiempo necesario para prestar el servicio, cumplir las finalidades descritas y atender responsabilidades legales, contractuales, fiscales o de seguridad."),
        p("Los eventos de pago cuentan actualmente con acceso público hasta la fecha indicada en el servicio, que generalmente corresponde a 30 días después de la fecha del evento, sujeto a las reglas del plan adquirido."),
        p("La terminación del acceso público no implica necesariamente la eliminación inmediata de toda la información. Algunos datos pueden quedar bloqueados o conservarse durante los plazos exigidos o permitidos por la legislación aplicable."),
        p(
          "La legislación mexicana contempla que la cancelación puede dar lugar a un periodo de bloqueo previo a la supresión cuando sea necesario conservar información para atender responsabilidades (Ley Federal de Protección de Datos Personales en Posesión de los Particulares).",
        ),
      ],
    },
    {
      id: "seguridad",
      title: "Seguridad",
      blocks: [
        p("Hilo Luna aplica medidas administrativas, técnicas y organizativas destinadas a proteger los datos contra pérdida, alteración, acceso, divulgación o tratamiento no autorizado."),
        p(
          "Entre otras medidas, utilizamos conexiones HTTPS, controles de acceso, separación de entornos, identificadores no predecibles, validación de permisos, mecanismos contra abuso, sanitización de imágenes, políticas de seguridad de contenido y servicios especializados de infraestructura.",
        ),
        p("Ningún sistema conectado a Internet puede garantizar seguridad absoluta."),
        p(
          "En caso de una vulneración que afecte significativamente los derechos de las personas titulares, se actuará conforme a la legislación aplicable. La Ley Federal de Protección de Datos Personales en Posesión de los Particulares contempla el deber de informar de manera inmediata vulneraciones significativas.",
        ),
      ],
    },
    {
      id: "derechos-arco",
      title: "Derechos ARCO",
      blocks: [
        p("La persona titular puede ejercer sus derechos de:"),
        ul([
          "Acceso, para conocer los datos personales que tratamos y sus condiciones de tratamiento.",
          "Rectificación, para solicitar la corrección de información inexacta o desactualizada.",
          "Cancelación, para solicitar la eliminación cuando resulte procedente.",
          "Oposición, para solicitar el cese de determinado tratamiento cuando legalmente corresponda.",
        ]),
        p("La legislación vigente reconoce expresamente estos derechos y permite ejercerlos en cualquier momento conforme a los requisitos previstos por la ley."),
        p(`Para ejercerlos, envíe una solicitud a: ${PRIVACY_EMAIL}`),
        p("La solicitud deberá incluir información suficiente para acreditar la identidad de la persona titular, identificar los datos involucrados y describir claramente el derecho que desea ejercer."),
        p(
          "Hilo Luna atenderá las solicitudes dentro de los plazos establecidos por la legislación aplicable. La ley prevé, con carácter general, hasta veinte días para comunicar la determinación y, cuando proceda, quince días adicionales para hacerla efectiva, con posibilidad de ampliación en los casos permitidos.",
        ),
      ],
    },
    {
      id: "revocacion-limitacion",
      title: "Revocación y limitación",
      blocks: [
        p(`La persona titular puede solicitar, cuando legalmente corresponda, la revocación del consentimiento o la limitación del uso o divulgación de sus datos escribiendo a: ${PRIVACY_EMAIL}`),
        p("La revocación no tendrá efectos retroactivos y puede no proceder respecto de tratamientos necesarios para mantener una relación contractual o cumplir obligaciones legales."),
      ],
    },
    {
      id: "menores",
      title: "Datos de menores de edad",
      blocks: [
        p("Hilo Luna no está diseñado para que menores de edad contraten planes o administren cuentas comerciales sin la intervención de su madre, padre o tutor."),
        p("Las invitaciones pueden hacer referencia a menores o incluir fotografías proporcionadas por sus responsables. Quien cargue dicho contenido declara contar con las autorizaciones necesarias."),
      ],
    },
    {
      id: "cookies",
      title: "Cookies y tecnologías similares",
      blocks: [
        p("Hilo Luna puede utilizar cookies o almacenamiento técnico estrictamente necesario para autenticación, seguridad, sesión y funcionamiento de la Plataforma."),
        p("Actualmente no utilizamos estas tecnologías con el propósito principal de vender perfiles publicitarios a terceros."),
        p("Si en el futuro incorporamos analítica, publicidad u otras tecnologías que requieran nuevas decisiones de consentimiento, actualizaremos este aviso y los mecanismos correspondientes."),
      ],
    },
    {
      id: "cambios-aviso",
      title: "Cambios al Aviso de Privacidad",
      blocks: [
        p("Podremos actualizar este Aviso de Privacidad cuando cambie la legislación, nuestros proveedores, funcionalidades o prácticas de tratamiento."),
        p("Los cambios materiales se comunicarán mediante hiloluna.com/privacy, la Plataforma o, cuando resulte apropiado, correo electrónico."),
      ],
    },
    {
      id: "contacto",
      title: "Contacto",
      blocks: [
        p("Para preguntas relacionadas con este Aviso de Privacidad o el tratamiento de datos:"),
        p(siteConfig.name),
        p(`Responsable: ${RESPONSIBLE_NAME}`),
        p(`Domicilio: ${RESPONSIBLE_ADDRESS}`),
        p(`Correo: ${PRIVACY_EMAIL}`),
      ],
    },
  ],
};

export const termsDocument: LegalDocument = {
  slug: "terms",
  title: "Términos y condiciones",
  description: `Condiciones para usar ${siteConfig.name} y comprar planes para tus eventos.`,
  updated: LAST_UPDATED,
  intro: [p("Estos Términos y Condiciones regulan el acceso y uso de Hilo Luna, disponible en hiloluna.com."), p("Al crear una cuenta, contratar un plan o utilizar los servicios, la persona usuaria acepta estos Términos.")],
  sections: [
    {
      id: "prestador-servicio",
      title: "Prestador del servicio",
      blocks: [
        p(`El servicio es prestado por: ${RESPONSIBLE_NAME}, bajo la marca comercial Hilo Luna.`),
        p(`Domicilio: ${RESPONSIBLE_ADDRESS}`),
        p(`Correo de atención: ${SUPPORT_EMAIL}`),
        p("La Ley Federal de Protección al Consumidor exige que en transacciones electrónicas el proveedor ponga a disposición del consumidor medios para aclaraciones y reclamaciones y proporcione información clara sobre el servicio."),
      ],
    },
    {
      id: "descripcion-servicio",
      title: "Descripción del servicio",
      blocks: [
        p("Hilo Luna es una plataforma para crear, personalizar, publicar y administrar invitaciones digitales para eventos."),
        p(
          "Dependiendo del plan y de las funciones disponibles, puede incluir: editor de invitaciones, plantillas, publicación mediante URL, administración de invitados, RSVP, acompañantes, galería de imágenes, ubicaciones, itinerario, mesa de regalos, QR, calendario, enlaces personalizados y panel de administración del evento.",
        ),
      ],
    },
    {
      id: "cuenta",
      title: "Cuenta",
      blocks: [
        p("Para utilizar determinadas funcionalidades es necesario crear una cuenta."),
        p("La persona usuaria es responsable de mantener el control de sus mecanismos de acceso y de las actividades realizadas desde su cuenta."),
        p("No debe utilizar la cuenta de otra persona sin autorización."),
        p("Hilo Luna puede suspender temporalmente una cuenta cuando existan indicios razonables de fraude, abuso, compromiso de seguridad o uso contrario a estos Términos."),
      ],
    },
    {
      id: "edad",
      title: "Edad",
      blocks: [
        p("La contratación de planes está dirigida a personas con capacidad legal suficiente para contratar."),
        p("Las personas menores de edad deberán utilizar el servicio a través de su madre, padre, tutor o representante legal cuando resulte aplicable."),
      ],
    },
    {
      id: "modelo-pago",
      title: "Modelo de pago",
      blocks: [
        p("Hilo Luna utiliza un modelo de pago único por evento."),
        p("No existe renovación mensual automática para los planes descritos actualmente."),
        p("Los planes comerciales actuales son:"),
        ul(["Gratis — $0 MXN", "Esencial — $499 MXN por evento", "Premium — $799 MXN por evento", "Upgrade de Esencial a Premium — $300 MXN por evento"]),
        p("Los precios se muestran en pesos mexicanos. Los precios publicados incluyen los impuestos aplicables."),
        p("Los precios para futuras compras pueden modificarse. Un cambio de precio no incrementará retroactivamente una compra que ya haya sido completada."),
      ],
    },
    {
      id: "funciones-limites",
      title: "Funciones y límites",
      blocks: [
        p("Actualmente los planes pueden incluir, entre otros límites:"),
        ul(["Gratis: hasta 30 invitados y 5 imágenes de galería.", "Esencial: hasta 100 invitados y 15 imágenes de galería.", "Premium: hasta 300 invitados y 40 imágenes de galería."]),
        p("Las características exactas y límites aplicables se mostrarán antes de confirmar la compra."),
        p("Cuando una persona cambia de plan, Hilo Luna no elimina automáticamente contenido ya existente por el solo hecho de un cambio de límites."),
      ],
    },
    {
      id: "upgrade",
      title: "Upgrade",
      blocks: [
        p("Un evento Esencial puede actualizarse a Premium pagando el importe de mejora vigente."),
        p("Actualmente la diferencia es de $300 MXN."),
        p("La mejora aplica únicamente al evento para el que fue adquirida."),
      ],
    },
    {
      id: "plan-por-evento",
      title: "Plan por evento",
      blocks: [
        p("Los planes no se asignan globalmente a toda la cuenta."),
        p("Una misma persona puede administrar distintos eventos con planes diferentes."),
        p("La compra de Premium para un evento no convierte automáticamente otros eventos de la misma cuenta en Premium."),
      ],
    },
    {
      id: "procesamiento-pago",
      title: "Procesamiento del pago",
      blocks: [
        p("Los pagos son procesados mediante Stripe."),
        p("Hilo Luna no almacena el número completo de tarjeta ni el CVC."),
        p("El plan se activa una vez que el pago haya sido confirmado correctamente por el proveedor de pagos y registrado por Hilo Luna."),
        p("Una pantalla de «pago exitoso» por sí sola no constituye confirmación definitiva si la transacción todavía no ha sido validada."),
      ],
    },
    {
      id: "acceso-temporal",
      title: "Acceso temporal del evento",
      blocks: [
        p("Los eventos de pago disponen de acceso durante el periodo indicado en la Plataforma."),
        p("Actualmente, la fecha mínima de acceso pagado se calcula de forma que cubra el evento y, en condiciones ordinarias, permanezca disponible hasta 30 días después de la fecha del evento."),
        p("Si la fecha del evento se modifica hacia una fecha posterior, Hilo Luna puede extender el periodo de acceso correspondiente."),
        p("Mover un evento hacia una fecha anterior no reduce automáticamente el periodo de acceso que ya había sido otorgado."),
        p("Al terminar el periodo de acceso público, la invitación puede dejar de estar disponible públicamente."),
        p("La expiración no implica necesariamente la eliminación inmediata de los datos."),
      ],
    },
    {
      id: "cancelacion-usuario",
      title: "Cancelación del evento por el usuario",
      blocks: [
        p("Cancelar, posponer o dejar de celebrar el evento no cancela automáticamente una compra ya procesada."),
        p("Si el evento cambia de fecha, la persona usuaria puede actualizar la información desde la Plataforma de acuerdo con las funciones disponibles."),
      ],
    },
    {
      id: "reembolsos",
      title: "Reembolsos",
      blocks: [
        p("Las solicitudes de reembolso se analizarán conforme a la legislación aplicable, las circunstancias de la compra y el estado de prestación del servicio."),
        p(`Para solicitar aclaración o reembolso: ${SUPPORT_EMAIL}`),
        p("Nada en estos Términos limita los derechos irrenunciables que correspondan a las personas consumidoras conforme a la legislación mexicana."),
        p(
          "No se considerará reembolso automático el simple hecho de que la persona usuaria decida no utilizar una invitación después de que el servicio haya sido correctamente habilitado, sin perjuicio de los derechos que legalmente procedan.",
        ),
      ],
    },
    {
      id: "facturacion",
      title: "Facturación",
      blocks: [
        p("Cuando legalmente corresponda y el usuario solicite comprobante fiscal, deberá proporcionar los datos fiscales necesarios conforme a las reglas vigentes."),
        p("Los recibos o confirmaciones emitidos por Stripe o Hilo Luna no sustituyen un CFDI cuando éste sea legalmente requerido."),
        p("Las instrucciones vigentes para solicitar facturación podrán publicarse en la Plataforma o proporcionarse por soporte."),
      ],
    },
    {
      id: "contenido-usuario",
      title: "Contenido del usuario",
      blocks: [
        p("Las fotografías, textos, nombres, ubicaciones, música, enlaces, imágenes, información de invitados y demás materiales cargados por la persona usuaria continúan perteneciendo a sus respectivos titulares."),
        p(
          "La persona usuaria concede a Hilo Luna una autorización limitada, no exclusiva y durante el tiempo necesario para: almacenar, procesar, transformar técnicamente, reproducir y mostrar dicho contenido únicamente para prestar, operar y proteger el servicio.",
        ),
        p("Hilo Luna no adquiere la propiedad del contenido por el hecho de ser cargado."),
      ],
    },
    {
      id: "responsabilidad-contenido",
      title: "Responsabilidad sobre el contenido",
      blocks: [
        p("La persona usuaria declara que cuenta con los derechos, autorizaciones o bases legales necesarias para utilizar el contenido que cargue."),
        p("Esto incluye fotografías, música, marcas, datos personales de invitados y material protegido por derechos de autor."),
        p("La persona usuaria no debe cargar contenido que infrinja derechos de terceros."),
      ],
    },
    {
      id: "datos-invitados",
      title: "Datos de invitados",
      blocks: [
        p("Quien administra un evento es responsable de utilizar de manera lícita los datos de sus invitados y de no solicitar información excesiva o innecesaria."),
        p("Hilo Luna proporciona herramientas tecnológicas para gestionar invitados y RSVP, pero ello no sustituye las obligaciones legales que correspondan al anfitrión respecto de la información que decide recabar."),
      ],
    },
    {
      id: "contenido-prohibido",
      title: "Contenido prohibido",
      blocks: [
        p("No podrá utilizarse Hilo Luna para:"),
        ul([
          "actividades ilegales",
          "suplantación de identidad",
          "fraude",
          "distribución de malware",
          "vulneración deliberada de sistemas",
          "contenido que infrinja derechos de propiedad intelectual",
          "publicación no autorizada de datos personales",
          "explotación o abuso de menores",
          "cualquier otra actividad prohibida por la legislación aplicable",
        ]),
        p("Hilo Luna podrá limitar o suspender contenido cuando sea razonablemente necesario para atender una obligación legal, proteger la seguridad o evitar daños."),
      ],
    },
    {
      id: "invitaciones-publicas",
      title: "Invitaciones públicas",
      blocks: [
        p("Al publicar una invitación, la persona usuaria entiende que cualquier persona que conozca la URL pública puede acceder al contenido público de esa invitación mientras esté disponible."),
        p("Los enlaces personalizados de invitados no deben publicarse de manera indiscriminada, pues permiten asociar una visita con un invitado concreto."),
      ],
    },
    {
      id: "disponibilidad-servicio",
      title: "Disponibilidad del servicio",
      blocks: [
        p("Hilo Luna realizará esfuerzos razonables para mantener la Plataforma disponible y segura."),
        p("Sin embargo, pueden presentarse interrupciones temporales por: mantenimiento, actualizaciones, fallos de proveedores, Internet, servicios de terceros, fuerza mayor, incidentes de seguridad u otras circunstancias técnicas."),
        p("Hilo Luna no promete disponibilidad ininterrumpida del 100%."),
        p("Cuando una interrupción imputable a Hilo Luna afecte de manera sustancial la prestación contratada, se analizarán los remedios que correspondan conforme a la legislación aplicable."),
      ],
    },
    {
      id: "servicios-terceros",
      title: "Servicios de terceros",
      blocks: [
        p("Hilo Luna depende parcialmente de servicios proporcionados por terceros, entre ellos infraestructura de alojamiento, autenticación, pagos, almacenamiento y correo."),
        p("Estos servicios pueden contar con sus propios términos y políticas."),
        p("La utilización de dichos proveedores no elimina las responsabilidades que legalmente correspondan a Hilo Luna."),
      ],
    },
    {
      id: "propiedad-intelectual",
      title: "Propiedad intelectual de Hilo Luna",
      blocks: [
        p(
          "La marca Hilo Luna, diseño de la Plataforma, software, interfaces, componentes visuales propios, plantillas originales, textos, código y demás materiales creados por Hilo Luna están protegidos por las leyes aplicables de propiedad intelectual.",
        ),
        p("La compra de un plan no transfiere la propiedad del software ni de las plantillas."),
        p("Se concede únicamente el derecho de utilizar las funciones contratadas para el evento correspondiente."),
      ],
    },
    {
      id: "plantillas",
      title: "Plantillas",
      blocks: [
        p("Las plantillas pueden evolucionar técnicamente con el tiempo."),
        p("Hilo Luna utiliza mecanismos destinados a conservar estable el contenido de invitaciones ya publicadas."),
        p("Hilo Luna podrá retirar una plantilla para nuevas invitaciones sin que ello implique necesariamente retirar invitaciones ya publicadas que la utilicen."),
      ],
    },
    {
      id: "seguridad",
      title: "Seguridad",
      blocks: [
        p("La persona usuaria no deberá intentar: obtener acceso no autorizado, evadir límites, utilizar credenciales ajenas, interferir con la operación, automatizar abusivamente solicitudes o explotar vulnerabilidades."),
        p(`Si detecta una vulnerabilidad, deberá comunicarla a ${SUPPORT_EMAIL} y evitar explotarla.`),
      ],
    },
    {
      id: "limitacion-responsabilidad",
      title: "Limitación de responsabilidad",
      blocks: [
        p(
          "En la medida permitida por la legislación aplicable, Hilo Luna no será responsable por daños derivados exclusivamente de: información incorrecta proporcionada por la persona usuaria; contenido subido sin autorización; difusión voluntaria de enlaces personalizados; fallas atribuibles a la conexión o dispositivo del usuario; o actos de terceros fuera del control razonable de Hilo Luna.",
        ),
        p("Esta cláusula no excluye responsabilidades que por ley no puedan limitarse ni los derechos irrenunciables de las personas consumidoras."),
      ],
    },
    {
      id: "modificaciones-servicio",
      title: "Modificaciones del servicio",
      blocks: [
        p("Hilo Luna puede realizar cambios técnicos, mejoras, correcciones o modificaciones razonables para mantener la seguridad, funcionamiento o evolución de la Plataforma."),
        p("No se eliminarán deliberadamente derechos ya adquiridos mediante una compra únicamente para obligar al usuario a realizar una nueva compra."),
      ],
    },
    {
      id: "modificacion-terminos",
      title: "Modificación de estos Términos",
      blocks: [
        p("Podremos actualizar estos Términos por razones legales, técnicas o comerciales."),
        p("Los cambios materiales se publicarán en hiloluna.com/terms y, cuando corresponda, se comunicarán dentro de la Plataforma o por correo."),
        p("Las modificaciones no se aplicarán retroactivamente para eliminar derechos de una compra ya realizada, salvo que una disposición legal requiera lo contrario."),
      ],
    },
    {
      id: "terminacion",
      title: "Terminación",
      blocks: [
        p("La persona usuaria puede dejar de utilizar Hilo Luna en cualquier momento."),
        p("Hilo Luna puede suspender el acceso cuando exista una violación material de estos Términos, fraude, abuso, riesgo de seguridad o requerimiento legal."),
        p("Cuando sea razonablemente posible, se procurará informar a la persona usuaria."),
      ],
    },
    {
      id: "legislacion-aplicable",
      title: "Legislación aplicable",
      blocks: [
        p("Estos Términos se interpretarán conforme a las leyes de los Estados Unidos Mexicanos."),
        p(
          "Las personas consumidoras conservan los derechos y mecanismos de reclamación previstos por la Ley Federal de Protección al Consumidor y pueden acudir a las autoridades competentes, incluida la Procuraduría Federal del Consumidor, cuando resulte procedente.",
        ),
        p("Nada en estos Términos constituye una renuncia a derechos irrenunciables reconocidos por la legislación aplicable."),
      ],
    },
    {
      id: "contacto",
      title: "Contacto y aclaraciones",
      blocks: [
        p("Para soporte, reclamaciones, aclaraciones de compra o información sobre el servicio:"),
        p(siteConfig.name),
        p(`Responsable: ${RESPONSIBLE_NAME}`),
        p(`Domicilio: ${RESPONSIBLE_ADDRESS}`),
        p(`Correo: ${SUPPORT_EMAIL}`),
      ],
    },
  ],
};
