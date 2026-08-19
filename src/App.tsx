import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ThemeToggle } from './components/ThemeToggle';
import AIRace from './pages/AIRace';
import Home from './pages/Home';
import Online from './pages/Online';
import Practice from './pages/Practice';

function App() {
  return (
    <BrowserRouter>
      <ThemeToggle />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/ai" element={<AIRace />} />
        <Route path="/online" element={<Online />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
