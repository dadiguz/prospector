import crypto from "node:crypto";

/**
 * Mensaje MIME para la API de Gmail. La API no inserta la firma sola:
 * se toma la firma de la cuenta (sendAs) y se agrega aquí, en HTML y en texto.
 * El cuerpo no lleva enlaces (lo exige el validador); los enlaces van solo en la firma.
 */
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");
const encodeHeader = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li)>/gi, "\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, (_, href, txt) => (txt.replace(/<[^>]+>/g, "").trim() === href ? href : `${txt} (${href})`))
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function bodyToHtml(body: string): string {
  return body
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<div>${esc(p).replace(/\n/g, "<br>")}</div><div><br></div>`)
    .join("");
}

export function buildMime(o: {
  from: string;
  fromName?: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  signatureHtml?: string;
  inReplyTo?: string;
  references?: string;
  /** Imágenes dentro del correo, entre el texto y la firma. */
  images?: { cid: string; filename: string; mime: string; data: Buffer }[];
}): string {
  const boundary = `b_${crypto.randomBytes(12).toString("hex")}`;
  const related = `r_${crypto.randomBytes(12).toString("hex")}`;
  const imgs = o.images ?? [];
  const imgHtml = imgs.map((i) => `<div><img src="cid:${i.cid}" alt="${esc(i.filename.replace(/\.[^.]+$/, ""))}" style="max-width:100%;height:auto;border-radius:6px"></div><div><br></div>`).join("");
  const sigHtml = o.signatureHtml ? `<div><br></div><div class="gmail_signature">${o.signatureHtml}</div>` : "";
  const sigText = o.signatureHtml ? `\n\n-- \n${htmlToText(o.signatureHtml)}` : "";
  const headers = [
    `From: ${o.fromName ? `${encodeHeader(o.fromName)} <${o.from}>` : o.from}`,
    `To: ${o.to}`,
    o.cc ? `Cc: ${o.cc}` : null,
    `Subject: ${encodeHeader(o.subject)}`,
    o.inReplyTo ? `In-Reply-To: ${o.inReplyTo}` : null,
    o.references ? `References: ${o.references}` : null,
    "MIME-Version: 1.0",
    imgs.length ? `Content-Type: multipart/related; boundary="${related}"` : `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);
  const alternative = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64(o.body.trim() + sigText),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64(`<div dir="ltr">${bodyToHtml(o.body)}${imgHtml}${sigHtml}</div>`),
    `--${boundary}--`,
  ];
  const parts = imgs.length
    ? [
        `--${related}`,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        "",
        ...alternative,
        ...imgs.flatMap((i) => [
          `--${related}`,
          `Content-Type: ${i.mime}; name="${encodeHeader(i.filename)}"`,
          "Content-Transfer-Encoding: base64",
          `Content-ID: <${i.cid}>`,
          `Content-Disposition: inline; filename="${encodeHeader(i.filename)}"`,
          "",
          i.data.toString("base64").replace(/.{76}/g, "$&\r\n"),
        ]),
        `--${related}--`,
        "",
      ]
    : [...alternative, ""];
  return Buffer.from([...headers, "", ...parts].join("\r\n"), "utf8").toString("base64url");
}
