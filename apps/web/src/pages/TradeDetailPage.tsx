import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchTrade } from '../api/client';
import TradeChart from '../features/charts/TradeChart';

export default function TradeDetailPage() {
  const { tradeId } = useParams();
  const tradeQuery = useQuery({
    queryKey: ['trade', tradeId],
    queryFn: () => fetchTrade(tradeId ?? ''),
    enabled: Boolean(tradeId),
  });

  if (tradeQuery.isLoading) {
    return <div className="empty">加载中...</div>;
  }

  if (!tradeQuery.data) {
    return <div className="empty">未找到交易</div>;
  }

  const trade = tradeQuery.data;

  return (
    <div className="trade-detail">
      <section className="panel">
        <h2>交易概览</h2>
        <div className="trade-summary">
          <div>
            <span>交易对</span>
            <strong>{trade.symbol}</strong>
          </div>
          <div>
            <span>方向</span>
            <strong>{trade.side}</strong>
          </div>
          <div>
            <span>大小</span>
            <strong>{trade.size.toFixed(4)}</strong>
          </div>
          <div>
            <span>已实现PnL</span>
            <strong>{trade.realizedPnl.toFixed(2)}</strong>
          </div>
          <div>
            <span>手续费</span>
            <strong>{trade.feeTotal.toFixed(2)}</strong>
          </div>
          <div>
            <span>资金费</span>
            <strong>{trade.fundingTotal.toFixed(2)}</strong>
          </div>
        </div>
      </section>
      <section className="panel">
        <h2>K线与交易标记</h2>
        <TradeChart trade={trade} />
      </section>
    </div>
  );
}
