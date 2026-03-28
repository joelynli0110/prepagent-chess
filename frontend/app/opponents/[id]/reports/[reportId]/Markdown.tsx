"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-3 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl font-semibold text-gray-900 mt-5 mb-2 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-semibold text-gray-800 mt-4 mb-1.5 first:mt-0">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-sm leading-relaxed text-gray-700 mb-3 last:mb-0">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-outside pl-5 space-y-1 mb-3 text-sm text-gray-700">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-outside pl-5 space-y-1 mb-3 text-sm text-gray-700">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-900">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-gray-600">{children}</em>
        ),
        code: ({ children, className }) => {
          const isBlock = !!className;
          return isBlock ? (
            <code className="block rounded-lg bg-gray-50 border px-4 py-3 font-mono text-xs text-gray-700 overflow-auto mb-3">
              {children}
            </code>
          ) : (
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700">
              {children}
            </code>
          );
        },
        pre: ({ children }) => <>{children}</>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-gray-200 pl-4 italic text-gray-500 my-3 text-sm">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-4 border-gray-200" />,
        table: ({ children }) => (
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-sm border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-gray-200 px-3 py-2 text-gray-700">{children}</td>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
