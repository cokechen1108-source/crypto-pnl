import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createAccount,
  deleteAccount,
  fetchSyncStatus,
  listAccounts,
  startSyncBinance,
  startSyncBybit,
  testConnection,
  type SyncJob,
  updateAccountStatus,
  type ExchangeName,
  type ExchangeAccount,
} from '../../api/client';

const EXCHANGES: { value: ExchangeName; label: string }[] = [
  { value: 'BYBIT', label: 'Bybit' },
  { value: 'BINANCE', label: '币安 Binance' },
];

const DEFAULT_USER_ID = 'default-user';

export default function ConnectExchange() {
  const queryClient = useQueryClient();
  const [exchange, setExchange] = useState<ExchangeName>('BINANCE');
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [apiPassphrase, setApiPassphrase] = useState('');
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [activeSyncJobId, setActiveSyncJobId] = useState<string | null>(null);
  const [activeSyncAccountId, setActiveSyncAccountId] = useState<string | null>(null);
  const handledSyncJobIdRef = useRef<string | null>(null);

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      try {
        const data = await listAccounts(DEFAULT_USER_ID);
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: createAccount,
    onSuccess: async (account) => {
      setVerifyResult(null);
      const test = await testConnection(account.id);
      if (test.ok) {
        await updateAccountStatus(account.id, true);
        setVerifyResult('API 验证成功');
      } else {
        await updateAccountStatus(account.id, false);
        setVerifyResult(`验证失败: ${test.message ?? '未知错误'}（账户已保存到待验证列表）`);
      }
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (err: Error) => {
      const msg = err.message || '';
      const isNetworkError =
        msg === 'Failed to fetch' ||
        msg.includes('NetworkError') ||
        msg.includes('Load failed') ||
        msg.includes('Network request failed');
      setVerifyResult(
        isNetworkError
          ? '添加失败: 无法连接后端。请先启动 API 服务：在终端执行 cd apps/api && npm run start:dev'
          : `添加失败: ${msg}`,
      );
    },
  });

  const testMutation = useMutation({
    mutationFn: testConnection,
    onSuccess: async (result, accountId) => {
      await updateAccountStatus(accountId, result.ok);
      setVerifyResult(result.ok ? 'API 验证成功' : `验证失败: ${result.message ?? '未知错误'}`);
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (err: Error) => {
      setVerifyResult(`验证失败: ${err.message}`);
    },
  });

  const syncStartMutation = useMutation({
    mutationFn: ({ accountId, ex }: { accountId: string; ex: ExchangeName }) =>
      ex === 'BINANCE' ? startSyncBinance(accountId) : startSyncBybit(accountId),
    onSuccess: (data, { accountId }) => {
      handledSyncJobIdRef.current = null;
      setActiveSyncJobId(data.jobId);
      setActiveSyncAccountId(accountId);
      setVerifyResult('同步任务已启动，正在拉取数据...');
    },
    onError: (err: Error) => {
      setVerifyResult(`同步失败: ${err.message}`);
    },
  });

  const syncStatusQuery = useQuery({
    queryKey: ['syncStatus', activeSyncJobId],
    queryFn: () => fetchSyncStatus(activeSyncJobId ?? ''),
    enabled: Boolean(activeSyncJobId),
    refetchInterval: (query) => {
      const data = query.state.data as SyncJob | undefined;
      if (!data) return 1000;
      return data.status === 'queued' || data.status === 'running' ? 1000 : false;
    },
  });

  useEffect(() => {
    const job = syncStatusQuery.data;
    if (!job || !activeSyncJobId || handledSyncJobIdRef.current === job.jobId) return;
    if (job.status === 'queued' || job.status === 'running') return;

    handledSyncJobIdRef.current = job.jobId;
    if (job.status === 'error') {
      setVerifyResult(`同步失败: ${job.error ?? job.message ?? '未知错误'}`);
      setActiveSyncJobId(null);
      setActiveSyncAccountId(null);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['trades'] });
    queryClient.invalidateQueries({ queryKey: ['dailyPnl'] });
    queryClient.invalidateQueries({ queryKey: ['totalPnl'] });
    const inserted = job.result?.tradesInserted ?? 0;
    const created = job.result?.tradesCreated ?? 0;
    setVerifyResult(
      `同步成功：新增原始成交 ${inserted} 条，重建交易 ${created} 条。`,
    );
    setActiveSyncJobId(null);
    setActiveSyncAccountId(null);
  }, [syncStatusQuery.data, activeSyncJobId, activeSyncAccountId, queryClient]);

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData<ExchangeAccount[]>(['accounts'], (prev) =>
        Array.isArray(prev) ? prev.filter((acc) => acc.id !== deletedId) : [],
      );
      setVerifyResult('账户已删除');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['dailyPnl'] });
      queryClient.invalidateQueries({ queryKey: ['totalPnl'] });
    },
    onError: (err: Error) => {
      setVerifyResult(`删除失败: ${err.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyResult(null);
    createMutation.mutate({
      userId: DEFAULT_USER_ID,
      exchange,
      name: name || (exchange === 'BINANCE' ? '币安账户' : 'Bybit 账户'),
      apiKey,
      apiSecret,
      apiPassphrase: apiPassphrase || undefined,
    });
  };

  const handleTest = (accountId: string) => {
    setVerifyResult(null);
    testMutation.mutate(accountId);
  };

  const handleDelete = (accountId: string, accountName: string) => {
    const ok = window.confirm(`确认删除账户「${accountName}」吗？该账户关联的同步数据也会被删除。`);
    if (!ok) return;
    setVerifyResult(null);
    deleteMutation.mutate(accountId);
  };

  const allAccounts = Array.isArray(accountsQuery.data) ? accountsQuery.data : [];
  const accounts = allAccounts.filter((acc) => acc.isActive);
  const pendingAccounts = allAccounts.filter((acc) => !acc.isActive);
  const syncJob = syncStatusQuery.data;
  const syncing = Boolean(
    syncJob &&
      (syncJob.status === 'queued' || syncJob.status === 'running'),
  );
  const syncProgress = syncJob?.progress ?? 0;

  return (
    <section className="panel connect-exchange">
      <h2>连接交易所 API</h2>
      <p className="connect-hint">
        请使用仅「读取」权限的 API Key，勿开启提现。币安需在 API 管理中勾选「启用期货」。
      </p>
      <form onSubmit={handleSubmit} className="connect-form">
        <div className="form-row">
          <div>
            <label>交易所</label>
            <select
              value={exchange}
              onChange={(e) => setExchange(e.target.value as ExchangeName)}
              className="form-select"
            >
              {EXCHANGES.map((ex) => (
                <option key={ex.value} value={ex.value}>
                  {ex.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>账户名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={exchange === 'BINANCE' ? '币安账户' : 'Bybit 账户'}
              className="form-input"
            />
          </div>
        </div>
        <div className="form-row">
          <div>
            <label>API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="只读权限，勿用提现权限"
              required
              className="form-input"
            />
          </div>
          <div>
            <label>API Secret</label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              required
              className="form-input"
            />
          </div>
        </div>
        {exchange === 'BINANCE' && (
          <div className="form-row">
            <div>
              <label>API Passphrase（选填，部分子账户需要）</label>
              <input
                type="password"
                value={apiPassphrase}
                onChange={(e) => setApiPassphrase(e.target.value)}
                className="form-input"
              />
            </div>
          </div>
        )}
        <div className="form-actions">
          <button
            type="submit"
            disabled={createMutation.isPending || !apiKey || !apiSecret}
            className="btn btn-primary"
          >
            {createMutation.isPending ? '添加中…' : '添加并验证'}
          </button>
          {verifyResult && (
            <div
              className={`verify-msg ${verifyResult.startsWith('API 验证成功') ? 'success' : 'error'}`}
              role="alert"
            >
              {verifyResult}
            </div>
          )}
        </div>
      </form>

      {accounts.length > 0 && (
        <div className="account-list">
          <h3>已连接账户</h3>
          <ul>
            {accounts.map((acc) => (
              <li key={acc.id} className="account-item">
                <span className="account-name">
                  {acc.name} <em>({acc.exchange})</em>
                </span>
                <span className="account-id">{acc.id}</span>
                <div className="account-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => handleTest(acc.id)}
                    disabled={testMutation.isPending}
                  >
                    验证
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => syncStartMutation.mutate({ accountId: acc.id, ex: acc.exchange })}
                    disabled={syncing || syncStartMutation.isPending}
                  >
                    {syncing && activeSyncAccountId === acc.id
                      ? `同步中 ${syncProgress}%`
                      : '同步'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(acc.id, acc.name)}
                    disabled={deleteMutation.isPending || syncing}
                  >
                    {deleteMutation.isPending ? '删除中…' : '删除'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {(syncing || syncStatusQuery.isFetching) && syncJob && (
            <div className="sync-progress-wrap" role="status" aria-live="polite">
              <div className="sync-progress-head">
                <span>同步进度</span>
                <span>{Math.max(0, Math.min(100, Math.round(syncProgress)))}%</span>
              </div>
              <div className="sync-progress-track">
                <div
                  className="sync-progress-bar"
                  style={{ width: `${Math.max(0, Math.min(100, Math.round(syncProgress)))}%` }}
                />
              </div>
              <p className="sync-progress-text">
                {syncJob.message ?? '正在同步，请稍候...'}
              </p>
              {typeof syncJob.totalSymbols === 'number' && typeof syncJob.completedSymbols === 'number' && (
                <p className="sync-progress-sub">
                  交易对进度：{syncJob.completedSymbols}/{syncJob.totalSymbols}
                </p>
              )}
            </div>
          )}
          {verifyResult && testMutation.isSuccess && (
            <p className={verifyResult.startsWith('API 验证成功') ? 'success' : 'error'}>
              {verifyResult}
            </p>
          )}
        </div>
      )}

      {pendingAccounts.length > 0 && (
        <div className="account-list">
          <h3>待验证账户（验证成功后才会参与数据展示）</h3>
          <ul>
            {pendingAccounts.map((acc) => (
              <li key={acc.id} className="account-item">
                <span className="account-name">
                  {acc.name} <em>({acc.exchange})</em>
                </span>
                <span className="account-id">{acc.id}</span>
                <div className="account-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => handleTest(acc.id)}
                    disabled={testMutation.isPending}
                  >
                    重新验证
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(acc.id, acc.name)}
                    disabled={deleteMutation.isPending || syncing}
                  >
                    {deleteMutation.isPending ? '删除中…' : '删除'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
