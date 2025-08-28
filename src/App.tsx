import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import { UserProvider, useUser } from './contexts/UserContext';
import { TopicProvider, useTopic } from './contexts/TopicContext';
import { ThemeProvider } from './contexts/ThemeContext';
import UserRegistrationModal from './components/UserRegistrationModal';
import TopicsListPage from './components/TopicsListPage';
import TopicDetailsPage from './components/TopicDetailsPage';
import AppLoading from './components/AppLoading';
import WindowControls from './components/WindowControls';

const AppContent = () => {
  const { isLoading, isRegistered } = useUser();
  const { currentTopic } = useTopic();

  if (isLoading) {
    return <AppLoading />;
  }

  return (
    <div className="app-container">
      {!isRegistered && <UserRegistrationModal />}

      {isRegistered && !currentTopic && <TopicsListPage />}

      {isRegistered && currentTopic && <TopicDetailsPage />}

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
  );
};

function App() {
  return (
    <ThemeProvider>
      <UserProvider>
        <TopicProvider>
          <div className="app-frame">
            <div className="app-titlebar">
              <div className="app-title">CrewCast</div>
              <WindowControls />
            </div>
            <AppContent />
          </div>
        </TopicProvider>
      </UserProvider>
    </ThemeProvider>
  );
}

export default App;