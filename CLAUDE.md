# Wysta — Project Context for Claude

## O que é isto

Plataforma digital de saúde sexual e reprodutiva feminina, contexto português. Comunicação assíncrona (chat por tópicos) entre utentes e profissionais de saúde. Sem videochamadas. Foco em privacidade e RGPD.

## Stack

- **Frontend**: Expo (React Native) + Expo Router — iOS, Android, Web
- **Backend**: Convex (realtime, DB, file storage)
- **Auth**: @convex-dev/auth (email/password)

## Roles

- `patient` — utente
- `professional` — profissional de saúde (responde conversas, notas internas)
- `admin` — gestão de utilizadores, sem acesso a conteúdo clínico

## Documentação de referência

- Contexto completo de engenharia: `docs/ENGINEERING.md`
- Tarefas e roadmap: `docs/TASKS.md`
- Contexto de produto: `contexto-plataforma.md`
- Protótipo antigo (Vite + React, web): `prototipo_OLD/`
- Wireframes: `wireframes/`

## Convenções

- Código e comentários em inglês
- Strings visíveis ao utilizador em português (PT)
- Expo Router com grupos de rotas: `(auth)`, `(patient)`, `(professional)`, `(admin)`
- Lógica de negócio no backend Convex, não no frontend
- Notas internas de profissionais: campo `isInternal: true` em `messages`, filtradas no backend

## Estado atual

Starter template limpo (Expo + Convex). A construir de raiz.
Ver `docs/TASKS.md` para o estado das tarefas.
