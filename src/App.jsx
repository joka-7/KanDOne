import { useEffect } from 'react';
import TasksApp from './TasksApp';
import { completeRedirectSignIn } from './firebase';

export default function App() {
  useEffect(() => {
    // Resolve any pending Google redirect sign-in on load. The Firebase SDK
    // itself is loaded lazily inside firebase.js; this no-ops when no redirect
    // is pending so cold offline visits skip the auth/Firestore chunk.
    completeRedirectSignIn().catch(() => {});
  }, []);

  return <TasksApp />;
}
