import {
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";
import { extractFeatures, handShape } from "./features";
import { SEQ_LEN, classify, resample } from "./classifier";

const POSE_EDGES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [11, 24], [12, 23],
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Engine {
  constructor() {
    this.video = null;
    this.canvas = null;
    this.handLM = null;
    this.poseLM = null;
    this.stream = null;

    this.running = false;
    this.raf = 0;
    this.ring = [];
    this.dataset = [];
    this.hasModel = false;

    this.settings = {
      targetFps: 20,
      usePose: true,
      mirror: true,
      showHands: true,
      showPose: true,
      threshold: 0.55,
      holdMs: 700,
      dominant: "right",
    };

    this.onFrame = null;
    this.onCommit = null;

    this.fps = 0;
    this.ms = 0;
    this.lastFrameAt = 0;
    this.lastVideoTime = -1;
    this.lastTick = 0;
    this.lastUi = 0;
    this.lastClassify = 0;

    this.cand = null;
    this.candSince = 0;
    this.locked = false;
    this.lastCommitted = null;
    this.lostSince = 0;
    this.progress = 0;
    this.recording = false;

    this.device = "—";
  }

  hasGPU = false;

  async init() {
    const wasmPath = new URL("wasm", document.baseURI).href;
    const handPath = new URL("models/hand_landmarker.task", document.baseURI).href;
    const posePath = new URL("models/pose_landmarker_lite.task", document.baseURI).href;

    const fileset = await FilesetResolver.forVisionTasks(wasmPath);

    const tryCreate = async (delegate) => {
      const hand = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: handPath, delegate },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      const pose = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: posePath, delegate },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      return { hand, pose, delegate };
    };

    try {
      const { hand, pose, delegate } = await tryCreate("GPU");
      this.handLM = hand;
      this.poseLM = pose;
      this.hasGPU = true;
      this.device = delegate;
    } catch (err) {
      console.warn("GPU no disponible, usando CPU:", err);
      const { hand, pose } = await tryCreate("CPU");
      this.handLM = hand;
      this.poseLM = pose;
      this.hasGPU = false;
      this.device = "CPU";
    }
  }

  async openCamera() {
    if (this.stream) return this.stream;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
    });
    return this.stream;
  }

  async bind(video, canvas) {
    if (!video || !canvas) return;
    this.video = video;
    this.canvas = canvas;
    if (this.stream && video.srcObject !== this.stream) {
      video.srcObject = this.stream;
    }
    try {
      await video.play();
    } catch {
      /* autoplay bloqueado: el usuario interactúa y se reanuda */
    }
    if (!this.running) {
      this.running = true;
      this.lastVideoTime = -1;
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  unbind(video) {
    if (video && this.video && video !== this.video) return;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.video = null;
    this.canvas = null;
    this.cand = null;
    this.locked = false;
    this.progress = 0;
  }

  setDataset(dataset) {
    this.dataset = dataset || [];
    this.hasModel = this.dataset.length > 0;
  }

  setSettings(settings) {
    this.settings = { ...this.settings, ...settings };
  }

  /** Devuelve la ventana actual remuestreada, lista para guardar como muestra. */
  captureWindow(n = SEQ_LEN) {
    if (this.ring.length < Math.min(10, n)) return null;
    const seq = resample(this.ring.slice(-30), n);
    return seq.map((f) => Array.from(f));
  }

  tick = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    const video = this.video;
    const canvas = this.canvas;
    if (!video || !canvas || video.readyState < 2 || !this.handLM) return;

    const now = performance.now();
    const minDelta = 1000 / Math.max(5, this.settings.targetFps);
    if (now - this.lastTick < minDelta) return;
    if (video.currentTime === this.lastVideoTime) return;

    const t0 = now;
    let handRes = null;
    let poseRes = null;
    try {
      handRes = this.handLM.detectForVideo(video, now);
      if (this.settings.usePose && this.poseLM) {
        poseRes = this.poseLM.detectForVideo(video, now);
      }
    } catch (err) {
      console.warn("Fallo la inferencia:", err);
      return;
    }

    this.lastTick = now;
    this.lastVideoTime = video.currentTime;
    const inferenceMs = performance.now() - t0;
    this.ms = this.ms ? this.ms * 0.85 + inferenceMs * 0.15 : inferenceMs;

    if (this.lastFrameAt) {
      const inst = 1000 / Math.max(1, now - this.lastFrameAt);
      this.fps = this.fps ? this.fps * 0.85 + inst * 0.15 : inst;
    }
    this.lastFrameAt = now;

    const feats = extractFeatures(handRes, poseRes, this.settings);
    if (feats) {
      this.ring.push(feats.vec);
      if (this.ring.length > 30) this.ring.shift();
      this.lostSince = 0;
    } else {
      if (!this.lostSince) this.lostSince = now;
    }

    let result = null;
    if (this.recording) {
      this.cand = null;
      this.progress = 0;
    } else if (feats && this.ring.length >= 12 && now - this.lastClassify > 90) {
      this.lastClassify = now;
      if (this.hasModel) {
        const ranked = classify(this.ring, this.dataset, 3);
        if (ranked) {
          result = {
            label: ranked[0].label,
            conf: ranked[0].conf,
            top3: ranked,
            source: "model",
          };
        }
      } else {
        const shape = handShape(feats.primary);
        if (shape) {
          result = {
            label: shape.label,
            conf: shape.confidence,
            top3: [{ label: shape.label, conf: shape.confidence }],
            source: "demo",
          };
        }
      }
    }

    if (result) {
      if (this.cand !== result.label) {
        this.cand = result.label;
        this.candSince = now;
      }
      const held = now - this.candSince;
      this.progress = clamp(held / Math.max(120, this.settings.holdMs), 0, 1);

      if (
        !this.locked &&
        held >= this.settings.holdMs &&
        result.conf >= this.settings.threshold
      ) {
        this.locked = true;
        this.lastCommitted = result.label;
        this.progress = 1;
        this.onCommit?.({
          label: result.label,
          conf: result.conf,
          source: result.source,
          ts: Date.now(),
        });
      }
      if (this.locked && result.label !== this.lastCommitted && now - this.candSince > 260) {
        this.locked = false;
      }
    } else {
      this.cand = null;
      this.progress = 0;
      if (this.locked && this.lostSince && now - this.lostSince > 420) {
        this.locked = false;
      }
    }

    this.draw(handRes, poseRes, feats);

    if (now - this.lastUi > 66) {
      this.lastUi = now;
      this.onFrame?.({
        label: result?.label || null,
        conf: result?.conf || 0,
        top3: result?.top3 || [],
        source: result?.source || null,
        progress: this.progress,
        locked: this.locked,
        fps: this.fps,
        ms: this.ms,
        hands: handRes?.landmarks?.length || 0,
        window: this.ring.length,
        device: this.device,
      });
    }
  };

  draw(handRes, poseRes, feats) {
    const canvas = this.canvas;
    const video = this.video;
    if (!canvas || !video) return;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(rect.width * dpr);
    const H = Math.round(rect.height * dpr);
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const scale = Math.max(rect.width / vw, rect.height / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const ox = (rect.width - dw) / 2;
    const oy = (rect.height - dh) / 2;
    const mirror = this.settings.mirror;

    const pt = (p) => ({
      x: ox + (mirror ? 1 - p.x : p.x) * dw,
      y: oy + p.y * dh,
    });

    // Pose (torso) — trazo tenue
    if (this.settings.showPose && poseRes?.landmarks?.[0]) {
      const pose = poseRes.landmarks[0];
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(103, 232, 199, 0.45)";
      ctx.beginPath();
      for (const [a, b] of POSE_EDGES) {
        const pa = pose[a], pb = pose[b];
        if (!pa || !pb) continue;
        const A = pt(pa), B = pt(pb);
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
      }
      ctx.stroke();
      ctx.fillStyle = "rgba(103, 232, 199, 0.75)";
      for (const idx of [11, 12, 13, 14, 15, 16]) {
        const p = pose[idx];
        if (!p) continue;
        const P = pt(p);
        ctx.beginPath();
        ctx.arc(P.x, P.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Manos — trazo principal
    const hands = handRes?.landmarks || [];
    if (this.settings.showHands) {
      hands.forEach((lm, hi) => {
        const primary = hi === 0;
        ctx.lineWidth = primary ? 3 : 2;
        ctx.strokeStyle = primary ? "rgba(203, 249, 74, 0.92)" : "rgba(203, 249, 74, 0.5)";
        ctx.beginPath();
        for (const [a, b] of HandLandmarker.HAND_CONNECTIONS) {
          const pa = lm[a], pb = lm[b];
          if (!pa || !pb) continue;
          const A = pt(pa), B = pt(pb);
          ctx.moveTo(A.x, A.y);
          ctx.lineTo(B.x, B.y);
        }
        ctx.stroke();

        ctx.fillStyle = primary ? "#EAFBB0" : "rgba(234, 251, 176, 0.7)";
        for (const p of lm) {
          const P = pt(p);
          ctx.beginPath();
          ctx.arc(P.x, P.y, primary ? 3.1 : 2.3, 0, Math.PI * 2);
          ctx.fill();
        }

        // Halo en la punta del índice para dar foco visual
        if (primary && lm[8]) {
          const P = pt(lm[8]);
          ctx.beginPath();
          ctx.arc(P.x, P.y, 9, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(203, 249, 74, 0.28)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
    }
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    try {
      this.handLM?.close?.();
      this.poseLM?.close?.();
    } catch {
      /* noop */
    }
  }
}
