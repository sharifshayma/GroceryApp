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

## Project Structure

```
src/
  pages/          # Route pages (Home, Lists, Stock, Profile, etc.)
  components/     # Reusable UI components
  hooks/          # Custom React hooks (useLists, useStock, useItems, etc.)
  i18n/           # Translation files (en.json, he.json)
  lib/            # Supabase client & utilities
api/              # Vercel serverless functions
supabase/         # Database migrations
public/           # PWA icons & assets
```

## License

MIT
