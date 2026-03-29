import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp, orderBy, getDocFromServer, doc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Hero } from './constants';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Error Handling Spec
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection Test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful.");
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
    // Log other errors for debugging
    console.warn("Firestore connection test warning:", error);
  }
}
testConnection();

// Auth helpers
export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

// Guide types
export interface Guide {
  id?: string;
  title: string;
  content: string;
  heroName: string;
  tags?: string[];
  authorUid: string;
  authorName?: string;
  authorPhoto?: string;
  createdAt?: any;
}

// Firestore helpers
export const addGuide = async (guide: Omit<Guide, 'id' | 'createdAt'>) => {
  const path = 'guides';
  try {
    return await addDoc(collection(db, path), {
      ...guide,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const getGuidesForHero = async (heroName: string): Promise<Guide[]> => {
  const path = 'guides';
  try {
    const q = query(
      collection(db, path),
      where('heroName', '==', heroName),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Guide));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const getAllHeroes = async (): Promise<Hero[]> => {
  const path = 'heroes';
  try {
    const querySnapshot = await getDocs(collection(db, path));
    return querySnapshot.docs.map(doc => doc.data() as Hero);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const seedHeroes = async (heroes: Hero[]) => {
  const path = 'heroes';
  try {
    for (const hero of heroes) {
      // Use season and name as ID to avoid duplicates across different seasons
      const docId = `${hero.season}_${hero.name}`.replace(/\//g, '_');
      await setDoc(doc(db, path, docId), hero);
    }
    console.log("Seeding complete.");
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};
