# React Component Integration Notes

This repository is currently a static HTML/CSS/JS Cloudflare Pages site.

It does **not** currently have:

- React
- TypeScript
- Tailwind CSS
- shadcn/ui config
- a package manager manifest (`package.json`)

Because of that, the new component files were added as dormant source files under `/components/ui`, but they will not run until the project is migrated to a React app.

## Recommended Baseline

Use a Next.js app with TypeScript, Tailwind, and shadcn/ui:

```bash
npx create-next-app@latest elysian-react --typescript --tailwind --eslint --app --src-dir false --import-alias "@/*"
cd elysian-react
npx shadcn@latest init
npm install lucide-react
```

For the `gradient-wave.tsx` component specifically, there are no extra runtime dependencies beyond React itself.

For the `glass-blog-card-shadcnui.tsx` component specifically, install:

```bash
npm install framer-motion lucide-react
npx shadcn@latest add avatar badge card
```

It also expects the standard shadcn utility helper at `@/lib/utils`.

## Expected Default Paths

- Components: `/components/ui`
- Global styles: `/app/globals.css`

If your project uses `src/`, the common equivalents are:

- Components: `/src/components/ui`
- Global styles: `/src/app/globals.css`

## Why `/components/ui` Matters

shadcn/ui assumes a predictable component location so imports stay consistent across your app and generated code. Using `/components/ui` makes it easier to:

- keep generated and custom UI components together
- preserve clean alias imports like `@/components/ui/button`
- avoid rewriting imports every time you add a new component
- make future shadcn CLI additions predictable

## If You Need Manual Setup

If you already have React but not Tailwind:

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

If you already have React but not TypeScript:

```bash
npm install -D typescript @types/react @types/react-dom
```

Create a `tsconfig.json` and enable a path alias like:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

## Current File Placement

The requested files are currently stored here for handoff:

- `components/ui/gradient-wave.tsx`
- `components/ui/glass-blog-card-shadcnui.tsx`
- `components/ui/demo.tsx`

When you migrate the site to React, keep them in the real app root's `/components/ui` folder and import `demo.tsx` from the appropriate page or route.
