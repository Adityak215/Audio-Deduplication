function formatTime(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function getKey(warning, index) {
  return warning.id || `${warning.file1?.id}-${warning.file2?.id}-${index}`;
}

export default function WarningList({ title, warnings, emptyMessage }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        <span className="badge">{warnings.length}</span>
      </div>

      {warnings.length === 0 ? (
        <p className="muted">{emptyMessage}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Similarity</th>
                <th>File A</th>
                <th>File B</th>
                <th>Detected</th>
              </tr>
            </thead>
            <tbody>
              {warnings.map((warning, index) => (
                <tr key={getKey(warning, index)}>
                  <td>{Number(warning.similarityPercent).toFixed(2)}%</td>
                  <td>{warning.file1?.filename || '-'}</td>
                  <td>{warning.file2?.filename || '-'}</td>
                  <td>{formatTime(warning.detectedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
