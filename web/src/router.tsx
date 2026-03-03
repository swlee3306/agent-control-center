import React from 'react';
import { Navigate, createBrowserRouter, useParams } from 'react-router-dom';
import { DashboardPage } from './screens/DashboardPage';
import { HelpPage } from './screens/HelpPage';
import { TaskDetailPage } from './screens/TaskDetailPage';
import { AgentConsolePage } from './screens/AgentConsolePage';

function MobileTaskRedirect() {
  const { taskId } = useParams() as { taskId?: string };
  return <Navigate to={taskId ? `/tasks/${encodeURIComponent(taskId)}` : '/'} replace />;
}

export const router = createBrowserRouter(
  [
    { path: '/', element: <DashboardPage /> },
    { path: '/help', element: <HelpPage /> },
    { path: '/tasks/:taskId', element: <TaskDetailPage /> },
    { path: '/tasks/:taskId/console/:role', element: <AgentConsolePage /> },
    // Deprecated: keep a redirect so old bookmarks don't break
    { path: '/m/tasks/:taskId', element: <MobileTaskRedirect /> },
  ],
  {
    // Works with Vite base when deployed under a subpath.
    basename: import.meta.env.BASE_URL,
  },
);
