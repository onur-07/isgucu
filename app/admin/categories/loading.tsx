export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-3">
        <div className="h-10 w-10 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin mx-auto" />
        <div className="text-xs font-black uppercase tracking-widest text-gray-400">
          Kategoriler yükleniyor...
        </div>
      </div>
    </div>
  );
}
