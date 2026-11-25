import { ESTILOS } from "./estilos";
import type { BrochureDoc } from "./content";

/**
 * Plantilla del brochure: 6 páginas de 1080×1350 (portada, el cambio, su sitio web,
 * el celular, el panel y cómo trabajamos). Recibe el contenido ya redactado y las fotos ya bajadas.
 */

export type Marca = {
  empresa: string;
  logo: string | null; // ruta relativa a la carpeta del brochure
  isotipo: string | null;
  ubicacion: string;
  contacto: { nombre: string; telefono: string; correo: string; sitio: string };
  referencia: { titulo: string; texto: string } | null;
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const br = (s: string) => esc(s).replace(/\\n|\n/g, "<br>");
const dinero = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const css = (ruta: string | null) => (ruta ? `url('${ruta.replace(/'/g, "%27")}')` : null);

const CHECK = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1f5a43" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
const CANDADO = (c = "#fff", t = 18) => `<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;
const ICONOS: Record<string, string> = {
  calendario: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  casa: '<path d="M3 21h18M5 21V10l7-6 7 6v11"/><path d="M10 21v-6h4v6"/>',
  ola: '<path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path d="M2 18c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>',
  mensaje: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  boleto: '<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v8a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2z"/><path d="M13 6v12" stroke-dasharray="2 2"/>',
  grafica: '<path d="M3 21h18"/><path d="M7 17V11M12 17V7M17 17v-4"/>',
  tarjeta: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  estrella: '<path d="M12 2 15 8.5 22 9.3l-5 4.8 1.2 7L12 17.8 5.8 21.1 7 14.1 2 9.3l7-.8z"/>',
};
const icono = (n: string, t = 26, c = "#1f5a43") =>
  `<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONOS[n] ?? ICONOS.estrella}</svg>`;

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** Un mes de ejemplo unos meses adelante, con un jueves elegido y algunos sábados llenos. */
function calendario(hoy = new Date()) {
  const mes = new Date(hoy.getFullYear(), hoy.getMonth() + 4, 1);
  const total = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const offset = (mes.getDay() + 6) % 7; // lunes = 0
  const dia = (d: number) => new Date(mes.getFullYear(), mes.getMonth(), d);
  const jueves = Array.from({ length: total }, (_, i) => i + 1).filter((d) => dia(d).getDay() === 4);
  const elegido = jueves[Math.min(3, jueves.length - 1)];
  const sabados = Array.from({ length: total }, (_, i) => i + 1).filter((d) => dia(d).getDay() === 6);
  const llenos = new Set([sabados[0], sabados[1], elegido + 2, elegido + 3].filter((d) => d && d <= total));
  const salida = Math.min(elegido + 2, total);
  const nombreMes = MESES[mes.getMonth()];
  return {
    titulo: `${nombreMes[0].toUpperCase()}${nombreMes.slice(1)} ${mes.getFullYear()}`,
    offset, total, elegido, llenos,
    rango: `${DIAS[4]} ${elegido} a ${DIAS[dia(salida).getDay()]} ${salida} ${nombreMes.slice(0, 3)}`,
    rangoLargo: `${elegido} al ${salida} de ${nombreMes}`,
    folio: `${String(mes.getMonth() + 1).padStart(2, "0")}${String(elegido).padStart(2, "0")}`,
    hoyLargo: `${["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][dia(elegido).getDay()]} ${elegido} de ${nombreMes}`,
  };
}

