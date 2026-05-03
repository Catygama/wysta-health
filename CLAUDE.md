# Wysta — Project Context for Claude

## O que é isto

Plataforma digital de saúde sexual e reprodutiva feminina, contexto português. Comunicação assíncrona (chat por tópicos) entre utentes e profissionais de saúde. Sem videochamadas. Foco em privacidade e RGPD.

## Stack

- **Frontend**: Expo SDK 55 (React Native 0.83) + Expo Router 55 — iOS, Android, Web
- **Backend**: Convex (realtime, DB, file storage) — deploy prod em EU-west-1 (`loyal-dolphin-681`)
- **Auth**: @convex-dev/auth — providers `Password` + `Anonymous` (guest)
- **Package manager**: bun
- **Hosting**: Cloudflare Pages (web app + landing), domínios `app.wysta.health` e `wysta.health`

## Roles

- `patient` — utente
- `professional` — profissional de saúde (responde conversas, notas internas)
- `admin` — gestão de utilizadores, sem acesso a conteúdo clínico

## Estrutura de pastas

```
app/                            # Expo Router
  _layout.tsx                   # ConvexAuthProvider + KeyboardProvider
  index.tsx                     # Redireciona por role (auth → onboarding → patient/professional/admin)
  (auth)/                       # login, register, onboarding
  (patient)/
    _layout.tsx                 # NativeTabs (iOS/Android)
    _layout.web.tsx             # Tabs web (Ionicons)
    index, conversations/, education/, profile, triage
  (professional)/
    _layout.tsx + _layout.web.tsx
    queue, conversations/, education/
  (admin)/                      # Painel de gestão de utilizadores

convex/                         # Backend
  schema.ts                     # userProfiles, conversations, messages, triageQuestions, educationalContent, auditLog
  auth.ts, auth.config.ts, http.ts
  users.ts, conversations.ts, messages.ts, triage.ts, education.ts

components/ui/                  # Button, Input, Icon (SF Symbols + Ionicons)
contexts/TabBarContext.tsx      # Esconder tab bar em ecrãs específicos
hooks/useCurrentUser.ts         # Wrapper de api.users.currentUser
lib/storage.ts + storage.web.ts # SecureStore (nativo) / localStorage (web)
constants/                      # theme.ts (PlatformColor + fallbacks), topics.ts, strings.ts
screens/                        # Componentes de ecrã partilhados (ConversationList, MessageThread, EducationScreen, etc.)
marketing/index.html            # Landing estática (wysta.health)
docs/                           # ENGINEERING.md, TASKS.md, plans/
```

## Convenções

- **Idioma**: código e comentários em inglês; strings visíveis ao utilizador em PT
- **Campos de profissional** no schema sempre prefixados (`professionalLicenseNumber`, `professionalSpecialty`, `professionalVerificationStatus`, `professionalVerificationDocuments`, `professionalVerificationNotes`) para distinguir de campos de utente
- **Routing**: Expo Router com grupos `(auth)`, `(patient)`, `(professional)`, `(admin)`
- **Tabs**: layout duplo `_layout.tsx` (NativeTabs via `expo-router/unstable-native-tabs`) e `_layout.web.tsx` (`Tabs` standard) — Metro escolhe a variante por plataforma
- **Ícones**: `components/ui/Icon.tsx` mapeia SF Symbols (iOS) ↔ Ionicons (Android/web). Nas tabs nativas usa-se diretamente `NativeTabs.Trigger.Icon` com `sf` + `md`
- **Storage de auth**: `lib/storage.ts` (SecureStore) com override `.web.ts` (localStorage) — passado a `ConvexAuthProvider`
- **Tema**: `constants/theme.ts` usa `PlatformColor` em iOS e fallbacks hex noutras plataformas
- **Lógica de negócio no backend Convex**, não no frontend
- **Notas internas de profissionais**: campo `isInternal: true` em `messages`, filtradas no backend

## Auth flows

- `(auth)/login.tsx` — utente: email/password, "Entrar como convidada" (anónimo), link para profissional
- `(auth)/register.tsx` — utente signup
- `(auth)/professional-login.tsx` — profissional: login + guest mode
- `(auth)/professional-signup.tsx` — pedido de verificação multi-secção (conta, identificação, cédula, documentos, notas). Auto-verifica para já — TODO no backend (`users.submitProfessionalVerification`) para passar a `pending` quando existir UI de aprovação.
- Guest controlado por `EXPO_PUBLIC_GUEST_AUTH` — qualquer valor que não seja `false` ou `0` mantém os botões visíveis (default: ativo).

## Deploy

- **Convex prod**: `bunx convex deploy` (ou via CF build com `CONVEX_DEPLOY_KEY`)
- **App web** (`app.wysta.health`): CF Pages, build command `bun run build:cf` (= `convex deploy --cmd 'bun run build:web'`), output `dist/`
- **Landing** (`wysta.health`): CF Pages, build command `exit 0`, output `marketing/`
- SPA fallback: CF Pages auto-deteta (não há `404.html` em `dist/`)

## Documentação de referência

- Engenharia: `docs/ENGINEERING.md`
- Tarefas e roadmap: `docs/TASKS.md`
- Produto: `contexto-plataforma.md`
- Protótipo antigo (Vite + React, web): `prototipo_OLD/`
- Wireframes: `wireframes/`
