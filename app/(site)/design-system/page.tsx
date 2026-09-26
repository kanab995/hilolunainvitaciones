import type { Metadata } from "next";
import {
  ChartColumn,
  Inbox,
  LayoutGrid,
  Mail,
  Pencil,
  Settings,
  Share2,
  Users,
  House,
  Search,
} from "lucide-react";
import { ActivityCard, ActivityItem } from "@/components/dashboard/activity-card";
import { ShortcutCard } from "@/components/dashboard/shortcut-card";
import { StatusCard, StatusCardSkeleton } from "@/components/dashboard/status-card";
import { DsBlock, DsSection } from "@/components/design-system/ds-section";
import {
  DialogDemo,
  DropdownDemo,
  FieldsDemo,
  SelectsDemo,
  TabsDemo,
  TogglesDemo,
} from "@/components/design-system/interactive-demos";
import { TokenValue } from "@/components/design-system/token-value";
import { Breadcrumbs, NavBar, NavLink, SidebarItem, SidebarNav } from "@/components/layout/navigation";
import { Wordmark } from "@/components/layout/wordmark";
import { TemplateCard, TemplateCardSkeleton } from "@/components/templates/template-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { CardSkeleton, LoadingState } from "@/components/ui/loading-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Eyebrow, Heading, Numeral, Text } from "@/components/ui/typography";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Design System",
  robots: { index: false, follow: false },
};

const sections = [
  ["tokens", "Tokens"],
  ["typography", "Tipografía"],
  ["buttons", "Botones"],
  ["forms", "Inputs y textareas"],
  ["selects", "Selects"],
  ["toggles", "Checkbox y switch"],
  ["tabs", "Tabs"],
  ["badges", "Badges"],
  ["cards", "Cards"],
  ["modal", "Modal"],
  ["dropdown", "Dropdown"],
  ["navigation", "Navegación"],
  ["headings", "Section headings"],
  ["template-cards", "Template cards"],
  ["dashboard-cards", "Dashboard cards"],
  ["status-cards", "Status cards"],
  ["empty", "Empty states"],
  ["loading", "Loading states"],
] as const;

const colorGroups: ReadonlyArray<{ title: string; tokens: readonly string[] }> = [
  {
    title: "Superficies",
    tokens: [
      "--lu-canvas",
      "--lu-surface",
      "--lu-surface-muted",
      "--lu-surface-tint",
      "--lu-selected",
      "--lu-nav-active",
      "--lu-section-band",
    ],
  },
  {
    title: "Tinta y texto",
    tokens: [
      "--lu-ink",
      "--lu-on-ink",
      "--lu-text",
      "--lu-text-secondary",
      "--lu-text-muted",
      "--lu-text-subtle",
      "--lu-eyebrow",
    ],
  },
  {
    title: "Marca y acento",
    tokens: [
      "--lu-brown-400",
      "--lu-brown-500",
      "--lu-brown-600",
      "--lu-brown-900",
      "--lu-blush",
      "--lu-blush-soft",
      "--lu-sage",
    ],
  },
  {
    title: "Bordes",
    tokens: ["--lu-border-subtle", "--lu-border", "--lu-border-outline", "--lu-border-strong"],
  },
  {
    title: "Feedback funcional (solo errores; nunca decorativo)",
    tokens: ["--lu-error", "--lu-error-bg"],
  },
  {
    title: "Estados",
    tokens: [
      "--lu-success",
      "--lu-success-bg",
      "--lu-pending",
      "--lu-pending-bg",
      "--lu-declined-bg",
    ],
  },
];

const serifScale = [
  { token: "display-xl", cls: "text-lu-display-xl", spec: "108 / 0.95 · fluido", use: "Título de plantilla / galería" },
  { token: "display-lg", cls: "text-lu-display-lg", spec: "72 / 1.0 · fluido", use: "Título de página del dashboard" },
  { token: "display-md", cls: "text-lu-display-md", spec: "60 / 1.05 · fluido", use: "Hero del home" },
  { token: "title-xl", cls: "text-lu-title-xl", spec: "48 / 1.05 · fluido", use: "Título del panel del editor" },
  { token: "h2", cls: "text-lu-h2", spec: "40 / 1.15 · fluido", use: "Título de sección" },
  { token: "h3", cls: "text-lu-h3", spec: "28 / 1.2 · fluido", use: "Título de tarjeta grande" },
  { token: "title-lg", cls: "text-lu-title-lg", spec: "26 / 1.2", use: "Nombre de plantilla" },
  { token: "title-md", cls: "text-lu-title-md", spec: "22 / 1.25", use: "Título de tarjeta" },
  { token: "title-sm", cls: "text-lu-title-sm", spec: "18 / 1.3", use: "Filas, etiquetas serif" },
] as const;

