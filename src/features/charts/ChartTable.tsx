/** The numbers behind a chart, as a table: the accessible way to read them and the precise one. */
export function ChartTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <details className="text-sm">
      <summary className="flex min-h-12 cursor-pointer items-center font-semibold text-accent underline underline-offset-4">View as table</summary>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-left">
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={i} scope="col" className="px-2 py-1.5 font-medium text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) =>
                  j === 0 ? (
                    <th key={j} scope="row" className="px-2 py-1.5 font-medium text-fg">{c}</th>
                  ) : (
                    <td key={j} className="tabular px-2 py-1.5 text-fg">{c}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
