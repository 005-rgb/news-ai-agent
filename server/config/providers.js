'use strict';

/**
 * LLM Provider definitions — default models, limits, reset logic
 */

const PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    defaultModel: 'gemini-1.5-flash',
    dailyLimitDefault: 1500,
    monthlyLimitDefault: 45000,
    resetLogic: 'midnight_utc',
  },
  groq: {
    name: 'Groq',
    defaultModel: 'llama-3.3-70b-versatile',
    dailyLimitDefault: 14400,  // ~14400 req/day on free tier
    monthlyLimitDefault: 432000,
    resetLogic: 'rolling_24h',
  },
  deepseek: {
    name: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    dailyLimitDefault: 500,
    monthlyLimitDefault: 15000,
    resetLogic: 'midnight_utc',
  },
  openrouter: {
    name: 'OpenRouter',
    defaultModel: 'meta-llama/llama-3.1-70b-instruct:free',
    dailyLimitDefault: 200,
    monthlyLimitDefault: 6000,
    resetLogic: 'rolling_24h',
  },
  mistral: {
    name: 'Mistral AI',
    defaultModel: 'mistral-small-latest',
    dailyLimitDefault: 500,
    monthlyLimitDefault: 15000,
    resetLogic: 'midnight_utc',
  },
  together: {
    name: 'Together AI',
    defaultModel: 'meta-llama/Llama-3-70b-chat-hf',
    dailyLimitDefault: 1000,
    monthlyLimitDefault: 30000,
    resetLogic: 'rolling_24h',
  },
  cerebras: {
    name: 'Cerebras',
    defaultModel: 'llama3.1-70b',
    dailyLimitDefault: 1000,
    monthlyLimitDefault: 30000,
    resetLogic: 'rolling_24h',
  },
  cohere: {
    name: 'Cohere',
    defaultModel: 'command-r',
    dailyLimitDefault: 1000,
    monthlyLimitDefault: 30000,
    resetLogic: 'midnight_utc',
  },
};

const FALLBACK_CHAIN = ['gemini','groq','deepseek','openrouter','mistral','together','cerebras','cohere'];

module.exports = { PROVIDERS, FALLBACK_CHAIN };
