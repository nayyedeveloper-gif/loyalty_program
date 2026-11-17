import { useLanguage } from '../../../context/LanguageContext'

/** Page title shown above the spin wheel. */
export default function Title({ title, onHelp }) {
  const { t } = useLanguage()
  return (
    <div className="spin-title-row">
      <h2 className="cx-title spin-page-title">{title}</h2>
      {onHelp && (
        <button
          type="button"
          className="help-icon-btn"
          aria-label={t('spinHelp')}
          title={t('spinHelp')}
          onClick={onHelp}
        >
          ?
        </button>
      )}
    </div>
  )
}
