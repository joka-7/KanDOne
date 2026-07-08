import { useEffect } from 'react';
import TasksApp from './TasksApp';
import { completeRedirectSignIn } from './firebase';

export default function App() {
  useEffect(() => {
    // Resolve any pending Google redirect sign-in on load.
    completeRedirectSignIn().catch(() => {});
  }, []);

  return <TasksApp />;
}
