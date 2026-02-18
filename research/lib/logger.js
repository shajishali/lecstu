/**
 * LECSTU Research — Experiment Logger
 *
 * Produces structured JSON logs for every experiment run.
 * Ensures reproducibility by recording model, params, hardware, and metrics.
 *
 * Usage:
 *   const { ExperimentLogger } = require('./logger');
 *   const logger = new ExperimentLogger('asr-benchmark');
 *   const run = logger.startRun({ model: 'whisper-medium', language: 'en' });
 *   run.logMetric('wer', 0.12);
 *   run.logMetric('latency_ms', 340);
 *   run.end();
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const LOGS_DIR = path.resolve(__dirname, '../logs');

function generateId() {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString('hex');
  return `exp_${ts}_${rand}`;
}

function getHardwareInfo() {
  return {
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    cpu_model: os.cpus()[0]?.model || 'unknown',
    total_memory_gb: parseFloat((os.totalmem() / 1073741824).toFixed(2)),
    free_memory_gb: parseFloat((os.freemem() / 1073741824).toFixed(2)),
    node_version: process.version,
  };
}

class ExperimentRun {
  constructor(experimentType, parameters, logger) {
    this.id = generateId();
    this.experiment_type = experimentType;
    this.parameters = parameters;
    this.metrics = {};
    this.artifacts = [];
    this.notes = [];
    this.start_time = new Date().toISOString();
    this.start_ms = Date.now();
    this.hardware = getHardwareInfo();
    this.status = 'running';
    this._logger = logger;
  }

  logMetric(name, value) {
    this.metrics[name] = value;
  }

  logMetrics(metricsObj) {
    Object.assign(this.metrics, metricsObj);
  }

  logArtifact(filePath, description) {
    this.artifacts.push({ path: filePath, description });
  }

  addNote(note) {
    this.notes.push({ time: new Date().toISOString(), text: note });
  }

  end(status = 'completed') {
    this.end_time = new Date().toISOString();
    this.duration_ms = Date.now() - this.start_ms;
    this.duration_seconds = parseFloat((this.duration_ms / 1000).toFixed(2));
    this.status = status;
    delete this.start_ms;
    delete this._logger;
    this._save();
    return this;
  }

  fail(errorMessage) {
    this.error = errorMessage;
    return this.end('failed');
  }

  _save() {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }

    const filename = `${this.experiment_type}_${this.id}.json`;
    const filepath = path.join(LOGS_DIR, filename);

    const record = {
      id: this.id,
      experiment_type: this.experiment_type,
      status: this.status,
      parameters: this.parameters,
      metrics: this.metrics,
      hardware: this.hardware,
      start_time: this.start_time,
      end_time: this.end_time,
      duration_ms: this.duration_ms,
      duration_seconds: this.duration_seconds,
      artifacts: this.artifacts,
      notes: this.notes,
    };

    if (this.error) record.error = this.error;

    fs.writeFileSync(filepath, JSON.stringify(record, null, 2));
    console.log(`[ExperimentLogger] Run saved: ${filepath}`);
    return filepath;
  }

  toJSON() {
    return {
      id: this.id,
      experiment_type: this.experiment_type,
      status: this.status,
      parameters: this.parameters,
      metrics: this.metrics,
      duration_seconds: this.duration_seconds,
    };
  }
}

class ExperimentLogger {
  constructor(experimentType) {
    this.experimentType = experimentType;
  }

  startRun(parameters = {}) {
    const run = new ExperimentRun(this.experimentType, parameters, this);
    console.log(`[ExperimentLogger] Started run ${run.id} for "${this.experimentType}"`);
    return run;
  }

  listRuns() {
    if (!fs.existsSync(LOGS_DIR)) return [];

    const files = fs.readdirSync(LOGS_DIR)
      .filter(f => f.startsWith(this.experimentType) && f.endsWith('.json'));

    return files.map(f => {
      const content = fs.readFileSync(path.join(LOGS_DIR, f), 'utf-8');
      return JSON.parse(content);
    });
  }

  getRunById(runId) {
    const files = fs.readdirSync(LOGS_DIR).filter(f => f.includes(runId));
    if (files.length === 0) return null;
    const content = fs.readFileSync(path.join(LOGS_DIR, files[0]), 'utf-8');
    return JSON.parse(content);
  }

  summarize() {
    const runs = this.listRuns().filter(r => r.status === 'completed');
    if (runs.length === 0) return { total_runs: 0 };

    const metricKeys = Object.keys(runs[0].metrics || {});
    const summary = { total_runs: runs.length, metrics: {} };

    for (const key of metricKeys) {
      const values = runs.map(r => r.metrics[key]).filter(v => typeof v === 'number');
      if (values.length === 0) continue;

      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const sorted = [...values].sort((a, b) => a - b);
      const median = sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];
      const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
      const stddev = Math.sqrt(variance);

      summary.metrics[key] = {
        mean: parseFloat(mean.toFixed(4)),
        median: parseFloat(median.toFixed(4)),
        std_dev: parseFloat(stddev.toFixed(4)),
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
      };
    }

    return summary;
  }
}

module.exports = { ExperimentLogger, ExperimentRun };
