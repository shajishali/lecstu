/**
 * LECSTU Research — Latency Profiler
 *
 * Measures response latency for ASR, translation, and chatbot services.
 * Supports single-call and batch profiling with statistical summaries.
 *
 * Usage:
 *   const { LatencyProfiler } = require('./latency_profiler');
 *   const profiler = new LatencyProfiler('asr-whisper-medium');
 *
 *   const result = await profiler.measure(async () => {
 *     return await whisper.transcribe(audio);
 *   });
 *   // result = { value: <return value>, latency_ms: 342.51 }
 *
 *   const batch = await profiler.measureBatch(audioFiles, async (file) => {
 *     return await whisper.transcribe(file);
 *   });
 *   // batch.summary = { mean, median, std_dev, min, max, p95, p99, count }
 */

class LatencyProfiler {
  constructor(label = 'default') {
    this.label = label;
    this.measurements = [];
  }

  async measure(fn) {
    const start = process.hrtime.bigint();
    const value = await fn();
    const end = process.hrtime.bigint();
    const latency_ms = parseFloat(Number(end - start) / 1e6).toFixed(2);
    const entry = { latency_ms: parseFloat(latency_ms), timestamp: new Date().toISOString() };
    this.measurements.push(entry);
    return { value, latency_ms: entry.latency_ms };
  }

  async measureBatch(items, fn) {
    const results = [];
    for (let i = 0; i < items.length; i++) {
      const result = await this.measure(() => fn(items[i], i));
      results.push({ item_index: i, ...result });
    }
    return { results, summary: this.summarize() };
  }

  summarize() {
    const latencies = this.measurements.map(m => m.latency_ms);
    if (latencies.length === 0) return null;

    const sorted = [...latencies].sort((a, b) => a - b);
    const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    const variance = latencies.reduce((s, v) => s + (v - mean) ** 2, 0) / latencies.length;

    const percentile = (p) => {
      const idx = Math.ceil(p / 100 * sorted.length) - 1;
      return sorted[Math.max(0, idx)];
    };

    return {
      label: this.label,
      count: latencies.length,
      mean_ms: parseFloat(mean.toFixed(2)),
      median_ms: parseFloat(median.toFixed(2)),
      std_dev_ms: parseFloat(Math.sqrt(variance).toFixed(2)),
      min_ms: sorted[0],
      max_ms: sorted[sorted.length - 1],
      p95_ms: percentile(95),
      p99_ms: percentile(99),
    };
  }

  reset() {
    this.measurements = [];
  }
}

module.exports = { LatencyProfiler };
