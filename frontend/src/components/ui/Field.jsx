export default function Field({ id, label, help, error, children, className, optional }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="ql-label">
          {label}
          {optional && <span className="ml-1 font-normal text-admin-muted">(optional)</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="ql-error" role="alert">
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="ql-help mt-1">
          {help}
        </p>
      ) : null}
    </div>
  );
}
