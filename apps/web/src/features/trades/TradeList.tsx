import { Link } from 'react-router-dom';
import type { Trade } from '../../api/client';
import { format } from 'date-fns';

type Props = {
  trades: Trade[];
  loading?: boolean;
  /** 当前选中用于 K 线显示的交易 id */
  selectedTradeId?: string | null;
  /** 点击某笔交易时回调，用于在 K 线图显示该笔的入场/出场 */
  onSelectTrade?: (trade: Trade) => void;
};

export default function TradeList({ trades, loading, selectedTradeId, onSelectTrade }: Props) {
  if (loading) {
    return <div className="empty">加载中...</div>;
  }

  if (trades.length === 0) {
    return (
      <div className="empty">
        <p>暂无交易数据</p>
        <p className="empty-hint">选择上方「全部」可显示该账户所有交易</p>
      </div>
    );
  }

  return (
    <div className="table">
      <div className="table-row header">
        <span>交易对</span>
        <span>方向</span>
        <span>开仓时间</span>
        <span>平仓时间</span>
        <span>大小</span>
        <span>PnL</span>
        <span>详情</span>
      </div>
      {trades.map((trade) => (
        <div
          key={trade.id}
          className={`table-row ${onSelectTrade ? 'table-row--selectable' : ''} ${selectedTradeId === trade.id ? 'table-row--selected' : ''}`}
          role={onSelectTrade ? 'button' : undefined}
          tabIndex={onSelectTrade ? 0 : undefined}
          onClick={onSelectTrade ? () => onSelectTrade(trade) : undefined}
          onKeyDown={
            onSelectTrade
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelectTrade(trade);
                }
              : undefined
          }
        >
          <span>{trade.symbol}</span>
          <span className={trade.side === 'LONG' ? 'positive' : 'negative'}>
            {trade.side}
          </span>
          <span>{format(new Date(trade.entryTime), 'yyyy-MM-dd HH:mm')}</span>
          <span>
            {trade.exitTime ? format(new Date(trade.exitTime), 'yyyy-MM-dd HH:mm') : '持仓中'}
          </span>
          <span>{trade.size.toFixed(4)}</span>
          <span className={trade.realizedPnl >= 0 ? 'positive' : 'negative'}>
            {trade.realizedPnl.toFixed(2)}
          </span>
          <span>
            <Link to={`/trades/${trade.id}`} onClick={(e) => e.stopPropagation()}>查看</Link>
          </span>
        </div>
      ))}
    </div>
  );
}
