import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

const clusterColors = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#9333ea',
  '#ea580c',
  '#0891b2',
  '#be123c',
  '#4f46e5',
  '#65a30d',
  '#ca8a04',
]

const randomBetween = (min, max) => min + Math.random() * (max - min)

const squaredDistance = (a, b) => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

const formatCoord = (value) => value.toFixed(1)

function createDataset(includeNoise = false) {
  const centers = [
    { x: randomBetween(120, 220), y: randomBetween(125, 250) },
    { x: randomBetween(440, 560), y: randomBetween(95, 220) },
    { x: randomBetween(270, 390), y: randomBetween(295, 410) },
    { x: randomBetween(115, 250), y: randomBetween(350, 470) },
  ]

  const points = Array.from({ length: 84 }, (_, index) => {
    const center = centers[index % centers.length]
    return {
      id: index,
      x: Math.max(34, Math.min(626, center.x + randomBetween(-58, 58))),
      y: Math.max(34, Math.min(486, center.y + randomBetween(-58, 58))),
      cluster: null,
      isNoise: false,
    }
  })

  if (!includeNoise) return points

  const noise = Array.from({ length: 16 }, (_, index) => ({
    id: points.length + index,
    x: randomBetween(34, 626),
    y: randomBetween(34, 486),
    cluster: null,
    isNoise: true,
  }))

  return [...points, ...noise]
}

function nearestCentroid(point, centroids) {
  let nearest = 0
  let nearestDistance = Number.POSITIVE_INFINITY

  centroids.forEach((centroid, index) => {
    const distance = squaredDistance(point, centroid)
    if (distance < nearestDistance) {
      nearest = index
      nearestDistance = distance
    }
  })

  return nearest
}

function assignPoints(points, centroids) {
  if (!centroids.length) return points

  return points.map((point) => ({
    ...point,
    cluster: nearestCentroid(point, centroids),
  }))
}

function computeCentroids(points, centroids) {
  return centroids.map((centroid, index) => {
    const assigned = points.filter((point) => point.cluster === index)
    if (!assigned.length) {
      return {
        ...centroid,
        prevX: centroid.x,
        prevY: centroid.y,
        x: randomBetween(50, 610),
        y: randomBetween(50, 470),
      }
    }

    const meanX =
      assigned.reduce((total, point) => total + point.x, 0) / assigned.length
    const meanY =
      assigned.reduce((total, point) => total + point.y, 0) / assigned.length

    return {
      ...centroid,
      prevX: centroid.x,
      prevY: centroid.y,
      x: meanX,
      y: meanY,
    }
  })
}

function calculateWcss(points, centroids) {
  if (!points.length || !centroids.length) return 0

  return points.reduce((total, point) => {
    if (point.cluster === null) return total
    return total + squaredDistance(point, centroids[point.cluster])
  }, 0)
}

function totalCentroidMovement(centroids) {
  return centroids.reduce((total, centroid) => {
    const dx = centroid.x - (centroid.prevX ?? centroid.x)
    const dy = centroid.y - (centroid.prevY ?? centroid.y)
    return total + Math.hypot(dx, dy)
  }, 0)
}

function initializeCentroids(points, k, mode) {
  if (!points.length) return []

  if (mode === 'kmeans++') {
    const selected = [points[Math.floor(Math.random() * points.length)]]

    while (selected.length < k) {
      let bestPoint = points[0]
      let bestDistance = -1

      points.forEach((point) => {
        const distance = Math.min(
          ...selected.map((centroid) => squaredDistance(point, centroid)),
        )
        if (distance > bestDistance) {
          bestPoint = point
          bestDistance = distance
        }
      })

      selected.push(bestPoint)
    }

    return selected.map((point, index) => ({
      id: index,
      x: point.x,
      y: point.y,
      prevX: point.x,
      prevY: point.y,
      color: clusterColors[index],
    }))
  }

  return Array.from({ length: k }, (_, index) => ({
    id: index,
    x: randomBetween(56, 604),
    y: randomBetween(56, 464),
    prevX: null,
    prevY: null,
    color: clusterColors[index],
  }))
}

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

