import type { Request, Response, NextFunction } from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import FormData from 'form-data';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';

const WHISPER_MODELS = ['tiny', 'base', 'small', 'medium'];
const LANGUAGES = ['en', 'ta', 'si'];
const ENGINES = ['whisper', 'whisper-finetuned', 'google', 'azure'];

export async function getStatus(_req: Request, res: Response, next: NextFunction) {
  try {
    if (config.asr.useHttpService) {
      try {
        const r = await axios.get(`${config.asr.asrServiceUrl}/health`, { timeout: 3000 });
        const ok = r.status === 200 && (r.data?.status === 'ok' || r.data?.available === true);
        return res.json({ success: true, data: { available: ok } });
      } catch {
        return res.json({ success: true, data: { available: false } });
      }
    }
    const asrDir = path.dirname(config.asr.asrScriptPath);
    const proc = spawn(config.asr.pythonPath, [config.asr.asrScriptPath, '--help'], {
      cwd: asrDir,
      env: { ...process.env, PYTHONPATH: asrDir },
    });
    const ok = await new Promise<boolean>((resolve) => {
      const t = setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 8000);
      proc.on('close', (code) => {
        clearTimeout(t);
        resolve(code === 0);
      });
      proc.on('error', () => {
        clearTimeout(t);
        resolve(false);
      });
    });
    res.json({ success: true, data: { available: ok } });
  } catch {
    res.json({ success: true, data: { available: false } });
  }
}

export async function transcribe(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file || !file.buffer) {
      throw new AppError('No audio file provided', 400);
    }

    const language = (req.body.language as string) || 'en';
    const engine = (req.body.engine as string) || 'whisper';
    const model = (req.body.model as string) || 'base';

    if (!LANGUAGES.includes(language)) {
      throw new AppError(`Invalid language. Use: ${LANGUAGES.join(', ')}`, 400);
    }
    if (!ENGINES.includes(engine)) {
      throw new AppError(`Invalid engine. Use: ${ENGINES.join(', ')}`, 400);
    }
    if (engine === 'whisper' && !WHISPER_MODELS.includes(model)) {
      throw new AppError(`Invalid Whisper model. Use: ${WHISPER_MODELS.join(', ')}`, 400);
    }
    if (engine === 'whisper-finetuned') {
      // Model ignored; uses finetuned checkpoint
    }

    let result: { text: string; confidence: number; latency_ms: number; engine: string; error?: string };

    try {
      if (config.asr.useHttpService) {
        result = await transcribeViaHttp(file.buffer, file.originalname || 'audio.wav', language, engine, model);
      } else {
        result = await transcribeViaSubprocess(file.buffer, file.originalname || 'audio.wav', language, engine, model);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ASR service error';
      const isConnectionError = /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET/i.test(msg);
      const userMessage = isConnectionError
        ? 'ASR service is not running. Run: npm run asr (or: cd ai-services/asr && uvicorn server:app --port 8001)'
        : msg;
      return res.status(503).json({
        success: false,
        message: userMessage,
        data: { text: '', confidence: 0, latency_ms: 0, engine, error: msg },
      });
    }

    if (result.error) {
      return res.status(503).json({
        success: false,
        message: 'ASR service unavailable',
        data: { text: '', confidence: 0, latency_ms: 0, engine, error: result.error },
      });
    }

    res.json({
      success: true,
      data: {
        text: result.text,
        confidence: result.confidence,
        latency_ms: result.latency_ms,
        engine: result.engine,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function transcribeViaHttp(
  buffer: Buffer,
  filename: string,
  language: string,
  engine: string,
  model: string
): Promise<{ text: string; confidence: number; latency_ms: number; engine: string; error?: string }> {
  const formData = new FormData();
  const contentType = filename?.toLowerCase().endsWith('.webm') ? 'audio/webm' : 'audio/wav';
  formData.append('audio', buffer, { filename: filename || 'audio.wav', contentType });
  formData.append('language', language);
  formData.append('engine', engine);
  formData.append('model', model);

  const response = await axios.post(`${config.asr.asrServiceUrl}/transcribe`, formData, {
    headers: formData.getHeaders(),
    timeout: 120000,
    validateStatus: () => true,
  });

  if (response.status !== 200) {
    const body = response.data;
    const errMsg = body?.error || body?.message || body?.detail || 'ASR HTTP service error';
    return {
      text: '',
      confidence: 0,
      latency_ms: 0,
      engine,
      error: errMsg,
    };
  }

  const data = response.data;
  return {
    text: data.text || '',
    confidence: data.confidence ?? 0,
    latency_ms: data.latency_ms ?? 0,
    engine: data.engine || engine,
    error: data.error,
  };
}

async function transcribeViaSubprocess(
  buffer: Buffer,
  filename: string,
  language: string,
  engine: string,
  model: string
): Promise<{ text: string; confidence: number; latency_ms: number; engine: string; error?: string }> {
  const ext = path.extname(filename) || '.webm';
  const tmpPath = path.join(os.tmpdir(), `asr-${Date.now()}${ext}`);

  try {
    fs.writeFileSync(tmpPath, buffer);
  } catch {
    return {
      text: '',
      confidence: 0,
      latency_ms: 0,
      engine,
      error: 'Failed to write temporary audio file',
    };
  }

  return new Promise((resolve) => {
    const args = [
      config.asr.asrScriptPath,
      '--file', tmpPath,
      '--language', language,
      '--engine', engine,
      '--model', model,
    ];

    const proc = spawn(config.asr.pythonPath, args, {
      cwd: path.dirname(config.asr.asrScriptPath),
      env: { ...process.env, PYTHONPATH: path.dirname(config.asr.asrScriptPath) },
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      try {
        fs.unlinkSync(tmpPath);
      } catch {}

      if (code !== 0) {
        resolve({
          text: '',
          confidence: 0,
          latency_ms: 0,
          engine,
          error: stderr || `Python process exited with code ${code}`,
        });
        return;
      }

      try {
        const data = JSON.parse(stdout.trim());
        resolve({
          text: data.text || '',
          confidence: data.confidence ?? 0,
          latency_ms: data.latency_ms ?? 0,
          engine: data.engine || engine,
          error: data.error,
        });
      } catch {
        resolve({
          text: '',
          confidence: 0,
          latency_ms: 0,
          engine,
          error: 'Invalid ASR response',
        });
      }
    });

    proc.on('error', (err) => {
      try {
        fs.unlinkSync(tmpPath);
      } catch {}
      resolve({
        text: '',
        confidence: 0,
        latency_ms: 0,
        engine,
        error: err.message || 'Failed to spawn ASR process',
      });
    });
  });
}
