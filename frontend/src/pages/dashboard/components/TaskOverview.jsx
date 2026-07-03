export default function TaskOverview({ data }) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-white text-lg font-semibold mb-1">Task Status Overview</h3>
            <p className="text-gray-400 text-sm">Todo, in progress, and completed task distribution.</p>
          </div>
          <span className="text-gray-400 text-sm">{data.reduce((sum, item) => sum + item.value, 0)} total</span>
        </div>
      </div>

      <div className="space-y-4">
        {data.map((item, index) => (
          <div key={index}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-300 text-sm font-medium">{item.label}</span>
              <span className="text-gray-400 text-sm">{item.percentage} (0%)</span>
            </div>
            <div className="w-full bg-dark-bg rounded-full h-2">
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: ['#94A3B8', '#3B82F6', '#FBBF24', '#86EFAC'][index]
                }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
