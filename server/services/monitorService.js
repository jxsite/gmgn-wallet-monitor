import {
  getMonitoredWallets,
  insertAlert,
  isCustomWallet,
  isAssociatedWallet,
  updateWalletTwitter,
  upsertSmartWalletFromTrade
} from '../db/database.js';
import { gmgnService } from './gmgnService.js';
import { getTokenMarketData } from './priceService.js';
import { telegramService } from './telegramService.js';
import { tradingSimulator } from './tradingSimulator.js';
import { goldenDogService } from './goldenDogService.js';
import { walletTracerService } from './walletTracerService.js';

// 过滤非 Meme 的基础结算资产与主流质押/封装资产，防止开仓比特币、以太坊、SOL 本币或稳定币
const EXCLUDED_BASE_TOKENS = new Set([
  'So11111111111111111111111111111111111111112', // WSOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh', // WBTC (Wormhole)
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // WETH (Wormhole)
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1', // bSOL
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', // JitoSOL
  '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj', // stSOL
]);

const EXCLUDED_SYMBOLS = new Set([
  'SOL', 'WSOL', 'USDC', 'USDT', 'WBTC', 'BTC', 'ETH', 'WETH', 'MSOL', 'BSOL', 'JITOSOL'
]);

export class MonitorService {
  constructor() {
    this.io = null;
    this.timer = null;
    this.isPolling = false;
    this.processedTxHashes = new Set();
    this.isRunning = false;
    this.pollCount = 0;
  }

  setSocketServer(io) {
    this.io = io;
  }

  clear() {
    this.processedTxHashes.clear();
    console.log('[Monitor] 已清空已处理交易哈希集合');
  }

  start(intervalMs = 12000) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.timer = setInterval(() => this.poll(), intervalMs);
    console.log(`[Monitor] 链上获利聪明钱与自定义关注钱包监控引擎已启动 (每 ${intervalMs / 1000}s 检测)`);

