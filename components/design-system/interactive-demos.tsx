"use client";

import { useState } from "react";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, fieldErrorId, fieldHintId } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

/* ───────── Campos con estado ───────── */

export function FieldsDemo() {
  const [title, setTitle] = useState("Nos casamos");
  const [story, setStory] = useState("");

  return (
    <div className="grid gap-x-6 gap-y-(--lu-gap-field) md:grid-cols-2">
      <Field
        htmlFor="ds-title"
        label="Título / frase principal"
        counter={{ value: title.length, max: 50 }}
      >
        <Input
          id="ds-title"
          tone="serif"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>
      <Field htmlFor="ds-email" label="Correo" hint="Lo usaremos solo para avisarte de confirmaciones.">
        <Input
          id="ds-email"
          type="email"
          placeholder="nombre@correo.com"
          aria-describedby={fieldHintId("ds-email")}
        />
      </Field>
      <Field htmlFor="ds-disabled" label="Deshabilitado">
        <Input id="ds-disabled" disabled defaultValue="No editable" />
      </Field>
      <Field
        htmlFor="ds-error"
        label="Con error"
        error="Escribe un nombre de al menos 3 caracteres."
      >
        <Input
          id="ds-error"
          invalid
          defaultValue="An"
          aria-describedby={fieldErrorId("ds-error")}
        />
      </Field>
      <Field htmlFor="ds-optional" label="Segundo nombre" optional>
        <Input id="ds-optional" placeholder="Opcional" />
      </Field>
      <Field htmlFor="ds-serif" label="Valor en serif (editor)">
        <Input id="ds-serif" tone="serif" defaultValue="Andrea" />
      </Field>
      <Field
        htmlFor="ds-story"
        label="Nuestra historia"
        counter={{ value: story.length, max: 300 }}
        hint="Cuéntales a tus invitados cómo empezó todo."
        className="md:col-span-2"
      >
        <Textarea
          id="ds-story"
          value={story}
          onChange={(event) => setStory(event.target.value)}
          placeholder="Hay momentos en la vida que se sienten distintos…"
          aria-describedby={fieldHintId("ds-story")}
        />
      </Field>
      <Field htmlFor="ds-textarea-error" label="Textarea con error" error="Este campo es obligatorio.">
        <Textarea
          id="ds-textarea-error"
          invalid
          aria-describedby={fieldErrorId("ds-textarea-error")}
        />
      </Field>
      <Field htmlFor="ds-textarea-disabled" label="Textarea deshabilitado">
        <Textarea id="ds-textarea-disabled" disabled defaultValue="No editable" />
      </Field>
    </div>
  );
}

/* ───────── Selects ───────── */

