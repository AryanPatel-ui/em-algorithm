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

const rgbPresets = {
  portrait: {
    label: 'Portrait',
    centers: [
      [224, 176, 134],
      [165, 96, 68],
      [72, 55, 47],
      [238, 221, 198],
    ],
  },
  landscape: {
    label: 'Landscape',
    centers: [
      [46, 111, 62],
      [116, 157, 78],
      [76, 138, 188],
      [218, 190, 118],
    ],
  },
  city: {
    label: 'City',
    centers: [
      [42, 52, 67],
      [116, 126, 136],
      [205, 188, 152],
      [184, 73, 55],
    ],
  },
}

const rgbClusterColors = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b']

const neuralStateColors = ['#2563eb', '#dc2626', '#16a34a', '#9333ea']

const neuralProfiles = [
  { label: 'Rest', mean: 24, spread: 8 },
  { label: 'Motor burst', mean: 72, spread: 12 },
  { label: 'Visual response', mean: 48, spread: 10 },
  { label: 'Recovery', mean: 34, spread: 7 },
]

function seededUnit(index, salt, seed) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233 + seed * 37.719) * 43758.5453
  return value - Math.floor(value)
}

function createRgbSamples(presetKey, componentCount, spread, seed = 0) {
  const preset = rgbPresets[presetKey] ?? rgbPresets.portrait
  const centers = preset.centers.slice(0, componentCount)

  return Array.from({ length: 420 }, (_, index) => {
    const centerIndex = Math.floor(seededUnit(index, 1, seed) * centers.length)
    const center = centers[centerIndex]
    const scatter = spread * (0.72 + seededUnit(index, 5, seed) * 0.72)
    const channel = (value, salt) =>
      Math.max(
        0,
        Math.min(
          255,
          value +
            (seededUnit(index, salt, seed) - 0.5) * scatter * 2 +
            (seededUnit(index, salt + 11, seed) - 0.5) * spread * 0.56,
        ),
      )

    const rgb = [
      channel(center[0], 2),
      channel(center[1], 3),
      channel(center[2], 4),
    ]

    return {
      id: index,
      rgb,
      cluster: null,
      color: `rgb(${rgb.map((value) => Math.round(value)).join(', ')})`,
    }
  })
}

function squaredRgbDistance(a, b) {
  return a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0)
}

function nearestRgbCentroid(rgb, centroids) {
  return centroids.reduce(
    (best, centroid, index) => {
      const distance = squaredRgbDistance(rgb, centroid)
      return distance < best.distance ? { index, distance } : best
    },
    { index: 0, distance: Number.POSITIVE_INFINITY },
  ).index
}

function initializeRgbCentroids(samples, componentCount) {
  if (!samples.length) return []

  const step = Math.max(1, Math.floor(samples.length / componentCount))
  return Array.from({ length: componentCount }, (_, index) => [
    ...samples[(index * step + index * 19) % samples.length].rgb,
  ])
}

function assignRgbSamples(samples, centroids) {
  if (!centroids.length) return samples

  return samples.map((sample) => ({
    ...sample,
    cluster: nearestRgbCentroid(sample.rgb, centroids),
  }))
}

function updateRgbCentroids(samples, centroids) {
  return centroids.map((centroid, index) => {
    const assigned = samples.filter((sample) => sample.cluster === index)
    if (!assigned.length) return centroid

    return [0, 1, 2].map(
      (channel) =>
        assigned.reduce((sum, sample) => sum + sample.rgb[channel], 0) /
        assigned.length,
    )
  })
}

function calculateRgbWcss(samples, centroids) {
  if (!samples.length || !centroids.length) return 0

  return samples.reduce((total, sample) => {
    if (sample.cluster === null) return total
    return total + squaredRgbDistance(sample.rgb, centroids[sample.cluster])
  }, 0)
}

function totalRgbCentroidMovement(previousCenters, nextCenters) {
  return nextCenters.reduce((total, center, index) => {
    const previous = previousCenters[index] ?? center
    return total + Math.sqrt(squaredRgbDistance(center, previous))
  }, 0)
}

function createRgbKMeansState(preset, components, spread, seed) {
  const samples = createRgbSamples(preset, components, spread, seed)
  return {
    samples,
    centers: initializeRgbCentroids(samples, components),
  }
}

function createNeuralSamples(stateCount, noiseLevel) {
  const length = 150
  return Array.from({ length }, (_, index) => {
    const phase = index / length
    const state =
      index < length * 0.22
        ? 0
        : index < length * 0.45
          ? 1
          : index < length * 0.68
            ? Math.min(2, stateCount - 1)
            : index < length * 0.84
              ? Math.min(3, stateCount - 1)
              : 0
    const profile = neuralProfiles[state]
    const rhythmic =
      Math.sin(index * 0.28) * profile.spread +
      Math.sin(index * 0.071 + state) * profile.spread * 0.58
    const deterministicNoise = Math.sin(index * 12.9898) * Math.cos(index * 78.233)
    const amplitude = Math.max(
      2,
      profile.mean + rhythmic + deterministicNoise * noiseLevel,
    )

    return {
      id: index,
      x: index,
      phase,
      amplitude,
      trueState: state,
      responsibilities: [],
    }
  })
}

function initializeNeuralParams(stateCount) {
  return Array.from({ length: stateCount }, (_, index) => ({
    id: index,
    mean: 22 + index * (58 / Math.max(1, stateCount - 1)),
    variance: 180,
    weight: 1 / stateCount,
    prevMean: null,
  }))
}

function estimateNeuralResponsibilities(samples, params) {
  if (!params.length) return samples

  return samples.map((sample) => {
    const raw = params.map((param) => {
      const variance = Math.max(18, param.variance)
      const exponent = -((sample.amplitude - param.mean) ** 2) / (2 * variance)
      return param.weight * Math.exp(exponent) / Math.sqrt(variance)
    })
    const total = raw.reduce((sum, value) => sum + value, 0) || 1

    return {
      ...sample,
      responsibilities: raw.map((value) => value / total),
    }
  })
}

function updateNeuralParams(samples, params) {
  return params.map((param, index) => {
    const weightSum = samples.reduce(
      (sum, sample) => sum + (sample.responsibilities[index] ?? 0),
      0,
    )
    if (weightSum <= 0.0001) return param

    const mean =
      samples.reduce(
        (sum, sample) =>
          sum + sample.amplitude * (sample.responsibilities[index] ?? 0),
        0,
      ) / weightSum
    const variance =
      samples.reduce((sum, sample) => {
        const responsibility = sample.responsibilities[index] ?? 0
        return sum + responsibility * (sample.amplitude - mean) ** 2
      }, 0) / weightSum

    return {
      ...param,
      prevMean: param.mean,
      mean,
      variance: Math.max(28, variance),
      weight: weightSum / samples.length,
    }
  })
}

function calculateNeuralLogLikelihood(samples, params) {
  if (!samples.length || !params.length) return 0

  return samples.reduce((total, sample) => {
    const likelihood = params.reduce((sum, param) => {
      const variance = Math.max(18, param.variance)
      const exponent = -((sample.amplitude - param.mean) ** 2) / (2 * variance)
      return sum + param.weight * Math.exp(exponent) / Math.sqrt(variance)
    }, 0)
    return total + Math.log(Math.max(likelihood, 1e-9))
  }, 0)
}

