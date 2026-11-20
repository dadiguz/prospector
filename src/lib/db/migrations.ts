/**
 * Migraciones de SQLite. Cada entrada se aplica una vez, en orden.
 * Nunca edites una migración ya publicada: agrega una nueva.
 * Modelo de datos: sección 4 del plan.
 */
export const migrations: { id: number; name: string; sql: string }[] = [
  {
    id: 1,
    name: "modelo_inicial",
    sql: /* sql */ `
CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  idea TEXT NOT NULL DEFAULT '',
  propuesta_valor TEXT NOT NULL DEFAULT '',
  voz TEXT NOT NULL DEFAULT '',
  metrica_principal TEXT NOT NULL DEFAULT '',
  conversion TEXT NOT NULL DEFAULT '',
  meta_actual TEXT NOT NULL DEFAULT '',
  config_json TEXT NOT NULL DEFAULT '{}',
  estado TEXT NOT NULL DEFAULT 'activo',
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE project_sources (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('dir','archivo','url','texto')),
  ruta TEXT NOT NULL,
  hash TEXT,
  ultima_lectura TEXT,
  exclusiones_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE product_facts (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  afirmacion TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('si_afirmar','no_afirmar','no_mencionar','pendiente')),
  evidencia TEXT NOT NULL DEFAULT '',
  terminos_json TEXT NOT NULL DEFAULT '[]',
  verificado_en TEXT,
  verificado_por TEXT
);

CREATE TABLE hooks (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  clave TEXT NOT NULL,
  nombre TEXT NOT NULL,
  formula TEXT NOT NULL,
  multiplicador INTEGER NOT NULL DEFAULT 100,
  redondeo INTEGER NOT NULL DEFAULT 100,
  frase TEXT NOT NULL,
  supuestos_json TEXT NOT NULL DEFAULT '[]',
  condicion TEXT NOT NULL DEFAULT '',
  UNIQUE (project_id, clave)
);

CREATE TABLE disqualifiers (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  regla TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('duro','blando')),
  deteccion TEXT NOT NULL DEFAULT '',
  origen TEXT NOT NULL DEFAULT ''
);

CREATE TABLE icp_attributes (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  clave TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  peso INTEGER NOT NULL,
  origen TEXT NOT NULL DEFAULT 'manual' CHECK (origen IN ('manual','aprendido')),
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (project_id, clave, version)
);

CREATE TABLE templates (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  clave TEXT NOT NULL,
  canal TEXT NOT NULL DEFAULT 'correo',
  asunto TEXT NOT NULL DEFAULT '',
  cuerpo TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  estado TEXT NOT NULL DEFAULT 'activa'
);

CREATE TABLE segments (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  definicion TEXT NOT NULL,
  consultas_json TEXT NOT NULL DEFAULT '[]',
  hook_id INTEGER REFERENCES hooks(id),
  template_id INTEGER REFERENCES templates(id),
  responsable TEXT,
  estado TEXT NOT NULL DEFAULT 'activo'
);

CREATE TABLE territories (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  usuario TEXT NOT NULL,
  incluidos_json TEXT NOT NULL DEFAULT '["*"]',
  excluidos_json TEXT NOT NULL DEFAULT '[]',
  excepciones_json TEXT NOT NULL DEFAULT '[]',
  vigente_desde TEXT NOT NULL DEFAULT (date('now')),
  motivo TEXT NOT NULL DEFAULT ''
);

CREATE TABLE organizations (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  nombre_norm TEXT NOT NULL,
  dominios_json TEXT NOT NULL DEFAULT '[]',
  ciudad TEXT,
  estado TEXT,
  pais TEXT NOT NULL DEFAULT 'MX',
  tipo TEXT
);
CREATE INDEX organizations_nombre_norm ON organizations(nombre_norm);

CREATE TABLE contacts (
  id INTEGER PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nombre TEXT,
  cargo TEXT,
  canal TEXT NOT NULL CHECK (canal IN ('correo','whatsapp','telefono','instagram')),
  valor TEXT NOT NULL,
  tipo_buzon TEXT CHECK (tipo_buzon IN ('nominal','operativo','generico')),
  url_fuente TEXT,
  fecha_visto TEXT,
  mx_ok INTEGER,
  estado TEXT NOT NULL DEFAULT 'valido' CHECK (estado IN ('valido','reboto','no_usar')),
  nota TEXT
);
CREATE INDEX contacts_valor ON contacts(valor);

CREATE TABLE search_runs (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  segment_id INTEGER REFERENCES segments(id),
  etiqueta TEXT NOT NULL,
  algorithm_version_id INTEGER,
  enfoque TEXT NOT NULL DEFAULT '',
  territorio TEXT NOT NULL DEFAULT '',
  pedidos INTEGER NOT NULL DEFAULT 10,
  limites_json TEXT NOT NULL DEFAULT '[]',
  fecha TEXT NOT NULL DEFAULT (datetime('now')),
  origen TEXT NOT NULL DEFAULT 'busqueda' CHECK (origen IN ('busqueda','importado','manual'))
);

CREATE TABLE prospects (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  segment_id INTEGER REFERENCES segments(id),
  search_run_id INTEGER REFERENCES search_runs(id),
  ficha_json TEXT NOT NULL DEFAULT '{}',
  atributos_json TEXT NOT NULL DEFAULT '{}',
  score INTEGER,
  score_detalle_json TEXT NOT NULL DEFAULT '[]',
  score_version INTEGER,
  lista TEXT NOT NULL CHECK (lista IN ('A','B','solo_wa_ig','descartado')),
  motivo_descarte TEXT,
  estado TEXT NOT NULL DEFAULT 'investigado',
  responsable TEXT,
  no_contactar_antes_de TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX prospects_project ON prospects(project_id, lista, estado);

CREATE TABLE evidence (
  id INTEGER PRIMARY KEY,
  prospect_id INTEGER NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  que_demuestra TEXT NOT NULL DEFAULT '',
  cita TEXT,
  fecha_leido TEXT,
  tipo TEXT NOT NULL DEFAULT 'verificado' CHECK (tipo IN ('verificado','suposicion'))
);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  prospect_id INTEGER NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  contact_id INTEGER REFERENCES contacts(id),
  canal TEXT NOT NULL DEFAULT 'correo',
  direccion TEXT NOT NULL DEFAULT 'salida' CHECK (direccion IN ('salida','entrada')),
  template_id INTEGER REFERENCES templates(id),
  template_version INTEGER,
  para TEXT,
  asunto TEXT NOT NULL DEFAULT '',
  cuerpo TEXT NOT NULL DEFAULT '',
  cuerpo_original TEXT,
  validacion_json TEXT NOT NULL DEFAULT '[]',
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','aprobado','enviado','fallo','descartado')),
  tanda TEXT,
  con_enlaces INTEGER NOT NULL DEFAULT 0,
  gmail_draft_id TEXT,
  gmail_message_id TEXT,
  gmail_thread_id TEXT,
  aprobado_por TEXT,
  enviado_en TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX messages_estado ON messages(estado);

CREATE TABLE reply_events (
  id INTEGER PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  fecha TEXT,
  clasificacion TEXT NOT NULL CHECK (clasificacion IN
    ('interesado','acuse','no_ahora','no','rebote','auto_respuesta','vacia','baja','otro')),
  confianza REAL,
  resumen TEXT NOT NULL DEFAULT '',
  quien_respondio TEXT,
  en_copia TEXT,
  pide TEXT CHECK (pide IN ('info','llamada','reunion','nada')),
  sugerencia TEXT,
  revisado_por_humano INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE followups (
  id INTEGER PRIMARY KEY,
  prospect_id INTEGER NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('correo','whatsapp','llamada','retomar')),
  fecha TEXT,
  motivo TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'pendiente'
);

CREATE TABLE labels (
  id INTEGER PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'usuario' CHECK (tipo IN ('sistema','usuario')),
  gmail_label_id TEXT,
  UNIQUE (project_id, nombre)
);
CREATE TABLE label_links (
  label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  prospect_id INTEGER REFERENCES prospects(id) ON DELETE CASCADE,
  message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE
);

CREATE TABLE suppression_list (
  id INTEGER PRIMARY KEY,
  valor TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('correo','dominio','telefono')),
  alcance TEXT NOT NULL DEFAULT 'global' CHECK (alcance IN ('proyecto','global')),
  project_id INTEGER REFERENCES projects(id),
  motivo TEXT NOT NULL,
  fecha TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (valor, alcance, project_id)
);

CREATE TABLE algorithm_versions (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL DEFAULT (datetime('now')),
  cambios_json TEXT NOT NULL,
  evidencia TEXT NOT NULL DEFAULT '',
  aprobado_por TEXT
);

CREATE TABLE blocked_hosts (
  host TEXT PRIMARY KEY,
  motivo TEXT NOT NULL,
  fecha TEXT NOT NULL DEFAULT (datetime('now')),
  no_reintentar_antes TEXT
);

CREATE TABLE jobs (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  search_run_id INTEGER REFERENCES search_runs(id),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_curso','hecho','fallo','en_pausa','cancelado')),
  presupuesto_json TEXT NOT NULL DEFAULT '{}',
  consumo_json TEXT NOT NULL DEFAULT '{}',
  reanudar_despues TEXT,
  mensaje TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE job_steps (
  id INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  orden INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  clave TEXT NOT NULL,
  entrada_json TEXT NOT NULL DEFAULT '{}',
  salida_json TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_curso','hecho','fallo','en_pausa','omitido')),
  error TEXT,
  intentos INTEGER NOT NULL DEFAULT 0,
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (job_id, clave)
);

CREATE TABLE usage_log (
  id INTEGER PRIMARY KEY,
  job_id INTEGER,
  paso TEXT NOT NULL,
  proveedor TEXT NOT NULL,
  modelo TEXT NOT NULL,
  tokens_entrada INTEGER NOT NULL DEFAULT 0,
  tokens_salida INTEGER NOT NULL DEFAULT 0,
  tokens_cache INTEGER NOT NULL DEFAULT 0,
  busquedas_web INTEGER NOT NULL DEFAULT 0,
  costo_usd REAL NOT NULL DEFAULT 0,
  duracion_ms INTEGER NOT NULL DEFAULT 0,
  fecha TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  quien TEXT NOT NULL,
  que TEXT NOT NULL,
  detalle TEXT NOT NULL DEFAULT '',
  fecha TEXT NOT NULL DEFAULT (datetime('now'))
);
`,
  },
  {
    id: 2,
    name: "gmail_sync",
    sql: /* sql */ `
ALTER TABLE reply_events ADD COLUMN gmail_message_id TEXT;
CREATE UNIQUE INDEX reply_events_gmail ON reply_events(gmail_message_id) WHERE gmail_message_id IS NOT NULL;
CREATE TABLE gmail_seen (
  gmail_message_id TEXT PRIMARY KEY,
  motivo TEXT NOT NULL,
  fecha TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE messages ADD COLUMN verificacion TEXT;
`,
  },
  {
    id: 3,
    name: "kv",
    sql: /* sql */ `
CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, actualizado_en TEXT NOT NULL DEFAULT (datetime('now')));
`,
  },
  {
    id: 4,
    name: "actividad_jobs",
    sql: /* sql */ `
ALTER TABLE jobs ADD COLUMN actividad_json TEXT NOT NULL DEFAULT '[]';
`,
  },
  {
    id: 5,
    name: "etiquetas",
    sql: /* sql */ `
ALTER TABLE labels ADD COLUMN color TEXT;
ALTER TABLE labels ADD COLUMN search_run_id INTEGER REFERENCES search_runs(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX labels_run ON labels(search_run_id) WHERE search_run_id IS NOT NULL;
CREATE UNIQUE INDEX label_links_prospect ON label_links(label_id, prospect_id) WHERE prospect_id IS NOT NULL;
`,
  },
];
