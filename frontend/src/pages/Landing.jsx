import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import BrandLogo from '../components/BrandLogo'
import LanguageSwitcher from '../components/LanguageSwitcher'
import ThemeSwitcher from '../components/ThemeSwitcher'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import {
  faGem,
  faPercent,
  faRightToBracket,
  faShoppingBag,
  faTrophy,
  faUserPlus,
} from '../lib/icons'

const TIERS = [
  { key: 'Bronze', points: '0', multiplier: '1.0x', descKey: 'bronzeDesc', className: 'tier-Bronze' },
  { key: 'Silver', points: '500', multiplier: '1.2x', descKey: 'silverDesc', className: 'tier-Silver' },
  { key: 'Gold', points: '2,000', multiplier: '1.5x', descKey: 'goldDesc', className: 'tier-Gold' },
  { key: 'Platinum', points: '6,000', multiplier: '2.0x', descKey: 'platinumDesc', className: 'tier-Platinum' },
  { key: 'Diamond', points: '15,000', multiplier: '2.5x', descKey: 'diamondDesc', className: 'tier-Diamond' },
]

export default function Landing() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const destination = user ? (user.role === 'admin' ? '/admin' : '/app') : '/signin'

  const steps = [
    { icon: faUserPlus, title: t('step1Title'), copy: t('step1Copy') },
    { icon: faShoppingBag, title: t('step2Title'), copy: t('step2Copy') },
    { icon: faGem, title: t('step3Title'), copy: t('step3Copy') },
    { icon: faTrophy, title: t('step4Title'), copy: t('step4Copy') },
  ]

  return (
    <div className="landing-page">
      <a href="#main-content" className="skip-link">{t('skipToContent')}</a>
      <header className="landing-hero">
        <div className="landing-glow" aria-hidden="true" />
        <div className="landing-dots" aria-hidden="true" />

        <div className="landing-topbar">
          <BrandLogo size="sm" to="/" variant="light" />
          <div className="landing-topbar-actions">
            <ThemeSwitcher variant="icon" />
            <LanguageSwitcher />
          </div>
        </div>

        <div className="landing-content">
          <BrandLogo size="hero" to={false} variant="light" className="landing-hero-logo" />
          <h1 className="landing-kicker">{t('landingTagline')}</h1>
          <p className="landing-copy">{t('landingCopy')}</p>
          <div className="landing-actions">
            <Link to={destination} className="btn btn-primary px-6">
              <FontAwesomeIcon icon={user ? faGem : faRightToBracket} aria-hidden="true" />
              {user ? t('openPanel') : t('signIn')}
            </Link>
            {!user && (
              <Link to="/signup" className="btn btn-landing-ghost">
                <FontAwesomeIcon icon={faUserPlus} aria-hidden="true" />
                {t('joinMembership')}
              </Link>
            )}
            <a href="#how-it-works" className="btn btn-landing-ghost">
              {t('learnMore')}
            </a>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
      <section id="how-it-works" className="landing-section" aria-labelledby="how-it-works-title">
        <div className="landing-section-inner">
          <p className="section-eyebrow">{t('howItWorks')}</p>
          <h2 id="how-it-works-title" className="section-title">{t('howItWorks')}</h2>
          <p className="section-copy">{t('howItWorksCopy')}</p>

          <div className="steps-grid">
            {steps.map((step, index) => (
              <article key={step.title} className="step-card" style={{ animationDelay: `${index * 0.06}s` }}>
                <div className="step-index">{index + 1}</div>
                <div className="step-icon">
                  <FontAwesomeIcon icon={step.icon} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="tiers" className="landing-section landing-section-alt" aria-labelledby="tiers-title">
        <div className="landing-section-inner">
          <p className="section-eyebrow">{t('tiersAndPoints')}</p>
          <h2 id="tiers-title" className="section-title">{t('tiersAndPoints')}</h2>
          <p className="section-copy">{t('tiersAndPointsCopy')}</p>

          <div className="rules-grid">
            <div className="rule-card">
              <FontAwesomeIcon icon={faGem} className="rule-icon" />
              <h3>{t('pointsRuleTitle')}</h3>
              <p>{t('pointsRuleCopy')}</p>
            </div>
            <div className="rule-card">
              <FontAwesomeIcon icon={faPercent} className="rule-icon" />
              <h3>{t('tierRuleTitle')}</h3>
              <p>{t('tierRuleCopy')}</p>
            </div>
          </div>

          <div className="tiers-grid">
            {TIERS.map((tier) => (
              <article key={tier.key} className="tier-card">
                <span className={`tier-pill ${tier.className}`}>{t(tier.key)}</span>
                <div className="tier-meta">
                  <div>
                    <span className="tier-meta-label">{t('minTierPoints')}</span>
                    <strong>{tier.points}</strong>
                  </div>
                  <div>
                    <span className="tier-meta-label">{t('multiplierLabel')}</span>
                    <strong>{tier.multiplier}</strong>
                  </div>
                </div>
                <p>{t(tier.descKey)}</p>
              </article>
            ))}
          </div>

          <div className="landing-section-cta">
            <Link to={user ? destination : '/signup'} className="btn btn-primary px-6">
              <FontAwesomeIcon icon={user ? faGem : faUserPlus} />
              {user ? t('openPanel') : t('joinMembership')}
            </Link>
          </div>
        </div>
      </section>

      </main>

      <footer className="landing-footer">
        <BrandLogo size="sm" to="/" variant="light" />
        <span>© {new Date().getFullYear()} 29 Jewellery</span>
      </footer>
    </div>
  )
}