export function renderBrochure(doc: BrochureDoc & { _dominio?: string }, fotos: (string | null)[], marca: Marca): string {
  const foto = (i: number) => (i >= 0 && i < fotos.length ? fotos[i] : null);
  const fondo = (i: number, capa: string, pos = "center") => {
    const u = css(foto(i));
    return u ? `background: ${capa}, ${u} ${pos} / cover;` : "";
  };
  const miniatura = (i: number) => {
    const u = css(foto(i));
    return u ? `background: ${u} center / cover;` : "background: linear-gradient(160deg, #3fa7b5, #1f5a43);";
  };
  const cal = calendario();
  const cat = doc.catalogo;
  const items = cat.items.slice(0, 4);
  while (items.length < 4) items.push({ nombre: "", detalle: "", precio: null, por: "", foto: -1 });
  const prin = items[0];
  const porNoche = /noche/i.test(prin.por);
  const cantidad = 2;
  const total = prin.precio ? prin.precio * cantidad : null;
  const anticipo = total ? (/anticipo/i.test(cat.anticipo) ? total / 2 : total) : null;
  const precioTxt = (it: (typeof items)[number]) => (it.precio ? dinero(it.precio) : "");
  const nombre = esc(doc.nombre_corto);
  const accion = esc(cat.accion);
  const sitioMarca = esc(marca.contacto.sitio);

  const pie = (num: string, nota?: string, derecha?: string) => `
  <div class="foot">${marca.logo ? `<img class="logo" src="${esc(marca.logo)}" alt="${esc(marca.empresa)}">` : `<b style="font-size:22px">${esc(marca.empresa)}</b>`}
    <span class="meta-r">${nota ? `<span class="note">${esc(nota)}</span>` : derecha ? esc(derecha) : nombre}${num ? `<span class="pg">${num}</span>` : ""}</span></div>`;
  const encabezado = (kicker: string, titulo: string) => `
  ${marca.isotipo ? `<img class="mark" src="${esc(marca.isotipo)}" alt="">` : ""}
  <div class="kicker">${esc(kicker)}</div>
  <h2 style="margin-top:30px">${br(titulo)}</h2>`;

  const semana = Array.from({ length: 7 }, (_, k) => cal.elegido - 3 + k);
  const diasCel = semana
    .map((d) => {
      if (d < 1 || d > cal.total) return `<span>&nbsp;<em>&nbsp;</em></span>`;
      if (d === cal.elegido) return `<span class="sel">${d}<em>3 libres</em></span>`;
      if (cal.llenos.has(d)) return `<span class="full">${d}<em>lleno</em></span>`;
      return `<span>${d}<em>${d % 3 === 0 ? "2 libres" : "libre"}</em></span>`;
    })
    .join("");
  const unidadCel = (it: (typeof items)[number], on: boolean, tag?: string) =>
    it.nombre
      ? `<div class="unit${on ? " on" : ""}"><div class="thumb" style="${miniatura(it.foto)}"></div><div class="tx"><b>${esc(it.nombre)}${tag ? ` <span class="tag">${tag}</span>` : ""}</b><span>${esc(it.detalle)}</span></div>${
          it.precio ? `<div class="pr">${precioTxt(it)}<small>${esc(it.por)}</small></div>` : `<div class="pr" style="font-size:13px;color:var(--ink-3)">Su precio</div>`
        }</div>`
      : "";

  const grid =
    ["lu", "ma", "mi", "ju", "vi", "sá", "do"].map((d) => `<span class="h">${d}</span>`).join("") +
    "<span></span>".repeat(cal.offset) +
    Array.from({ length: cal.total }, (_, i) => i + 1)
      .map((d) => `<span class="${d === cal.elegido ? "s" : d === cal.elegido + 1 ? "r" : cal.llenos.has(d) ? "f" : ""}">${d}</span>`)
      .join("");
  const estadoWeb = ["Elegido", "Agregar", "Agregar", "Lleno"];
  const etiquetaWeb = ["Quedan 3", "", "Quedan 1", "Lleno"];
  const unidadWeb = (it: (typeof items)[number], k: number) =>
    it.nombre
      ? `<div class="wu${k === 0 ? " on" : ""}"><div class="ph" style="${miniatura(it.foto)}">${etiquetaWeb[k] ? `<em${k === 3 ? ' class="full"' : ""}>${etiquetaWeb[k]}</em>` : ""}</div><div class="in"><b>${esc(it.nombre)}</b><small>${esc(it.detalle)}</small><div class="row"><strong>${it.precio ? `${precioTxt(it)}<small> ${esc(it.por)}</small>` : '<span style="font-weight:600;color:var(--ink-3)">Su precio</span>'}</strong><span>${estadoWeb[k]}</span></div></div></div>`
      : "";

  const qr = (() => {
    const n = 11, seed = [0x5a3c, 0x91e7, 0x3b28, 0xc46d, 0x7e15, 0x2f9a, 0xd83b, 0x64c1, 0x1ba7, 0xe952, 0x4d6e];
    let out = "";
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const fin = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7);
        const on = fin || ((seed[y] >> x) & 1) === 1;
        out += `<i${on ? "" : ' class="o"'}></i>`;
      }
    return out;
  })();

  const lugar = doc.lugar ? ` · ${esc(doc.lugar)}` : "";
  // Sin precios publicados no se inventan: se deja el lugar de su tarifa.
  const conPrecios = items.some((it) => it.precio);
  const totalTxt = total ? dinero(total) : "Su tarifa";
  const anticipoTxt = anticipo ? dinero(anticipo) : "Su anticipo";
  const notaPrecios = conPrecios ? "Pantalla de ejemplo con los precios de su sitio" : "Pantalla de ejemplo; se carga con sus precios";
  const restoTxt = total && anticipo && total !== anticipo ? dinero(total - anticipo) : null;
  const concepto = `${esc(prin.nombre)} · ${cantidad} ${porNoche ? "noches" : esc(cat.unidad_fecha || "")}`.trim();
  const strip = doc.cambio.fotos.filter((f) => foto(f.foto)).slice(0, 3);

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${nombre} · ${esc(marca.empresa)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>${ESTILOS}</style></head>
<body>

<section class="page cover" id="p1">
  <div class="cover-top" style="${fondo(doc.portada.foto_fondo, "linear-gradient(90deg, rgba(10,30,24,.82) 0%, rgba(10,30,24,.55) 50%, rgba(10,30,24,.1) 100%)", "center 40%")}">
    <div class="kicker">Para ${nombre}${lugar}</div>
    <h1>${esc(doc.portada.titulo)}</h1>
  </div>
  <div class="cover-bottom">
    <p class="lead">${esc(doc.portada.lead)}</p>
    <div class="chips">${doc.portada.puntos.slice(0, 3).map((p) => `<div class="chip"><i>${CHECK}</i>${esc(p)}</div>`).join("")}</div>
    ${pie("", undefined, marca.ubicacion)}
  </div>
  <div class="phone"><div class="screen"><div class="notch"></div><div class="status"><span>9:41</span><span>●●● ▮</span></div>
    <div class="hero" style="${fondo(items[0].foto, "linear-gradient(180deg, transparent 30%, rgba(0,0,0,.55))")}"><small>${nombre} · ${esc(cat.seccion)}</small><b>Elige tu fecha</b></div>
    <div class="body"><div class="dates">${["lu", "ma", "mi", "ju", "vi", "sá", "do"].map((d) => `<span class="h">${d}</span>`).join("")}${diasCel}</div>
      ${unidadCel(items[0], true, "Quedan 3")}${unidadCel(items[1], false)}${unidadCel(items[2], false)}
    </div>
    <div class="pay"><div class="big"><span>${esc(cat.anticipo.replace(/\s*\(.*\)/, ""))}</span><b>${anticipoTxt}</b></div><div class="btn">${accion}</div></div>
  </div></div>
</section>

<section class="page" id="p2">${encabezado("El cambio", doc.cambio.titulo)}
  <div class="vs">
    <div class="col hoy"><h3>Hoy</h3><ul class="steps">${doc.cambio.hoy.slice(0, 4).map((x, i) => `<li><i>${i + 1}</i>${esc(x)}</li>`).join("")}</ul><div class="meta">${esc(doc.cambio.hoy_nota)}</div></div>
    <div class="col con"><h3>Con el sistema</h3><ul class="steps">${doc.cambio.con.slice(0, 4).map((x, i) => `<li><i>${i + 1}</i>${esc(x)}</li>`).join("")}</ul><div class="meta">${esc(doc.cambio.con_nota)}</div></div>
  </div>
  ${strip.length === 3 ? `<div class="strip">${strip.map((f) => `<div style="background-image:${css(foto(f.foto))}"><span>${esc(f.etiqueta)}</span></div>`).join("")}</div>` : ""}
  ${pie("02")}
</section>

<section class="page" id="p3">${encabezado("En su página web", `Su sitio, ahora\ncon ${cat.accion.toLowerCase() === "comprar" ? "venta en línea" : "reservaciones"}`)}
  <div class="browser">
    <div class="bbar"><i></i><i></i><i></i><div class="url">${CANDADO("#87938c", 11)}${esc(doc._dominio ?? "")}${esc(cat.ruta.startsWith("/") ? cat.ruta : `/${cat.ruta}`)}</div></div>
    <div class="whero" style="${fondo(doc.cambio.fotos[0]?.foto ?? -1, "linear-gradient(90deg, rgba(10,30,24,.78), rgba(10,30,24,.2))", "center 60%")}">
      <div class="wnav"><span class="wlogo">${nombre}</span><nav>${cat.menu.slice(0, 5).map((m) => (m.toLowerCase() === cat.seccion.toLowerCase() ? `<b>${esc(m)}</b>` : `<span>${esc(m)}</span>`)).join("")}</nav></div>
      <div><h3>${esc(cat.titulo_web)}</h3><p>${esc(cat.texto_web)}</p></div>
    </div>
    <div class="wbody">
      <div class="wcal"><h5>${cal.titulo} <span>${cantidad} ${esc(cat.unidad_fecha)}</span></h5><div class="wgrid">${grid}</div><div class="wleg">Tachado: lleno<br>En verde: tus fechas</div></div>
      <div class="wunits">${items.map(unidadWeb).join("")}</div>
      <div class="wsum">
        <div class="top"><small>Tu ${porNoche ? "estancia" : "compra"}</small><b>${cal.rango}</b></div>
        <div class="hold"><span>Te lo apartamos mientras pagas</span><span>9:58</span></div>
        <div class="in"><div><span>${concepto}</span><span>${totalTxt}</span></div>${restoTxt ? `<div><span>Resto al llegar</span><span>${restoTxt}</span></div>` : ""}
          <div class="tot"><span>${esc(cat.anticipo.replace(/\s*\(.*\)/, ""))}</span><b>${anticipoTxt}</b></div></div>
        <div class="wbtn">${CANDADO("#fff", 13)}Pagar con tarjeta</div><div class="safe">Confirmación al instante</div>
      </div>
    </div>
  </div>
  <div class="pts">
    <div><b>En su mismo sitio</b>Se integra a la página que ya tienen.</div>
    <div><b>Disponibilidad real</b>Nadie aparta algo que ya está ocupado.</div>
    <div><b>En computadora y celular</b>Desde donde los busquen.</div>
  </div>
  ${pie("03", notaPrecios)}
</section>

<section class="page" id="p4">${encabezado("Lo que ve su cliente", `Elige, paga y listo`)}
  <div style="display:flex; gap:44px; margin-top:54px; justify-content:center;">
    <div class="phone"><div class="screen"><div class="notch"></div><div class="status"><span>9:41</span><span>●●● ▮</span></div>
      <div class="hero" style="height:150px;${fondo(items[1].foto >= 0 ? doc.cambio.fotos[1]?.foto ?? -1 : -1, "linear-gradient(180deg, transparent 20%, rgba(0,0,0,.6))")}"><small>Tu ${porNoche ? "estancia" : "compra"}</small><b>${cal.rango}</b></div>
      <div class="body">
        <div class="unit on"><div class="thumb" style="${miniatura(prin.foto)}"></div><div class="tx"><b>${esc(prin.nombre)}</b><span>${cantidad} ${porNoche ? "noches" : esc(cat.unidad_fecha)}</span></div><div class="pr">${totalTxt}</div></div>
        ${items[1].nombre ? `<div class="unit"><div class="thumb" style="${miniatura(items[1].foto)}"></div><div class="tx"><b>+ ${esc(items[1].nombre)}</b><span>${esc(items[1].detalle)}</span></div><div class="pr" style="font-size:14px;color:var(--ink-3)">opcional</div></div>` : ""}
      </div>
      <div class="pay">
        <div class="row"><span>Total</span><span>${totalTxt}</span></div>${restoTxt ? `<div class="row"><span>Resto al llegar</span><span>${restoTxt}</span></div>` : ""}
        <div class="big"><span>${esc(cat.anticipo)}</span><b>${anticipoTxt}</b></div>
        <div class="btn">${CANDADO()}Pagar ${/anticipo/i.test(cat.anticipo) ? "anticipo" : ""}</div><div class="secure">Pago seguro con tarjeta</div>
      </div>
    </div></div>
    <div class="phone"><div class="screen"><div class="notch"></div><div class="status"><span>9:42</span><span>●●● ▮</span></div>
      <div class="ok">
        <div class="check"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#1f5a43" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>
        <h3>¡Listo!</h3><p>Te esperamos en ${nombre}.<br>Te mandamos la confirmación por correo.</p>
        <div class="ticket">
          <div class="row"><span>${esc(cat.seccion)}</span><b>${esc(prin.nombre)}</b></div>
          <div class="row"><span>Fechas</span><b>${cal.rangoLargo}</b></div>
          <div class="row"><span>Pagado</span><b style="color:var(--green)">${anticipoTxt}</b></div>
          <div class="row"><span>Folio</span><b>${esc(doc.nombre_corto.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ ]/g, "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 3) || "RS")}-${cal.folio}</b></div>
        </div>
        <div class="qr">${qr}</div><p style="font-size:13px">Muéstralo al llegar</p>
      </div>
    </div></div>
  </div>
  ${pie("04", notaPrecios.replace("Pantalla", "Pantallas"))}
</section>

<section class="page" id="p5">${encabezado("Lo que ven ustedes", doc.panel.titulo)}
  <div class="panel">
    <div class="bar"><b>${nombre} · Hoy</b><span>${cal.hoyLargo}</span></div>
    <div class="kpis">${doc.panel.kpis.slice(0, 3).map((k) => `<div class="kpi"><span>${esc(k.etiqueta)}</span><b>${esc(k.valor)}</b><em>${esc(k.nota)}</em></div>`).join("")}</div>
    <div class="occ"><h4>${esc(doc.panel.barras_titulo)}</h4>${doc.panel.barras
      .slice(0, 3)
      .map((b) => `<div class="occ-row"><span>${esc(b.nombre)}</span><div class="track"><div class="fill" style="width:${b.total > 0 ? Math.min(100, Math.round((b.usados / b.total) * 100)) : 0}%"></div></div><span>${b.usados} / ${b.total}</span></div>`)
      .join("")}</div>
    <div class="list">${doc.panel.lista
      .slice(0, 3)
      .map((l) => `<div class="li"><div><b>${esc(l.nombre)}</b><small>${esc(l.detalle)}</small></div><span style="color:var(--ink-2)">${esc(l.monto)}</span><span class="pill ${l.pagado ? "paid" : "wait"}">${l.pagado ? "Pagado" : "Por pagar"}</span></div>`)
      .join("")}</div>
  </div>
  ${pie("05", "Datos de ejemplo")}
</section>

<section class="page" id="p6">${encabezado("Cómo trabajamos", doc.medida.titulo)}
  <div class="grid3">${doc.medida.puntos.slice(0, 4).map((p) => `<div class="feat"><div class="ic">${icono(p.icono)}</div><b>${esc(p.titulo)}</b><p>${esc(p.texto)}</p></div>`).join("")}</div>
  ${marca.referencia ? `<div class="ref">${icono("estrella", 44)}<div><b>${esc(marca.referencia.titulo)}</b><p>${esc(marca.referencia.texto)}</p></div></div>` : ""}
  <div class="cta"><b>${esc(doc.medida.cta_titulo)}</b><p>${esc(doc.medida.cta_texto)}</p>
    <div class="contact">
      <div><span>Contacto</span>${esc(marca.contacto.nombre)}</div><div><span>Teléfono</span>${esc(marca.contacto.telefono)}</div>
      <div><span>Correo</span>${esc(marca.contacto.correo)}</div><div><span>Sitio</span>${sitioMarca}</div>
    </div>
  </div>
  ${pie("06")}
</section>

<script>
  const p = new URLSearchParams(location.search).get("p");
  if (p) { document.body.classList.add("solo"); document.getElementById("p" + p).classList.add("on"); }
</script>
</body></html>`;
}
