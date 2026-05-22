import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const articleSections = [
  {
    kicker: 'Box 1',
    title: 'What kinds of problems involve latent variables?',
    body: 'Problems with hidden states or missing measurements—such as determining which cluster produced a point, identifying document topics, or inferring unobserved disease states.',
    insight: 'Latent variables act as bridges when direct observation is impossible.',
    more: 'In topic modeling (LDA) or speech recognition (HMMs), we observe words or sound signals but cannot see the underlying topic or phonetic state. Latent variables allow us to model these complex dependencies mathematically.',
    visual: 'hidden',
  },
  {
    kicker: 'Box 2',
    title: 'Why is direct maximum likelihood difficult in such models?',
    body: 'Because summing over all possible hidden assignments creates complex, non-convex likelihood functions with no closed-form analytical solutions.',
    insight: 'Incomplete data introduces complex couplings between parameters.',
    more: 'Without knowing the assignments, the log-likelihood of the observed data contains a sum inside the log. This prevents us from taking derivatives and solving for parameters directly, making optimization a high-dimensional challenge.',
    visual: 'mixture',
  },
  {
    kicker: 'Box 3',
    title: 'What happens in the E-step?',
    body: 'We calculate the expectation of the latent variables—computing the posterior probabilities of the hidden states based on current parameter estimates.',
    insight: 'Assign soft probabilities to explanations instead of making hard guesses.',
    more: 'In a mixture model, this means calculating the probability (responsibility) that each mixture component generated each data point under our current parameters.',
    visual: 'estep',
  },
  {
    kicker: 'Box 4',
    title: 'What happens in the M-step?',
    body: 'We update the model parameters to maximize the expected complete-data log-likelihood computed in the E-step, using the soft assignments as weights.',
    insight: 'Find parameters that make our soft assignments most plausible.',
    more: 'For Gaussian mixtures, this translates to computing new means, variances, and mixture weights as weighted averages, pulling components toward the data they explain best.',
    visual: 'mstep',
  },
  {
    kicker: 'Box 5',
    title: 'Why does EM increase likelihood at each iteration?',
    body: 'Because each E-step constructs a tight lower bound on the true log-likelihood, and each M-step maximizes this lower bound, ensuring monotonic improvements.',
    insight: 'Each cycle acts as a steady step up a local coordinate hill.',
    more: 'Since both the bound calculation and the maximization step optimize the same underlying objective, the overall observed data likelihood is guaranteed never to decrease.',
    visual: 'cycle',
  },
  {
    kicker: 'Box 6',
    title: 'Implement EM for a simple mixture model.',
    body: 'Write code that alternates between assigning data points to clusters (E-step) and updating cluster centers and weights based on those assignments (M-step).',
    insight: 'A clean iteration loop turns messy points into clean clusters.',
    more: 'A simple Gaussian Mixture Model (GMM) can be implemented in python or javascript by initializing random means, then updating the posterior weights and computing weighted means and variances.',
    visual: 'diagram',
  },
  {
    kicker: 'Box 7',
    title: 'Study sensitivity to initialisation.',
    body: 'Since EM only guarantees convergence to local optima, different random starting parameters can lead to completely different final clustering configurations.',
    insight: 'A poor starting point can lock the model into a bad explanation.',
    more: 'Using smart initialization schemes, such as running K-Means first to locate candidate cluster centers (K-Means++ style), is standard practice to find global optima.',
    visual: 'probability',
  },
  {
    kicker: 'Box 8',
    title: 'Identify limitations such as local maxima.',
    body: 'EM is sensitive to local optima, can converge slowly in flat regions of the likelihood surface, and requires specifying the number of latent states upfront.',
    insight: 'Steady climbing guarantees a peak, but not necessarily the highest one.',
    more: 'If two clusters are heavily overlapping, EM might get trapped in a suboptimal saddle point, requiring multiple random restarts to verify convergence to the best peak.',
    visual: 'limits',
  },
  {
    kicker: 'Box 9',
    title: 'How should one decide convergence in practice?',
    body: 'Monitor the change in log-likelihood between consecutive iterations, stopping when the improvement falls below a small threshold (e.g., 1e-6).',
    insight: 'Stop when updates no longer yield meaningful scientific revisions.',
    more: 'Alternatively, you can monitor parameter updates directly or use maximum iteration limits to prevent endless loops in extremely flat probability regions.',
    visual: 'applications',
  },
  {
    kicker: 'Box 10',
    title: 'Jensen’s inequality and the lower-bound idea behind EM.',
    body: 'By using the concavity of the logarithm, Jensen\'s inequality constructs a tractable lower bound (the ELBO) that makes optimizing the complex log-sum objective simple.',
    insight: 'We optimize a shifting, solvable lower bound that pushes the true likelihood up.',
    more: 'Jensen\'s inequality states that the log of an expectation is greater than or equal to the expectation of the log. This creates a surrogate function that touches the true likelihood at the current parameter estimates.',
    visual: 'math',
  },
]

function useReadingProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const updateProgress = () => {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight
      const current = scrollable > 0 ? window.scrollY / scrollable : 0
      setProgress(Math.min(1, Math.max(0, current)))
    }

    updateProgress()
    window.addEventListener('scroll', updateProgress, { passive: true })
    window.addEventListener('resize', updateProgress)
    return () => {
      window.removeEventListener('scroll', updateProgress)
      window.removeEventListener('resize', updateProgress)
    }
  }, [])

  return progress
}

function useRevealOnScroll() {
  const rootRef = useRef(null)

  useEffect(() => {
    const cards = rootRef.current?.querySelectorAll('.section-card')
    if (!cards?.length) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
          }
        })
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.18 },
    )

    cards.forEach((card) => observer.observe(card))
    return () => observer.disconnect()
  }, [])

  return rootRef
}

function ProgressBar({ progress }) {
  return (
    <div className="progress-shell" aria-hidden="true">
      <div
        className="progress-fill"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  )
}

function Hero() {
  return (
    <header className="hero" aria-labelledby="article-title">
      <div className="masthead">
        <span>Machine Learning Review</span>
        <span>Methods Desk</span>
        <span>Vol. EM</span>
      </div>
      <div className="hero-rule" />
      <p className="eyebrow">Interactive Science Article</p>
      <h1 id="article-title">
        Expectation Maximization Algorithm
      </h1>
      <p className="subtitle">
        A step-by-step exploration of how machines estimate hidden patterns
        from incomplete data.
      </p>
      <div className="byline" aria-label="Article metadata">
        <span>By Editorial Machine Learning Lab</span>
        <span>May 23, 2026</span>
        <span>12 minute read</span>
      </div>
      <div className="hero-rule lower" />
    </header>
  )
}

function Visual({ type }) {
  const dots = useMemo(
    () => [
      ['16%', '61%', 'blue'],
      ['25%', '48%', 'blue'],
      ['35%', '66%', 'blue'],
      ['57%', '34%', 'gold'],
      ['70%', '42%', 'gold'],
      ['78%', '27%', 'gold'],
      ['48%', '58%', 'ink'],
    ],
    [],
  )

  if (type === 'math') {
    return (
      <div className="visual math-visual" aria-label="EM objective formula">
        <span>Q(theta | theta_old)</span>
        <span>= E[log p(x, z | theta)]</span>
        <small>E-step defines the expectation. M-step maximizes it.</small>
      </div>
    )
  }

  if (type === 'cycle' || type === 'diagram') {
    return (
      <div className="visual cycle-visual" aria-label="EM cycle diagram">
        <div className="cycle-node">Data</div>
        <div className="cycle-node">E-Step</div>
        <div className="cycle-node">M-Step</div>
        <div className="cycle-arrow one" />
        <div className="cycle-arrow two" />
        <div className="cycle-arrow three" />
      </div>
    )
  }

  if (type === 'applications') {
    return (
      <div className="visual application-visual" aria-label="Application tags">
        <span>Clustering</span>
        <span>Speech</span>
        <span>Topics</span>
        <span>Imaging</span>
      </div>
    )
  }

  if (type === 'limits') {
    return (
      <div className="visual limit-visual" aria-label="Local optima chart">
        <i />
        <i />
        <i />
        <span>local optimum</span>
      </div>
    )
  }

  return (
    <div className={`visual scatter-visual ${type}`} aria-label="Latent groups">
      {dots.map(([left, top, color], index) => (
        <span
          className={`dot ${color}`}
          key={`${left}-${top}`}
          style={{ left, top, animationDelay: `${index * 90}ms` }}
        />
      ))}
      <span className="cluster-ring left" />
      <span className="cluster-ring right" />
    </div>
  )
}

function SectionCard({ section, index }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <article className="section-card" style={{ '--delay': `${index * 45}ms` }}>
      <div className="section-copy">
        <p className="section-kicker">{section.kicker}</p>
        <h2>{section.title}</h2>
        <p>{section.body}</p>
        <blockquote>{section.insight}</blockquote>
        <button
          className="learn-more"
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          <span>{expanded ? 'Close note' : 'Learn more'}</span>
          <span aria-hidden="true">{expanded ? '-' : '+'}</span>
        </button>
        <div className={`more-panel ${expanded ? 'is-open' : ''}`}>
          <p>{section.more}</p>
        </div>
      </div>
      <Visual type={section.visual} />
    </article>
  )
}

function App() {
  const progress = useReadingProgress()
  const articleRef = useRevealOnScroll()

  return (
    <>
      <ProgressBar progress={progress} />
      <main ref={articleRef}>
        <Hero />
        <section className="lede" aria-label="Article introduction">
          <p>
            The EM algorithm is easiest to understand as a patient editorial
            process. It drafts a plausible version of the missing facts, revises
            the model against that draft, and repeats until the story stops
            changing.
          </p>
        </section>
        <h2 className="checkpoints-heading">Checkpoints</h2>
        <section className="article-grid" aria-label="EM algorithm sections">
          {articleSections.map((section, index) => (
            <SectionCard
              index={index}
              key={section.title}
              section={section}
            />
          ))}
        </section>
      </main>
    </>
  )
}

export default App
