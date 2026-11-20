# Prospector

A local tool for sales prospecting. It finds prospects with verifiable evidence, drafts short emails from a proven template, sends them through your Gmail only after you approve them, tracks replies, and shows which kinds of prospects respond.

The interface is in Spanish. Everything runs on your computer. Your data and keys never go into this repository.

## What you need

- Node.js 22.13 or newer
- A Claude API key (from console.anthropic.com), for finding prospects and classifying replies
- A Google Workspace account, to connect Gmail

## Setup

```bash
npm install
npm run dev
```

Open http://127.0.0.1:4321 and:

1. **Fill in your profile** (name, work email, phone, company). It is used as the sender and in your messages.
2. **Ajustes (Settings) → API key de Claude**: paste your key. It is checked and saved in your system keychain.
3. **Ajustes → Gmail**: follow the links shown there to create a free OAuth client in Google Cloud (no credit card needed):
   - create a project,
   - enable the Gmail API,
   - set up the consent screen as **Internal**,
   - create an OAuth client of type **Desktop app**.

   Paste the Client ID and Client secret, then click **Conectar con Google**.

Each person uses their own API key and their own Gmail.

## Keep it running (Mac)

To run it in the background, start at login and restart if it crashes:

```bash
npm run servicio -- instalar
```

After `git pull`, run `npm run servicio -- actualizar`. Other commands: `estado`, `logs`, `reiniciar`, `desinstalar`. On Windows or Linux use `npm run build && npm start`.

## Projects

The repo ships with no projects. A project is a Markdown file with what you sell, what you can and cannot claim, the scoring profile, segments and email templates.

- **Import**: on the home page, choose the `.md` file and click **Importar proyecto**. Importing again updates the setup and keeps your prospects and messages.
- **Start from scratch**: click **Descargar plantilla .md**, fill it in and import it.
- **Share**: on a project page, click **Exportar .md**. The file has no prospects or personal data.

## How it works

- **Project**: what you sell, what you can and cannot claim, segments to search.
- **Prospects**: search results in four lists (verified email, weaker, WhatsApp only, discarded), each with its evidence.
- **Drafts**: review and edit. Nothing is sent until you confirm.
- **Replies**: synced from Gmail and classified, with an analysis of what is working.

Each search has a spending cap in US dollars (set in Ajustes).

## Where your data lives

Outside the repo, in `~/.prospector` (Mac/Linux) or `%APPDATA%\Prospector` (Windows): the database, your profile and your settings. Keys and Gmail tokens are stored in the system keychain. Back up that folder; never commit it.
