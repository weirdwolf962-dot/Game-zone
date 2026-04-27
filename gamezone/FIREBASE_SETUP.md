# GameZone — Firebase Setup Guide

## Step 1: Create a Firebase Project

1. Go to https://console.firebase.google.com
2. Click **"Add project"**
3. Name it `gamezone` (or anything you like)
4. Disable Google Analytics (not needed), click **Create Project**

---

## Step 2: Enable Google Auth

1. In Firebase Console → **Authentication** → **Sign-in method**
2. Click **Google** → Enable it
3. Add your support email → **Save**

---

## Step 3: Create Realtime Database

1. Go to **Realtime Database** → **Create Database**
2. Choose a region (e.g. `asia-southeast1` for India)
3. Start in **Test mode** (you'll add security rules below)

---

## Step 4: Get Your Config

1. Go to **Project Settings** (gear icon) → **Your Apps**
2. Click **"Add app"** → Choose **Web** (</>)
3. Register with name `gamezone-web`
4. Copy the `firebaseConfig` object

---

## Step 5: Paste Config into the App

Open `src/lib/firebase.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
}
```

---

## Step 6: Set Realtime Database Rules

In Firebase Console → **Realtime Database** → **Rules**, paste:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid == $uid"
      }
    },
    "rooms": {
      "$roomCode": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

Click **Publish**.

---

## Step 7: Add Authorized Domain (for deployment)

If you deploy to Vercel/Netlify:
1. **Authentication** → **Settings** → **Authorized domains**
2. Add your Vercel/Netlify URL

---

## Running the App

```bash
npm install
npm run dev
```

Open http://localhost:5173 — done! 🎮
