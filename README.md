# NAPO Client

React Native / Expo mobile client for NAPO.

## Requirements

- Node.js 22.13+ recommended for Expo SDK 57
- npm
- Expo Go or Android emulator

## Run

```powershell
cd C:\Workspace\napo-client
npm install
$env:EXPO_PUBLIC_API_BASE_URL="http://10.0.2.2:8080"
npm run android
```

For iOS simulator, use:

```powershell
$env:EXPO_PUBLIC_API_BASE_URL="http://localhost:8080"
npm run ios
```

For a physical phone, set `EXPO_PUBLIC_API_BASE_URL` to your computer LAN IP, for example:

```powershell
$env:EXPO_PUBLIC_API_BASE_URL="http://192.168.1.50:8080"
```

## Current MVP

- Email/password login and account creation against the Spring Boot API
- NAPO JWT stored in memory for the current session
- Chat-first interface inspired by ChatGPT mobile
- Left drawer with reminders, refresh, edit, and delete actions
- Light/dark theme toggle
- Chat sends messages to `POST /api/chat/messages`
- Reminder list fetch through `Authorization: Bearer <accessToken>`

Google Sign-In will be added in the next increment.