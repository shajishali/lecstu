import type { Request, Response, NextFunction } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';

const LANGUAGES = ['en', 'ta', 'si'];
const ENGINES = ['google', 'azure', 'marian', 'mbart'];

export async function translate(req: Request, res: Response, next: NextFunction) {
  try {
    const text = req.body.text as string;
    const src = (req.body.src as string) || 'en';
    const tgt = (req.body.tgt as string) || 'ta';
    const engine = (req.body.engine as string) || 'google';

    if (!text || typeof text !== 'string') {
      throw new AppError('Missing or invalid text', 400);
    }
    if (!LANGUAGES.includes(src)) {
      throw new AppError(`Invalid source language. Use: ${LANGUAGES.join(', ')}`, 400);
    }
    if (!LANGUAGES.includes(tgt)) {
      throw new AppError(`Invalid target language. Use: ${LANGUAGES.join(', ')}`, 400);
    }
    if (!ENGINES.includes(engine)) {
      throw new AppError(`Invalid engine. Use: ${ENGINES.join(', ')}`, 400);
    }

    const result = await translateViaSubprocess(text, src, tgt, engine);

    if (result.error) {
      console.error('[Translation] Error:', result.error);
      return res.status(503).json({
        success: false,
        message: 'Translation service error',
        data: {
          translated_text: '',
          latency_ms: result.latency_ms,
          engine: result.engine,
          error: result.error,
        },
      });
    }

    res.json({
      success: true,
      data: {
        translated_text: result.translated_text,
        latency_ms: result.latency_ms,
        engine: result.engine,
      },
    });
  } catch (err) {
    next(err);
  }
}

const ENGINE_TIMEOUT_MS: Record<string, number> = {
  google: 10000,
  marian: 15000,
  azure: 15000,
  mbart: 15000,
};

async function translateViaSubprocess(
  text: string,
  src: string,
  tgt: string,
  engine: string
): Promise<{ translated_text: string; latency_ms: number; engine: string; error?: string }> {
  const timeoutMs = ENGINE_TIMEOUT_MS[engine] ?? 60000;
  return new Promise((resolve) => {
    const args = [
      config.translation.scriptPath,
      '--text', text,
      '--src', src,
      '--tgt', tgt,
      '--engine', engine,
    ];

    const proc = spawn(config.translation.pythonPath, args, {
      cwd: path.dirname(config.translation.scriptPath),
      env: { ...process.env, PYTHONPATH: path.dirname(config.translation.scriptPath) },
    });

    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({
        translated_text: '',
        latency_ms: 0,
        engine,
        error: `Translation timed out after ${timeoutMs / 1000}s`,
      });
    }, timeoutMs);

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        resolve({
          translated_text: '',
          latency_ms: 0,
          engine,
          error: stderr || `Process exited with code ${code}`,
        });
        return;
      }
      try {
        const data = JSON.parse(stdout.trim());
        resolve({
          translated_text: data.translated_text || '',
          latency_ms: data.latency_ms ?? 0,
          engine: data.engine || engine,
          error: data.error,
        });
      } catch {
        resolve({
          translated_text: '',
          latency_ms: 0,
          engine,
          error: 'Invalid translation response',
        });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      resolve({
        translated_text: '',
        latency_ms: 0,
        engine,
        error: err.message || 'Failed to spawn translation process',
      });
    });
  });
}
