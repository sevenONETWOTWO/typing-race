import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AIRace from './pages/AIRace';
import Home from './pages/Home';
import Practice from './pages/Practice';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/ai" element={<AIRace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
