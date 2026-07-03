import { PieChart as MuiPieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'

export default function PieChart({ data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-white text-lg font-semibold mb-1">Task Distribution</h3>
        <p className="text-gray-400 text-sm">Status breakdown of all tasks.</p>
      </div>
      <div className="flex justify-center">
        <ResponsiveContainer width="100%" height={300}>
          <MuiPieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={120}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '8px', color: '#632280' }}
            />
          </MuiPieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-6 space-y-3">
        {data.map((item, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
              <span className="text-gray-300 text-sm">{item.name}</span>
            </div>
            <span className="text-white font-medium">{item.value} (0%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}
