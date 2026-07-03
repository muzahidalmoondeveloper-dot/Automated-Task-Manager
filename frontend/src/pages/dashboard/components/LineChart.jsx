import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function TaskCompletionChart({ data }) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-white text-lg font-semibold mb-1">Task Completion Progress</h3>
          <p className="text-gray-400 text-sm">7-day cumulative view with daily breakdown.</p>
        </div>
        <button className="bg-dark-bg border border-dark-border text-gray-300 px-3 py-2 rounded text-sm font-medium flex items-center gap-2">
          7 Days
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="day" stroke="#94A3B8" style={{ fontSize: '12px' }} />
          <YAxis stroke="#94A3B8" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '8px' }}
            labelStyle={{ color: '#fff' }}
          />
          <Line
            type="monotone"
            dataKey="completed"
            stroke="#22C55E"
            dot={{ fill: '#22C55E', r: 5 }}
            activeDot={{ r: 7 }}
            strokeWidth={2}
            name="Completed Tasks"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
