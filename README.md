<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Invox

Invox is a React, Vite, TypeScript, TailwindCSS, Firebase, and Gemini application.

View your app in AI Studio: https://ai.studio/apps/drive/19fUODCGQATBSnny7TxW2l1eA0G2Dau6W

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Firebase, App Check, and Gemini values.
3. Run the app:
   `npm run dev`

## Firebase

- Firestore rules: `firestore.rules`
- Storage rules: `storage.rules`
- Firestore indexes: `firestore.indexes.json`
- Cloud Functions: `functions/src/index.ts`
- Hosting output: `dist`

Deploy rules and indexes with Firebase CLI after authenticating:

`firebase deploy --only firestore,storage`

Build and deploy Functions from `functions` after installing its dependencies:

`npm install && npm run build && firebase deploy --only functions`
