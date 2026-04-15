import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import AdminRoute from './components/AdminRoute';
import HomePage from './pages/HomePage';
import QuizPage from './pages/QuizPage';
import AdminDashboard from './pages/AdminDashboard';
import ManageCategories from './pages/ManageCategories';
import ManageQuestions from './pages/ManageQuestions';
import ManageUsers from './pages/ManageUsers';
import GrammarPage from './pages/GrammarPage';
import ManageGrammar from './pages/ManageGrammar';
import ManageSchoolAccounts from './pages/ManageSchoolAccounts';
import ManageResults from './pages/ManageResults';
import PracticePage from './pages/PracticePage';
import ExamListPage from './pages/ExamListPage';
import ExamPage from './pages/ExamPage';
import StatisticsPage from './pages/StatisticsPage';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/quiz/:type/:id" element={<QuizPage />} />
            <Route path="/grammar" element={<GrammarPage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/exams" element={<ExamListPage />} />
            <Route path="/exam/:source" element={<ExamPage />} />
            <Route path="/statistics" element={<StatisticsPage />} />
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/categories" element={<ManageCategories />} />
              <Route path="/admin/questions" element={<ManageQuestions />} />
              <Route path="/admin/users" element={<ManageUsers />} />
              <Route path="/admin/grammar" element={<ManageGrammar />} />
              <Route path="/admin/school-accounts" element={<ManageSchoolAccounts />} />
              <Route path="/admin/results" element={<ManageResults />} />
            </Route>
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}
