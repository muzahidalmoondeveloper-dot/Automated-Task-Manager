export default function QuickSummary({ data }) {
  const colors = {
    'Todo': 'bg-gray-100 text-gray-700',
    'In Progress': 'bg-blue-100 text-blue-700',
    'Pending Review': 'bg-orange-100 text-orange-700',
    'Done': 'bg-green-100 text-green-700',
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-6">
      <h3 className="text-white text-lg font-semibold mb-6">Quick Summary</h3>

      <div className="space-y-3">
        {data.map((item, index) => (
          <div
            key={index}
            className={`${colors[item.label] || 'bg-gray-100'} rounded-lg p-4 flex items-center justify-between`}
          >
            <span className="font-medium">{item.label}</span>
            <span className="text-lg font-bold">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