function KMeansPlayground({ onBack }) {
  const planeRef = useRef(null)
  const [k, setK] = useState(3)
  const [points, setPoints] = useState(() => createDataset(false))
  const [centroids, setCentroids] = useState([])
  const [phase, setPhase] = useState('data')
  const [iteration, setIteration] = useState(0)
  const [movementHistory, setMovementHistory] = useState([])
  const [showLines, setShowLines] = useState(false)
  const [running, setRunning] = useState(false)
  const [noiseEnabled, setNoiseEnabled] = useState(false)
  const [initMode, setInitMode] = useState('random')
  const [showVoronoi, setShowVoronoi] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [placementMode, setPlacementMode] = useState(false)

  const assignedPoints = points.filter((point) => point.cluster !== null)
  const counts = centroids.map(
    (_, index) => points.filter((point) => point.cluster === index).length,
  )
  const wcss = calculateWcss(points, centroids)
  const latestMovement = movementHistory.at(-1) ?? 0
  const converged = phase === 'converged'

  const generateData = useCallback(() => {
    setPoints(createDataset(noiseEnabled))
    setCentroids([])
    setPhase('data')
    setIteration(0)
    setMovementHistory([])
    setShowLines(false)
    setRunning(false)
    setPlacementMode(false)
  }, [noiseEnabled])

  const clearAssignments = useCallback((nextK) => {
    setK(nextK)
    setPoints((current) =>
      current.map((point) => ({
        ...point,
        cluster: null,
      })),
    )
    setCentroids([])
    setPhase('data')
    setIteration(0)
    setMovementHistory([])
    setShowLines(false)
    setRunning(false)
    setPlacementMode(false)
  }, [])

  const placeCentroids = useCallback(() => {
    const data = points.length ? points : createDataset(noiseEnabled)
    setPoints(data.map((point) => ({ ...point, cluster: null })))
    setCentroids(initializeCentroids(data, k, initMode))
    setPhase('initialized')
    setIteration(0)
    setMovementHistory([])
    setShowLines(false)
    setRunning(false)
    setPlacementMode(false)
  }, [initMode, k, noiseEnabled, points])

  const startManualPlacement = useCallback(() => {
    const data = points.length ? points : createDataset(noiseEnabled)
    setPoints(data.map((point) => ({ ...point, cluster: null })))
    setCentroids([])
    setPhase('placing')
    setIteration(0)
    setMovementHistory([])
    setShowLines(false)
    setRunning(false)
    setPlacementMode(true)
  }, [noiseEnabled, points])

  const handlePlaneClick = useCallback(
    (event) => {
      if (!placementMode || centroids.length >= k) return

      const svg = planeRef.current
      if (!svg) return

      const point = svg.createSVGPoint()
      point.x = event.clientX
      point.y = event.clientY
      const cursor = point.matrixTransform(svg.getScreenCTM().inverse())
      const nextCentroid = {
        id: centroids.length,
        x: Math.max(0, Math.min(660, cursor.x)),
        y: Math.max(0, Math.min(520, cursor.y)),
        prevX: null,
        prevY: null,
        color: clusterColors[centroids.length],
      }

      setCentroids((current) => {
        const next = [...current, nextCentroid]
        if (next.length === k) {
          setPhase('initialized')
          setPlacementMode(false)
        }
        return next
      })
    },
    [centroids.length, k, placementMode],
  )

  const runNextStep = useCallback(() => {
    if (!points.length) {
      setPoints(createDataset(noiseEnabled))
      setPhase('data')
      return
    }

    if (!centroids.length) {
      setCentroids(initializeCentroids(points, k, initMode))
      setPhase('initialized')
      setPlacementMode(false)
      return
    }

    if (placementMode) return

    if (phase === 'converged') {
      setRunning(false)
      return
    }

    if (phase === 'initialized' || phase === 'updated' || phase === 'data') {
      setPoints((current) => assignPoints(current, centroids))
      setShowLines(true)
      window.setTimeout(() => setShowLines(false), 620 / speed)
      setPhase('assignment')
      return
    }

    const updated = computeCentroids(points, centroids)
    const movement = totalCentroidMovement(updated)
    const reassigned = assignPoints(points, updated)
    const hasConverged = movement < 1.2

    setCentroids(updated)
    setPoints(reassigned)
    setIteration((value) => value + 1)
    setMovementHistory((history) => [...history.slice(-11), movement])
    setPhase(hasConverged ? 'converged' : 'updated')
    if (hasConverged) setRunning(false)
  }, [centroids, initMode, k, noiseEnabled, phase, placementMode, points, speed])

  useEffect(() => {
    if (!running) return undefined

    const delay = Math.max(260, 1100 / speed)
    const timer = window.setTimeout(runNextStep, delay)
    return () => window.clearTimeout(timer)
  }, [runNextStep, running, speed])

  const reset = () => {
    setPoints([])
    setCentroids([])
    setPhase('empty')
    setIteration(0)
    setMovementHistory([])
    setShowLines(false)
    setRunning(false)
    setPlacementMode(false)
  }

  const phaseLabel = {
    empty: 'Ready',
    data: 'Dataset generated',
    placing: `Click the plane to place ${k - centroids.length} centroid${
      k - centroids.length === 1 ? '' : 's'
    }`,
    initialized: 'Step 1 - Initialization',
    assignment: 'Step 2 - Assignment phase',
    updated: 'Step 3 - Update phase',
    converged: 'Step 4 - Converged',
  }[phase]

  const cells = useMemo(() => {
    if (!showVoronoi || !centroids.length) return []

    const size = 34
    const columns = Math.ceil(660 / size)
    const rows = Math.ceil(520 / size)

    return Array.from({ length: columns * rows }, (_, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      const probe = {
        x: column * size + size / 2,
        y: row * size + size / 2,
      }
      const cluster = nearestCentroid(probe, centroids)
      return {
        id: index,
        x: column * size,
        y: row * size,
        size,
        color: clusterColors[cluster],
      }
    })
  }, [centroids, showVoronoi])

  return (
    <div className="kmeans-page">
      <header className="kmeans-hero">
        <button className="back-button" onClick={onBack} type="button">
          <span>← Back to Article</span>
        </button>
        <p className="subpage-kicker">01 / Interactive Playground</p>
        <h1>Understanding K-Means Clustering</h1>
        <p>
          K-Means groups data points into K clusters by repeatedly assigning
          points to the nearest centroid and moving centroids to cluster centers.
        </p>
      </header>

      <section className="kmeans-workbench" aria-label="K-Means simulation">
        <div className="sim-panel">
          <div className="sim-toolbar" aria-label="Simulation controls">
            <label className="k-slider">
              <span>K clusters: {k}</span>
              <input
                type="range"
                min="2"
                max="10"
                value={k}
                onChange={(event) => clearAssignments(Number(event.target.value))}
              />
            </label>
            <button type="button" onClick={generateData}>
              Generate Data
            </button>
            <button type="button" onClick={placeCentroids}>
              Initialize Centroids
            </button>
            <button
              className={placementMode ? 'is-active' : ''}
              type="button"
              onClick={startManualPlacement}
            >
              Place Centroids
            </button>
            <button type="button" onClick={runNextStep}>
              Next Step
            </button>
            <button
              className={running ? 'is-active' : ''}
              type="button"
              onClick={() => setRunning((value) => !value)}
              disabled={!points.length || converged}
            >
              {running ? 'Pause' : 'Auto Run'}
            </button>
            <button type="button" onClick={reset}>
              Reset
            </button>
          </div>

          <div className="advanced-controls" aria-label="Advanced options">
            <label>
              <input
                type="checkbox"
                checked={noiseEnabled}
                onChange={(event) => setNoiseEnabled(event.target.checked)}
              />
              Add noise points
            </label>
            <label>
              <input
                type="checkbox"
                checked={showVoronoi}
                onChange={(event) => setShowVoronoi(event.target.checked)}
              />
              Show Voronoi boundaries
            </label>
            <label className="select-label">
              Initialization
              <select
                value={initMode}
                onChange={(event) => setInitMode(event.target.value)}
              >
                <option value="random">Random</option>
                <option value="kmeans++">K-Means++</option>
              </select>
            </label>
            <label className="speed-control">
              Speed: {speed.toFixed(1)}x
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
              />
            </label>
          </div>

          <div className="simulation-stage">
            <div className="stage-status">
              <span>{phaseLabel}</span>
              <strong>{converged ? 'Converged' : 'Optimizing'}</strong>
            </div>
            <svg
              className="cluster-plane"
              ref={planeRef}
              viewBox="0 0 660 520"
              role="img"
              aria-label="2D coordinate plane showing K-Means clustering"
              onClick={handlePlaneClick}
            >
              <defs>
                <pattern
                  id="small-grid"
                  width="26"
                  height="26"
                  patternUnits="userSpaceOnUse"
                >
                  <path d="M 26 0 L 0 0 0 26" />
                </pattern>
              </defs>
              <rect width="660" height="520" className="plane-bg" />
              <rect width="660" height="520" fill="url(#small-grid)" />
              {cells.map((cell) => (
                <rect
                  key={cell.id}
                  x={cell.x}
                  y={cell.y}
                  width={cell.size}
                  height={cell.size}
                  fill={cell.color}
                  opacity="0.055"
                />
              ))}
              {showLines &&
                assignedPoints.map((point) => {
                  const centroid = centroids[point.cluster]
                  return (
                    <line
                      key={`line-${point.id}`}
                      x1={point.x}
                      y1={point.y}
                      x2={centroid.x}
                      y2={centroid.y}
                      stroke={centroid.color}
                      className="distance-line"
                    />
                  )
                })}
              {centroids.map((centroid) =>
                centroid.prevX === null ? null : (
                  <line
                    key={`trail-${centroid.id}`}
                    x1={centroid.prevX}
                    y1={centroid.prevY}
                    x2={centroid.x}
                    y2={centroid.y}
                    stroke={centroid.color}
                    className="movement-trail"
                  />
                ),
              )}
              {points.map((point) => {
                const color =
                  point.cluster === null
                    ? point.isNoise
                      ? '#64748b'
                      : '#334155'
                    : clusterColors[point.cluster]

                return (
                  <circle
                    key={point.id}
                    cx={point.x}
                    cy={point.y}
                    r={point.isNoise ? 4.2 : 5.6}
                    fill={color}
                    className="data-point"
                  />
                )
              })}
              {centroids.map((centroid) => (
                <g
                  key={centroid.id}
                  className="centroid-marker"
                  style={{ '--centroid-color': centroid.color }}
                >
                  <circle
                    cx={centroid.x}
                    cy={centroid.y}
                    r="14"
                    fill="#ffffff"
                    stroke={centroid.color}
                  />
                  <path
                    d={`M ${centroid.x - 8} ${centroid.y} L ${
                      centroid.x + 8
                    } ${centroid.y} M ${centroid.x} ${
                      centroid.y - 8
                    } L ${centroid.x} ${centroid.y + 8}`}
                    stroke={centroid.color}
                  />
                </g>
              ))}
              {placementMode && centroids.length < k ? (
                <text x="24" y="38" className="placement-hint">
                  Click to place centroid {centroids.length + 1} of {k}
                </text>
              ) : null}
            </svg>
          </div>
        </div>

        <aside className="metrics-panel" aria-label="K-Means metrics">
          <div className="metric-card primary">
            <span>Iteration</span>
            <strong>{iteration}</strong>
          </div>
          <div className="metric-card">
            <span>WCSS</span>
            <strong>{Math.round(wcss).toLocaleString()}</strong>
          </div>
          <div className="metric-card">
            <span>Centroid movement</span>
            <strong>{latestMovement.toFixed(2)}</strong>
          </div>
          <div className="movement-chart" aria-label="Centroid movement history">
            {movementHistory.length ? (
              movementHistory.map((movement, index) => {
                const maxMovement = Math.max(...movementHistory, 1)
                return (
                  <span
                    key={`${movement}-${index}`}
                    style={{ height: `${Math.max(8, (movement / maxMovement) * 100)}%` }}
                  />
                )
              })
            ) : (
              <p>Movement history appears after the first update.</p>
            )}
          </div>
          <div className="cluster-list">
            <h3>Cluster Counts</h3>
            {centroids.length ? (
              centroids.map((centroid, index) => (
                <div key={centroid.id} className="cluster-row">
                  <i style={{ background: centroid.color }} />
                  <span>Cluster {index + 1}</span>
                  <strong>{counts[index]}</strong>
                </div>
              ))
            ) : (
              <p>Initialize centroids to begin measuring clusters.</p>
            )}
          </div>
          <div className="centroid-list">
            <h3>Centroid Coordinates</h3>
            {centroids.map((centroid, index) => (
              <div key={centroid.id} className="centroid-row">
                <span style={{ color: centroid.color }}>μ{index + 1}</span>
                <code>
                  ({formatCoord(centroid.x)}, {formatCoord(centroid.y)})
                </code>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="learning-boxes" aria-label="K-Means explanation">
        <article>
          <p>Box 1</p>
          <h2>Core Idea</h2>
          <span>Points belong to the nearest centroid.</span>
        </article>
        <article>
          <p>Box 2</p>
          <h2>Objective Function</h2>
          <code>Minimize: J = Σ ||xᵢ − μⱼ||²</code>
          <span>
            K-Means minimizes total distance between points and assigned cluster
            centers.
          </span>
        </article>
        <article>
          <p>Box 3</p>
          <h2>Why it works</h2>
          <span>
            Assignment reduces error locally. Centroid updates reduce error
            globally. Alternating these steps gradually improves clustering.
          </span>
        </article>
      </section>
    </div>
  )
}

function SubPage({ type, onBack }) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [type])

  if (type === 'kmeans') {
    return <KMeansPlayground onBack={onBack} />
  }

  const pageDetails = {
    kmeans: {
      kicker: '01 / Interactive Playground',
      title: 'K-Means Clustering',
      image: '/kmeans_viz.png',
      alt: 'K-Means 2D Clustering Analysis',
      description: 'The K-Means algorithm partitions data points into K clusters by minimizing the within-cluster sum of squares (Euclidean distance). It operates by alternating between assigning points to the nearest centroid and recomputing centroids.',
      details: 'This supplemental page serves as the foundation for the interactive K-Means playground. You will be able to customize cluster parameters, step through iterations, and benchmark convergence alongside Expectation Maximization.'
    },
    rgb: {
      kicker: '02 / Image Segmentation',
      title: 'RGB Color Space Distribution',
      image: '/rgb_dist.png',
      alt: '3D Color space distribution graph',
      description: 'Image segmentation treats pixels in a color space (like RGB) as observations generated by a mixture model. Expectation-Maximization partitions the 3D color cloud to isolate and extract distinct visual components.',
      details: 'This supplemental page serves as the foundation for the RGB segmentation visualizer. You will be able to upload custom images, analyze pixel distribution coordinates, and partition colors using Gaussian Mixtures.'
    },
    neuroscience: {
      kicker: '03 / Neural Signal Analysis',
      title: 'Neuroscience Signal Analysis',
      image: '/neuro_brain.png',
      alt: 'Neural Connectome Mapping',
      description: 'Neural connectome mapping utilizes latent variable models to trace structural pathways and brain state transitions, allowing researchers to decode signals and isolate spike counts from background electrical noise.',
      details: 'This supplemental page serves as the foundation for neuroscience data visualization. You will be able to simulate electrode spike patterns, apply filter kernels, and inspect state probability decodings.'
    }
  }

  const page = pageDetails[type]
  if (!page) return null

  return (
    <div className="subpage-container">
      <header className="subpage-header">
        <button className="back-button" onClick={onBack} aria-label="Go back to main article">
          <span>← Back to Article</span>
        </button>
        <p className="subpage-kicker">{page.kicker}</p>
      </header>

      <div className="subpage-content">
        <div className="subpage-copy">
          <h1 className="subpage-title">{page.title}</h1>
          <p>{page.description}</p>
          <h4>Implementation Target</h4>
          <p>{page.details}</p>
        </div>
        <div className="subpage-visual-wrapper">
          <img src={page.image} alt={page.alt} className="subpage-visual" />
        </div>
      </div>
    </div>
  )
}

function App() {
  const [activePage, setActivePage] = useState('main')
  const progress = useReadingProgress()
  const articleRef = useRevealOnScroll()

  return (
    <>
      <ProgressBar progress={progress} />
      {activePage === 'main' ? (
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

          <section className="article-supplement" aria-label="Supplemental sections">
            <div className="supplemental-section" id="maths-behind-em">
              <h2 className="section-heading">Maths Behind the EM</h2>
              <div className="placeholder-card">
                <p>Detailed mathematical formulation, Jensen's Inequality proof, and coordinate ascent derivation will be added here.</p>
              </div>
            </div>

            <div className="supplemental-section" id="report">
              <h2 className="section-heading">Report</h2>
              <div className="placeholder-card">
                <p>Performance report, empirical tables, and convergence analysis will be added here.</p>
              </div>
            </div>

            <div className="supplemental-section" id="visualization">
              <h2 className="section-heading">Visualization</h2>
              <div className="visualization-grid">
                <div
                  className="visualization-card clickable"
                  id="viz-k-means"
                  onClick={() => setActivePage('kmeans')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setActivePage('kmeans')}
                >
                  <p className="viz-card-kicker">01 / Interactive Playground</p>
                  <h3 className="viz-card-title">K-Means</h3>
                  <div className="viz-image-wrapper">
                    <img src="/kmeans_viz.png" alt="K-Means 2D Clustering Analysis" className="viz-image" />
                  </div>
                </div>

                <div
                  className="visualization-card clickable"
                  id="viz-rgb"
                  onClick={() => setActivePage('rgb')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setActivePage('rgb')}
                >
                  <p className="viz-card-kicker">02 / Image Segmentation</p>
                  <h3 className="viz-card-title">RGB</h3>
                  <div className="viz-image-wrapper">
                    <img src="/rgb_dist.png" alt="3D Color space distribution graph" className="viz-image" />
                  </div>
                </div>

                <div
                  className="visualization-card clickable"
                  id="viz-neuroscience"
                  onClick={() => setActivePage('neuroscience')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setActivePage('neuroscience')}
                >
                  <p className="viz-card-kicker">03 / Neural Signal Analysis</p>
                  <h3 className="viz-card-title">Neuroscience</h3>
                  <div className="viz-image-wrapper">
                    <img src="/neuro_brain.png" alt="Neural Connectome Mapping" className="viz-image" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      ) : (
        <main>
          <SubPage type={activePage} onBack={() => setActivePage('main')} />
        </main>
      )}
    </>
  )
}

export default App
