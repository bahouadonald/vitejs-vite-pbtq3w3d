import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBv4kugD9oN0BqQcBKqg6FzTMTp0dft3SE",
  authDomain: "drop-platform-68cbc.firebaseapp.com",
  projectId: "drop-platform-68cbc",
  storageBucket: "drop-platform-68cbc.firebasestorage.app",
  messagingSenderId: "643930489994",
  appId: "1:643930489994:web:b549c30df22d826d645973"
};

const app = initializeApp(firebaseConfig);

// Firestore avec cache local persistant (IndexedDB) :
// les donnees s'affichent instantanement au retour + lecture hors-ligne.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export const auth = getAuth(app);

// Session persistante — le fan reste connecte
setPersistence(auth, browserLocalPersistence).catch(console.error);

export default app;
