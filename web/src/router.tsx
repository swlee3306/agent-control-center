import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { DashboardPage } from './screens/DashboardPage';
import { TaskDetailPage } from './screens/TaskDetailPage';

export const router = createBrowserRouter([
  { path: '/', element: <DashboardPage /> },
  { path: '/tasks/:taskId', element: <TaskDetailPage /> },
]);
