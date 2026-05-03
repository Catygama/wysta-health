# Wysta

Plataforma digital de saúde sexual e reprodutiva feminina, em português. Comunicação assíncrona (chat por tópicos) entre utentes e profissionais de saúde. Sem videochamadas. Privacidade primeiro, RGPD.

- **Web app**: https://app.wysta.health
- **Landing**: https://wysta.health

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend (iOS, Android, Web) | Expo SDK 55 + Expo Router 55 |
| Backend / DB / Realtime / Storage | Convex |
| Auth | `@convex-dev/auth` (email/password) |
| Hosting | Cloudflare Pages (web + landing) |
| Package manager | bun |

## Estrutura

```
app/                # Expo Router — grupos (auth) / (patient) / (professional) / (admin)
convex/             # Schema + funções backend (queries, mutations, http)
components/ui/      # Button, Input, Icon
contexts/           # TabBarContext
hooks/              # useCurrentUser
lib/                # storage.ts (+.web.ts) — SecureStore / localStorage
constants/          # theme, topics, strings
screens/            # Componentes de ecrã partilhados
marketing/          # Landing estática (wysta.health)
docs/               # ENGINEERING.md, TASKS.md, plans/
```

Routing usa layouts separados por plataforma:
- `_layout.tsx` → `NativeTabs` (`expo-router/unstable-native-tabs`) em iOS/Android
- `_layout.web.tsx` → `Tabs` standard com Ionicons em web

## Setup

Pré-requisitos: [bun](https://bun.sh), Xcode (iOS), Android Studio (Android).

```sh
bun install
bunx convex dev    # inicia deployment dev e gera .env.local + convex/_generated
bun run start      # Expo dev server (i = iOS, a = Android, w = web)
```

`convex dev` deve continuar a correr em paralelo durante o desenvolvimento para sincronizar o schema/funções.

## Scripts

| Comando | Efeito |
|---------|--------|
| `bun run start` | Expo dev server |
| `bun run ios` / `android` / `web` | Lançar plataforma específica |
| `bun run lint` | ESLint (config Expo) |
| `bun run build:web` | `expo export -p web` → `dist/` |
| `bun run build:cf` | `convex deploy --cmd 'bun run build:web'` (usado pelo CI da CF Pages) |

## Deploy

Dois projetos separados na **Cloudflare Pages**, ambos ligados a este repositório:

**App** (`app.wysta.health`)
- Build command: `bun run build:cf`
- Output: `dist/`
- Env vars: `CONVEX_DEPLOY_KEY`, `NODE_VERSION=20`
- SPA fallback: auto-detectado pela CF Pages (sem `404.html` em `dist/`)

**Landing** (`wysta.health`, `www.wysta.health`)
- Build command: `exit 0`
- Output: `marketing/`

A CF Pages dispara em cada push para `main`. O `--cmd` do `convex deploy` garante que o backend é publicado **antes** do upload do bundle web, evitando incompatibilidades de schema em produção.

## Domínios e localização

- Backend Convex prod em **EU-west-1** (`loyal-dolphin-681.eu-west-1.convex.cloud`) por requisitos RGPD
- UI strings em PT-PT; código e comentários em inglês

## Documentação

- `CLAUDE.md` — contexto rápido para o assistente
- `docs/ENGINEERING.md` — schema, decisões de arquitetura
- `docs/TASKS.md` — roadmap e estado das fases
- `contexto-plataforma.md` — visão de produto
