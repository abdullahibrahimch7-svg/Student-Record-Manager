# Student Record Manager

A dark-themed student records website built with HTML, CSS, and JavaScript. Users can create an account, sign in, and keep their student records synced with Firebase.

**Created by Abdullah Ibrahim**

## Features

- Email and password account creation and sign-in
- Password reset and sign-out
- Student records saved to the signed-in user's Cloud Firestore account
- Add students, add subjects, update marks, and delete records
- Search, filter, and sort student records
- Class overview and performance charts
- CSV report export
- Responsive dark theme

## Run locally

This is a static website; it does not require npm or a local backend.

1. Clone or download this repository.
2. Open the project folder in Visual Studio Code.
3. Use the **Live Server** extension to open the root `index.html` file.
4. Sign in or create an account.

You need an internet connection to use Firebase authentication and cloud sync. Opening the page directly as a `file://` URL may prevent Firebase modules from loading; use Live Server instead.

## Firebase project setup

The website uses Firebase Authentication and Cloud Firestore. Configure Firebase once for the website; each user creates their own account.

1. Create a Firebase project and register a **Web app**.
2. In **Authentication → Sign-in method**, enable **Email/Password**.
3. Create a **Cloud Firestore** database. The database ID can remain `(default)`.
4. Copy the Firebase Web app configuration into `static/firebase-config.js`, replacing the values there.
5. In **Authentication → Settings → Authorized domains**, add the domain used to access the website. For local testing, add `localhost` or `127.0.0.1` if needed.
6. In the Firestore **Rules** tab, publish the contents of `firestore.rules`.

The included `static/firebase-config.js` is configured for the project's Firebase web app. Firebase web configuration is intended to be present in client-side code; never add a Firebase service-account key or other private credentials to this repository.

The rules in `firestore.rules` restrict each signed-in user to records under their own account. Do not replace them with open test-mode rules.

## Deploy with Firebase Hosting

Install the Firebase CLI, open a terminal in the project folder, then run:

```bash
firebase login
firebase use --add
firebase deploy --only firestore:rules,hosting
```

During `firebase use --add`, select the Firebase project configured in `static/firebase-config.js`. After deployment, add the Hosting domain to Authentication's authorized domains if it is not already listed.

## Data and backups

Student records are stored in Cloud Firestore under each user's Firebase account and can be accessed when signed in on another device. If the browser has records from the earlier local-only version, the website offers to import them after sign-in; the local copy is retained.

Use **Export report** in the dashboard to download a CSV copy of the records. Scheduled Firestore backups are optional and may incur charges. Firebase usage is subject to current quotas and pricing; review [Firebase pricing](https://firebase.google.com/pricing) before enabling paid features.
