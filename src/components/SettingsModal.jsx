import React, { useState, useEffect } from 'react';
import { X, Send, Key, DollarSign, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, settings, onSaveSettings, onTestTelegram }) {
  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [gmgnKey, setGmgnKey] = useState('');
  const [autoBuyAmount, setAutoBuyAmount] = useState('10');
  const [autoBuyEnabled, setAutoBuyEnabled] = useState(true);

  const [testStatus, setTestStatus] = useState(null); // { loading, success, message }
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (settings) {
      setTgToken(settings.telegram_bot_token || '');
      setTgChatId(settings.telegram_chat_id || '');
      setGmgnKey(settings.gmgn_api_key || '');
      setAutoBuyAmount(settings.auto_buy_amount || '10');
      setAutoBuyEnabled(settings.auto_buy_enabled !== 'false');
    }
  }, [settings]);

  if (!isOpen) return null;

  const handleTestTg = async () => {
    if (!tgToken || !tgChatId) {
      setTestStatus({ loading: false, success: false, message: '请先填写 Bot Token 和 Chat ID' });
      return;
    }
    setTestStatus({ loading: true, success: null, message: '正在测试连接 Telegram...' });
    const res = await onTestTelegram(tgToken, tgChatId);
    setTestStatus({ loading: false, success: res.success, message: res.message });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await onSaveSettings({
      telegram_bot_token: tgToken.trim(),
      telegram_chat_id: tgChatId.trim(),
      gmgn_api_key: gmgnKey.trim(),
      auto_buy_amount: autoBuyAmount.trim(),
      auto_buy_enabled: autoBuyEnabled ? 'true' : 'false'
    });
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-brand-cyan">
              <Key className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">系统参数设置</h3>
              <p className="text-xs text-slate-400">配置电报推送、GMGN 接口与模拟交易策略</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Telegram 配置 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                <Send className="h-3.5 w-3.5 text-brand-cyan" />
                <span>Telegram 机器人配置 (买入即时推送)</span>
              </label>
              <span className="text-[11px] text-slate-400">
                向 <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-brand-cyan underline">@BotFather</a> 申请
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Bot Token</label>
                <input
                  type="text"
                  placeholder="例如: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                  value={tgToken}
                  onChange={(e) => setTgToken(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-cyan font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Chat ID (您的 Telegram 账号 ID 或群组 ID)
                </label>
                <input
                  type="text"
                  placeholder="例如: 987654321 (可通过 @userinfobot 获取)"
                  value={tgChatId}
                  onChange={(e) => setTgChatId(e.target.value)}
                  className="w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-cyan font-mono"
                />
              </div>
            </div>

            {/* 测试按钮与状态 */}
            <div className="flex items-center space-x-3 pt-1">
              <button
                type="button"
                onClick={handleTestTg}
                disabled={testStatus?.loading}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-brand-cyan border border-slate-700 transition disabled:opacity-50"
              >
                {testStatus?.loading ? '正在测试...' : '发送测试消息'}
              </button>
              {testStatus && (
                <div className={`text-xs flex items-center space-x-1 ${testStatus.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {testStatus.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                  <span>{testStatus.message}</span>
                </div>
              )}
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* GMGN OpenAPI Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                <Key className="h-3.5 w-3.5 text-purple-400" />
                <span>GMGN API Key (可选)</span>
              </label>
              <a
                href="https://gmgn.ai/ai"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-brand-cyan hover:underline inline-flex items-center space-x-0.5"
              >
                <span>前往 gmgn.ai/ai 免费获取</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <input
              type="password"
              placeholder="如未填写，系统将自动启用内置高胜率种子钱包与链上实时行情引擎"
              value={gmgnKey}
              onChange={(e) => setGmgnKey(e.target.value)}
              className="w-full bg-dark-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-cyan font-mono"
            />
            <p className="text-[11px] text-slate-500">
              配置 GMGN API Key 后，系统将直接通过 GMGN OpenAPI 获取实时 Smart Money 榜单与交易画像。
            </p>
          </div>

          <hr className="border-slate-800" />

          {/* 模拟交易设置 */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
              <DollarSign className="h-3.5 w-3.5 text-brand-green" />
              <span>10U 模拟跟单交易参数</span>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">单笔模拟买入金额 (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={autoBuyAmount}
                    onChange={(e) => setAutoBuyAmount(e.target.value)}
                    className="w-full bg-dark-800 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-xs text-white focus:outline-none focus:border-brand-cyan font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">自动模拟开仓开关</label>
                <button
                  type="button"
                  onClick={() => setAutoBuyEnabled(!autoBuyEnabled)}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                    autoBuyEnabled
                      ? 'bg-brand-green/20 text-brand-green border-brand-green/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {autoBuyEnabled ? '已启用自动买入 10U' : '已暂停自动买入'}
                </button>
              </div>
            </div>
          </div>

          {/* Footer Save Button */}
          <div className="pt-2 flex items-center justify-between">
            {saveSuccess ? (
              <span className="text-xs text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="h-4 w-4" />
                <span>设置已成功保存！</span>
              </span>
            ) : <span />}
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-brand-green to-brand-cyan text-dark-900 hover:opacity-90 transition shadow-lg shadow-brand-cyan/20"
              >
                保存全部设置
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