const sansScale = [
  { token: "lg", cls: "text-lu-lg", spec: "18 / 1.55", use: "Lead" },
  { token: "md", cls: "text-lu-md", spec: "16 / 1.625", use: "Párrafo de marketing" },
  { token: "base", cls: "text-lu-base", spec: "15 / 1.45", use: "Cuerpo, navegación, inputs" },
  { token: "ui", cls: "text-lu-ui", spec: "14 / 1.4", use: "Botones md, sidebar" },
  { token: "sm", cls: "text-lu-sm", spec: "13 / 1.4", use: "UI del workspace, etiquetas" },
  { token: "xs", cls: "text-lu-xs", spec: "12 / 1.35", use: "Captions (mínimo accesible)" },
] as const;

const radii = [
  ["--lu-radius-xs", "4", "Checkbox"],
  ["--lu-radius-input", "8", "Inputs, selects"],
  ["--lu-radius-button", "10", "Botón sm/md"],
  ["--lu-radius-button-lg", "12", "Botón lg"],
  ["--lu-radius-button-xl", "16", "Botón xl"],
  ["--lu-radius-image", "10", "Foto en tarjeta"],
  ["--lu-radius-card", "14", "Tarjetas, menús"],
  ["--lu-radius-modal", "16", "Modal"],
  ["--lu-radius-banner", "20", "Banners"],
  ["--lu-radius-pill", "999", "Chips, segmented, CTA navbar, badges"],
] as const;

const shadows = [
  ["shadow-lu-card", "Tarjeta"],
  ["shadow-lu-card-hover", "Tarjeta (hover)"],
  ["shadow-lu-float", "Menús y popovers"],
  ["shadow-lu-modal", "Modal"],
] as const;

const spacing = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96] as const;

const containers = [
  ["Página (contenedor)", "1440", "w-full"],
  ["Contenido de página @1440", "1312", "w-[91%]"],
  ["Lectura (prose)", "512", "w-[36%]"],
  ["Modal lg", "640", "w-[44%]"],
  ["Modal md", "512", "w-[36%]"],
  ["Modal sm", "416", "w-[29%]"],
] as const;