    // 启动即先执行一次
    setTimeout(() => this.poll(), 1500);
  }

  stop() {
    this.isRunning = false;
    if (this.timer) clearInterval(this.timer);
    console.log('[Monitor] 监控引擎已暂停');
  }

  async poll() {
    if (this.isPolling) return;
    this.isPolling = true;
    this.pollCount++;

    try {
      const monitoredWallets = getMonitoredWallets();
      if (monitoredWallets.length === 0) {
        this.isPolling = false;
        return;
      }

      let detectedTrades = [];

      // 1. 从 GMGN OpenAPI 实时获取全网 Top 获利聪明钱最新真实买入事件
      if (gmgnService.hasApiKey()) {
        const smartTrades = await gmgnService.getSmartMoneyTrades(30);
        if (smartTrades && smartTrades.length > 0) {
          for (const t of smartTrades) {
            const isBuy = t.event === 'buy' || t.side === 'buy' || t.action === 'buy';
            if (!isBuy) continue;

            const walletAddr = t.maker || t.wallet_address || '';
            if (!walletAddr || walletAddr.length < 32) continue;

            const tokenAddr = t.base_address || t.token_address;
            if (!tokenAddr) continue;

            const tokenSymbol = (t.base_token?.symbol || t.token_symbol || 'TOKEN').replace(/^\$/, '');
            // 过滤 WSOL、USDC、USDT、WBTC 等基础资产
            if (EXCLUDED_BASE_TOKENS.has(tokenAddr) || EXCLUDED_SYMBOLS.has(tokenSymbol.toUpperCase())) {
              continue;
            }

            const twitterUser = t.maker_info?.twitter_username || '';
            const twitterName = t.maker_info?.twitter_name || '';
            const customCheck = isCustomWallet(walletAddr);
            const assocCheck = isAssociatedWallet(walletAddr);

            const walletLabel = t.maker_info?.name ||
              (t.maker_info?.tags?.length ? `聪明钱 (${t.maker_info.tags.join(',')})` : 'GMGN 聪明钱');

            // 自动同步真实聪明钱钱包信息与 X 账号到数据库
            upsertSmartWalletFromTrade({
              address: walletAddr,
              label: walletLabel,
              tag: (t.maker_info?.tags && t.maker_info.tags[0]) || 'smart_degen',
              twitter_username: twitterUser
            });

            if (twitterUser) {
              updateWalletTwitter(walletAddr, twitterUser, twitterName);
            }

            detectedTrades.push({
              tx_hash: t.transaction_hash || t.tx_hash || `${walletAddr}_${tokenAddr}_${t.timestamp || Date.now()}`,
              wallet_address: walletAddr,
              wallet_label: walletLabel,
              token_address: tokenAddr,
              token_symbol: tokenSymbol,
              token_name: t.base_token?.name || t.token_name || t.base_token?.symbol || 'Token',
              side: 'BUY',
              amount_usd: parseFloat(t.amount_usd || t.buy_cost_usd || 1000),
              price_usd: parseFloat(t.price_usd || t.base_price_usd || 0),
              twitter_username: twitterUser,
              is_custom: customCheck,
              is_associated: assocCheck.isAssociated,
              parent_wallet: assocCheck.parentWallet
            });
          }
        }

        // 2. 定期轮询自定义重点关注钱包与关联小号的最新买卖流水 (每 3 次轮询执行一次)
        if (this.pollCount % 3 === 0) {
          const priorityWallets = monitoredWallets.filter(w => w.is_custom === 1 || w.is_associated === 1);
          if (priorityWallets.length > 0) {
            // 每次抽检 1 个重点钱包，防止请求过频超限
            const targetWallet = priorityWallets[(Math.floor(this.pollCount / 3)) % priorityWallets.length];
            const activities = await gmgnService.getWalletActivity(targetWallet.address, 10);
            if (activities && Array.isArray(activities)) {
              for (const act of activities) {
                const isBuy = act.event === 'buy' || act.side === 'buy' || act.action === 'buy';
                if (!isBuy) continue;
                const tokenAddr = act.token_address || act.base_address;
                if (!tokenAddr) continue;

                const tokenSymbol = (act.token_symbol || act.symbol || 'TOKEN').replace(/^\$/, '');
                if (EXCLUDED_BASE_TOKENS.has(tokenAddr) || EXCLUDED_SYMBOLS.has(tokenSymbol.toUpperCase())) {
                  continue;
                }

                detectedTrades.push({
                  tx_hash: act.tx_hash || act.transaction_hash || `${targetWallet.address}_${tokenAddr}_${act.timestamp || Date.now()}`,
                  wallet_address: targetWallet.address,
                  wallet_label: targetWallet.label,
                  token_address: tokenAddr,
                  token_symbol: tokenSymbol,
                  token_name: act.token_name || act.name || 'Token',
                  side: 'BUY',
                  amount_usd: parseFloat(act.amount_usd || 1000),
                  price_usd: parseFloat(act.price_usd || 0),
                  twitter_username: targetWallet.twitter_username || '',
                  is_custom: targetWallet.is_custom === 1,
                  is_associated: targetWallet.is_associated === 1,
                  parent_wallet: targetWallet.parent_wallet || ''
                });
              }
            }
          }
        }
      }

      // 3. 处理检测到的真实买入事件
      for (const trade of detectedTrades) {
        const txHash = trade.tx_hash || `${trade.wallet_address}_${trade.token_address}_${Date.now()}`;
        if (this.processedTxHashes.has(txHash)) continue;

        this.processedTxHashes.add(txHash);
        if (this.processedTxHashes.size > 2000) {
          this.processedTxHashes.clear();
        }

        await this.handleBuyEvent(trade);
      }
    } catch (err) {
      console.error('[Monitor] 轮询检测异常:', err.message);
    } finally {
      this.isPolling = false;
    }
  }

  // 核心买入事件处理管道 (真实链上交易驱动)
  async handleBuyEvent(trade) {
    const {
      tx_hash,
      wallet_address,
      wallet_label,
      token_address,
      token_symbol,
      token_name,
      amount_usd,
      price_usd,
      twitter_username = '',
      is_custom = false,
      is_associated = false,
      parent_wallet = ''
    } = trade;

    console.log(`[Monitor] ⚡ 发现真实买入信号: ${wallet_label || wallet_address} 买入 $${token_symbol || 'TOKEN'} ($${amount_usd})`);

    // 1. 获取实时代币市值与精确单价
    const marketData = await getTokenMarketData(token_address);
    const mc = marketData?.marketCap || marketData?.fdv || 100000;
    const finalPrice = (price_usd && price_usd > 0) ? price_usd : (marketData?.price || 0.0001);
    const finalSymbol = marketData?.symbol || token_symbol || 'UNKNOWN';
    const finalName = marketData?.name || token_name || 'Token';

    // 核心需求1：检查当前是否已有该代币持仓（防止重复买入）
    const isAlreadyHeld = tradingSimulator.hasOpenPosition(token_address);

    // 2. 存入警报表 (包含代币单价、推特账号、自定义钱包标识、关联小号标识)
    const alertRecord = {
      tx_hash,
      wallet_address,
      wallet_label: wallet_label || 'GMGN 聪明钱',
      token_address,
      token_symbol: finalSymbol,
      token_name: finalName,
      side: 'BUY',
      amount_usd: amount_usd || 1000,
      price_usd: finalPrice,
      mc_at_event: mc,
      twitter_username,
      is_custom: is_custom ? 1 : 0,
      is_associated: is_associated ? 1 : 0,
      is_simulated: isAlreadyHeld ? 0 : 1,
      sim_status: isAlreadyHeld ? 'ALREADY_HELD' : 'SIMULATED',
      created_at: new Date().toISOString()
    };
    insertAlert(alertRecord);

    // 3. WebSocket 广播到前端大屏
    if (this.io) {
      this.io.emit('alert:new', alertRecord);
    }

    // 4. 执行模拟交易（如已持仓则跳过，杜绝重复买入）
    if (!isAlreadyHeld) {
      await tradingSimulator.executeSimulatedBuy({
        tokenAddress: token_address,
        tokenSymbol: finalSymbol,
        tokenName: finalName,
        triggerWallet: wallet_address,
        buyAmountUsd: 10.0,
        entryPrice: finalPrice
      });
    } else {
      console.log(`[Monitor] 🛡️ 策略保护生效: 代币 $${finalSymbol} 已在持仓中，已记录信号但不重复开仓`);
    }

    // 5. 推送 Telegram 结构化通知 (包含代币价格、GMGN直达链接、X推特账号、自定义/关联小号标识)
    await telegramService.sendBuyAlert({
      walletAddress: wallet_address,
      walletLabel: wallet_label,
      tokenAddress: token_address,
      tokenSymbol: finalSymbol,
      tokenName: finalName,
      buyAmountUsd: amount_usd,
      marketCap: mc,
      priceUsd: finalPrice,
      twitterUsername: twitter_username,
      isCustom: is_custom,
      isAssociated: is_associated,
      parentWallet: parent_wallet,
      simulatedBuyAmount: 10.0,
      isDuplicate: isAlreadyHeld,
      txHash: tx_hash
    });

    // 6. 检查是否触发金狗共识预警 (聪明钱买入人数最多 / 金额最多)
    await goldenDogService.checkAndAlertGoldenDog(token_address);

    // 7. 自动触发资金走向挖掘 (深度追踪该聪明钱是否有分发 SOL 的关联小钱包)
    walletTracerService.traceAndLinkAssociatedWallets(wallet_address, wallet_label).catch(() => {});
  }

  // 手动触发测试信号 (用于用户或开发调试验证)
  async triggerTestSignal(customTokenAddress = null) {
    const monitoredWallets = getMonitoredWallets();
    const wallet = monitoredWallets[0] || { address: 'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh', label: 'Raydium 开盘神枪手', twitter_username: 'sol_degen_alpha' };
    const targetTokenAddress = customTokenAddress || 'CzLSujWBLFsSjncfkh59rQDqJgRq6QUEZ3ZUGUkpump';

    const txHash = `test_${Date.now()}`;
    const trade = {
      tx_hash: txHash,
      wallet_address: wallet.address,
      wallet_label: wallet.label,
      token_address: targetTokenAddress,
      token_symbol: 'TEST',
      token_name: 'Test Smart Token',
      side: 'BUY',
      amount_usd: 3200,
      price_usd: 0.00352,
      twitter_username: wallet.twitter_username || '',
      is_custom: isCustomWallet(wallet.address),
      is_associated: isAssociatedWallet(wallet.address).isAssociated
    };

    await this.handleBuyEvent(trade);
    return { success: true, message: '测试真实买入信号已触发并推送！' };
  }
}

export const monitorService = new MonitorService();
