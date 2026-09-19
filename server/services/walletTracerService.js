import { gmgnService } from './gmgnService.js';
import { addAssociatedWallet, getAssociatedWallets, isAssociatedWallet } from '../db/database.js';
import { telegramService } from './telegramService.js';

export class WalletTracerService {
  constructor() {
    this.io = null;
    this.tracedWallets = new Set();
  }

  setSocketServer(io) {
    this.io = io;
  }

  // 深度追踪资金流向并挖掘同一用户的关联小号/老鼠仓
  async traceAndLinkAssociatedWallets(walletAddress, walletLabel = '聪明钱') {
    if (!walletAddress || this.tracedWallets.has(walletAddress)) return [];
    this.tracedWallets.add(walletAddress);
    if (this.tracedWallets.size > 1000) this.tracedWallets.clear();

    const discovered = [];

    try {
      // 1. 查询钱包近期链上活动与转账记录
      const activities = await gmgnService.getWalletActivity(walletAddress, 15);
      if (!activities || !Array.isArray(activities)) return [];

      for (const act of activities) {
        // 寻找 SOL 转账 (transfer / fund_from / fund_to)
        const isTransfer = act.event === 'transfer' || act.type === 'transfer' || act.action === 'transfer';
        const fromAddr = act.from_address || act.sender || act.source;
        const toAddr = act.to_address || act.receiver || act.target;

        let candidateChild = null;
        let transferAmount = act.amount || act.sol_amount || 0;

        if (isTransfer) {
          // 主钱包给小钱包分发资金（主转子）
          if (fromAddr === walletAddress && toAddr && toAddr !== walletAddress) {
            candidateChild = toAddr;
          }
          // 或者小钱包向主钱包归集资金（子转主）
          else if (toAddr === walletAddress && fromAddr && fromAddr !== walletAddress) {
            candidateChild = fromAddr;
          }
        }

        if (candidateChild && candidateChild.length >= 32) {
          const check = isAssociatedWallet(candidateChild);
          if (!check.isAssociated) {
            const childLabel = `🔗 ${walletLabel.slice(0, 10)} 关联小号`;
            addAssociatedWallet({
              address: candidateChild,
              label: childLabel,
              parent_wallet: walletAddress,
              fund_source: act.tx_hash || 'SOL Transfer',
              twitter_username: ''
            });

            discovered.push({
              address: candidateChild,
              parentWallet: walletAddress,
              label: childLabel,
              amount: transferAmount
            });

            console.log(`[Tracer] 🔍 资金流向挖掘成功: 发现 ${walletLabel} 关联小号 -> ${candidateChild}`);

            // 推送 Telegram 关联小号挖掘通知
            await telegramService.sendAssociatedWalletAlert({
              parentWallet: walletAddress,
              parentLabel: walletLabel,
              childWallet: candidateChild,
              amount: transferAmount
            });

            if (this.io) {
              this.io.emit('wallet:associated_new', {
                childWallet: candidateChild,
                parentWallet: walletAddress,
                label: childLabel
              });
            }
          }
        }
      }
    } catch (err) {
      // 容错不阻塞主业务
    }

    return discovered;
  }

  getDiscoveredWallets() {
    return getAssociatedWallets();
  }
}

export const walletTracerService = new WalletTracerService();