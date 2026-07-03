export const dashboardData = {
  myTasks: 0,
  pendingReview: 0,
  completed: 0,
  taskStatusOverview: [
    { label: 'Todo', value: 10, percentage: 30 },
    { label: 'In Progress', value: 5, percentage: 10 },
    { label: 'Pending Review', value: 1, percentage: 5 },
    { label: 'Done', value: 5, percentage: 70 },
  ],
  taskDistribution: [
    { name: 'Todo', value: 10, color: '#94A3B8' },
    { name: 'In Progress', value: 3, color: '#3B82F6' },
    { name: 'Pending Review', value: 5, color: '#FBBF24' },
    { name: 'Done', value: 2, color: '#86EFAC' },
  ],
  completionProgress: [
    { day: '7 days ago', completed: 5 },
    { day: '6 days ago', completed: 3 },
    { day: '5 days ago', completed: 8 },
    { day: '4 days ago', completed: 1 },
    { day: '3 days ago', completed: 3 },
    { day: '2 days ago', completed: 1 },
    { day: 'Yesterday', completed: 5 },
    { day: 'Today', completed: 0 },
  ]
}
