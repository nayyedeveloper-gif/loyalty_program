/** Page title shown above the spin wheel. */
export default function Title({ title, onHelp }) {
  return (
    <div className="spin-title-row">
      <h2 className="cx-title spin-page-title">{title}</h2>
      {onHelp && (
        <button
          type="button"
          className="help-icon-btn"
          aria-label="Help"
          title="Help"
          onClick={onHelp}
        >
          ?
        </button>
      )}
    </div>
  )
}