export default function DesignSystemPage() {
  return (
    <div data-layout="design-system">
      <header className="lu-container flex h-20 items-center justify-between gap-6">
        <Wordmark href={routes.home} />
        <Badge tone="outline">Ruta interna · no indexada</Badge>
      </header>

      <main id="main" className="lu-container pb-24">
        <div className="flex flex-col gap-5 pt-8 pb-12">
          <Eyebrow>Sistema visual</Eyebrow>
          <Heading as="h1" size="display-lg">
            Design <em className="italic">System</em>
          </Heading>
          <Text size="md" tone="muted" className="max-w-(--lu-prose-max)">
            Todos los componentes reutilizables y sus estados, construidos con los tokens medidos de
            los mockups. Cada valor sale de las variables <code className="font-mono">--lu-*</code>.
          </Text>
          <nav aria-label="Secciones" className="mt-3 flex flex-wrap gap-2">
            {sections.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="inline-flex h-9 items-center rounded-lu-pill border border-lu-border-subtle bg-lu-surface px-4 text-lu-sm text-lu-text-secondary transition-colors hover:border-lu-border hover:text-lu-text"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>

        {/* ───────── Tokens ───────── */}
        <DsSection
          id="tokens"
          eyebrow="Fundamentos"
          title="Tokens"
          description="Color, radio, sombra, espaciado y anchos. Los valores se leen en vivo desde el CSS."
        >
          {colorGroups.map((group) => (
            <DsBlock key={group.title} label={group.title}>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
                {group.tokens.map((token) => (
                  <div key={token} className="flex flex-col gap-2">
                    <div
                      className="h-16 rounded-lu-input border border-lu-border-subtle"
                      style={{ background: `var(${token})` }}
                    />
                    <span className="text-lu-xs font-medium break-all text-lu-text">{token}</span>
                    <TokenValue name={token} />
                  </div>
                ))}
              </div>
            </DsBlock>
          ))}

          <DsBlock label="Radios">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {radii.map(([token, px, use]) => (
                <div key={token} className="flex flex-col gap-2">
                  <div
                    className="h-20 border border-lu-border bg-lu-surface-tint"
                    style={{ borderRadius: `var(${token})` }}
                  />
                  <span className="text-lu-xs font-medium text-lu-text">{token}</span>
                  <span className="text-lu-xs text-lu-text-muted">
                    {px} px · {use}
                  </span>
                </div>
              ))}
            </div>
          </DsBlock>

          <DsBlock label="Sombras y bordes">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {shadows.map(([cls, use]) => (
                <div key={cls} className="flex flex-col gap-3">
                  <div
                    className={`h-24 rounded-lu-card border border-lu-border-subtle bg-lu-surface ${cls}`}
                  />
                  <span className="text-lu-xs font-medium text-lu-text">{cls}</span>
                  <span className="text-lu-xs text-lu-text-muted">{use}</span>
                </div>
              ))}
              <div className="flex flex-col gap-3">
                <div className="h-24 rounded-lu-card border-2 border-lu-brown-600 bg-lu-surface" />
                <span className="text-lu-xs font-medium text-lu-text">borde 2 px · selección</span>
                <span className="text-lu-xs text-lu-text-muted">Filete normal: 1 px</span>
              </div>
            </div>
          </DsBlock>

          <DsBlock label="Escala de espaciado (base 4 px)">
            <div className="flex flex-col gap-2">
              {spacing.map((px) => (
                <div key={px} className="flex items-center gap-4">
                  <span className="w-12 text-lu-xs tabular-nums text-lu-text-muted">{px} px</span>
                  <div
                    className="h-3 rounded-lu-xs bg-lu-brown-400/70"
                    style={{ width: `${px}px` }}
                  />
                </div>
              ))}
            </div>
          </DsBlock>

          <DsBlock label="Anchos de contenedor">
            <div className="flex flex-col gap-3">
              {containers.map(([label, px, width]) => (
                <div key={label} className="flex items-center gap-4">
                  <span className="w-56 shrink-0 text-lu-xs text-lu-text-muted">{label}</span>
                  <div className="flex-1">
                    <div className={`flex h-7 items-center rounded-lu-xs bg-lu-surface-tint px-2 ${width}`}>
                      <span className="text-lu-xs tabular-nums text-lu-text-secondary">{px} px</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DsBlock>
        </DsSection>

        {/* ───────── Tipografía ───────── */}
        <DsSection
          id="typography"
          eyebrow="Fundamentos"
          title="Tipografía"
          description="Serif editorial (Cormorant Garamond) para titulares y cifras; sans limpia (Inter) para interfaz."
        >
          <DsBlock label="Serif · Cormorant Garamond 500">
            <div className="flex flex-col divide-y divide-lu-border-subtle">
              {serifScale.map((row) => (
                <div key={row.token} className="grid gap-2 py-5 md:grid-cols-[14rem_1fr] md:items-baseline">
                  <div className="flex flex-col">
                    <span className="text-lu-sm font-medium text-lu-text">{row.token}</span>
                    <span className="text-lu-xs text-lu-text-muted">{row.spec}</span>
                    <span className="text-lu-xs text-lu-text-subtle">{row.use}</span>
                  </div>
                  <p className={`font-lu-display text-lu-text ${row.cls}`}>
                    Tu evento merece una <em className="italic">invitación</em>
                  </p>
                </div>
              ))}
            </div>
          </DsBlock>

          <DsBlock label="Sans · Inter">
            <div className="flex flex-col divide-y divide-lu-border-subtle">
              {sansScale.map((row) => (
                <div key={row.token} className="grid gap-2 py-4 md:grid-cols-[14rem_1fr] md:items-baseline">
                  <div className="flex flex-col">
                    <span className="text-lu-sm font-medium text-lu-text">{row.token}</span>
                    <span className="text-lu-xs text-lu-text-muted">{row.spec}</span>
                    <span className="text-lu-xs text-lu-text-subtle">{row.use}</span>
                  </div>
                  <p className={`text-lu-text-secondary ${row.cls}`}>
                    Crea, personaliza y comparte invitaciones digitales para bodas, XV años y más.
                  </p>
                </div>
              ))}
            </div>
          </DsBlock>

          <DsBlock label="Eyebrow · cifras · énfasis">
            <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
              <Eyebrow>Editando sección</Eyebrow>
              <Numeral>108</Numeral>
              <Numeral size="lg">01</Numeral>
              <Heading size="h2">
                Todo lo que necesitas en una <em className="italic">sola invitación</em>
              </Heading>
            </div>
          </DsBlock>
        </DsSection>

        {/* ───────── Botones ───────── */}
        <DsSection
          id="buttons"
          eyebrow="Acciones"
          title="Botones"
          description="Rectángulo de esquinas moderadas: radio 10 (md), 12 (lg) y 16 (xl). Alturas 40 · 44 · 54 · 64. La forma píldora es una excepción para el CTA de la navbar."
        >
          <DsBlock label="Variantes × tamaños">
            <div className="flex flex-col gap-5">
              {(["primary", "secondary", "ghost"] as const).map((variant) => (
                <div key={variant} className="flex flex-wrap items-center gap-4">
                  <span className="w-24 text-lu-xs text-lu-text-muted">{variant}</span>
                  <Button variant={variant} size="sm">Pequeño</Button>
                  <Button variant={variant} size="md">Mediano</Button>
                  <Button variant={variant} size="lg">Grande</Button>
                  <Button variant={variant} size="xl">Extra grande</Button>
                </div>
              ))}
            </div>
          </DsBlock>

          <DsBlock label="Con flecha (patrón de los CTA)">
            <div className="flex flex-wrap items-center gap-4">
              <Button arrow>Crear invitación</Button>
              <Button size="lg" arrow>Crear mi invitación</Button>
              <Button size="lg" variant="secondary">Ver plantillas</Button>
              <Button variant="secondary" size="sm" arrow>Ver todas las plantillas</Button>
              <Button variant="ghost" size="sm" arrow>Ver toda la actividad</Button>
            </div>
          </DsBlock>

          <DsBlock label="Forma píldora (excepción: CTA primario de la navbar) · chips y segmented también son píldora">
            <div className="flex flex-wrap items-center gap-4">
              <Button shape="pill" arrow>Crear invitación</Button>
              <Button shape="pill" variant="secondary">Entrar</Button>
            </div>
          </DsBlock>

          <DsBlock label="Etiqueta serif (solo detalle de plantilla, mockup 03)">
            <div className="flex max-w-xl flex-col gap-3">
              <Button size="xl" font="serif" fullWidth arrow>Usar esta plantilla</Button>
              <Button size="xl" font="serif" variant="secondary" fullWidth>Ver invitación completa</Button>
            </div>
          </DsBlock>

          <DsBlock label="Estados">
            <div className="flex flex-wrap items-center gap-4">
              <Button>Normal</Button>
              <Button loading>Guardando</Button>
              <Button disabled>Deshabilitado</Button>
              <Button variant="secondary" loading>Guardando</Button>
              <Button variant="secondary" disabled>Deshabilitado</Button>
              <Button variant="ghost" disabled>Deshabilitado</Button>
            </div>
            <Text size="sm" tone="muted">
              Hover y foco: pasa el ratón o usa Tab sobre cualquier botón (anillo marrón 600 de 2 px).
            </Text>
          </DsBlock>

          <DsBlock label="Botón de ícono">
            <div className="flex flex-wrap items-center gap-4">
              <IconButton aria-label="Siguiente" size="sm" />
              <IconButton aria-label="Siguiente" />
              <IconButton aria-label="Siguiente" size="lg" />
              <IconButton aria-label="Editar" variant="solid" shape="square"><Pencil /></IconButton>
              <IconButton aria-label="Buscar" variant="ghost"><Search /></IconButton>
              <IconButton aria-label="Compartir" shape="square"><Share2 /></IconButton>
              <IconButton aria-label="Deshabilitado" disabled />
            </div>
          </DsBlock>
        </DsSection>

        {/* ───────── Inputs ───────── */}
        <DsSection
          id="forms"
          eyebrow="Formularios"
          title="Inputs y textareas"
          description="Altura 44, radio 8, borde de 1 px. Valores en serif disponibles para el editor. Los errores usan los tokens de feedback --lu-error / --lu-error-bg."
        >
          <FieldsDemo />
        </DsSection>

        <DsSection id="selects" eyebrow="Formularios" title="Selects">
          <SelectsDemo />
        </DsSection>

        <DsSection id="toggles" eyebrow="Formularios" title="Checkbox y switch">
          <TogglesDemo />
        </DsSection>

        {/* ───────── Tabs ───────── */}
        <DsSection
          id="tabs"
          eyebrow="Navegación"
          title="Tabs"
          description="Subrayado tostado (navegación) y segmentado (Móvil / Escritorio)."
        >
          <TabsDemo />
        </DsSection>

        {/* ───────── Badges ───────── */}
        <DsSection id="badges" eyebrow="Datos" title="Badges" description="Etiquetas y estados de RSVP.">
          <DsBlock label="Tonos">
            <div className="flex flex-wrap items-center gap-3">
              <Badge>Neutral</Badge>
              <Badge tone="outline">Contorno</Badge>
              <Badge tone="accent">Acento blush</Badge>
              <Badge tone="ink">Tinta</Badge>
              <Badge tone="success" dot>Confirmado</Badge>
              <Badge tone="pending" dot>Pendiente</Badge>
              <Badge tone="declined" dot>No asistirá</Badge>
            </div>
          </DsBlock>
          <DsBlock label="Tamaño md">
            <div className="flex flex-wrap items-center gap-3">
              <Badge size="md">Boda</Badge>
              <Badge size="md" tone="accent">Floral</Badge>
              <Badge size="md" tone="success" dot>Confirmado</Badge>
              <Badge size="md" tone="pending" dot>Pendiente</Badge>
              <Badge size="md" tone="declined" dot>No asistirá</Badge>
            </div>
          </DsBlock>
        </DsSection>

        {/* ───────── Cards ───────── */}
        <DsSection
          id="cards"
          eyebrow="Superficies"
          title="Cards"
          description="Se separan del fondo con un filete de 1 px y una sombra muy suave; radio 14."
        >
          <div className="grid gap-(--lu-gap-grid-lg) md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardTitle>Por defecto</CardTitle>
              <CardDescription className="mt-2">Filete + sombra suave.</CardDescription>
            </Card>
            <Card variant="flat">
              <CardTitle>Plana</CardTitle>
              <CardDescription className="mt-2">Solo filete, sin sombra.</CardDescription>
            </Card>
            <Card variant="tint">
              <CardTitle>Teñida</CardTitle>
              <CardDescription className="mt-2">Superficie teñida, sin borde.</CardDescription>
            </Card>
            <Card interactive>
              <CardTitle>Interactiva</CardTitle>
              <CardDescription className="mt-2">Eleva la sombra al pasar el ratón.</CardDescription>
            </Card>
          </div>
          <DsBlock label="Anatomía">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle>Título de la tarjeta</CardTitle>
                <CardDescription>Descripción breve que explica el contenido.</CardDescription>
              </CardHeader>
              <CardContent>
                <Text size="sm">Contenido principal de la tarjeta.</Text>
              </CardContent>
              <CardFooter>
                <Button size="sm">Aceptar</Button>
                <Button size="sm" variant="ghost">Cancelar</Button>
              </CardFooter>
            </Card>
          </DsBlock>
        </DsSection>

        {/* ───────── Modal / Dropdown ───────── */}
        <DsSection
          id="modal"
          eyebrow="Superposiciones"
          title="Modal"
          description="Velo de tinta al 40 % sin desenfoque, radio 16. Cierra con la X, Escape o el velo."
        >
          <DialogDemo />
        </DsSection>

        <DsSection id="dropdown" eyebrow="Superposiciones" title="Dropdown">
          <div>
            <DropdownDemo />
          </div>
        </DsSection>

        {/* ───────── Navegación ───────── */}
        <DsSection
          id="navigation"
          eyebrow="Navegación"
          title="Navegación"
          description="Barra superior de marketing, sidebar del dashboard y migas de pan."
        >
          <DsBlock label="Navbar de marketing">
            <div className="overflow-hidden rounded-lu-card border border-lu-border-subtle bg-lu-canvas">
              <NavBar
                brand={<Wordmark />}
                links={
                  <>
                    <NavLink href="#navigation" active>Plantillas</NavLink>
                    <NavLink href="#navigation">Cómo funciona</NavLink>
                    <NavLink href="#navigation">Precios</NavLink>
                    <NavLink href="#navigation">Entrar</NavLink>
                  </>
                }
                actions={<Button shape="pill" arrow>Crear invitación</Button>}
              />
            </div>
          </DsBlock>

          <div className="grid gap-10 md:grid-cols-2">
            <DsBlock label="Sidebar del dashboard">
              <div className="w-64 rounded-lu-card border border-lu-border-subtle bg-lu-surface-muted p-4">
                <SidebarNav label="Dashboard (demo)">
                  <SidebarItem href="#navigation" active icon={<House />}>Mis eventos</SidebarItem>
                  <SidebarItem href="#navigation" icon={<LayoutGrid />}>Plantillas</SidebarItem>
                  <SidebarItem href="#navigation" icon={<Users />}>Lista de invitados</SidebarItem>
                  <SidebarItem href="#navigation" icon={<ChartColumn />}>Confirmaciones</SidebarItem>
                  <SidebarItem href="#navigation" icon={<Mail />}>Mensajes</SidebarItem>
                  <SidebarItem href="#navigation" icon={<Settings />}>Configuración</SidebarItem>
                </SidebarNav>
              </div>
            </DsBlock>

            <div className="flex flex-col gap-10">
              <DsBlock label="Migas · chevron (03, 05)">
                <Breadcrumbs
                  items={[
                    { label: "Mis eventos", href: routes.events },
                    { label: "Andrea & Fernando" },
                  ]}
                />
              </DsBlock>
              <DsBlock label="Migas · barra (04)">
                <Breadcrumbs
                  separator="slash"
                  items={[
                    { label: "Mis eventos", href: routes.events },
                    { label: "Boda de Andrea & Fernando" },
                  ]}
                />
              </DsBlock>
            </div>
          </div>
        </DsSection>

        {/* ───────── Section headings ───────── */}
        <DsSection
          id="headings"
          eyebrow="Editorial"
          title="Section headings"
          description="Eyebrow opcional, titular serif con una palabra en cursiva (entre asteriscos) y subtítulo."
        >
          <div className="grid gap-12 md:grid-cols-2">
            <SectionHeading
              eyebrow="Diseños para momentos inolvidables"
              title="Encuentra un diseño que se sienta *como tú*"
              description="Explora nuestra colección de invitaciones digitales, creadas para cada historia."
              size="display-md"
            />
            <SectionHeading
              align="center"
              title="Elige el momento que estás *celebrando*"
              description="Diseños para cada tipo de celebración"
              size="h2"
            />
            <SectionHeading eyebrow="Editando sección" title="Portada" size="title-xl" />
            <SectionHeading title="Actividad *reciente*" size="h3" />
          </div>
        </DsSection>

        {/* ───────── Template cards ───────── */}
        <DsSection
          id="template-cards"
          eyebrow="Plantillas"
          title="Template cards"
          description="Un solo componente para home, galería y «otros diseños». Sin imagen: bloque vacío (no hay assets con licencia registrada aún)."
        >
          <div className="grid gap-(--lu-gap-grid) sm:grid-cols-2 lg:grid-cols-3">
            <TemplateCard href={routes.template("magnolia")} name="Magnolia" category="Boda" styles={["Floral"]} />
            <TemplateCard href={routes.template("ivory")} name="Ivory" category="Boda" styles={["Minimal", "Elegante"]} />
            <TemplateCard href={routes.template("etoile")} name="Étoile" category="XV años" styles={["Elegante"]} />
          </div>
          <DsBlock label="Cargando">
            <div className="grid gap-(--lu-gap-grid) sm:grid-cols-2 lg:grid-cols-3">
              <TemplateCardSkeleton />
              <TemplateCardSkeleton className="hidden sm:block" />
              <TemplateCardSkeleton className="hidden lg:block" />
            </div>
          </DsBlock>
        </DsSection>

        {/* ───────── Dashboard cards ───────── */}
        <DsSection
          id="dashboard-cards"
          eyebrow="Dashboard"
          title="Dashboard cards"
          description="Atajos con ícono, título serif y flecha circular, y la tarjeta de actividad reciente."
        >
          <div className="grid gap-(--lu-gap-grid) md:grid-cols-2 lg:grid-cols-4">
            <ShortcutCard
              href={routes.eventEdit("demo")}
              icon={<Pencil />}
              title="Editar invitación"
              description="Personaliza textos, fotos, colores y todos los detalles de tu invitación."
            />
            <ShortcutCard
              href={routes.eventGuests("demo")}
              icon={<Users />}
              title="Invitados"
              description="Gestiona tu lista, agrega invitados y envía recordatorios."
            >
              <div className="flex gap-2">
                <Badge tone="success" dot>Confirmado</Badge>
                <Badge tone="pending" dot>Pendiente</Badge>
              </div>
            </ShortcutCard>
            <ShortcutCard
              href={routes.eventRsvp("demo")}
              icon={<ChartColumn />}
              title="Confirmaciones"
              description="Revisa en tiempo real las respuestas y estadísticas de tu evento."
            />
            <ShortcutCard
              href={routes.event("demo")}
              icon={<Share2 />}
              title="Compartir"
              description="Comparte tu invitación por WhatsApp, redes sociales o con un enlace directo."
            />
          </div>
          <div className="max-w-2xl">
            <ActivityCard title="Actividad reciente" action={{ label: "Ver toda la actividad", href: routes.events }}>
              <ActivityItem name="Ana Ruiz" action="confirmó asistencia" time="Hace 2 horas" />
              <ActivityItem name="Luis Pérez" action="confirmó 3 invitados" time="Hace 5 horas" />
              <ActivityItem name="Carla Soto" action="está revisando su invitación" time="Hace 1 día" />
              <ActivityItem name="Javier Díaz" action="no asistirá" time="Hace 2 días" />
            </ActivityCard>
          </div>
        </DsSection>

        {/* ───────── Status cards ───────── */}
        <DsSection
          id="status-cards"
          eyebrow="Dashboard"
          title="Status cards"
          description="Métricas de RSVP: salvia = confirmado, arena = pendiente, blush = no asistirá. «Tal vez» cuenta como pendiente."
        >
          <div className="grid gap-(--lu-gap-grid) md:grid-cols-3">
            <StatusCard tone="confirmed" value={108} label="Confirmados" />
            <StatusCard tone="pending" value={31} label="Pendientes" />
            <StatusCard tone="declined" value={17} label="No asistirán" />
          </div>
          <DsBlock label="Con enlace">
            <div className="grid gap-(--lu-gap-grid) md:grid-cols-3">
              <StatusCard tone="confirmed" value={108} label="Confirmados" href={routes.eventRsvp("demo")} />
              <StatusCard tone="pending" value={31} label="Pendientes" href={routes.eventRsvp("demo")} />
              <StatusCard tone="declined" value={17} label="No asistirán" href={routes.eventRsvp("demo")} />
            </div>
          </DsBlock>
          <DsBlock label="Cargando">
            <div className="grid gap-(--lu-gap-grid) md:grid-cols-3">
              <StatusCardSkeleton />
              <StatusCardSkeleton className="hidden md:flex" />
              <StatusCardSkeleton className="hidden md:flex" />
            </div>
          </DsBlock>
        </DsSection>

        {/* ───────── Empty states ───────── */}
        <DsSection
          id="empty"
          eyebrow="Estados"
          title="Empty states"
          description="Sin mockup: compuestos con ícono en contenedor suave, titular serif y una acción."
        >
          <div className="grid gap-(--lu-gap-grid-lg) md:grid-cols-2">
            <Card padding="none">
              <EmptyState
                icon={<Users />}
                title="Aún no tienes invitados"
                description="Agrega a tu primera persona o importa tu lista para empezar a recibir confirmaciones."
                action={<Button arrow>Agregar invitado</Button>}
              />
            </Card>
            <EmptyState
              variant="dashed"
              icon={<Inbox />}
              title="Sin actividad todavía"
              description="Cuando tus invitados abran o confirmen su invitación, lo verás aquí."
            />
          </div>
        </DsSection>

        {/* ───────── Loading states ───────── */}
        <DsSection
          id="loading"
          eyebrow="Estados"
          title="Loading states"
          description="Un solo tono, sin degradados ni shimmer: anillo giratorio y pulso de opacidad."
        >
          <DsBlock label="Spinner">
            <div className="flex items-center gap-6 text-lu-brown-500">
              <Spinner size={16} />
              <Spinner size={24} />
              <Spinner size={36} />
            </div>
          </DsBlock>
          <DsBlock label="Loading state">
            <Card padding="none" className="max-w-md">
              <LoadingState label="Cargando tus eventos…" />
            </Card>
          </DsBlock>
          <DsBlock label="Skeletons">
            <div className="grid gap-(--lu-gap-grid) md:grid-cols-3">
              <CardSkeleton />
              <CardSkeleton className="hidden md:flex" />
              <div className="hidden flex-col gap-3 md:flex">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="size-12 rounded-full" />
              </div>
            </div>
          </DsBlock>
        </DsSection>
      </main>
    </div>
  );
}