export function SelectsDemo() {
  return (
    <div className="grid gap-x-6 gap-y-(--lu-gap-field) md:grid-cols-3">
      <Field htmlFor="ds-select-style" label="Estilo">
        <Select defaultValue="todos">
          <SelectTrigger id="ds-select-style">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estilos</SelectItem>
            <SelectGroup>
              <SelectLabel>Estilos</SelectLabel>
              <SelectItem value="floral">Floral</SelectItem>
              <SelectItem value="minimal">Minimal</SelectItem>
              <SelectItem value="rustico">Rústico</SelectItem>
              <SelectItem value="moderno">Moderno</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field htmlFor="ds-select-placeholder" label="Con placeholder">
        <Select>
          <SelectTrigger id="ds-select-placeholder">
            <SelectValue placeholder="Elige una opción" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">Opción A</SelectItem>
            <SelectItem value="b">Opción B</SelectItem>
            <SelectItem value="c" disabled>
              Opción C (no disponible)
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field htmlFor="ds-select-disabled" label="Deshabilitado">
        <Select disabled defaultValue="a">
          <SelectTrigger id="ds-select-disabled">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">Opción A</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

/* ───────── Checkbox y Switch ───────── */

export function TogglesDemo() {
  const [overlay, setOverlay] = useState(true);
  const [terms, setTerms] = useState<boolean | "indeterminate">(false);

  return (
    <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
      <div className="flex flex-col gap-5">
        <label className="flex items-start gap-3">
          <Checkbox checked={terms} onCheckedChange={setTerms} className="mt-0.5" />
          <span className="flex flex-col">
            <span className="text-lu-base text-lu-text">Confirmo que tengo los derechos</span>
            <span className="text-lu-sm text-lu-text-muted">
              Necesario para subir audio propio a la invitación.
            </span>
          </span>
        </label>
        <label className="flex items-center gap-3">
          <Checkbox defaultChecked />
          <span className="text-lu-base text-lu-text">Marcado</span>
        </label>
        <label className="flex items-center gap-3">
          <Checkbox checked="indeterminate" />
          <span className="text-lu-base text-lu-text">Indeterminado</span>
        </label>
        <label className="flex items-center gap-3">
          <Checkbox disabled />
          <span className="text-lu-base text-lu-text-subtle">Deshabilitado</span>
        </label>
        <label className="flex items-center gap-3">
          <Checkbox disabled defaultChecked />
          <span className="text-lu-base text-lu-text-subtle">Deshabilitado marcado</span>
        </label>
      </div>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-6">
          <div className="flex flex-col">
            <label htmlFor="ds-switch-overlay" className="text-lu-base font-medium text-lu-text">
              Overlay en imagen
            </label>
            <span className="text-lu-sm text-lu-text-muted">
              Agregar un velo para mejorar la legibilidad del texto.
            </span>
          </div>
          <Switch id="ds-switch-overlay" checked={overlay} onCheckedChange={setOverlay} />
        </div>
        <div className="flex items-center justify-between gap-6">
          <label htmlFor="ds-switch-off" className="text-lu-base text-lu-text">
            Apagado
          </label>
          <Switch id="ds-switch-off" />
        </div>
        <div className="flex items-center justify-between gap-6">
          <label htmlFor="ds-switch-disabled" className="text-lu-base text-lu-text-subtle">
            Deshabilitado
          </label>
          <Switch id="ds-switch-disabled" disabled />
        </div>
        <div className="flex items-center justify-between gap-6">
          <label htmlFor="ds-switch-disabled-on" className="text-lu-base text-lu-text-subtle">
            Deshabilitado activo
          </label>
          <Switch id="ds-switch-disabled-on" disabled defaultChecked />
        </div>
      </div>
    </div>
  );
}

/* ───────── Tabs ───────── */

export function TabsDemo() {
  return (
    <div className="grid gap-10 md:grid-cols-2">
      <Tabs defaultValue="plantillas">
        <TabsList variant="underline" aria-label="Secciones (subrayado)">
          <TabsTrigger value="plantillas">Plantillas</TabsTrigger>
          <TabsTrigger value="como">Cómo funciona</TabsTrigger>
          <TabsTrigger value="precios">Precios</TabsTrigger>
          <TabsTrigger value="off" disabled>
            Deshabilitada
          </TabsTrigger>
        </TabsList>
        <TabsContent value="plantillas" className="text-lu-sm text-lu-text-secondary">
          Contenido de la pestaña «Plantillas».
        </TabsContent>
        <TabsContent value="como" className="text-lu-sm text-lu-text-secondary">
          Contenido de la pestaña «Cómo funciona».
        </TabsContent>
        <TabsContent value="precios" className="text-lu-sm text-lu-text-secondary">
          Contenido de la pestaña «Precios».
        </TabsContent>
      </Tabs>

      <Tabs defaultValue="movil">
        <TabsList variant="segmented" aria-label="Vista previa (segmentado)">
          <TabsTrigger value="movil">Móvil</TabsTrigger>
          <TabsTrigger value="escritorio">Escritorio</TabsTrigger>
        </TabsList>
        <TabsContent value="movil" className="text-lu-sm text-lu-text-secondary">
          Vista previa en formato móvil.
        </TabsContent>
        <TabsContent value="escritorio" className="text-lu-sm text-lu-text-secondary">
          Vista previa en formato escritorio.
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ───────── Modal ───────── */

export function DialogDemo() {
  const sizes = [
    { key: "sm", label: "Modal pequeño" },
    { key: "md", label: "Modal mediano" },
    { key: "lg", label: "Modal grande" },
  ] as const;

  return (
    <div className="flex flex-wrap gap-3">
      {sizes.map(({ key, label }) => (
        <Dialog key={key}>
          <DialogTrigger asChild>
            <Button variant="secondary">{label}</Button>
          </DialogTrigger>
          <DialogContent size={key}>
            <DialogHeader>
              <DialogTitle>¿Publicar tu invitación?</DialogTitle>
              <DialogDescription>
                Tus invitados podrán verla en su enlace. Podrás seguir editándola y volver a
                publicar cuando quieras.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Cancelar</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button arrow>Publicar</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}

/* ───────── Dropdown ───────── */

export function DropdownDemo() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" className="gap-2.5 pl-2.5">
          <Avatar name="Andrea" size="sm" />
          Andrea
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
        <DropdownMenuItem>
          <User aria-hidden="true" />
          Perfil
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings aria-hidden="true" />
          Configuración
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <LogOut aria-hidden="true" />
          Cerrar sesión
        </DropdownMenuItem>
        <DropdownMenuItem disabled>Deshabilitado</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
