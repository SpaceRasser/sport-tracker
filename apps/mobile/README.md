# Mobile (Expo)

## Setup

1. Copy `.env.example` to `.env` and update the API URL when needed.
2. Install dependencies from the repo root:

```bash
pnpm install
```

> ⚠️ На реальном устройстве `localhost` не работает. Укажите IP вашего компьютера в сети
> (например, `http://192.168.0.10:3000`) или используйте туннель.

## Commands

```bash
pnpm mobile:dev
pnpm mobile:android
pnpm mobile:ios
```

## Windows note

Если на Windows при `expo start --android` возникает ошибка `ENOENT mkdir ...\\.expo\\metro\\externals\\node:sea`,
то помогло добавить `metro.config.js` с отключёнными node externals и очистить кеш:

```bash
pnpm --filter mobile start:clear
```
