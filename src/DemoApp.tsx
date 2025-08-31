import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import './styles/ticket.css';
import { ThemeProvider } from './contexts/ThemeContext';
import CrewCastDemoUI from './components/CrewCastDemoUI';

function DemoApp() {
  return (
    <ThemeProvider>
      <div className="app-frame">
        <CrewCastDemoUI />
        <ToastContainer
          position="bottom-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
        />
      </div>
    </ThemeProvider>
  );
}

export default DemoApp;