export function PageLoader({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="page-loader">
      <div className="spinner" aria-hidden />
      <p className="muted">{message}</p>
    </div>
  );
}