function projectRgbPoint([r, g, b], angle) {
  const scale = 1 / 255
  const x = (r - 128) * scale
  const y = (g - 128) * scale
  const z = (b - 128) * scale
  const cosY = Math.cos(angle)
  const sinY = Math.sin(angle)
  const cosX = Math.cos(-0.58)
  const sinX = Math.sin(-0.58)
  const rx = x * cosY - z * sinY
  const rz = x * sinY + z * cosY
  const ry = y * cosX - rz * sinX
  const depth = y * sinX + rz * cosX

  return {
    x: rx,
    y: ry,
    depth,
  }
}

function getLineThroughCanvas(origin, direction, width, height) {
  const intersections = []
  const addPoint = (x, y) => {
    if (x >= 0 && x <= width && y >= 0 && y <= height) {
      intersections.push({ x, y })
    }
  }

  if (Math.abs(direction.x) > 0.0001) {
    addPoint(0, origin.y + ((0 - origin.x) / direction.x) * direction.y)
    addPoint(width, origin.y + ((width - origin.x) / direction.x) * direction.y)
  }

  if (Math.abs(direction.y) > 0.0001) {
    addPoint(origin.x + ((0 - origin.y) / direction.y) * direction.x, 0)
    addPoint(origin.x + ((height - origin.y) / direction.y) * direction.x, height)
  }

  if (intersections.length < 2) return null

  return [intersections[0], intersections[1]]
}

function drawRgbAxis(ctx, origin, direction, width, height, color, label) {
  const segment = getLineThroughCanvas(origin, direction, width, height)
  if (!segment) return

  const [start, end] = segment
  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.6
  ctx.moveTo(start.x, start.y)
  ctx.lineTo(end.x, end.y)
  ctx.stroke()

  const labelPoint =
    Math.hypot(end.x - origin.x, end.y - origin.y) >
    Math.hypot(start.x - origin.x, start.y - origin.y)
      ? end
      : start

  ctx.fillStyle = color
  ctx.font = '700 13px Inter, system-ui, sans-serif'
  ctx.fillText(label, labelPoint.x + (labelPoint.x > origin.x ? -18 : 10), labelPoint.y + 16)
}

function drawRgbCubeOutline(ctx, project) {
  const cubeCorners = [
    [0, 0, 0],
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
    [255, 0, 255],
    [0, 255, 255],
    [255, 255, 255],
  ]
  const edges = [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 4],
    [1, 5],
    [2, 4],
    [2, 6],
    [3, 5],
    [3, 6],
    [4, 7],
    [5, 7],
    [6, 7],
  ]
  const projectedCorners = cubeCorners.map((corner) => project(corner))

  ctx.lineWidth = 1.15
  ctx.strokeStyle = 'rgba(24, 54, 83, 0.25)'
  edges.forEach(([startIndex, endIndex]) => {
    const start = projectedCorners[startIndex]
    const end = projectedCorners[endIndex]
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
  })
}

function createRgbProjector(rect, angle, originOffset) {
  const size = Math.min(rect.width, rect.height) * 0.42
  const origin = {
    x: rect.width * 0.5 + originOffset.x,
    y: rect.height * 0.52 + originOffset.y,
  }
  const zeroPoint = projectRgbPoint([0, 0, 0], angle)

  return {
    origin,
    project(rgb) {
      const point = projectRgbPoint(rgb, angle)
      return {
        x: origin.x + (point.x - zeroPoint.x) * size,
        y: origin.y - (point.y - zeroPoint.y) * size,
        depth: point.depth,
      }
    },
  }
}

