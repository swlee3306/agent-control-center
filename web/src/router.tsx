import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { DashboardPage } from './screens/DashboardPage';
import { TaskDetailPage } from './screens/TaskDetailPage';

export const router = createBrowserRouter(
  [
    { path: '/', element: <DashboardPage /> },
    { path: '/tasks/:taskId', element: <TaskDetailPage /> },
  ],
  {
    // Works with Vite base when deployed under a subpath.
    basename: import.meta.env.BASE_URL,
  },
);
