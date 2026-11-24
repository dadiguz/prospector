import {
  Baby, BookOpen, Briefcase, Building2, Calendar, Camera, Car, Coffee, Dumbbell, Factory, GraduationCap, HeartPulse, Home, Hotel,
  Leaf, Megaphone, Music, PawPrint, Plane, Salad, Scissors, Shirt, ShoppingBag, Sprout, Stethoscope, Store, Ticket, Truck, Utensils, Waves, Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Ícono y color de cada proyecto (menú lateral y selector). Sin dependencias de servidor: lo usan
 * componentes de cliente y la generación de proyectos (que elige de estas listas).
 */

export const ICONOS_PROYECTO: Record<string, { icono: LucideIcon; para: string }> = {
  boleto: { icono: Ticket, para: "boletos, eventos, entradas" },
  olas: { icono: Waves, para: "parques acuáticos, balnearios, playa, albercas" },
  fabrica: { icono: Factory, para: "manufactura, plantas, maquiladoras, industria" },
  hoja: { icono: Leaf, para: "salud natural, ecología, productos naturales" },
  ensalada: { icono: Salad, para: "comida saludable, nutrición, meal prep" },
  cubiertos: { icono: Utensils, para: "restaurantes, comida" },
  cafe: { icono: Coffee, para: "cafeterías" },
  pesa: { icono: Dumbbell, para: "gimnasios, deporte" },
  graduacion: { icono: GraduationCap, para: "escuelas, cursos, educación" },
  libro: { icono: BookOpen, para: "editoriales, bibliotecas, contenido" },
  estetoscopio: { icono: Stethoscope, para: "clínicas, consultorios, médicos" },
  pulso: { icono: HeartPulse, para: "bienestar, hospitales" },
  casa: { icono: Home, para: "inmobiliarias, vivienda" },
  hotel: { icono: Hotel, para: "hoteles, hospedaje" },
  edificio: { icono: Building2, para: "empresas, oficinas, corporativos" },
  maletin: { icono: Briefcase, para: "servicios profesionales, B2B" },
  tienda: { icono: Store, para: "comercios, tiendas físicas" },
  bolsa: { icono: ShoppingBag, para: "tiendas en línea, retail" },
  camion: { icono: Truck, para: "logística, transporte, reparto" },
  auto: { icono: Car, para: "autos, talleres, agencias" },
  llave: { icono: Wrench, para: "talleres, mantenimiento, oficios" },
  avion: { icono: Plane, para: "viajes, turismo" },
  musica: { icono: Music, para: "música, conciertos" },
  camara: { icono: Camera, para: "fotografía, video, medios" },
  megafono: { icono: Megaphone, para: "marketing, publicidad" },
  calendario: { icono: Calendar, para: "agendas, citas, reservas" },
  brote: { icono: Sprout, para: "agricultura, viveros" },
  huella: { icono: PawPrint, para: "mascotas, veterinarias" },
  camisa: { icono: Shirt, para: "ropa, moda" },
  tijeras: { icono: Scissors, para: "estéticas, barberías, belleza" },
  bebe: { icono: Baby, para: "bebés, guarderías" },
};

export const COLORES_PROYECTO: Record<string, { bg: string; fg: string }> = {
  terracota: { bg: "#F6E4DB", fg: "#A34E2F" },
  ocre: { bg: "#F5ECD3", fg: "#85631D" },
  salvia: { bg: "#E3EEE4", fg: "#3F6B4B" },
  oliva: { bg: "#ECEEDC", fg: "#5C6224" },
  petroleo: { bg: "#DDEDEC", fg: "#2C6662" },
  azul: { bg: "#E1EAF5", fg: "#33568A" },
  ciruela: { bg: "#EEE2EE", fg: "#6E3D6E" },
  rosa: { bg: "#F7E1E6", fg: "#9A3D55" },
  pizarra: { bg: "#E7E8EB", fg: "#4B5160" },
};

export const CLAVES_ICONO = Object.keys(ICONOS_PROYECTO) as [string, ...string[]];
export const CLAVES_COLOR = Object.keys(COLORES_PROYECTO) as [string, ...string[]];

export function ProjectIcon({ nombre, icono, color, size = 24 }: { nombre: string; icono?: string | null; color?: string | null; size?: number }) {
  const c = COLORES_PROYECTO[color ?? ""] ?? null;
  const I = ICONOS_PROYECTO[icono ?? ""]?.icono;
  const radio = size >= 24 ? 7 : 5;
  if (!I)
    return (
      <span className="flex shrink-0 items-center justify-center bg-accent-soft font-serif text-accent" style={{ width: size, height: size, borderRadius: radio, fontSize: size * 0.58 }}>
        {nombre.slice(0, 1)}
      </span>
    );
  return (
    <span className="flex shrink-0 items-center justify-center" style={{ width: size, height: size, borderRadius: radio, background: c?.bg ?? "var(--accent-soft)", color: c?.fg ?? "var(--accent)" }} aria-hidden>
      <I size={Math.round(size * 0.6)} strokeWidth={1.9} />
    </span>
  );
}
