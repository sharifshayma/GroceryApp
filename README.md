# GroceryApp

A household grocery management PWA for families and roommates. Create shopping lists, track what's in stock, and never forget what you need at the store.

**Live demo:** [grocerylist.shayma.me](https://grocerylist.shayma.me)

## Features

- **Shopping Lists** — Create lists, shop with check-off mode, and carry over unbought items to a new list automatically
- **Stock Tracking** — Keep track of what's in your pantry with low-stock alerts
- **Household Sharing** — Invite family members to share lists and stock via invite codes
- **Item Catalog** — Organize items by category with emoji icons, tags (recipes, stores), and notes
- **Bilingual** — Full English and Hebrew support with RTL layout
- **Installable PWA** — Works offline, installable on mobile and desktop
- **WhatsApp Sharing** — Share lists as text or via link
- **Connect to Claude** — Talk to your groceries via an MCP server (search items, mark bought, adjust stock, etc.) — see [Connect to Claude](#connect-to-claude) below

## Tech Stack

- **Frontend:** React 19, React Router 7, Tailwind CSS 4
- **Backend:** Supabase (PostgreSQL + Auth + Row-Level Security)
- **Build:** Vite 8 with PWA plugin
- **i18n:** i18next (English + Hebrew)
- **Deployment:** Vercel
- **Email:** Resend (for feedback)

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- (Optional) [Vercel](https://vercel.com) account for deployment

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/sharifshayma/GroceryApp.git
   cd GroceryApp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your environment file:
   ```bash
   cp .env.example .env
   ```
   Fill in your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

4. Set up the database — run the migration files in `supabase/migrations/` against your Supabase project (via the Supabase dashboard SQL editor or CLI).

5. Start the dev server:
   ```bash
   npm run dev
   ```

### Deployment

Deploy to Vercel:
```bash
vercel --prod
```

Or connect your GitHub repo to Vercel for automatic deployments.

## Connect to Claude

The app exposes an MCP (Model Context Protocol) server at `/api/mcp` so you can manage your groceries from Claude (Desktop, web, or any MCP-compatible client) — "what do I need to buy?", "add bread to my list", "I just used 1 egg", etc.

### Tools (11)

Reads: `search_items`, `get_lists`, `get_need_to_buy`, `list_tags`.
Writes: `add_to_list`, `mark_list_item`, `edit_list_item`, `set_stock`, `adjust_stock`, `manage_list`, `tag_item`.

### Set up the server

The MCP function needs the Supabase service-role key (it bypasses RLS and scopes every query by household via `mcp_tokens`).

In your Vercel project:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...your service role key...
```

Run migration `008_mcp_tokens.sql` against your Supabase project.

### Generate a personal token

1. Open the app → **Profile** → **Connect to Claude**.
2. Click **Generate new token**, give it a name (e.g. "Claude Desktop").
3. Copy the token — it's shown only once.

### Connect from Claude

Add the MCP server to Claude Desktop's config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "grocery": {
      "url": "https://your-app.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer <paste-your-token>"
      }
    }
  }
}
```

Restart Claude Desktop. The 11 grocery tools should appear in the tool list.

### Revoking tokens

Profile → Connect to Claude → **Revoke** next to any active token. The hash row is deleted; further calls with that token return 401.

## Project Structure

```
src/
  pages/          # Route pages (Home, Lists, Stock, Profile, etc.)
  components/     # Reusable UI components
  hooks/          # Custom React hooks (useLists, useStock, useItems, etc.)
  i18n/           # Translation files (en.json, he.json)
  lib/
    grocery.js    # Shared business logic — used by hooks AND the MCP server
    supabase.js   # Browser Supabase client
    withTimeout.js
api/
  feedback.js     # Feedback email handler
  mcp.js          # MCP server (Streamable HTTP transport)
supabase/         # Database migrations
public/           # PWA icons & assets
```

## License

MIT
