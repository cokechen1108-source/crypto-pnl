import { Link, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import TradeDetailPage from './pages/TradeDetailPage';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">Crypto PnL Console</div>
        <nav className="nav">
          <Link to="/">仪表盘</Link>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/trades/:tradeId" element={<TradeDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
