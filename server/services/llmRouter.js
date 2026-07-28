'use strict';

/**
 * LLM Router — abstraksi semua provider
 * callLLM(prompt, options?) → { text, tokensUsed, provider, model, latencyMs }
 */

const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const keyPool = require('./keyPool');
const logger = require('../utils/logger');
const config = require('../config');

// ── Provider definitions ────────────────────────────────────────────────────

const PROVIDERS = {
  gemini: {
    defaultModel: 'gemini-1.5-flash',
    async call(keyValue, prompt, model, maxTokens, temperature) {
      const genAI = new GoogleGenerativeAI(keyValue);
      const m = genAI.getGenerativeModel({
        model: model || 'gemini-1.5-flash',
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      });

      // Google AI SDK tidak support timeout native — race dengan manual timer
      const timeoutMs = config.llmTimeout || 60_000;
      const timeoutErr = Object.assign(
        new Error(`Gemini request timed out after ${timeoutMs}ms`),
        { code: 'ECONNABORTED' }
      );
      const result = await Promise.race([
        m.generateContent(prompt),
        new Promise((_, reject) => setTimeout(() => reject(timeoutErr), timeoutMs)),
      ]);

      const text = result.response.text();
      const usage = result.response.usageMetadata;
      return {
        text,
        tokensUsed: (usage?.promptTokenCount || 0) + (usage?.candidatesTokenCount || 0),
      };
    },
  },
  groq: {
    defaultModel: 'llama-3.3-70b-versatile',
    async call(keyValue, prompt, model, maxTokens, temperature) {
      const res = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        { model: model || 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens || 2000, temperature: temperature || 0.7 },
        { headers: { Authorization: `Bearer ${keyValue}`, 'Content-Type': 'application/json' }, timeout: config.llmTimeout }
      );
      return { text: res.data.choices[0].message.content, tokensUsed: res.data.usage?.total_tokens || 0 };
    },
  },
  deepseek: {
    defaultModel: 'deepseek-chat',
    async call(keyValue, prompt, model, maxTokens, temperature) {
      const res = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        { model: model || 'deepseek-chat', messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens || 2000, temperature: temperature || 0.7 },
        { headers: { Authorization: `Bearer ${keyValue}`, 'Content-Type': 'application/json' }, timeout: config.llmTimeout }
      );
      return { text: res.data.choices[0].message.content, tokensUsed: res.data.usage?.total_tokens || 0 };
    },
  },
  openrouter: {
    defaultModel: 'meta-llama/llama-3.1-70b-instruct:free',
    async call(keyValue, prompt, model, maxTokens, temperature) {
      const res = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        { model: model || 'meta-llama/llama-3.1-70b-instruct:free', messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens || 2000, temperature: temperature || 0.7 },
        { headers: { Authorization: `Bearer ${keyValue}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://news-ai-agent.replit.app', 'X-Title': 'NewsAIAgent' }, timeout: config.llmTimeout }
      );
      return { text: res.data.choices[0].message.content, tokensUsed: res.data.usage?.total_tokens || 0 };
    },
  },
  mistral: {
    defaultModel: 'mistral-small-latest',
    async call(keyValue, prompt, model, maxTokens, temperature) {
      const res = await axios.post(
        'https://api.mistral.ai/v1/chat/completions',
        { model: model || 'mistral-small-latest', messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens || 2000, temperature: temperature || 0.7 },
        { headers: { Authorization: `Bearer ${keyValue}`, 'Content-Type': 'application/json' }, timeout: config.llmTimeout }
      );
      return { text: res.data.choices[0].message.content, tokensUsed: res.data.usage?.total_tokens || 0 };
    },
  },
  together: {
    defaultModel: 'meta-llama/Llama-3-70b-chat-hf',
    async call(keyValue, prompt, model, maxTokens, temperature) {
      const res = await axios.post(
        'https://api.together.xyz/v1/chat/completions',
        { model: model || 'meta-llama/Llama-3-70b-chat-hf', messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens || 2000, temperature: temperature || 0.7 },
        { headers: { Authorization: `Bearer ${keyValue}`, 'Content-Type': 'application/json' }, timeout: config.llmTimeout }
      );
      return { text: res.data.choices[0].message.content, tokensUsed: res.data.usage?.total_tokens || 0 };
    },
  },
  cerebras: {
    defaultModel: 'llama3.1-70b',
    async call(keyValue, prompt, model, maxTokens, temperature) {
      const res = await axios.post(
        'https://api.cerebras.ai/v1/chat/completions',
        { model: model || 'llama3.1-70b', messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens || 2000, temperature: temperature || 0.7 },
        { headers: { Authorization: `Bearer ${keyValue}`, 'Content-Type': 'application/json' }, timeout: config.llmTimeout }
      );
      return { text: res.data.choices[0].message.content, tokensUsed: res.data.usage?.total_tokens || 0 };
    },
  },
  cohere: {
    defaultModel: 'command-r',
    async call(keyValue, prompt, model, maxTokens, temperature) {
      const res = await axios.post(
        'https://api.cohere.ai/v1/chat',
        { model: model || 'command-r', message: prompt, max_tokens: maxTokens || 2000, temperature: temperature || 0.7 },
        { headers: { Authorization: `Bearer ${keyValue}`, 'Content-Type': 'application/json' }, timeout: config.llmTimeout }
      );
      const text = res.data.text || res.data.message?.content?.[0]?.text || '';
      const tokens = (res.data.meta?.billed_units?.input_tokens || 0) + (res.data.meta?.billed_units?.output_tokens || 0);
      return { text, tokensUsed: tokens };
    },
  },
};

// ── Error classification ───────────────────────────────────────────────────

function classifyError(err) {
  const status = err.response?.status;
  if (status === 401 || status === 403) return 'auth_error';
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'server_error';
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') return 'network_error';
  if (err.message?.includes('context_length') || err.message?.includes('token')) return 'context_length_exceeded';
  return 'unknown_error';
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Main function used by all agents
 * @param {string} prompt
 * @param {{ provider?, model?, maxTokens?, temperature?, category?, agentName? }} options
 */
async function callLLM(prompt, options = {}) {
  const { provider: preferredProvider, model, maxTokens = 2000, temperature = 0.7, category, agentName = 'LLMRouter' } = options;

  let keyRow, keyValue;
  try {
    const selected = await keyPool.selectBestKey({ provider: preferredProvider, category });
    keyRow = selected.keyRow;
    keyValue = selected.keyValue;
  } catch (err) {
    await logger.critical(agentName, 'No LLM keys available', { error: err.message });
    throw err;
  }

  const providerDef = PROVIDERS[keyRow.provider];
  if (!providerDef) throw new Error(`Unknown provider: ${keyRow.provider}`);

  const start = Date.now();
  try {
    const result = await providerDef.call(keyValue, prompt, model || providerDef.defaultModel, maxTokens, temperature);
    const latencyMs = Date.now() - start;

    await keyPool.recordUsage(keyRow.id, result.tokensUsed);
    await logger.info(agentName, `LLM call OK — ${keyRow.provider} — ${result.tokensUsed} tokens — ${latencyMs}ms`, { provider: keyRow.provider, latencyMs, tokensUsed: result.tokensUsed });

    return {
      text: result.text,
      tokensUsed: result.tokensUsed,
      provider: keyRow.provider,
      model: model || providerDef.defaultModel,
      latencyMs,
    };
  } catch (err) {
    const errorType = classifyError(err);
    await keyPool.recordError(keyRow.id, `${errorType}: ${err.message}`);
    await logger.error(agentName, `LLM call FAILED — ${keyRow.provider} — ${errorType}`, { error: err.message, provider: keyRow.provider });

    // Retry with different provider if rate_limit or server_error
    if (['rate_limit','server_error'].includes(errorType) && !preferredProvider) {
      const fallbackProviders = Object.keys(PROVIDERS).filter(p => p !== keyRow.provider);
      for (const fp of fallbackProviders) {
        try {
          const fb = await keyPool.selectBestKey({ provider: fp });
          const result = await PROVIDERS[fp].call(fb.keyValue, prompt, PROVIDERS[fp].defaultModel, maxTokens, temperature);
          await keyPool.recordUsage(fb.keyRow.id, result.tokensUsed);
          return { text: result.text, tokensUsed: result.tokensUsed, provider: fp, model: PROVIDERS[fp].defaultModel, latencyMs: Date.now() - start };
        } catch (_) { continue; }
      }
    }

    const enriched = new Error(err.message);
    enriched.code = errorType;
    throw enriched;
  }
}

/**
 * Direct call with explicit key — used by /keys/:id/test endpoint
 */
async function callWithKey(provider, keyValue, prompt) {
  const providerDef = PROVIDERS[provider];
  if (!providerDef) throw new Error(`Unknown provider: ${provider}`);
  const result = await providerDef.call(keyValue, prompt, providerDef.defaultModel, 100, 0.1);
  return result;
}

module.exports = { callLLM, callWithKey, PROVIDERS };
