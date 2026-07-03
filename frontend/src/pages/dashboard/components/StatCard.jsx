export default function StatCard({ title, value, description, icon: Icon, color }) {
  const colorClasses = {
    blue: 'bg-blue-50',
    orange: 'bg-orange-50',
    green: 'bg-green-50',
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-6 flex flex-col justify-between h-full">
      <div>
        <h3 className="text-gray-400 text-sm font-medium mb-2">{title}</h3>
        <p className="text-white text-4xl font-bold mb-2">{value}</p>
        <p className="text-gray-400 text-sm">{description}</p>
      </div>
      <div className={`${colorClasses[color] || 'bg-blue-50'} w-12 h-12 rounded-lg flex items-center justify-center`}>
        {Icon && <Icon className="w-6 h-6" />}
      </div>
    </div>
  )
}
