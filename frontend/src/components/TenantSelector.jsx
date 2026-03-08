export default function TenantSelector({ tenants, selected, onSelect }) {
  if (tenants.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <label className="text-sm font-medium text-gray-500 block mb-2">Active Tenant</label>
      <div className="flex flex-wrap gap-2">
        {tenants.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selected?.id === t.id
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t.company_name}
          </button>
        ))}
      </div>
    </div>
  )
}
