import React, { useState, useEffect, useRef, useCallback } from 'react';
import './EmAlgoPlayground.css';

// ── UTILITY MATH FUNCTIONS ──
function gaussPDF(x, mu, sigma) {
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
}

export default function EmAlgoPlayground({ onBack }) {
  const [activeSection, setActiveSection] = useState('s41');

  // ==========================================
  // ── 4.1 COIN STATE & ACTION HANDLERS ──
  // ==========================================
  const [trueA, setTrueA] = useState(0.70);
  const [trueB, setTrueB] = useState(0.35);
  const [numFlips, setNumFlips] = useState(10);
  
  const [coinState, setCoinState] = useState(null);
  const [coinStepDots, setCoinStepDots] = useState({ sd1: '', sd2: '', sd3: '', sd4: '' });
  const [coinReveal, setCoinReveal] = useState(false);
  const [flipVisuals, setFlipVisuals] = useState([]);
  const [isFlipping, setIsFlipping] = useState(false);

  const flipCoins = async () => {
    if (isFlipping) return;
    setIsFlipping(true);
    setCoinReveal(false);
    setCoinState(null);
    setFlipVisuals([]);
    setCoinStepDots({ sd1: 'active', sd2: '', sd3: '', sd4: '' });

    const usedA = Math.random() < 0.5;
    const p = usedA ? trueA : trueB;
    const seq = Array.from({ length: numFlips }, () => Math.random() < p ? 'H' : 'T');

    // Visual sequence animation
    for (let i = 0; i < seq.length; i++) {
      await new Promise(r => setTimeout(r, 80));
      setFlipVisuals(prev => [...prev, seq[i]]);
    }

    setCoinState({ tA: trueA, tB: trueB, usedA, seq });
    setCoinStepDots({ sd1: 'done', sd2: '', sd3: '', sd4: '' });
    setIsFlipping(false);
  };

  const runEMOnCoins = () => {
    if (!coinState) return;
    setCoinStepDots(prev => ({ ...prev, sd2: 'active' }));
    
    const { seq } = coinState;
    const n = seq.length;
    const H = seq.filter(x => x === 'H').length;
    const T = n - H;

    let a = 0.4 + Math.random() * 0.4;
    let b = 0.2 + Math.random() * 0.4;
    let iters = 0;
    let prev_a = 0;

    for (let iter = 0; iter < 200; iter++) {
      const log_pA = H * Math.log(a + 1e-10) + T * Math.log(1 - a + 1e-10);
      const log_pB = H * Math.log(b + 1e-10) + T * Math.log(1 - b + 1e-10);
      const max_log = Math.max(log_pA, log_pB);
      const pA = Math.exp(log_pA - max_log);
      const pB = Math.exp(log_pB - max_log);
      const wA = pA / (pA + pB + 1e-10);
      const wB = pB / (pA + pB + 1e-10);
      
      prev_a = a;
      a = (wA * H + 1e-4) / (wA * n + 2e-4);
      b = (wB * H + 1e-4) / (wB * n + 2e-4);
      iters++;
      if (Math.abs(a - prev_a) < 1e-6) break;
    }

    setCoinStepDots(prev => ({ ...prev, sd2: 'done', sd3: 'active' }));

    const log_pA = H * Math.log(a + 1e-10) + T * Math.log(1 - a + 1e-10);
    const log_pB = H * Math.log(b + 1e-10) + T * Math.log(1 - b + 1e-10);
    const usedA_guess = log_pA > log_pB;

    setCoinState(prev => ({
      ...prev,
      emUsedA: usedA_guess,
      emA: a,
      emB: b,
      iters
    }));

    setCoinStepDots(prev => ({ ...prev, sd3: 'done', sd4: 'active' }));
  };

  const revealCoinTruth = () => {
    if (!coinState) return;
    setCoinReveal(true);
    setCoinStepDots(prev => ({ ...prev, sd4: 'done' }));
  };

  // ==========================================
  // ── 4.2 E-STEP Gaussian Model Explorer ──
  // ==========================================
  const [muA, setMuA] = useState(162);
  const [muB, setMuB] = useState(178);
  const [sigma, setSigma] = useState(7);
  const estepCanvasRef = useRef(null);

  const heightData = [
    152, 155, 157, 158, 160, 161, 163, 165, 166, 168,
    170, 172, 173, 175, 176, 178, 180, 183, 185, 188
  ];

  const probs = heightData.map(h => {
    const pA = gaussPDF(h, muA, sigma);
    const pB = gaussPDF(h, muB, sigma);
    return pA / (pA + pB + 1e-10);
  });

  const drawEStep = useCallback(() => {
    const canvas = estepCanvasRef.current;
    if (!canvas) return;
    const W = canvas.offsetWidth || 560, H = 180;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const minH = 146, maxH = 194, padL = 30, padR = 20, padT = 10, padB = 36;
    const xs = x => padL + (x - minH) / (maxH - minH) * (W - padL - padR);
    const chartH = H - padT - padB;

    // Grid lines
    ctx.strokeStyle = 'rgba(24, 54, 83, 0.08)'; ctx.lineWidth = 0.5;
    [150, 155, 160, 165, 170, 175, 180, 185, 190].forEach(v => {
      ctx.beginPath(); ctx.moveTo(xs(v), padT); ctx.lineTo(xs(v), H - padB); ctx.stroke();
      ctx.fillStyle = 'rgba(18, 18, 18, 0.6)'; ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'center';
      ctx.fillText(v, xs(v), H - 10);
    });
    ctx.fillStyle = 'rgba(18, 18, 18, 0.6)'; ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'center';
    ctx.fillText('Height (cm)', W / 2, H - 1);

    // Gaussian curves
    const drawGauss = (m, color) => {
      const maxY = gaussPDF(m, m, sigma);
      ctx.beginPath();
      for (let x = minH; x <= maxH; x += 0.3) {
        const y = gaussPDF(x, m, sigma) / maxY;
        const cx = xs(x), cy = padT + (1 - y) * chartH;
        x === minH ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
      }
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7; ctx.stroke();
      ctx.globalAlpha = 1;
    };
    drawGauss(muA, '#183653');
    drawGauss(muB, '#892828');

    // Dots
    heightData.forEach((h, i) => {
      const p = probs[i];
      const r = Math.round(p * 24 + (1 - p) * 137);
      const g = Math.round(p * 54 + (1 - p) * 40);
      const b = Math.round(p * 83 + (1 - p) * 40);
      const x = xs(h), y = H / 2;
      ctx.beginPath(); ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.5; ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 8px IBM Plex Mono'; ctx.textAlign = 'center';
      ctx.fillText(h, x, y + 4);
    });

    // Mean lines
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = '#183653'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(xs(muA), padT); ctx.lineTo(xs(muA), H - padB); ctx.stroke();
    ctx.strokeStyle = '#892828';
    ctx.beginPath(); ctx.moveTo(xs(muB), padT); ctx.lineTo(xs(muB), H - padB); ctx.stroke();
    ctx.setLineDash([]);

    // Legend
    ctx.fillStyle = '#183653'; ctx.font = '11px IBM Plex Mono'; ctx.textAlign = 'left';
    ctx.fillText('● Group A (μ=' + muA + ')', padL, padT + 12);
    ctx.fillStyle = '#892828';
    ctx.fillText('● Group B (μ=' + muB + ')', padL + 140, padT + 12);
  }, [muA, muB, sigma, probs]);

  useEffect(() => {
    if (activeSection === 's42') {
      drawEStep();
    }
  }, [activeSection, drawEStep]);

  // ==========================================
  // ── 4.3 M-STEP Dynamic Updates ──
  // ==========================================
  const [msData, setMsData] = useState([]);
  const [msMuA, setMsMuA] = useState(0);
  const [msMuB, setMsMuB] = useState(0);
  const [msIter, setMsIter] = useState(0);
  const [msDelta, setMsDelta] = useState(null);
  const mstepCanvasRef = useRef(null);

  const mStepReset = useCallback(() => {
    const data = Array.from({ length: 10 }, () => 152 + Math.random() * 12)
      .concat(Array.from({ length: 10 }, () => 172 + Math.random() * 14));
    const initMuA = 155 + Math.random() * 20;
    const initMuB = initMuA + 4 + Math.random() * 18;

    setMsData(data);
    setMsMuA(initMuA);
    setMsMuB(initMuB);
    setMsIter(0);
    setMsDelta(null);
  }, []);

  const mStepOne = useCallback(() => {
    if (!msData.length) return;
    const sigmaA = 8, sigmaB = 8;
    const pA = msData.map(h => gaussPDF(h, msMuA, sigmaA));
    const pB = msData.map(h => gaussPDF(h, msMuB, sigmaB));
    const w = msData.map((_, i) => pA[i] / (pA[i] + pB[i] + 1e-10));
    
    const swA = w.reduce((a, b) => a + b, 0);
    const swB = w.reduce((a, b) => a + (1 - b), 0);
    
    const newMuA = msData.reduce((s, h, i) => s + w[i] * h, 0) / (swA + 1e-10);
    const newMuB = msData.reduce((s, h, i) => s + (1 - w[i]) * h, 0) / (swB + 1e-10);

    const delta = Math.abs(newMuA - msMuA);
    setMsDelta(delta);
    setMsMuA(newMuA);
    setMsMuB(newMuB);
    setMsIter(prev => prev + 1);
  }, [msData, msMuA, msMuB]);

  const [msIntervalId, setMsIntervalId] = useState(null);
  const mStepRun = () => {
    if (msIntervalId) return;
    let currentMuA = msMuA;
    let currentMuB = msMuB;
    let currentIter = msIter;

    const interval = setInterval(() => {
      // Inline math calculation to avoid state lag
      const sigmaA = 8, sigmaB = 8;
      const pA = msData.map(h => gaussPDF(h, currentMuA, sigmaA));
      const pB = msData.map(h => gaussPDF(h, currentMuB, sigmaB));
      const w = msData.map((_, i) => pA[i] / (pA[i] + pB[i] + 1e-10));
      
      const swA = w.reduce((a, b) => a + b, 0);
      const swB = w.reduce((a, b) => a + (1 - b), 0);
      
      const newMuA = msData.reduce((s, h, i) => s + w[i] * h, 0) / (swA + 1e-10);
      const newMuB = msData.reduce((s, h, i) => s + (1 - w[i]) * h, 0) / (swB + 1e-10);

      const delta = Math.abs(newMuA - currentMuA);
      
      currentMuA = newMuA;
      currentMuB = newMuB;
      currentIter += 1;

      setMsDelta(delta);
      setMsMuA(newMuA);
      setMsMuB(newMuB);
      setMsIter(currentIter);

      if (currentIter >= 25 || delta < 0.001) {
        clearInterval(interval);
        setMsIntervalId(null);
      }
    }, 160);

    setMsIntervalId(interval);
  };

  useEffect(() => {
    return () => {
      if (msIntervalId) clearInterval(msIntervalId);
    };
  }, [msIntervalId]);

  const drawMStep = useCallback(() => {
    const canvas = mstepCanvasRef.current;
    if (!canvas || !msData.length) return;
    const W = canvas.offsetWidth || 560, H = 220;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const minH = Math.min(...msData) - 5, maxH = Math.max(...msData) + 5;
    const padL = 32, padR = 20, padT = 14, padB = 36;
    const xs = x => padL + (x - minH) / (maxH - minH) * (W - padL - padR);
    const chartH = H - padT - padB;

    // Grid lines
    ctx.strokeStyle = 'rgba(24, 54, 83, 0.08)'; ctx.lineWidth = 0.5;
    for (let v = Math.ceil(minH / 5) * 5; v <= maxH; v += 5) {
      ctx.beginPath(); ctx.moveTo(xs(v), padT); ctx.lineTo(xs(v), H - padB); ctx.stroke();
      ctx.fillStyle = 'rgba(18, 18, 18, 0.6)'; ctx.font = '9px IBM Plex Mono'; ctx.textAlign = 'center';
      ctx.fillText(v, xs(v), H - 14);
    }

    const sigmaA = 8, sigmaB = 8;
    const pA = msData.map(h => gaussPDF(h, msMuA, sigmaA));
    const pB = msData.map(h => gaussPDF(h, msMuB, sigmaB));
    const ws = msData.map((_, i) => pA[i] / (pA[i] + pB[i] + 1e-10));

    // Gaussians
    const drawGauss2 = (mu, sig, color) => {
      ctx.beginPath();
      for (let x = minH; x <= maxH; x += 0.2) {
        const y = gaussPDF(x, mu, sig);
        const cx = xs(x), cy = H - padB - y * (chartH * 0.85) / gaussPDF(mu, mu, sig);
        x === minH ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
      }
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.85; ctx.stroke();
      ctx.globalAlpha = 1;

      // Area fill
      const pts = [];
      for (let x = minH; x <= maxH; x += 0.3) {
        pts.push([xs(x), H - padB - gaussPDF(x, mu, sig) * (chartH * 0.85) / gaussPDF(mu, mu, sig)]);
      }
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      pts.forEach(([cx, cy]) => ctx.lineTo(cx, cy));
      ctx.lineTo(pts[pts.length - 1][0], H - padB); ctx.lineTo(pts[0][0], H - padB); ctx.closePath();
      ctx.fillStyle = color.replace('rgb', 'rgba').replace(')', ', 0.08)');
      ctx.fill();

      // Mean dashed line
      ctx.setLineDash([5, 3]);
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.moveTo(xs(mu), padT); ctx.lineTo(xs(mu), H - padB); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    };

    drawGauss2(msMuA, sigmaA, 'rgb(24,54,83)');
    drawGauss2(msMuB, sigmaB, 'rgb(137,40,40)');

    // Render points
    msData.forEach((h, i) => {
      const p = ws[i];
      const r = Math.round(p * 24 + (1 - p) * 137);
      const g = Math.round(p * 54 + (1 - p) * 40);
      const b = Math.round(p * 83 + (1 - p) * 40);
      const x = xs(h), y = H - padB - 14;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, 2 * Math.PI);
      ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.5; ctx.stroke();
    });

    ctx.fillStyle = '#183653'; ctx.font = '11px IBM Plex Mono'; ctx.textAlign = 'left';
    ctx.fillText('Group A  μ=' + msMuA.toFixed(1), padL, padT + 12);
    ctx.fillStyle = '#892828'; ctx.textAlign = 'right';
    ctx.fillText('Group B  μ=' + msMuB.toFixed(1), W - padR, padT + 12);
  }, [msData, msMuA, msMuB]);

  useEffect(() => {
    if (activeSection === 's43') {
      if (!msData.length) {
        mStepReset();
      } else {
        drawMStep();
      }
    }
  }, [activeSection, msData.length, mStepReset, drawMStep]);

  useEffect(() => {
    if (activeSection === 's43') {
      drawMStep();
    }
  }, [msMuA, msMuB, drawMStep]);

  // ==========================================
  // ── 4.4 CONVERGENCE STATS & PLOT ──
  // ==========================================
  const [convData, setConvData] = useState([]);
  const [convMuA, setConvMuA] = useState(0);
  const [convMuB, setConvMuB] = useState(0);
  const [convPi, setConvPi] = useState(0.5);
  const [convLL, setConvLL] = useState([]);
  const [convIter, setConvIter] = useState(0);
  const [convRuns, setConvRuns] = useState([]);
  const [convStatus, setConvStatus] = useState('Not started');
  const convCanvasRef = useRef(null);

  const calculateLL = (data, muA, muB, piA, sigma = 8) => {
    return data.reduce((s, x) => {
      const v = piA * gaussPDF(x, muA, sigma) + (1 - piA) * gaussPDF(x, muB, sigma);
      return s + Math.log(v + 1e-10);
    }, 0);
  };

  const convReset = useCallback(() => {
    const data = Array.from({ length: 14 }, () => 152 + Math.random() * 10)
      .concat(Array.from({ length: 14 }, () => 174 + Math.random() * 12));
    const initMuA = 153 + Math.random() * 26;
    const initMuB = initMuA + 3 + Math.random() * 22;
    const initPi = 0.3 + Math.random() * 0.4;
    const initialLL = calculateLL(data, initMuA, initMuB, initPi);

    setConvData(data);
    setConvMuA(initMuA);
    setConvMuB(initMuB);
    setConvPi(initPi);
    setConvIter(0);
    setConvLL([initialLL]);
    setConvStatus('Not started');
  }, []);

  const convStep = useCallback(() => {
    if (convIter >= 30) return;
    const sigma = 8;
    const pA = convData.map(x => convPi * gaussPDF(x, convMuA, sigma));
    const pB = convData.map(x => (1 - convPi) * gaussPDF(x, convMuB, sigma));
    const w = convData.map((_, i) => pA[i] / (pA[i] + pB[i] + 1e-10));
    
    const sw = w.reduce((a, b) => a + b, 0);
    const newMuA = convData.reduce((s, x, i) => s + w[i] * x, 0) / (sw + 1e-10);
    const newMuB = convData.reduce((s, x, i) => s + (1 - w[i]) * x, 0) / (convData.length - sw + 1e-10);
    const newPi = sw / convData.length;

    const nextLL = calculateLL(convData, newMuA, newMuB, newPi);

    setConvMuA(newMuA);
    setConvMuB(newMuB);
    setConvPi(newPi);
    setConvIter(prev => prev + 1);
    setConvLL(prev => [...prev, nextLL]);
    setConvStatus(convIter + 1 >= 30 ? 'Converged' : 'Running...');
  }, [convData, convMuA, convMuB, convPi, convIter]);

  const [convIntervalId, setConvIntervalId] = useState(null);
  const convRunAll = () => {
    if (convIntervalId) return;
    let currentMuA = convMuA;
    let currentMuB = convMuB;
    let currentPi = convPi;
    let currentIter = convIter;
    let currentLL = [...convLL];

    const interval = setInterval(() => {
      const sigma = 8;
      const pA = convData.map(x => currentPi * gaussPDF(x, currentMuA, sigma));
      const pB = convData.map(x => (1 - currentPi) * gaussPDF(x, currentMuB, sigma));
      const w = convData.map((_, i) => pA[i] / (pA[i] + pB[i] + 1e-10));
      
      const sw = w.reduce((a, b) => a + b, 0);
      const newMuA = convData.reduce((s, x, i) => s + w[i] * x, 0) / (sw + 1e-10);
      const newMuB = convData.reduce((s, x, i) => s + (1 - w[i]) * x, 0) / (convData.length - sw + 1e-10);
      const newPi = sw / convData.length;

      const nextLL = calculateLL(convData, newMuA, newMuB, newPi);

      currentMuA = newMuA;
      currentMuB = newMuB;
      currentPi = newPi;
      currentIter += 1;
      currentLL = [...currentLL, nextLL];

      setConvMuA(newMuA);
      setConvMuB(newMuB);
      setConvPi(newPi);
      setConvIter(currentIter);
      setConvLL(currentLL);

      if (currentIter >= 30) {
        clearInterval(interval);
        setConvIntervalId(null);
        setConvStatus('Converged');
        setConvRuns(prev => [
          ...prev, 
          { start: currentLL[0].toFixed(2), final: nextLL.toFixed(2), iters: currentIter }
        ]);
      }
    }, 120);

    setConvIntervalId(interval);
  };

  useEffect(() => {
    return () => {
      if (convIntervalId) clearInterval(convIntervalId);
    };
  }, [convIntervalId]);

  const drawConv = useCallback(() => {
    const canvas = convCanvasRef.current;
    if (!canvas || !convLL.length) return;
    const W = canvas.offsetWidth || 560, H = 240;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const padL = 52, padR = 20, padT = 18, padB = 36;
    const minLL = Math.min(...convLL) - Math.abs(Math.min(...convLL)) * 0.04;
    const maxLL = Math.max(...convLL) + Math.abs(Math.max(...convLL)) * 0.02;
    const maxIter = Math.max(convLL.length - 1, 1);
    const xs = i => padL + (i / maxIter) * (W - padL - padR);
    const ys = v => padT + (1 - (v - minLL) / (maxLL - minLL)) * (H - padT - padB);

    // Grid lines
    ctx.strokeStyle = 'rgba(24, 54, 83, 0.08)'; ctx.lineWidth = 0.5;
    for (let t = 0; t <= 4; t++) {
      const v = minLL + t / 4 * (maxLL - minLL);
      ctx.beginPath(); ctx.moveTo(padL, ys(v)); ctx.lineTo(W - padR, ys(v)); ctx.stroke();
      ctx.fillStyle = 'rgba(18, 18, 18, 0.6)'; ctx.font = '9px IBM Plex Mono'; ctx.textAlign = 'right';
      ctx.fillText(v.toFixed(1), padL - 4, ys(v) + 3);
    }

    ctx.fillStyle = 'rgba(18, 18, 18, 0.6)'; ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'center';
    ctx.fillText('Iteration', W / 2, H - 6);
    ctx.save(); ctx.translate(12, H / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('Log-likelihood', 0, 0); ctx.restore();

    if (convLL.length > 1) {
      // Area gradient
      const grad = ctx.createLinearGradient(padL, padT, padL, H - padB);
      grad.addColorStop(0, 'rgba(24, 54, 83, 0.15)');
      grad.addColorStop(1, 'rgba(24, 54, 83, 0)');
      
      ctx.beginPath();
      convLL.forEach((v, i) => i === 0 ? ctx.moveTo(xs(i), ys(v)) : ctx.lineTo(xs(i), ys(v)));
      ctx.lineTo(xs(convLL.length - 1), H - padB);
      ctx.lineTo(xs(0), H - padB);
      ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();

      // Main line
      ctx.beginPath();
      convLL.forEach((v, i) => i === 0 ? ctx.moveTo(xs(i), ys(v)) : ctx.lineTo(xs(i), ys(v)));
      ctx.strokeStyle = '#183653'; ctx.lineWidth = 2.5; ctx.stroke();

      // Individual points
      convLL.forEach((v, i) => {
        ctx.beginPath(); ctx.arc(xs(i), ys(v), 4, 0, 2 * Math.PI);
        ctx.fillStyle = i === convLL.length - 1 ? '#b08f26' : '#183653'; ctx.fill();
      });
    }
  }, [convLL]);

  useEffect(() => {
    if (activeSection === 's44') {
      if (!convData.length) {
        convReset();
      } else {
        drawConv();
      }
    }
  }, [activeSection, convData.length, convReset, drawConv]);

  useEffect(() => {
    if (activeSection === 's44') {
      drawConv();
    }
  }, [convLL, drawConv]);

  // ==========================================
  // ── 4.5 JENSEN'S INEQUALITY VISUALS ──
  // ==========================================
  const [jx1, setJx1] = useState(15);
  const [jx2, setJx2] = useState(75);
  const jensenCanvasRef = useRef(null);
  const staircaseCanvasRef = useRef(null);

  const drawJensen = useCallback(() => {
    const canvas = jensenCanvasRef.current;
    if (!canvas) return;
    const W = canvas.offsetWidth || 560, H = 260;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const domMin = 1, domMax = 100;
    const padL = 42, padR = 20, padT = 16, padB = 36;
    const allY = Array.from({ length: 100 }, (_, i) => Math.log(i + 1));
    const minY = Math.min(...allY), maxY = Math.max(...allY) + 0.2;
    const xs = x => padL + (x - domMin) / (domMax - domMin) * (W - padL - padR);
    const ys = v => padT + (1 - (v - minY) / (maxY - minY)) * (H - padT - padB);

    // Grid lines
    ctx.strokeStyle = 'rgba(24, 54, 83, 0.08)'; ctx.lineWidth = 0.5;
    [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0].forEach(v => {
      ctx.beginPath(); ctx.moveTo(padL, ys(v)); ctx.lineTo(W - padR, ys(v)); ctx.stroke();
      ctx.fillStyle = 'rgba(18, 18, 18, 0.6)'; ctx.font = '9px IBM Plex Mono'; ctx.textAlign = 'right';
      ctx.fillText(v.toFixed(1), padL - 4, ys(v) + 3);
    });
    ctx.fillStyle = 'rgba(18, 18, 18, 0.6)'; ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'center';
    ctx.fillText('x', W / 2, H - 8);

    // Concave Curve fill
    const pts = [];
    for (let x = domMin; x <= domMax; x += 0.5) pts.push([xs(x), ys(Math.log(x))]);
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    pts.forEach(([cx, cy]) => ctx.lineTo(cx, cy));
    ctx.lineTo(pts[pts.length - 1][0], H - padB); ctx.lineTo(pts[0][0], H - padB); ctx.closePath();
    ctx.fillStyle = 'rgba(137, 40, 40, 0.04)'; ctx.fill();

    // Draw main Curve
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    pts.forEach(([cx, cy]) => ctx.lineTo(cx, cy));
    ctx.strokeStyle = '#892828'; ctx.lineWidth = 2.5; ctx.stroke();

    const y1 = Math.log(jx1), y2 = Math.log(jx2);
    const mx = (jx1 + jx2) / 2, my_chord = (y1 + y2) / 2, my_curve = Math.log(mx);

    // Chord line
    ctx.beginPath(); ctx.moveTo(xs(jx1), ys(y1)); ctx.lineTo(xs(jx2), ys(y2));
    ctx.strokeStyle = '#ca6510'; ctx.lineWidth = 2; ctx.stroke();

    // Vertical gap line
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = '#6a349c'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(xs(mx), ys(my_chord)); ctx.lineTo(xs(mx), ys(my_curve)); ctx.stroke();
    ctx.setLineDash([]);

    // Dashed lines to y-axis
    ctx.setLineDash([2, 4]); ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(24, 54, 83, 0.18)';
    ctx.beginPath(); ctx.moveTo(padL, ys(y1)); ctx.lineTo(xs(jx1), ys(y1)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(padL, ys(y2)); ctx.lineTo(xs(jx2), ys(y2)); ctx.stroke();
    ctx.setLineDash([]);

    // Nodes
    [[xs(jx1), ys(y1), '#892828', 'A'], [xs(jx2), ys(y2), '#892828', 'B'],
     [xs(mx), ys(my_chord), '#ca6510', '½'], [xs(mx), ys(my_curve), '#892828', 'f(½)']].forEach(([cx, cy, col, lbl]) => {
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
      ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = '#fbf8f0'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = col; ctx.font = 'bold 10px IBM Plex Mono'; ctx.textAlign = 'center';
      ctx.fillText(lbl, cx, cy - 10);
    });

    // Legend labels
    ctx.fillStyle = '#892828'; ctx.font = '11px IBM Plex Mono'; ctx.textAlign = 'left';
    ctx.fillText('log(x) curve', padL + 8, padT + 14);
    ctx.fillStyle = '#ca6510';
    ctx.fillText('chord (lower bound)', padL + 8, padT + 28);
  }, [jx1, jx2]);

  const drawStaircase = useCallback(() => {
    const canvas = staircaseCanvasRef.current;
    if (!canvas) return;
    const W = canvas.offsetWidth || 560, H = 120;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const padL = 20, padR = 20, padT = 10, padB = 20;
    const xs = x => padL + x / 100 * (W - padL - padR);
    const ys = y => padT + (1 - y) * (H - padT - padB);

    // Curve
    ctx.beginPath();
    for (let x = 1; x <= 100; x++) {
      const y = Math.log(x) / Math.log(100);
      x === 1 ? ctx.moveTo(xs(x), ys(y)) : ctx.lineTo(xs(x), ys(y));
    }
    ctx.strokeStyle = '#892828'; ctx.lineWidth = 2; ctx.globalAlpha = 0.6; ctx.stroke(); ctx.globalAlpha = 1;

    // Staircase lower bounds (EM Staircase)
    const starts = [5, 20, 45, 70];
    const cols = ['#183653', '#6a349c', '#ca6510', '#b08f26'];
    starts.forEach((sx, idx) => {
      const sy = Math.log(sx) / Math.log(100);
      const nextX = starts[idx + 1] || 95;
      const ex = nextX;
      const ey = Math.log(ex) / Math.log(100);
      
      const slope = 1 / sx / Math.log(100) * 100;
      const lx0 = Math.max(sx - 8, 1), lx1 = Math.min(ex + 4, 99);
      
      ctx.beginPath();
      ctx.moveTo(xs(lx0), ys(sy + (lx0 - sx) * slope / 100));
      ctx.lineTo(xs(lx1), ys(sy + (lx1 - sx) * slope / 100));
      ctx.strokeStyle = cols[idx]; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.75; ctx.stroke(); ctx.globalAlpha = 1;
      
      if (idx < starts.length - 1) {
        const vx = xs(nextX);
        const ly_start = ys(sy + (nextX - sx) * slope / 100);
        const ly_end = ys(ey);
        ctx.beginPath(); ctx.moveTo(vx, ly_start); ctx.lineTo(vx, ly_end);
        ctx.strokeStyle = cols[idx]; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1; ctx.setLineDash([]);
      }
      ctx.beginPath(); ctx.arc(xs(sx), ys(sy), 4, 0, 2 * Math.PI);
      ctx.fillStyle = cols[idx]; ctx.fill();
    });

    ctx.fillStyle = 'rgba(18, 18, 18, 0.6)'; ctx.font = '9px IBM Plex Mono'; ctx.textAlign = 'right';
    ctx.fillText('Each tangent = one EM lower bound. Maximizing it jumps to the next tangent point.', W - padR, H - 4);
  }, []);

  useEffect(() => {
    if (activeSection === 's45') {
      drawJensen();
      drawStaircase();
    }
  }, [activeSection, drawJensen, drawStaircase]);

  // ==========================================
  // ── 4.6 FULL GMM PARAMETER updates ──
  // ==========================================
  const [gmmInitMuA, setGmmInitMuA] = useState(160);
  const [gmmInitMuB, setGmmInitMuB] = useState(180);
  const [gmmInitPiA, setGmmInitPiA] = useState(0.5);

  const [gmmMuA, setGmmMuA] = useState(160);
  const [gmmMuB, setGmmMuB] = useState(180);
  const [gmmSigmaA, setGmmSigmaA] = useState(5);
  const [gmmSigmaB, setGmmSigmaB] = useState(5);
  const [gmmPiA, setGmmPiA] = useState(0.5);
  const [gmmWeights, setGmmWeights] = useState([]);
  const [gmmIter, setGmmIter] = useState(0);
  const [gmmPhase, setGmmPhase] = useState('ready');

  const gmmCanvasRef = useRef(null);

  const gmmReset = useCallback(() => {
    setGmmMuA(gmmInitMuA);
    setGmmMuB(gmmInitMuB);
    setGmmSigmaA(5);
    setGmmSigmaB(5);
    setGmmPiA(gmmInitPiA);
    setGmmIter(0);
    setGmmPhase('ready');
    setGmmWeights(heightData.map(() => 0.5));
  }, [gmmInitMuA, gmmInitMuB, gmmInitPiA]);

  const gmmStepE = useCallback(() => {
    const weights = heightData.map(x => {
      const pA = gmmPiA * gaussPDF(x, gmmMuA, gmmSigmaA);
      const pB = (1 - gmmPiA) * gaussPDF(x, gmmMuB, gmmSigmaB);
      const sum = pA + pB + 1e-10;
      return pA / sum;
    });

    setGmmWeights(weights);
    setGmmPhase('e-done');
  }, [gmmPiA, gmmMuA, gmmSigmaA, gmmMuB, gmmSigmaB]);

  const gmmStepM = useCallback(() => {
    if (!gmmWeights.length) return;
    const n = heightData.length;
    const sumW_A = gmmWeights.reduce((a, b) => a + b, 0);
    const sumW_B = n - sumW_A;

    const newMuA = heightData.reduce((s, x, i) => s + gmmWeights[i] * x, 0) / (sumW_A + 1e-10);
    const newMuB = heightData.reduce((s, x, i) => s + (1 - gmmWeights[i]) * x, 0) / (sumW_B + 1e-10);

    const newVarA = heightData.reduce((s, x, i) => s + gmmWeights[i] * ((x - newMuA) ** 2), 0) / (sumW_A + 1e-10);
    const newVarB = heightData.reduce((s, x, i) => s + (1 - gmmWeights[i]) * ((x - newMuB) ** 2), 0) / (sumW_B + 1e-10);

    setGmmPiA(sumW_A / n);
    setGmmMuA(newMuA);
    setGmmMuB(newMuB);
    setGmmSigmaA(Math.sqrt(newVarA + 0.5));
    setGmmSigmaB(Math.sqrt(newVarB + 0.5));
    setGmmIter(prev => prev + 1);
    setGmmPhase('m-done');
  }, [gmmWeights]);

  const [gmmIntervalId, setGmmIntervalId] = useState(null);
  const gmmRunFull = () => {
    if (gmmIntervalId) return;
    let currentMuA = gmmMuA;
    let currentMuB = gmmMuB;
    let currentSigmaA = gmmSigmaA;
    let currentSigmaB = gmmSigmaB;
    let currentPiA = gmmPiA;
    let currentWeights = [...gmmWeights];
    let phase = gmmPhase;
    let steps = 0;

    const interval = setInterval(() => {
      if (phase === 'ready' || phase === 'm-done') {
        // Run E-step
        currentWeights = heightData.map(x => {
          const pA = currentPiA * gaussPDF(x, currentMuA, currentSigmaA);
          const pB = (1 - currentPiA) * gaussPDF(x, currentMuB, currentSigmaB);
          const sum = pA + pB + 1e-10;
          return pA / sum;
        });
        phase = 'e-done';
        setGmmWeights(currentWeights);
        setGmmPhase('e-done');
      } else {
        // Run M-step
        const n = heightData.length;
        const sumW_A = currentWeights.reduce((a, b) => a + b, 0);
        const sumW_B = n - sumW_A;

        const newMuA = heightData.reduce((s, x, i) => s + currentWeights[i] * x, 0) / (sumW_A + 1e-10);
        const newMuB = heightData.reduce((s, x, i) => s + (1 - currentWeights[i]) * x, 0) / (sumW_B + 1e-10);

        const newVarA = heightData.reduce((s, x, i) => s + currentWeights[i] * ((x - newMuA) ** 2), 0) / (sumW_A + 1e-10);
        const newVarB = heightData.reduce((s, x, i) => s + (1 - currentWeights[i]) * ((x - newMuB) ** 2), 0) / (sumW_B + 1e-10);

        currentPiA = sumW_A / n;
        currentMuA = newMuA;
        currentMuB = newMuB;
        currentSigmaA = Math.sqrt(newVarA + 0.5);
        currentSigmaB = Math.sqrt(newVarB + 0.5);
        phase = 'm-done';

        setGmmPiA(currentPiA);
        setGmmMuA(currentMuA);
        setGmmMuB(currentMuB);
        setGmmSigmaA(currentSigmaA);
        setGmmSigmaB(currentSigmaB);
        setGmmIter(prev => prev + 1);
        setGmmPhase('m-done');
      }
      steps++;
      if (steps >= 16) {
        clearInterval(interval);
        setGmmIntervalId(null);
      }
    }, 150);

    setGmmIntervalId(interval);
  };

  useEffect(() => {
    return () => {
      if (gmmIntervalId) clearInterval(gmmIntervalId);
    };
  }, [gmmIntervalId]);

  const drawGMM = useCallback(() => {
    const canvas = gmmCanvasRef.current;
    if (!canvas) return;
    const W = canvas.offsetWidth || 560, H = 240;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const minH = 145, maxH = 195;
    const padL = 40, padR = 20, padT = 20, padB = 40;
    const xs = x => padL + (x - minH) / (maxH - minH) * (W - padL - padR);
    const chartH = H - padT - padB;

    // Grid vertical lines
    ctx.strokeStyle = 'rgba(24, 54, 83, 0.08)';
    for(let h = 150; h <= 190; h += 10) {
      ctx.beginPath(); ctx.moveTo(xs(h), padT); ctx.lineTo(xs(h), H - padB); ctx.stroke();
      ctx.fillStyle = 'rgba(18, 18, 18, 0.6)'; ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'center';
      ctx.fillText(h, xs(h), H - padB + 15);
    }

    const scale = 1200;

    // Mixture curve (Dashed Navy)
    ctx.beginPath();
    for(let x = minH; x <= maxH; x += 0.5) {
      const y = gmmPiA * gaussPDF(x, gmmMuA, gmmSigmaA) + (1 - gmmPiA) * gaussPDF(x, gmmMuB, gmmSigmaB);
      const sy = H - padB - y * scale; 
      x === minH ? ctx.moveTo(xs(x), sy) : ctx.lineTo(xs(x), sy);
    }
    ctx.strokeStyle = 'rgba(24, 54, 83, 0.35)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);

    // Single Gaussian curves
    const drawOne = (m, sig, p, color) => {
      ctx.beginPath();
      for(let x = minH; x <= maxH; x += 0.5) {
        const y = p * gaussPDF(x, m, sig);
        const sy = H - padB - y * scale;
        x === minH ? ctx.moveTo(xs(x), sy) : ctx.lineTo(xs(x), sy);
      }
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke();
      
      const pts = [];
      for(let x = minH; x <= maxH; x += 0.5) pts.push([xs(x), H - padB - p * gaussPDF(x, m, sig) * scale]);
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      pts.forEach(pt => ctx.lineTo(pt[0], pt[1]));
      ctx.lineTo(xs(maxH), H - padB); ctx.lineTo(xs(minH), H - padB); ctx.closePath();
      ctx.fillStyle = color.replace('rgb', 'rgba').replace(')', ', 0.08)'); ctx.fill();
    };

    drawOne(gmmMuA, gmmSigmaA, gmmPiA, 'rgb(24, 54, 83)'); // Navy (A)
    drawOne(gmmMuB, gmmSigmaB, 1 - gmmPiA, 'rgb(137, 40, 40)'); // Crimson (B)

    // Render pie chart data nodes
    heightData.forEach((x, i) => {
      const wA = gmmWeights[i] || 0.5;
      const cx = xs(x), cy = H - padB - 10;
      const radius = 9;

      // Group A slice
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * wA));
      ctx.fillStyle = 'rgb(24, 54, 83)';
      ctx.fill();

      // Group B slice
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, -Math.PI / 2 + (Math.PI * 2 * wA), -Math.PI / 2 + (Math.PI * 2));
      ctx.fillStyle = 'rgb(137, 40, 40)';
      ctx.fill();

      // Inner border
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Value label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 7px IBM Plex Mono';
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(x), cx, cy + 2.5);
    });
  }, [gmmMuA, gmmMuB, gmmSigmaA, gmmSigmaB, gmmPiA, gmmWeights]);

  useEffect(() => {
    if (activeSection === 's46') {
      gmmReset();
    }
  }, [activeSection, gmmReset]);

  useEffect(() => {
    if (activeSection === 's46') {
      drawGMM();
    }
  }, [gmmMuA, gmmMuB, gmmSigmaA, gmmSigmaB, gmmPiA, gmmWeights, drawGMM]);

  // Window resize event handler
  useEffect(() => {
    const handleResize = () => {
      if (activeSection === 's42') drawEStep();
      if (activeSection === 's43') drawMStep();
      if (activeSection === 's44') drawConv();
      if (activeSection === 's45') { drawJensen(); drawStaircase(); }
      if (activeSection === 's46') drawGMM();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeSection, drawEStep, drawMStep, drawConv, drawJensen, drawStaircase, drawGMM]);

  return (
    <div className="em-playground-container">
      <header className="em-playground-header">
        <button className="back-button" onClick={onBack} aria-label="Go back to main article">
          <span>← Back to Article</span>
        </button>
      </header>

      <div className="hero">
        <div className="hero-label">Section 4 — Machine Learning</div>
        <h1>Expectation–<em>Maximization</em></h1>
        <p>Five interactive examples that build intuition from the ground up. Tap any section to explore.</p>
      </div>

      <nav className="nav-strip" role="navigation">
        <button className={`nav-btn ${activeSection === 's41' ? 'active' : ''}`} onClick={() => setActiveSection('s41')}>4.1 Intro & EM</button>
        <button className={`nav-btn ${activeSection === 's42' ? 'active' : ''}`} onClick={() => setActiveSection('s42')}>4.2 E-Step</button>
        <button className={`nav-btn ${activeSection === 's43' ? 'active' : ''}`} onClick={() => setActiveSection('s43')}>4.3 M-Step</button>
        <button className={`nav-btn ${activeSection === 's44' ? 'active' : ''}`} onClick={() => setActiveSection('s44')}>4.4 Convergence</button>
        <button className={`nav-btn ${activeSection === 's45' ? 'active' : ''}`} onClick={() => setActiveSection('s45')}>4.5 Jensen's</button>
        <button className={`nav-btn ${activeSection === 's46' ? 'active' : ''}`} onClick={() => setActiveSection('s46')}>4.6 GMM</button>
      </nav>

      <main className="main">
        {/* ── SECTION 4.1 ── */}
        <section className={`section ${activeSection === 's41' ? 'active' : ''}`} id="s41">
          <div className="section-num">4.1</div>
          <h2 class="section-title">Introduction to <span class="highlight">EM Algorithm</span></h2>
          
          <div className="def-card">
            <strong>The core problem EM solves:</strong> You have data with missing or hidden information, and you can't solve for the parameters without knowing the hidden data — and you can't infer the hidden data without the parameters. EM breaks this circular dependency by alternating between the two.
          </div>

          <p style={{ color: 'var(--muted2)', fontSize: '14px', marginBottom: '1rem' }}>
            <strong style={{ color: 'var(--text)' }}>Example: The Two Coins Problem.</strong> Two biased coins exist — Coin A and Coin B with different head probabilities. Someone secretly picks one and flips it 10 times. You see the results but <em>never learn which coin was used</em>. EM figures out both the coin biases AND which coin was likely used.
          </p>

          <div className="demo-card">
            <div className="demo-header">
              <div className="demo-dot" style={{ background: 'var(--accent-c)' }}></div>
              <div className="demo-dot" style={{ background: 'var(--accent-e)' }}></div>
              <div className="demo-dot" style={{ background: 'var(--accent-b)' }}></div>
              <span className="demo-title">two_coins_em.py — interactive simulation</span>
            </div>
            <div className="demo-body">
              <div className="coin-grid">
                <div>
                  <div className="coin-setup-label">Configure coins</div>
                  <div className="coin-inputs">
                    <div className="slider-row">
                      <label>Coin A (p_H)</label>
                      <input type="range" min="0.1" max="0.95" step="0.05" value={trueA} onChange={e => setTrueA(+e.target.value)} disabled={isFlipping}/>
                      <span className="val">{trueA.toFixed(2)}</span>
                    </div>
                    <div className="slider-row">
                      <label>Coin B (p_H)</label>
                      <input type="range" min="0.05" max="0.9" step="0.05" value={trueB} onChange={e => setTrueB(+e.target.value)} disabled={isFlipping}/>
                      <span className="val">{trueB.toFixed(2)}</span>
                    </div>
                    <div className="slider-row">
                      <label>Flips</label>
                      <input type="range" min="5" max="30" step="1" value={numFlips} onChange={e => setNumFlips(+e.target.value)} disabled={isFlipping}/>
                      <span className="val">{numFlips}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="coin-setup-label">Flip sequence (hidden: which coin?)</div>
                  <div className="coin-flips-area">
                    {flipVisuals.length === 0 ? (
                      <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Press "Flip coins" to start</span>
                    ) : (
                      flipVisuals.map((flip, i) => (
                        <div key={i} className={`flip-coin flip-${flip}`}>{flip}</div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="step-indicator">
                <div className={`step-dot ${coinStepDots.sd1}`}>1</div>
                <div className="step-line"></div>
                <span style={{ margin: '0 4px' }}>Flip</span>
                <div className="step-line"></div>
                <div className={`step-dot ${coinStepDots.sd2}`}>2</div>
                <div className="step-line"></div>
                <span style={{ margin: '0 4px' }}>E-step</span>
                <div className="step-line"></div>
                <div className={`step-dot ${coinStepDots.sd3}`}>3</div>
                <div className="step-line"></div>
                <span style={{ margin: '0 4px' }}>M-step</span>
                <div className="step-line"></div>
                <div className={`step-dot ${coinStepDots.sd4}`}>4</div>
                <div className="step-line"></div>
                <span style={{ margin: '0 4px' }}>Reveal</span>
              </div>

              <div className="btn-row">
                <button className="btn btn-primary" onClick={flipCoins} disabled={isFlipping}>⟳ Flip Coins</button>
                <button className="btn" onClick={runEMOnCoins} disabled={!coinState || isFlipping}>▶️ Run EM</button>
                <button className="btn" onClick={revealCoinTruth} disabled={!coinState || !coinState.emA || isFlipping}>◉ Reveal Truth</button>
              </div>

              {coinState && coinState.emA && (
                <div className="stats-row" style={{ display: 'flex' }}>
                  <div className="stat-chip">EM: Coin A bias = <span className="val">{coinState.emA.toFixed(3)}</span></div>
                  <div className="stat-chip">EM: Coin B bias = <span className="val">{coinState.emB.toFixed(3)}</span></div>
                  <div className="stat-chip">Likely used = <span className="val">{coinState.emUsedA ? 'Coin A' : 'Coin B'}</span></div>
                  <div className="stat-chip">Iterations = <span className="val">{coinState.iters}</span></div>
                </div>
              )}

              <div className={`result-reveal ${coinReveal ? 'show' : ''}`}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Truth revealed</div>
                {coinState && (
                  <div className="result-grid">
                    <div className="result-item"><div className="k">TRUE Coin A bias</div><div className="v">{coinState.tA.toFixed(2)}</div></div>
                    <div className="result-item"><div className="k">TRUE Coin B bias</div><div className="v">{coinState.tB.toFixed(2)}</div></div>
                    <div className="result-item"><div className="k">COIN ACTUALLY USED</div><div className="v">{coinState.usedA ? 'Coin A' : 'Coin B'}</div></div>
                    <div className="result-item">
                      <div className="k">EM WAS</div>
                      <div className={`v ${coinState.usedA === coinState.emUsedA ? 'correct' : 'wrong'}`}>
                        {coinState.usedA === coinState.emUsedA ? '✓ Correct!' : '✗ Wrong (can happen with short sequences)'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="explain-box">
                <span className="tag tag-e">Key idea</span>
                EM treats the coin identity as a hidden variable. It starts with a random guess for both biases, then alternates: "given these biases, which coin was probably used?" → "given that coin assignment, what are the best bias estimates?" — repeat until converged.
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 4.2 ── */}
        <section className={`section ${activeSection === 's42' ? 'active' : ''}`} id="s42">
          <div className="section-num">4.2</div>
          <h2 class="section-title">The <span class="highlight">E-Step</span></h2>

          <div className="def-card">
            <strong>E-Step (Expectation):</strong> Given current parameter estimates, compute the <em>expected value</em> of the hidden/latent variables. Each data point gets a <strong>soft probability</strong> of belonging to each cluster — not a hard assignment. This is what separates EM from K-Means.
          </div>

          <p style={{ color: 'var(--muted2)', fontSize: '14px', marginBottom: '1rem' }}>
            <strong style={{ color: 'var(--text)' }}>Example: Heights without gender labels.</strong> We have 20 people's heights but no gender information. The E-step asks: given our current Gaussian model, how likely is each person to be from group A vs group B?
          </p>

          <div className="demo-card">
            <div className="demo-header">
              <div className="demo-dot" style={{ background: 'var(--accent-a)' }}></div>
              <div className="demo-dot" style={{ background: 'var(--accent-b)' }}></div>
              <div className="demo-dot" style={{ background: 'var(--muted)' }}></div>
              <span className="demo-title">e_step_visualizer.py — soft assignment demo</span>
            </div>
            <div className="demo-body">
              <div className="slider-row">
                <label>μ Group A</label>
                <input type="range" min="155" max="175" value={muA} onChange={e => setMuA(+e.target.value)}/>
                <span className="val">{muA} cm</span>
              </div>
              <div className="slider-row">
                <label>μ Group B</label>
                <input type="range" min="165" max="190" value={muB} onChange={e => setMuB(+e.target.value)}/>
                <span className="val">{muB} cm</span>
              </div>
              <div className="slider-row">
                <label>σ (spread)</label>
                <input type="range" min="3" max="15" value={sigma} onChange={e => setSigma(+e.target.value)}/>
                <span className="val">{sigma}</span>
              </div>

              <div className="canvas-wrap" style={{ marginTop: '1rem' }}>
                <canvas ref={estepCanvasRef} height="180"></canvas>
              </div>

              <div style={{ marginTop: '1.25rem' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '.6rem' }}>Soft assignment probabilities (sample points)</div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="prob-table">
                    <thead>
                      <tr>
                        <th>Height</th>
                        <th>P(Group A)</th>
                        <th>P(Group B)</th>
                        <th>Soft assignment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 3, 7, 10, 14, 17, 19].map(i => {
                        const h = heightData[i];
                        const p = probs[i];
                        const pA = (p * 100).toFixed(1);
                        const pB = ((1 - p) * 100).toFixed(1);
                        const barA = Math.round(p * 100);
                        const barB = 100 - barA;

                        return (
                          <tr key={i}>
                            <td style={{ fontFamily: 'var(--mono)', fontSize: '12px' }}>{h} cm</td>
                            <td>
                              <div className="prob-bar-wrap">
                                <div className="prob-bar-bg">
                                  <div className="prob-bar-fill" style={{ width: `${barA}%`, background: '#183653' }}></div>
                                </div>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: '#183653', minWidth: '40px' }}>{pA}%</span>
                              </div>
                            </td>
                            <td>
                              <div className="prob-bar-wrap">
                                <div className="prob-bar-bg">
                                  <div className="prob-bar-fill" style={{ width: `${barB}%`, background: '#892828' }}></div>
                                </div>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: '#892828', minWidth: '40px' }}>{pB}%</span>
                              </div>
                            </td>
                            <td style={{ fontSize: '12px', color: p > 0.6 ? '#183653' : p < 0.4 ? '#892828' : 'var(--muted2)' }}>
                              {p > 0.6 ? 'A' : p < 0.4 ? 'B' : 'Uncertain'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="explain-box" style={{ marginTop: '1rem' }}>
                <span className="tag tag-e">E-step</span>
                Drag the sliders to move the group means. Watch how each dot's color shifts — <span style={{ color: 'var(--accent-a)' }}>blue</span> = more likely Group A, <span style={{ color: 'var(--accent-b)' }}>green</span> = more likely Group B. Points in between have <em>partial</em> membership in both groups simultaneously.
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 4.3 ── */}
        <section className={`section ${activeSection === 's43' ? 'active' : ''}`} id="s43">
          <div className="section-num">4.3</div>
          <h2 class="section-title">The <span class="highlight">M-Step</span></h2>

          <div className="def-card">
            <strong>M-Step (Maximization):</strong> Using the soft assignments from the E-step as weights, <em>re-estimate the model parameters</em> to maximize the expected log-likelihood. Each data point contributes to each group proportionally to its membership probability.
          </div>

          <p style={{ color: 'var(--muted2)', fontSize: '14px', marginBottom: '1rem' }}>
            <strong style={{ color: 'var(--text)' }}>Watch the full EM loop.</strong> Two Gaussian curves start at random positions. Each iteration: E-step computes soft assignments → M-step moves the means to the weighted center of each cluster. The curves chase the data.
          </p>

          <div className="demo-card">
            <div className="demo-header">
              <div className="demo-dot" style={{ background: 'var(--accent-a)' }}></div>
              <div className="demo-dot" style={{ background: 'var(--accent-b)' }}></div>
              <div className="demo-dot" style={{ background: 'var(--accent-c)' }}></div>
              <span className="demo-title">m_step_loop.py — EM iteration visualizer</span>
            </div>
            <div className="demo-body">
              <div className="canvas-wrap">
                <canvas ref={mstepCanvasRef} height="220"></canvas>
              </div>

              <div className="stats-row" style={{ marginTop: '.75rem' }}>
                <div className="stat-chip">Iteration: <span className="val">{msIter}</span></div>
                <div className="stat-chip">μ<sub>A</sub> = <span className="val">{msMuA ? `${msMuA.toFixed(2)} cm` : '—'}</span></div>
                <div className="stat-chip">μ<sub>B</sub> = <span className="val">{msMuB ? `${msMuB.toFixed(2)} cm` : '—'}</span></div>
                <div className="stat-chip">Δμ<sub>A</sub> = <span className="val">{msDelta !== null ? msDelta.toFixed(4) : '—'}</span></div>
              </div>

              <div className="btn-row">
                <button className="btn btn-primary" onClick={mStepOne} disabled={!!msIntervalId}>▶️ One Iteration</button>
                <button className="btn btn-success" onClick={mStepRun} disabled={!!msIntervalId}>▶️▶️ Run to Convergence</button>
                <button className="btn" onClick={mStepReset} disabled={!!msIntervalId}>⟳ New Dataset</button>
              </div>

              <div className="explain-box">
                <span className="tag tag-m">M-step</span>
                New mean = Σ(wᵢ · xᵢ) / Σ(wᵢ) — a weighted average where each person's height is weighted by their probability of belonging to that group. The 6'2" person barely counts toward group B. The ambiguous 5'8" person counts 50-50 toward both.
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 4.4 ── */}
        <section className={`section ${activeSection === 's44' ? 'active' : ''}`} id="s44">
          <div className="section-num">4.4</div>
          <h2 class="section-title">Convergence <span class="highlight">of EM</span></h2>

          <div className="def-card">
            <strong>Convergence guarantee:</strong> Every EM iteration either <em>increases</em> the log-likelihood or keeps it exactly the same — it can never decrease. EM always reaches <em>a</em> peak, but not necessarily the global maximum. Different starting points may converge to different local optima.
          </div>

          <p style={{ color: 'var(--muted2)', fontSize: '14px', marginBottom: '1rem' }}>
            <strong style={{ color: 'var(--text)' }}>Try multiple random starts.</strong> Hit "New Random Start" to initialize EM at a different point. Some starts find higher optima than others — this is why real implementations run EM many times and pick the best result.
          </p>

          <div className="demo-card">
            <div className="demo-header">
              <div className="demo-dot" style={{ background: 'var(--accent-e)' }}></div>
              <div className="demo-dot" style={{ background: 'var(--accent-c)' }}></div>
              <div className="demo-dot" style={{ background: 'var(--muted)' }}></div>
              <span className="demo-title">convergence_plot.py — log-likelihood over iterations</span>
            </div>
            <div className="demo-body">
              <div className="canvas-wrap">
                <canvas ref={convCanvasRef} height="240"></canvas>
              </div>

              <div className="stats-row" style={{ marginTop: '.75rem' }}>
                <div className="stat-chip">Iteration: <span className="val">{convIter}</span></div>
                <div className="stat-chip">Log-L: <span className="val">{convLL.length ? convLL[convLL.length - 1].toFixed(3) : '—'}</span></div>
                <div className="stat-chip">
                  Δ: <span className="val" style={{ 
                    color: convLL.length > 1 && (convLL[convLL.length - 1] - convLL[convLL.length - 2]) < -0.0001 ? '#ca6510' : '#892828' 
                  }}>
                    {convLL.length > 1 ? 
                      ((convLL[convLL.length - 1] - convLL[convLL.length - 2]) >= 0 ? '+' : '') + (convLL[convLL.length - 1] - convLL[convLL.length - 2]).toFixed(4)
                      : '—'
                    }
                  </span>
                </div>
                <div className="stat-chip">Status: <span className="val">{convStatus}</span></div>
              </div>

              <div className="btn-row">
                <button className="btn btn-primary" onClick={convStep} disabled={!!convIntervalId || convIter >= 30}>▶️ One Step</button>
                <button className="btn btn-success" onClick={convRunAll} disabled={!!convIntervalId || convIter >= 30}>▶️▶️ Run All</button>
                <button className="btn" onClick={convReset} disabled={!!convIntervalId}>⟳ New Random Start</button>
              </div>

              {convRuns.length > 0 && (
                <div style={{ marginTop: '.75rem' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '.5rem' }}>Previous runs</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {convRuns.map((r, i) => (
                      <div key={i} className="stat-chip" style={{ fontSize: '11px' }}>
                        Run {i + 1}: <span className="val">{r.final}</span> ({r.iters} iters)
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="explain-box">
                <span className="tag tag-c">Convergence</span>
                The curve always goes up or flat — never dips. Try 3–4 different random starts and compare the final log-likelihood values. The best one is what you'd report. In practice, run EM 10–20 times and keep the run with the highest final score.
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 4.5 ── */}
        <section className={`section ${activeSection === 's45' ? 'active' : ''}`} id="s45">
          <div className="section-num">4.5</div>
          <h2 class="section-title">Jensen's Inequality & <span class="highlight">Lower Bound</span></h2>

          <div className="def-card">
            <strong>Jensen's Inequality:</strong> For a <em>concave</em> function f (like log), <strong>f(E[X]) ≥ E[f(X)]</strong>. The function evaluated at the average is always ≥ the average of the function values. The chord between two points on a concave curve always lies <em>below</em> the curve.
          </div>

          <p style={{ color: 'var(--muted2)', fontSize: '14px', marginBottom: '1rem' }}>
            <strong style={{ color: 'var(--text)' }}>Why EM never decreases.</strong> The true log-likelihood is hard to optimize directly (log of a sum). Jensen lets EM construct a simpler <em>lower bound</em> — always ≤ the real thing. Each iteration maximizes this bound, which provably lifts the real likelihood upward.
          </p>

          <div className="demo-card">
            <div className="demo-header">
              <div className="demo-dot" style={{ background: 'var(--accent-d)' }}></div>
              <div className="demo-dot" style={{ background: 'var(--accent-a)' }}></div>
              <div className="demo-dot" style={{ background: 'var(--accent-c)' }}></div>
              <span className="demo-title">jensens_inequality.py — interactive lower bound visualization</span>
            </div>
            <div className="demo-body">
              <div className="slider-row">
                <label>Point A (x₁)</label>
                <input type="range" min="2" max="80" value={jx1} onChange={e => setJx1(+e.target.value)}/>
                <span className="val">{jx1}</span>
              </div>
              <div className="slider-row">
                <label>Point B (x₂)</label>
                <input type="range" min="20" max="98" value={jx2} onChange={e => setJx2(+e.target.value)}/>
                <span className="val">{jx2}</span>
              </div>

              <div className="canvas-wrap" style={{ marginTop: '1rem' }}>
                <canvas ref={jensenCanvasRef} height="260"></canvas>
              </div>

              <div className="jensen-info">
                <div className="jensen-stat">
                  <div className="jk">f(avg(A, B))</div>
                  <div className="jv" style={{ color: 'var(--accent-b)' }}>{Math.log((jx1 + jx2) / 2).toFixed(4)}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>log(midpoint x)</div>
                </div>
                <div className="jensen-stat">
                  <div className="jk">avg(f(A), f(B))</div>
                  <div className="jv" style={{ color: 'var(--accent-c)' }}>{((Math.log(jx1) + Math.log(jx2)) / 2).toFixed(4)}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>midpoint of chord</div>
                </div>
                <div className="jensen-stat">
                  <div className="jk">Gap (always ≥ 0)</div>
                  <div className="jv" style={{ 
                    color: (Math.log((jx1 + jx2) / 2) - (Math.log(jx1) + Math.log(jx2)) / 2) >= 0 ? 'var(--accent-b)' : 'var(--accent-c)' 
                  }}>
                    {(Math.log((jx1 + jx2) / 2) - (Math.log(jx1) + Math.log(jx2)) / 2).toFixed(4)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>curve − chord</div>
                </div>
              </div>

              <div style={{ marginTop: '1rem', padding: '1rem 1.25rem', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '.5rem' }}>The EM lower bound — staircase analogy</div>
                <canvas ref={staircaseCanvasRef} height="120"></canvas>
              </div>

              <div className="explain-box" style={{ marginTop: '1rem' }}>
                <span className="tag tag-j">Jensen</span>
                The <span style={{ color: 'var(--accent-b)' }}>green curve</span> is log(x). The <span style={{ color: 'var(--accent-c)' }}>orange chord</span> always stays below. The midpoint of the chord (orange dot) is always lower than the curve (green dot). EM repeatedly builds a new lower bound tangent to the curve at the current estimate, maximizes it, and repeats — like climbing a staircase.
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 4.6 ── */}
        <section className={`section ${activeSection === 's46' ? 'active' : ''}`} id="s46">
          <div className="section-num">4.6</div>
          <h2 class="section-title">Gaussian <span class="highlight">Mixture Model</span></h2>

          <div className="def-card">
            <strong>GMM Explainer:</strong> A Gaussian Mixture Model (GMM) represents a population as a sum of multiple Gaussian distributions. In this example, we model height as a mixture of two groups (e.g., Male and Female). EM is the standard algorithm used to estimate the means, variances, and mixing weights (proportions).
          </div>

          <div className="demo-card">
            <div className="demo-header">
              <div className="demo-dot" style={{ background: 'var(--accent-a)' }}></div>
              <div className="demo-dot" style={{ background: 'var(--accent-b)' }}></div>
              <div className="demo-dot" style={{ background: 'var(--accent-d)' }}></div>
              <span className="demo-title">gmm_interactive.py — full em cycle</span>
            </div>
            <div className="demo-body">
              <div style={{ marginBottom: '1.5rem' }}>
                <div className="coin-setup-label">Initial Model Parameters</div>
                <div className="slider-row">
                  <label>Init μ<sub>A</sub></label>
                  <input type="range" min="150" max="175" step="1" value={gmmInitMuA} onChange={e => { setGmmInitMuA(+e.target.value); }} disabled={!!gmmIntervalId}/>
                  <span className="val">{gmmInitMuA}</span>
                </div>
                <div className="slider-row">
                  <label>Init μ<sub>B</sub></label>
                  <input type="range" min="170" max="190" step="1" value={gmmInitMuB} onChange={e => { setGmmInitMuB(+e.target.value); }} disabled={!!gmmIntervalId}/>
                  <span className="val">{gmmInitMuB}</span>
                </div>
                <div className="slider-row">
                  <label>Init π<sub>A</sub></label>
                  <input type="range" min="0.1" max="0.9" step="0.05" value={gmmInitPiA} onChange={e => { setGmmInitPiA(+e.target.value); }} disabled={!!gmmIntervalId}/>
                  <span className="val">{gmmInitPiA.toFixed(2)}</span>
                </div>
              </div>

              <div className="canvas-wrap">
                <canvas ref={gmmCanvasRef} height="240"></canvas>
              </div>

              <div className="stats-row" style={{ marginTop: '1rem' }}>
                <div className="stat-chip">Iteration: <span className="val">{gmmIter}</span></div>
                <div className="stat-chip">π<sub>A</sub> = <span className="val">{gmmPiA.toFixed(2)}</span></div>
                <div className="stat-chip">μ<sub>A</sub> = <span className="val">{gmmMuA.toFixed(1)}</span></div>
                <div className="stat-chip">μ<sub>B</sub> = <span className="val">{gmmMuB.toFixed(1)}</span></div>
              </div>

              <div className="btn-row">
                <button className="btn btn-primary" onClick={gmmStepE} disabled={!!gmmIntervalId || gmmPhase === 'e-done'}>1. Run E-Step</button>
                <button className="btn btn-primary" onClick={gmmStepM} disabled={!!gmmIntervalId || gmmPhase !== 'e-done'}>2. Run M-Step</button>
                <button className="btn btn-success" onClick={gmmRunFull} disabled={!!gmmIntervalId}>▶️ Run Full EM</button>
                <button className="btn" onClick={gmmReset} disabled={!!gmmIntervalId}>⟳ Reset Model</button>
              </div>

              <div className="explain-box">
                <span className={`tag ${gmmPhase === 'e-done' ? 'tag-e' : gmmPhase === 'm-done' ? 'tag-m' : ''}`}>
                  {gmmPhase === 'ready' ? 'Step: Ready' : gmmPhase === 'e-done' ? 'E-Step Done' : 'M-Step Done'}
                </span>
                <span>
                  {gmmPhase === 'ready' && 'Initial parameters set. Click "Run E-Step" to calculate group memberships. The Dashed Curve represents the mixture PDF.'}
                  {gmmPhase === 'e-done' && 'Responsibilities computed. Each point is now colored as a mini pie chart showing its probability of being in Group A (Blue) vs Group B (Green). Click "Run M-Step" to update model parameters.'}
                  {gmmPhase === 'm-done' && 'Model parameters updated! The Gaussians shifted to better fit the weighted data points. The mixing weight πA also adjusted.'}
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