function drawRgbScene(canvas, samples, centers, angle, originOffset) {
  const rect = canvas.getBoundingClientRect()
  const ratio = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.floor(rect.width * ratio))
  canvas.height = Math.max(1, Math.floor(rect.height * ratio))

  const ctx = canvas.getContext('2d')
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, rect.width, rect.height)

  const { origin, project } = createRgbProjector(rect, angle, originOffset)
  const axisDirection = (rgb) => {
    const point = project(rgb)
    return {
      x: point.x - origin.x,
      y: point.y - origin.y,
    }
  }

  drawRgbCubeOutline(ctx, project)
  drawRgbAxis(ctx, origin, axisDirection([255, 0, 0]), rect.width, rect.height, '#dc2626', 'X')
  drawRgbAxis(ctx, origin, axisDirection([0, 255, 0]), rect.width, rect.height, '#16a34a', 'Y')
  drawRgbAxis(ctx, origin, axisDirection([0, 0, 255]), rect.width, rect.height, '#2563eb', 'Z')

  samples
    .map((sample) => ({ sample, point: project(sample.rgb) }))
    .sort((a, b) => a.point.depth - b.point.depth)
    .forEach(({ sample, point }) => {
      const radius = 2.2 + (point.depth + 0.85) * 1.8
      ctx.beginPath()
      ctx.fillStyle =
        sample.cluster === null ? sample.color : rgbClusterColors[sample.cluster]
      ctx.globalAlpha = sample.cluster === null ? 0.72 : 0.82
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
      ctx.fill()
    })

  ctx.globalAlpha = 1
  centers.forEach((center, index) => {
    const point = project(center)
    ctx.beginPath()
    ctx.fillStyle = rgbClusterColors[index]
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2.5
    ctx.arc(point.x, point.y, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  })

  ctx.beginPath()
  ctx.fillStyle = '#121212'
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2.5
  ctx.arc(origin.x, origin.y, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#121212'
  ctx.font = '700 12px Inter, system-ui, sans-serif'
  ctx.fillText('0,0,0', origin.x + 12, origin.y - 12)
}

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

function SectionCard({ section, index }) {
  return (
    <article className="section-card" style={{ '--delay': `${index * 45}ms` }}>
      <div className="section-copy">
        <p className="section-kicker">{section.kicker}</p>
        <h2>{section.title}</h2>
        <p>{section.body}</p>
        <blockquote>{section.insight}</blockquote>
      </div>
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

function RgbPlayground({ onBack }) {
  const [preset, setPreset] = useState('portrait')
  const [components, setComponents] = useState(3)
  const [spread, setSpread] = useState(46)
  const [dataSeed, setDataSeed] = useState(0)
  const initialRgbState = useMemo(
    () => createRgbKMeansState('portrait', 3, 46, 0),
    [],
  )
  const [samples, setSamples] = useState(initialRgbState.samples)
  const [centers, setCenters] = useState(initialRgbState.centers)
  const [rgbPhase, setRgbPhase] = useState('initialized')
  const [iteration, setIteration] = useState(0)
  const [movementHistory, setMovementHistory] = useState([])
  const [rgbHistory, setRgbHistory] = useState([])
  const [rotation, setRotation] = useState(0.72)
  const [originOffset, setOriginOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const canvasRef = useRef(null)
  const dragRef = useRef({ pointerId: null, x: 0, y: 0, mode: 'rotate' })

  const clusterStats = useMemo(
    () =>
      centers.map((center, index) => {
        const assigned = samples.filter((sample) => sample.cluster === index)
        const variance =
          assigned.reduce((total, sample) => {
            const distance = sample.rgb.reduce(
              (sum, value, channel) => sum + (value - center[channel]) ** 2,
              0,
            )
            return total + distance
          }, 0) / Math.max(1, assigned.length)

        return {
          center,
          count: assigned.length,
          variance: Math.sqrt(variance),
        }
      }),
    [centers, samples],
  )
  const counts = centers.map(
    (_, index) => samples.filter((sample) => sample.cluster === index).length,
  )
  const wcss = calculateRgbWcss(samples, centers)
  const latestMovement = movementHistory.at(-1) ?? 0
  const phaseLabel = {
    data: 'Dataset generated',
    initialized: 'Step 1 - Initialization',
    assigned: 'Step 2 - Assignment phase',
    updated: 'Step 3 - Update phase',
    converged: 'Step 4 - Converged',
  }[rgbPhase]

  const saveRgbSnapshot = useCallback(() => {
    setRgbHistory((history) => [
      ...history.slice(-14),
      {
        samples,
        centers,
        rgbPhase,
        iteration,
        movementHistory,
      },
    ])
  }, [centers, iteration, movementHistory, rgbPhase, samples])

  const generateData = useCallback(() => {
    saveRgbSnapshot()
    const nextSeed = dataSeed + 1
    const nextState = createRgbKMeansState(preset, components, spread, nextSeed)
    setDataSeed(nextSeed)
    setSamples(nextState.samples)
    setCenters(nextState.centers)
    setRgbPhase('initialized')
    setIteration(0)
    setMovementHistory([])
  }, [components, dataSeed, preset, saveRgbSnapshot, spread])

  const initializeCentroids = useCallback(() => {
    saveRgbSnapshot()
    const nextCenters = initializeRgbCentroids(samples, components)
    setCenters(nextCenters)
    setSamples((current) => current.map((sample) => ({ ...sample, cluster: null })))
    setRgbPhase('initialized')
    setIteration(0)
    setMovementHistory([])
  }, [components, samples, saveRgbSnapshot])

  const runNextRgbStep = useCallback(() => {
    saveRgbSnapshot()

    if (!centers.length) {
      const nextCenters = initializeRgbCentroids(samples, components)
      setCenters(nextCenters)
      setRgbPhase('initialized')
      setIteration(0)
      setMovementHistory([])
      return
    }

    if (rgbPhase === 'converged') return

    if (rgbPhase === 'initialized' || rgbPhase === 'updated' || rgbPhase === 'data') {
      setSamples((current) => assignRgbSamples(current, centers))
      setRgbPhase('assigned')
      return
    }

    const updatedCenters = updateRgbCentroids(samples, centers)
    const movement = totalRgbCentroidMovement(centers, updatedCenters)
    setCenters(updatedCenters)
    setSamples((current) => assignRgbSamples(current, updatedCenters))
    setIteration((value) => value + 1)
    setMovementHistory((history) => [...history.slice(-11), movement])
    setRgbPhase(movement < 0.8 ? 'converged' : 'updated')
  }, [centers, components, rgbPhase, samples, saveRgbSnapshot])

  const runPreviousRgbStep = useCallback(() => {
    setRgbHistory((history) => {
      const previous = history.at(-1)
      if (!previous) return history

      setSamples(previous.samples)
      setCenters(previous.centers)
      setRgbPhase(previous.rgbPhase)
      setIteration(previous.iteration)
      setMovementHistory(previous.movementHistory)
      return history.slice(0, -1)
    })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawRgbScene(canvas, samples, centers, rotation, originOffset)
  }, [samples, centers, originOffset, rotation])

  const startDrag = useCallback((event) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const origin = {
      x: rect.left + rect.width * 0.5 + originOffset.x,
      y: rect.top + rect.height * 0.52 + originOffset.y,
    }
    const distanceFromOrigin = Math.hypot(event.clientX - origin.x, event.clientY - origin.y)
    const mode = distanceFromOrigin <= 28 ? 'origin' : 'rotate'

    canvas.setPointerCapture(event.pointerId)
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, mode }
    setIsDragging(true)
  }, [originOffset])

  const dragScene = useCallback((event) => {
    if (dragRef.current.pointerId !== event.pointerId) return

    const deltaX = event.clientX - dragRef.current.x
    const deltaY = event.clientY - dragRef.current.y
    dragRef.current.x = event.clientX
    dragRef.current.y = event.clientY

    if (dragRef.current.mode === 'origin') {
      setOriginOffset((value) => ({
        x: value.x + deltaX,
        y: value.y + deltaY,
      }))
      return
    }

    setRotation((value) => value + deltaX * 0.01)
  }, [])

  const endDrag = useCallback((event) => {
    if (dragRef.current.pointerId !== event.pointerId) return

    const canvas = canvasRef.current
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId)
    }
    dragRef.current = { pointerId: null, x: 0, y: 0, mode: 'rotate' }
    setIsDragging(false)
  }, [])

  return (
    <div className="rgb-page">
      <header className="rgb-hero">
        <button className="back-button" onClick={onBack} aria-label="Go back to main article">
          <span>← Back to Article</span>
        </button>
        <p className="subpage-kicker">02 / Image Segmentation</p>
        <h1>3D K-Means in RGB Space</h1>
        <p>
          Treat every pixel as a 3D point with red, green, and blue coordinates.
          The K-Means loop assigns points to the nearest RGB centroid, then
          moves each centroid to the mean color of its cluster.
        </p>
      </header>

      <section className="rgb-workbench" aria-label="RGB color space visualizer">
        <div className="rgb-stage">
          <div className="rgb-toolbar">
            <label>
              Preset
              <select
                value={preset}
                onChange={(event) => {
                  const nextPreset = event.target.value
                  const nextState = createRgbKMeansState(
                    nextPreset,
                    components,
                    spread,
                    dataSeed,
                  )
                  setPreset(nextPreset)
                  setSamples(nextState.samples)
                  setCenters(nextState.centers)
                  setRgbPhase('initialized')
                  setIteration(0)
                  setMovementHistory([])
                  setRgbHistory([])
                }}
              >
                {Object.entries(rgbPresets).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Components
              <input
                type="range"
                min="2"
                max="4"
                value={components}
                onChange={(event) => {
                  const nextComponents = Number(event.target.value)
                  const nextState = createRgbKMeansState(
                    preset,
                    nextComponents,
                    spread,
                    dataSeed,
                  )
                  setComponents(nextComponents)
                  setSamples(nextState.samples)
                  setCenters(nextState.centers)
                  setRgbPhase('initialized')
                  setIteration(0)
                  setMovementHistory([])
                  setRgbHistory([])
                }}
              />
              <strong>{components}</strong>
            </label>
            <label>
              Color spread
              <input
                type="range"
                min="18"
                max="82"
                value={spread}
                onChange={(event) => {
                  const nextSpread = Number(event.target.value)
                  const nextState = createRgbKMeansState(
                    preset,
                    components,
                    nextSpread,
                    dataSeed,
                  )
                  setSpread(nextSpread)
                  setSamples(nextState.samples)
                  setCenters(nextState.centers)
                  setRgbPhase('initialized')
                  setIteration(0)
                  setMovementHistory([])
                  setRgbHistory([])
                }}
              />
              <strong>{spread}</strong>
            </label>
            <button type="button" onClick={generateData}>
              Generate Data
            </button>
            <button type="button" onClick={initializeCentroids}>
              Initialize Centroids
            </button>
            <button type="button" onClick={runNextRgbStep}>
              Next Step
            </button>
            <button
              type="button"
              onClick={runPreviousRgbStep}
              disabled={!rgbHistory.length}
            >
              Previous Step
            </button>
          </div>
          <div className="rgb-status">
            <span>{phaseLabel}</span>
            <strong>{rgbPhase === 'converged' ? 'Converged' : 'Optimizing'}</strong>
          </div>
          <canvas
            ref={canvasRef}
            className={`em3d-canvas ${isDragging ? 'is-dragging' : ''}`}
            aria-label="Draggable 3D RGB color cloud"
            onPointerDown={startDrag}
            onPointerMove={dragScene}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        </div>

        <aside className="rgb-inspector" aria-label="3D K-Means metrics">
          <div className="rgb-metric primary">
            <span>Iteration</span>
            <strong>{iteration}</strong>
          </div>
          <div className="rgb-metric">
            <span>WCSS</span>
            <strong>{Math.round(wcss).toLocaleString()}</strong>
          </div>
          <div className="rgb-component-list">
            <h2>Cluster Counts</h2>
            {clusterStats.map((stat, index) => (
              <article key={rgbClusterColors[index]} className="rgb-component">
                <i style={{ background: rgbClusterColors[index] }} />
                <div>
                  <strong>Cluster {index + 1}</strong>
                  <code>{stat.count} pixels</code>
                </div>
                <span>{counts[index]}</span>
              </article>
            ))}
            {!clusterStats.length ? <p>Initialize centroids to begin clustering.</p> : null}
          </div>
          <div className="rgb-metric">
            <span>Centroid movement</span>
            <strong>{latestMovement.toFixed(2)}</strong>
          </div>
          <div className="movement-chart" aria-label="RGB centroid movement history">
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
          <div className="rgb-component-list">
            <h2>Centroid Coordinates</h2>
            {clusterStats.map((stat, index) => (
              <article key={`center-${rgbClusterColors[index]}`} className="rgb-component">
                <i style={{ background: rgbClusterColors[index] }} />
                <div>
                  <strong>μ{index + 1}</strong>
                  <code>
                    RGB({stat.center.map((value) => Math.round(value)).join(', ')})
                  </code>
                </div>
                <span>{stat.variance.toFixed(1)} σ</span>
              </article>
            ))}
            {!clusterStats.length ? <p>No centroids placed yet.</p> : null}
          </div>
        </aside>
      </section>

      <section className="rgb-learning-boxes" aria-label="3D K-Means notes">
        <article>
          <p>Box 1</p>
          <h2>3D points</h2>
          <span>
            Each dot has coordinates <code>(R, G, B)</code>, so distance is
            measured in three dimensions instead of two.
          </span>
        </article>
        <article>
          <p>Box 2</p>
          <h2>Assignment</h2>
          <span>
            The assignment step colors every pixel by the nearest RGB centroid,
            exactly like nearest-centroid assignment in the 2D playground.
          </span>
        </article>
        <article>
          <p>Box 3</p>
          <h2>Centroid updates</h2>
          <span>
            The update step replaces each centroid with the mean red, green,
            and blue values of its assigned pixels.
          </span>
        </article>
      </section>
    </div>
  )
}

function NeuroPlayground({ onBack }) {
  const [stateCount, setStateCount] = useState(3)
  const [noise, setNoise] = useState(16)
  const [samples, setSamples] = useState(() => createNeuralSamples(3, 16))
  const [params, setParams] = useState([])
  const [phase, setPhase] = useState('data')
  const [iteration, setIteration] = useState(0)
  const [running, setRunning] = useState(false)
  const [likelihoodHistory, setLikelihoodHistory] = useState([])

  const logLikelihood = calculateNeuralLogLikelihood(samples, params)
  const latestDelta =
    likelihoodHistory.length > 1
      ? likelihoodHistory.at(-1) - likelihoodHistory.at(-2)
      : 0
  const hasResponsibilities = samples.some((sample) => sample.responsibilities.length)
  const converged = phase === 'converged'

  const generateSignal = useCallback(() => {
    setSamples(createNeuralSamples(stateCount, noise))
    setParams([])
    setPhase('data')
    setIteration(0)
    setRunning(false)
    setLikelihoodHistory([])
  }, [noise, stateCount])

  const initialize = useCallback(() => {
    setSamples((current) =>
      current.length ? current.map((sample) => ({ ...sample, responsibilities: [] })) : createNeuralSamples(stateCount, noise),
    )
    setParams(initializeNeuralParams(stateCount))
    setPhase('initialized')
    setIteration(0)
    setRunning(false)
    setLikelihoodHistory([])
  }, [noise, stateCount])

  const runNextStep = useCallback(() => {
    if (!params.length) {
      initialize()
      return
    }

    if (phase === 'converged') {
      setRunning(false)
      return
    }

    if (phase === 'initialized' || phase === 'updated' || phase === 'data') {
      const estimated = estimateNeuralResponsibilities(samples, params)
      setSamples(estimated)
      setPhase('expectation')
      return
    }

    const updated = updateNeuralParams(samples, params)
    const nextLikelihood = calculateNeuralLogLikelihood(samples, updated)
    const movement = updated.reduce(
      (sum, param) => sum + Math.abs(param.mean - (param.prevMean ?? param.mean)),
      0,
    )

    setParams(updated)
    setIteration((value) => value + 1)
    setLikelihoodHistory((history) => [...history.slice(-11), nextLikelihood])
    setPhase(movement < 0.22 && iteration > 1 ? 'converged' : 'updated')
    if (movement < 0.22 && iteration > 1) setRunning(false)
  }, [initialize, iteration, params, phase, samples])

  useEffect(() => {
    if (!running) return undefined

    const timer = window.setTimeout(runNextStep, 850)
    return () => window.clearTimeout(timer)
  }, [runNextStep, running])

  const chartPoints = useMemo(() => {
    const maxAmplitude = Math.max(...samples.map((sample) => sample.amplitude), 1)
    return samples
      .map((sample, index) => {
        const x = 24 + (index / Math.max(1, samples.length - 1)) * 712
        const y = 220 - (sample.amplitude / maxAmplitude) * 166
        return `${x.toFixed(2)},${y.toFixed(2)}`
      })
      .join(' ')
  }, [samples])

  const phaseLabel = {
    data: 'Signal generated',
    initialized: 'Step 1 - Initialize states',
    expectation: 'Step 2 - Estimate hidden states',
    updated: 'Step 3 - Update emission model',
    converged: 'Step 4 - Converged',
  }[phase]

  return (
    <div className="neuro-page">
      <header className="neuro-hero">
        <button className="back-button" onClick={onBack} aria-label="Go back to main article">
          <span>← Back to Article</span>
        </button>
        <p className="subpage-kicker">03 / Neural Signal Analysis</p>
        <h1>Neuroscience Signal Analysis</h1>
        <p>
          Treat a neural recording as emissions from hidden brain states. The
          E-step estimates state responsibility at each time point, and the
          M-step updates each state's firing-rate profile.
        </p>
      </header>

      <section className="neuro-workbench" aria-label="Neural EM simulation">
        <div className="neuro-stage">
          <div className="neuro-toolbar">
            <label>
              States
              <input
                type="range"
                min="2"
                max="4"
                value={stateCount}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  setStateCount(next)
                  setSamples(createNeuralSamples(next, noise))
                  setParams([])
                  setPhase('data')
                  setIteration(0)
                  setLikelihoodHistory([])
                }}
              />
              <strong>{stateCount}</strong>
            </label>
            <label>
              Noise
              <input
                type="range"
                min="6"
                max="34"
                value={noise}
                onChange={(event) => setNoise(Number(event.target.value))}
              />
              <strong>{noise}</strong>
            </label>
            <button type="button" onClick={generateSignal}>
              Generate Signal
            </button>
            <button type="button" onClick={initialize}>
              Initialize States
            </button>
            <button type="button" onClick={runNextStep}>
              Next Step
            </button>
            <button
              className={running ? 'is-active' : ''}
              type="button"
              onClick={() => setRunning((value) => !value)}
              disabled={converged}
            >
              {running ? 'Pause' : 'Auto Run'}
            </button>
          </div>

          <div className="neuro-status">
            <span>{phaseLabel}</span>
            <strong>{converged ? 'Stable states' : 'Estimating'}</strong>
          </div>

          <svg
            className="neuro-chart"
            viewBox="0 0 760 260"
            role="img"
            aria-label="Neural signal with hidden state responsibilities"
          >
            <rect width="760" height="260" className="neuro-chart-bg" />
            {samples.map((sample, index) => {
              const x = 24 + (index / Math.max(1, samples.length - 1)) * 712
              const dominant = hasResponsibilities
                ? sample.responsibilities.indexOf(Math.max(...sample.responsibilities))
                : sample.trueState
              const confidence = hasResponsibilities
                ? Math.max(...sample.responsibilities)
                : 0.22
              return (
                <rect
                  key={sample.id}
                  x={x - 2.4}
                  y="18"
                  width="4.8"
                  height="204"
                  fill={neuralStateColors[dominant]}
                  opacity={hasResponsibilities ? 0.12 + confidence * 0.26 : 0.08}
                />
              )
            })}
            {[60, 120, 180].map((line) => (
              <line key={line} x1="24" x2="736" y1={line} y2={line} className="neuro-grid-line" />
            ))}
            <polyline points={chartPoints} className="neuro-signal-line" />
            {samples
              .filter((sample) => sample.amplitude > 62)
              .map((sample) => {
                const x = 24 + (sample.id / Math.max(1, samples.length - 1)) * 712
                return <line key={`spike-${sample.id}`} x1={x} x2={x} y1="226" y2="242" className="spike-tick" />
              })}
            {params.map((param, index) => {
              const y = 220 - (param.mean / 96) * 166
              return (
                <g key={param.id}>
                  <line x1="24" x2="736" y1={y} y2={y} stroke={neuralStateColors[index]} className="state-mean-line" />
                  <text x="646" y={y - 7} fill={neuralStateColors[index]} className="state-label">
                    {neuralProfiles[index].label}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <aside className="neuro-inspector" aria-label="Hidden state metrics">
          <div className="neuro-metric primary">
            <span>Iteration</span>
            <strong>{iteration}</strong>
          </div>
          <div className="neuro-metric">
            <span>Log likelihood</span>
            <strong>{Math.round(logLikelihood).toLocaleString()}</strong>
          </div>
          <div className="neuro-metric">
            <span>Latest gain</span>
            <strong>{latestDelta.toFixed(2)}</strong>
          </div>
          <div className="likelihood-chart" aria-label="Log likelihood history">
            {likelihoodHistory.length ? (
              likelihoodHistory.map((value, index) => {
                const min = Math.min(...likelihoodHistory)
                const max = Math.max(...likelihoodHistory)
                const height = max === min ? 32 : 12 + ((value - min) / (max - min)) * 88
                return <span key={`${value}-${index}`} style={{ height: `${height}%` }} />
              })
            ) : (
              <p>Likelihood history appears after the first M-step.</p>
            )}
          </div>
          <div className="state-list">
            <h2>Hidden States</h2>
            {params.length ? (
              params.map((param, index) => (
                <article key={param.id} className="state-row">
                  <i style={{ background: neuralStateColors[index] }} />
                  <div>
                    <strong>{neuralProfiles[index].label}</strong>
                    <code>mean {param.mean.toFixed(1)} Hz</code>
                  </div>
                  <span>{Math.round(param.weight * 100)}%</span>
                </article>
              ))
            ) : (
              <p>Initialize hidden states to inspect means and weights.</p>
            )}
          </div>
        </aside>
      </section>

      <section className="neuro-learning-boxes" aria-label="Neural EM notes">
        <article>
          <p>Box 1</p>
          <h2>Latent brain states</h2>
          <span>States are not observed directly; EM infers them from firing-rate patterns.</span>
        </article>
        <article>
          <p>Box 2</p>
          <h2>Responsibilities</h2>
          <span>Each time point receives soft probabilities across rest, burst, response, and recovery states.</span>
        </article>
        <article>
          <p>Box 3</p>
          <h2>Emission updates</h2>
          <span>The M-step refits each state's mean activity and mixture weight from those soft assignments.</span>
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

  if (type === 'rgb') {
    return <RgbPlayground onBack={onBack} />
  }

  if (type === 'neuroscience') {
    return <NeuroPlayground onBack={onBack} />
  }

  if (type === 'em') {
    return <EmAlgoPlayground onBack={onBack} />
  }

  if (type === 'presentation') {
    return <PresentationPlayground onBack={onBack} />
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

const pagePaths = {
  main: '/',
  kmeans: '/kmeans',
  rgb: '/rgb',
  neuroscience: '/neuroscience',
  em: '/em',
  presentation: '/presentation',
}

function getPageFromPath() {
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  return Object.entries(pagePaths).find(([, pagePath]) => pagePath === path)?.[0] ?? 'main'
}

function App() {
  const [activePage, setActivePage] = useState(() => getPageFromPath())
  const progress = useReadingProgress()
  const articleRef = useRevealOnScroll()

  const navigateToPage = useCallback((page) => {
    const nextPath = pagePaths[page] ?? pagePaths.main
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }
    setActivePage(page)
  }, [])

  useEffect(() => {
    const syncPageFromHistory = () => setActivePage(getPageFromPath())
    window.addEventListener('popstate', syncPageFromHistory)
    return () => window.removeEventListener('popstate', syncPageFromHistory)
  }, [])

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
            <div className="supplemental-section" id="presentation">
              <h2 className="section-heading">Presentation</h2>
              <div
                className="presentation-card clickable-card"
                onClick={() => navigateToPage('presentation')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigateToPage('presentation')}
              >
                <div className="presentation-preview-visual">
                  <div className="slide-preview-mockup">
                    <div className="mockup-header">
                      <span className="dot"></span>
                      <span className="dot"></span>
                      <span className="dot"></span>
                    </div>
                    <div className="mockup-body">
                      <div className="mockup-title">Expectation–Maximization</div>
                      <div className="mockup-subtitle">A Patient Editorial Process</div>
                      <div className="mockup-slide-num">Slide 1 / 6</div>
                    </div>
                  </div>
                </div>
                <div className="presentation-card-footer">
                  <button className="presentation-btn">Launch Presentation →</button>
                </div>
              </div>
            </div>

            <div className="supplemental-section" id="maths-behind-em">
              <h2 className="section-heading">Maths Behind the EM</h2>
              <div className="placeholder-card">
                <p>Detailed mathematical formulation, Jensen's Inequality proof, and coordinate ascent derivation will be added here.</p>
              </div>
            </div>

            <div className="supplemental-section" id="report">
              <h2 className="section-heading">Report & Empirical Studies</h2>
              <ReportSection />
            </div>

            <div className="supplemental-section" id="visualization">
              <h2 className="section-heading">Visualization</h2>
              <div className="visualization-grid">
                <div
                  className="visualization-card clickable"
                  id="viz-k-means"
                  onClick={() => navigateToPage('kmeans')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigateToPage('kmeans')}
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
                  onClick={() => navigateToPage('rgb')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigateToPage('rgb')}
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
                  onClick={() => navigateToPage('neuroscience')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigateToPage('neuroscience')}
                >
                  <p className="viz-card-kicker">03 / Neural Signal Analysis</p>
                  <h3 className="viz-card-title">Neuroscience</h3>
                  <div className="viz-image-wrapper">
                    <img src="/neuro_brain.png" alt="Neural Connectome Mapping" className="viz-image" />
                  </div>
                </div>

                <div
                  className="visualization-card clickable"
                  id="viz-em-algo"
                  onClick={() => navigateToPage('em')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigateToPage('em')}
                >
                  <p className="viz-card-kicker">04 / Interactive Explainer</p>
                  <h3 className="viz-card-title">EM Algo</h3>
                  <div className="viz-image-wrapper">
                    <img src="/em_viz.png" alt="EM Algorithm Interactive Explainer" className="viz-image" />
                  </div>
                </div>
              </div>

            </div>
          </section>
        </main>
      ) : (
        <main>
          <SubPage type={activePage} onBack={() => navigateToPage('main')} />
        </main>
      )}
    </>
  )
}

function EmAlgoPlayground({ onBack }) {
  return (
    <div className="em-playground-container">
      <header className="em-playground-header">
        <button className="back-button" onClick={onBack} aria-label="Go back to main article">
          <span>← Back to Article</span>
        </button>
      </header>
      <div className="em-iframe-wrapper">
        <iframe
          title="EM Algorithm Explainer"
          src="/em_algo.html"
          className="em-explainer-iframe"
        />
      </div>
    </div>
  )
}

function PresentationPlayground({ onBack }) {
  const [currentSlide, setCurrentSlide] = useState(0)

  const slides = [
    {
      title: "Introduction",
      subtitle: "A Patient Editorial Process for Incomplete Data",
      kicker: "01 / Introduction",
    },
    {
      title: "Mathematical Background",
      subtitle: "Objective Functions & Log-Likelihood Intractability",
      kicker: "02 / Mathematical Background",
    },
    {
      title: "Latent Variable Models",
      subtitle: "Decoding the Hidden Driving Forces",
      kicker: "03 / Latent Variable Models",
    },
    {
      title: "Expectation–Maximization Algorithm",
      subtitle: "Alternating Coordinate Ascent Steps",
      kicker: "04 / Expectation–Maximization Algorithm",
    },
    {
      title: "Gaussian Mixture Models",
      subtitle: "The Canonical Latent Variable Baseline",
      kicker: "05 / Gaussian Mixture Models",
    },
    {
      title: "Implementation and Results",
      subtitle: "",
      kicker: "06 / Implementation and Results",
    },
    {
      title: "Limitations and Applications",
      subtitle: "Local Maxima Pitfalls & Smart Initializations",
      kicker: "07 / Limitations and Applications",
    },
    {
      title: "Conclusion",
      subtitle: "Key Takeaways & Future Horizons",
      kicker: "08 / Conclusion",
    }
  ]

  const handleNext = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length)
  }, [slides.length])

  const handlePrev = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
  }, [slides.length])



  // Key navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') handleNext()
      if (e.key === 'ArrowLeft') handlePrev()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNext, handlePrev])

  const progressPercent = ((currentSlide + 1) / slides.length) * 100

  return (
    <div className="em-playground-container presentation-page">
      <header className="em-playground-header">
        <button className="back-button" onClick={onBack} aria-label="Go back to main article">
          <span>← Back to Article</span>
        </button>
      </header>

      <div className="presentation-slide-deck">
        <div className="slide-card">
          <div className="slide-header">
            <span className="slide-kicker">{slides[currentSlide].kicker}</span>
            <span className="slide-counter">{currentSlide + 1} / {slides.length}</span>
          </div>
          
          {currentSlide !== 2 && (
            <h2 className="slide-title">{slides[currentSlide].title}</h2>
          )}
          {currentSlide !== 2 && slides[currentSlide].subtitle && (
            <h3 className="slide-subtitle">{slides[currentSlide].subtitle}</h3>
          )}

          {currentSlide === 2 && (
            <div className="slide-scroll-body" style={{
              width: '100%',
              maxHeight: '430px',
              overflowY: 'auto',
              textAlign: 'center',
              padding: '0 40px 30px 40px',
              marginTop: '10px',
              fontFamily: 'var(--sans)',
              fontSize: '0.96rem',
              color: '#2c3033',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}>
              <div style={{ width: '100%', maxWidth: '720px' }}>
                <h4 style={{ color: '#183653', marginTop: '0', marginBottom: '12px', fontSize: '1.15rem', fontWeight: '800', letterSpacing: '0.04em' }}>LATENT VARIABLES</h4>
                <div style={{ margin: '0 auto 28px auto', lineHeight: '1.7', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>• Hidden variables that cannot be directly observed</div>
                  <div>• Represent underlying factors that influence observed data</div>
                  <div>• Denoted by <strong>Z</strong></div>
                  <div>• Observed variables are denoted by <strong>X</strong></div>
                  <div>• Model parameters are denoted by <strong>θ</strong></div>
                </div>

                <h4 style={{ color: '#183653', marginTop: '32px', marginBottom: '12px', fontSize: '1.15rem', fontWeight: '800', letterSpacing: '0.04em' }}>KEY IDEA</h4>
                <div style={{ margin: '0 auto 28px auto', lineHeight: '1.7', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>• Observed data is generated by hidden factors</div>
                  <div>• Latent variables explain patterns and structure in data</div>
                  <div>• Many real-world problems contain hidden information</div>
                </div>

                <h4 style={{ color: '#183653', marginTop: '32px', marginBottom: '12px', fontSize: '1.15rem', fontWeight: '800', letterSpacing: '0.04em' }}>EXAMPLE</h4>
                <div style={{ margin: '0 auto 28px auto', lineHeight: '1.7', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>• Customer Purchases &rarr; Observed Data (X)</div>
                  <div>• Customer Preferences &rarr; Latent Variable (Z)</div>
                </div>

                <h4 style={{ color: '#183653', marginTop: '32px', marginBottom: '12px', fontSize: '1.15rem', fontWeight: '800', letterSpacing: '0.04em' }}>GRAPHICAL MODEL</h4>
                <div style={{ background: '#ede4d2', padding: '10px 24px', borderRadius: '4px', display: 'inline-block', fontFamily: 'var(--serif)', fontSize: '1.2rem', fontWeight: '600', color: '#183653', margin: '0 auto 16px auto', border: '1px solid #d7d4c9', letterSpacing: '0.05em' }}>
                  θ &rarr; Z &rarr; X
                </div>
                <div style={{ margin: '0 auto 28px auto', lineHeight: '1.7', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>• Parameters generate latent variables</div>
                  <div>• Latent variables generate observations</div>
                </div>

                <h4 style={{ color: '#183653', marginTop: '32px', marginBottom: '12px', fontSize: '1.15rem', fontWeight: '800', letterSpacing: '0.04em' }}>JOINT PROBABILITY</h4>
                <div style={{ background: '#ede4d2', padding: '10px 24px', borderRadius: '4px', display: 'inline-block', fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: '1.2rem', color: '#183653', margin: '0 auto 16px auto', border: '1px solid #d7d4c9' }}>
                  P(X, Z | θ)
                </div>
                <div style={{ margin: '0 auto 28px auto', lineHeight: '1.7', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>• Describes the relationship between observed and hidden variables</div>
                </div>

                <h4 style={{ color: '#183653', marginTop: '32px', marginBottom: '12px', fontSize: '1.15rem', fontWeight: '800', letterSpacing: '0.04em' }}>MARGINALIZATION</h4>
                <div style={{ margin: '0 auto 16px auto', lineHeight: '1.7' }}>
                  Latent variables are unknown. Sum over all possible hidden states:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', margin: '0 auto 28px auto' }}>
                  <div style={{ background: '#ede4d2', padding: '14px 20px', borderRadius: '6px', borderLeft: '3px solid #183653', width: '100%', maxWidth: '340px', fontFamily: 'var(--mono)', fontSize: '0.84rem' }}>
                    <strong>Discrete Z:</strong><br />
                    P(X|θ) = &Sigma;<sub>Z</sub> P(X,Z|θ)
                  </div>
                  <div style={{ background: '#ede4d2', padding: '14px 20px', borderRadius: '6px', borderLeft: '3px solid #183653', width: '100%', maxWidth: '340px', fontFamily: 'var(--mono)', fontSize: '0.84rem' }}>
                    <strong>Continuous Z:</strong><br />
                    P(X|θ) = &int; P(X,Z|θ)dZ
                  </div>
                </div>

                <h4 style={{ color: '#183653', marginTop: '32px', marginBottom: '12px', fontSize: '1.15rem', fontWeight: '800', letterSpacing: '0.04em' }}>APPLICATIONS</h4>
                <div style={{ margin: '0 auto 28px auto', lineHeight: '1.7', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>• Clustering</div>
                  <div>• Topic Modeling</div>
                  <div>• Recommendation Systems</div>
                  <div>• Speech Recognition</div>
                  <div>• Image Segmentation</div>
                </div>

                <h4 style={{ color: '#183653', marginTop: '32px', marginBottom: '12px', fontSize: '1.15rem', fontWeight: '800', letterSpacing: '0.04em' }}>IMPORTANCE</h4>
                <div style={{ margin: '0 auto 28px auto', lineHeight: '1.7', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>• Models hidden information</div>
                  <div>• Explains underlying data structure</div>
                  <div>• Handles uncertainty</div>
                  <div>• Foundation of EM Algorithm</div>
                </div>

                <h4 style={{ color: '#183653', marginTop: '32px', marginBottom: '12px', fontSize: '1.15rem', fontWeight: '800', letterSpacing: '0.04em' }}>LINK TO EM</h4>
                <div style={{ margin: '0 auto 28px auto', lineHeight: '1.7', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>• Latent variables are unknown</div>
                  <div>• Direct likelihood optimization becomes difficult</div>
                  <div>• Creates the Log-Sum Problem</div>
                  <div>• EM estimates Z and updates θ iteratively</div>
                </div>

                <h4 style={{ color: '#183653', marginTop: '40px', marginBottom: '12px', fontSize: '1.15rem', fontWeight: '800', letterSpacing: '0.04em' }}>ONE-LINE SUMMARY</h4>
                <blockquote style={{ margin: '16px auto 0 auto', maxWidth: '600px', padding: '16px 24px', borderLeft: 'none', borderTop: '2px solid #c74a26', borderBottom: '2px solid #c74a26', fontSize: '1.08rem', fontStyle: 'italic', color: '#183653', lineHeight: '1.6' }}>
                  "Latent variables (Z) are hidden factors that influence observed data (X) and help explain the underlying structure of the data."
                </blockquote>
              </div>
            </div>
          )}

          {currentSlide === 5 && (
            <button
              className="presentation-btn slide-action-btn"
              onClick={() => {
                onBack()
                setTimeout(() => {
                  const el = document.getElementById('visualization')
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                }, 100)
              }}
              style={{ marginTop: '40px' }}
            >
              Explore Interactive Visualizers →
            </button>
          )}
        </div>
      </div>

      <div className="presentation-controls-bar">
        <div className="slide-progress-track">
          <div className="slide-progress-bar" style={{ width: `${progressPercent}%` }}></div>
        </div>

        <div className="presentation-actions">
          <button className="btn control-btn" onClick={handlePrev} aria-label="Previous slide">
            ◀ Previous
          </button>

          <button className="btn btn-primary control-btn" onClick={handleNext} aria-label="Next slide">
            Next ▶
          </button>
        </div>

        <div className="slide-dots">
          {slides.map((_, idx) => (
            <button
              key={idx}
              className={`slide-dot-indicator ${idx === currentSlide ? 'active' : ''}`}
              onClick={() => {
                setCurrentSlide(idx)
              }}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ReportSection() {
  const [activeTab, setActiveTab] = useState('abstract')

  const authors = [
    'Chavi Makana',
    'Anubhav Kumari',
    'Kartik Manmode',
    'Aryan Patel',
    'Rajveer Singh',
  ]

  return (
    <div className="report-dashboard">
      <header className="report-citation-header">
        <span className="academic-badge">Academic Project Report</span>
        <h3 className="report-main-title">Expectation–Maximization Algorithm</h3>
        <p className="report-meta-info">
          Department of Computer Science • May 2026 • Project Thesis
        </p>
        <div className="author-grid">
          {authors.map((author) => (
            <div key={author} className="author-badge">
              <span className="author-dot" />
              <span className="author-name">{author}</span>
            </div>
          ))}
        </div>
      </header>

      <div className="report-workspace-grid">
        {/* Left Panel: synthesized content */}
        <div className="report-insights-panel">
          <nav className="report-tabs-nav" aria-label="Report chapters">
            {[
              { id: 'abstract', label: 'Abstract' },
              { id: 'math', label: 'Core Math' },
              { id: 'limitations', label: 'Limitations' },
              { id: 'results', label: 'Empirical Findings' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`tab-btn ${activeTab === tab.id ? 'is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="report-tab-body">
            {activeTab === 'abstract' && (
              <article className="academic-article fade-in">
                <p className="serif-para">
                  <span className="drop-cap">T</span>he Expectation–Maximization (EM) algorithm is a widely used iterative optimization technique for estimating parameters in statistical models that contain latent or hidden variables. In many real-world problems, the observed data is incomplete or generated from multiple hidden sources, making direct maximum likelihood estimation difficult. The EM algorithm solves this problem by dividing the optimization process into two iterative steps known as the Expectation step (E-step) and the Maximization step (M-step).
                </p>
                <p className="serif-para">
                  In the E-step, the algorithm estimates the expected values of hidden variables using the current parameter values. In the M-step, the model parameters are updated to maximize the expected log-likelihood obtained from the E-step. These two steps are repeated until convergence is achieved. The EM algorithm is based on the concept of likelihood maximization and Jensen’s inequality, which ensures that the likelihood value improves after every iteration.
                </p>
                <div className="abstract-accent-quote">
                  "Overall, this project demonstrates how the EM algorithm provides an effective framework for solving incomplete-data optimization problems and highlights its importance in machine learning, statistics, and artificial intelligence applications."
                </div>
              </article>
            )}

            {activeTab === 'math' && (
              <div className="math-formulations fade-in">
                <p className="math-intro-text">
                  Below are the core mathematical formulations derived in Chapters 2, 4, and 5 of the report:
                </p>

                <section className="math-card">
                  <span className="math-card-label">Expectation Step (E-step)</span>
                  <p className="math-desc">Computes the expectation of the complete-data log-likelihood ($Q$-function) with respect to the latent posterior:</p>
                  <div className="math-display">
                    <span className="math-var">Q</span>(<span className="math-var">θ</span>, <span className="math-var">θ</span><sup>(<span className="math-var">t</span>)</sup>) = <span className="math-symbol">E</span><sub><span className="math-var">Z</span>|<span className="math-var">X</span>,<span className="math-var">θ</span><sup>(<span className="math-var">t</span>)</sup></sub> [ log <span className="math-var">P</span>(<span className="math-var">X</span>, <span className="math-var">Z</span> | <span className="math-var">θ</span>) ]
                  </div>
                </section>

                <section className="math-card">
                  <span className="math-card-label">Maximization Step (M-step)</span>
                  <p className="math-desc">Updates the parameters by maximizing the expectation function obtained in the E-step:</p>
                  <div className="math-display">
                    <span className="math-var">θ</span><sup>(<span className="math-var">t</span>+1)</sup> = arg max<sub><span className="math-var">θ</span></sub> <span className="math-var">Q</span>(<span className="math-var">θ</span>, <span className="math-var">θ</span><sup>(<span className="math-var">t</span>)</sup>)
                  </div>
                </section>

                <section className="math-card">
                  <span className="math-card-label">Evidence Lower Bound (ELBO) via Jensen's Inequality</span>
                  <p className="math-desc">Constructs a tight concave lower bound at the current estimate to guarantee monotonic convergence:</p>
                  <div className="math-display">
                    log <span className="math-var">P</span>(<span className="math-var">X</span> | <span className="math-var">θ</span>) &ge; <span className="math-symbol">&sum;</span><sub><span className="math-var">Z</span></sub> <span className="math-var">q</span>(<span className="math-var">Z</span>) log <span className="math-fraction"><sup><span className="math-var">P</span>(<span className="math-var">X</span>, <span className="math-var">Z</span> | <span className="math-var">θ</span>)</sup><sub>&frasl;</sub><sub><span className="math-var">q</span>(<span className="math-var">Z</span>)</sub></span>
                  </div>
                  <p className="math-subtext">where choosing <span className="math-var">q</span>(<span className="math-var">Z</span>) = <span className="math-var">P</span>(<span className="math-var">Z</span> | <span className="math-var">X</span>, <span className="math-var">θ</span><sup>(<span className="math-var">t</span>)</sup>) makes the bound tight.</p>
                </section>

                <section className="math-card">
                  <span className="math-card-label">Soft Cluster Membership (&gamma; in GMMs)</span>
                  <p className="math-desc">Computes the posterior probability (responsibility) that data point <span className="math-var">x<sub>n</sub></span> belongs to Gaussian component <span className="math-var">k</span>:</p>
                  <div className="math-display-large">
                    <span className="math-var">&gamma;</span>(<span className="math-var">z<sub>nk</sub></span>) = <span className="math-fraction"><sup><span className="math-var">&pi;<sub>k</sub></span> &bull; <span className="math-symbol">N</span>(<span className="math-var">x<sub>n</sub></span> | <span className="math-var">&mu;<sub>k</sub></span>, <span className="math-var">&Sigma;<sub>k</sub></span>)</sup><sub>&frasl;</sub><sub><span className="math-symbol">&sum;</span><sub><span className="math-var">j</span></sub> <span className="math-var">&pi;<sub>j</sub></span> &bull; <span className="math-symbol">N</span>(<span className="math-var">x<sub>n</sub></span> | <span className="math-var">&mu;<sub>j</sub></span>, <span className="math-var">&Sigma;<sub>j</sub></span>)</sub></span>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'limitations' && (
              <div className="limitations-grid fade-in">
                <p className="math-intro-text" style={{ gridColumn: '1 / -1' }}>
                  The report discusses several fundamental challenges and mathematical boundaries in Chapter 7:
                </p>

                <article className="limitation-card">
                  <h4>⚠️ Local Maxima Convergence</h4>
                  <p>Because the log-likelihood surface is non-convex, the algorithm guarantees finding a local optimum, but does not guarantee the global maximum.</p>
                </article>

                <article className="limitation-card">
                  <h4>🎯 Sensitivity to Initialization</h4>
                  <p>Different starting centers or mixing parameters can lead to wildly different final clusters. Utilizing <strong>K-Means initialization</strong> significantly stabilizes results.</p>
                </article>

                <article className="limitation-card">
                  <h4>⏳ Slow Convergence Speed</h4>
                  <p>As the model parameters approach the optimum, the change in likelihood per step shrinks exponentially, requiring many iterations to converge fully.</p>
                </article>

                <article className="limitation-card">
                  <h4>🛑 Singular Covariances</h4>
                  <p>If a single Gaussian component is assigned too few points, its variance collapses to zero, making the covariance matrix singular and causing numerical overflow.</p>
                </article>
              </div>
            )}

            {activeTab === 'results' && (
              <article className="academic-article fade-in">
                <p className="serif-para">
                  Chapter 6.2 outlines extensive numerical experiments testing the algorithm against traditional K-Means clustering.
                </p>
                
                <h4 className="findings-sub">Key Discoveries:</h4>
                <ul className="findings-list">
                  <li>
                    <strong>Soft vs. Hard Clustering:</strong> Unlike K-Means which enforces hard borders, the EM algorithm's soft cluster assignments allow points near cluster boundaries to retain fractional weights across multiple components (e.g. 70% Cluster A, 30% Cluster B).
                  </li>
                  <li>
                    <strong>Covariance Adaptability:</strong> Gaussian Mixture Models successfully capture anisotropic clusters (ellipses with arbitrary rotations and sizes), whereas K-Means is mathematically limited to isotropic spheres.
                  </li>
                  <li>
                    <strong>Likelihood Progression:</strong> In all experiments (N=150, K=3), the Evidence Lower Bound (ELBO) showed strict monotonic increase, validating Jensen's Inequality in practice.
                  </li>
                </ul>

                <p className="serif-para">
                  These insights directly drive the active simulations in the <strong>K-Means 2D Playground</strong>, the <strong>3D RGB cloud partitioner</strong>, and the <strong>Neuroscience electrode spike de-noiser</strong> pages of this web app.
                </p>
              </article>
            )}
          </div>
        </div>

        {/* Right Panel: actual PDF iframe inside premium mock browser */}
        <div className="report-pdf-viewer">
          <div className="browser-iframe-container">
            <iframe
              title="EM Algorithm Academic Project Report"
              src="/report.pdf"
              className="report-pdf-iframe"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App

