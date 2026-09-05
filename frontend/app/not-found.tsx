import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-16 text-center">
      {/* 大数字 */}
      <div className="text-9xl font-black text-gray-100 dark:text-gray-800 select-none leading-none mb-2">
        404
      </div>
      <div className="text-4xl mb-6">🔍</div>

      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-3">
        页面未找到
      </h1>
      <p className="text-gray-500 dark:text-gray-400 max-w-md leading-relaxed mb-8">
        你访问的页面不存在，可能已被删除或链接有误。
        不如换一个方向继续探索？
      </p>

      {/* 快捷跳转 */}
      <div className="flex flex-wrap gap-3 justify-center">
        <Link href="/problems"
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500
            text-white text-sm font-medium transition-all">
          🔢 去刷题
        </Link>
        <Link href="/patterns"
          className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700
            text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
          🧩 算法模式
        </Link>
        <Link href="/graph"
          className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700
            text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
          🕸️ 知识图谱
        </Link>
      </div>
    </div>
  );
}
