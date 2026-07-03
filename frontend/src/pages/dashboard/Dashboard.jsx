import { useState } from 'react';
import StatCard from '../dashboard/components/StatCard';
import TaskOverview from '../dashboard/components/TaskOverview';
import QuickSummary from '../dashboard/components/QuickSummary';
import LineChart from '../dashboard/components/LineChart';
import PieChart from '../dashboard/components/PieChart';
import { dashboardData } from '../dashboard/data/mockData';
import { Bell, CheckSquare, Clock, ListTodo } from 'lucide-react';

export default function DashboardPage() {
  const [data] = useState(dashboardData)

  return (
    <div className="min-h-screen bg-dark-bg text-white">
      {/* Header */}
      {/* <header className="border-b border-dark-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Automated Task Manager</h1>
            <p className="text-gray-400 text-sm">Meeting action items to tasks</p>
          </div>
          <button className="p-2 hover:bg-dark-card rounded-lg transition">
            <Bell size={24} />
          </button>
        </div>
      </header> */}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Dashboard</h2>
          <p className="text-gray-400">Welcome back, Shimanta Sarker. Here is your workspace overview.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="My Tasks"
            value={data.myTasks}
            description="Tasks assigned to you"
            icon={ListTodo}
            color="blue"
          />
          <StatCard
            title="Pending Review"
            value={data.pendingReview}
            description="Awaiting manager approval"
            icon={Clock}
            color="orange"
          />
          <StatCard
            title="Completed"
            value={data.completed}
            description="Approved and done"
            icon={CheckSquare}
            color="green"
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Task Status Overview */}
          <div className="lg:col-span-2">
            <TaskOverview data={data.taskStatusOverview} />
          </div>

          {/* Quick Summary */}
          <div>
            <QuickSummary data={data.taskStatusOverview} />
          </div>
        </div>

        {/* Bottom Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Line Chart */}
          <LineChart data={data.completionProgress} />

          {/* Pie Chart */}
          <PieChart data={data.taskDistribution} />
        </div>
      </main>
    </div>
  )
}
