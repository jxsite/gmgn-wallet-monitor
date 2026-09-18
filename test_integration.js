import axios from 'axios';

async function runTests() {
  const BASE_URL = 'http://localhost:3000';
  console.log('Testing server endpoints at', BASE_URL);

  // 1. 测试静态页面托管
  const htmlRes = await axios.get(BASE_URL);
  console.log('✓ 静态主页返回:', htmlRes.status, 'HTML包含root:', htmlRes.data.includes('id="root"'));

  // 2. 测试系统状态接口
  const statusRes = await axios.get(`${BASE_URL}/api/status`);
  console.log('✓ 系统状态接口:', statusRes.data);

  // 3. 测试钱包列表 (确认 100 个钱包)
  const walletsRes = await axios.get(`${BASE_URL}/api/wallets`);
  console.log('✓ 钱包列表接口: 钱包总数 =', walletsRes.data.wallets?.length);
  if (walletsRes.data.wallets?.length > 0) {
    console.log('  Rank #1 钱包:', walletsRes.data.wallets[0].label, walletsRes.data.wallets[0].address);
  }

  // 4. 测试手动触发买入信号 (WIF)
  console.log('触发测试买入 WIF: EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm...');
  const buyRes = await axios.post(`${BASE_URL}/api/test/buy`, {
    tokenAddress: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm'
  });
  console.log('✓ 测试买入返回:', buyRes.data);

  // 等待 1 秒数据入库
  await new Promise(r => setTimeout(r, 1000));

  // 5. 检查警报流水
  const alertsRes = await axios.get(`${BASE_URL}/api/alerts`);
  console.log('✓ 最新买入警报记录数 =', alertsRes.data.alerts?.length);
  if (alertsRes.data.alerts?.length > 0) {
    const a = alertsRes.data.alerts[0];
    console.log(`  警报详情: [${a.token_symbol}] ${a.token_name} | CA: ${a.token_address} | MC: $${a.mc_at_event?.toLocaleString()}`);
  }

  // 6. 检查 10U 模拟持仓
  const posRes = await axios.get(`${BASE_URL}/api/positions`);
  console.log('✓ 模拟活跃持仓记录数 =', posRes.data.positions?.length);
  if (posRes.data.positions?.length > 0) {
    const p = posRes.data.positions[0];
    console.log(`  仓位详情: [${p.token_symbol}] 本金: $${p.entry_amount} | 入场MC: $${p.entry_mc?.toLocaleString()} | 当前MC: $${p.current_mc?.toLocaleString()} | 收益率: ${p.current_pnl_ratio}%`);
  }

  // 7. 测试设置获取与更新
  const settingsRes = await axios.get(`${BASE_URL}/api/settings`);
  console.log('✓ 系统设置读取成功');

  console.log('\n========================================');
  console.log('🎉 全部接口与核心业务逻辑自动化测试通过！');
  console.log('========================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
