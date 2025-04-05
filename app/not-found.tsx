import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center">
      <h2 className="text-2xl font-bold mb-4">Страница не найдена</h2>
      <p className="mb-4">Не удалось найти запрошенный ресурс.</p>
      <Link href="/" className="text-primary-600 hover:underline">
        Вернуться на главную
      </Link>
    </div>
  )
} 