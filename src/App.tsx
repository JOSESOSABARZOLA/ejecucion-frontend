// import { UserProvider } from "./context/UserContext";
// import MainLayout from "./layouts/MainLayout";
// import ReceptionPage from "./pages/ReceptionPage";

import { useRoutes } from "react-router-dom";
import { routes } from "./config/routes";
import { AppProviders } from "./providers/AppProviders";

function App() {
  const element = useRoutes(routes);

  return (
    <AppProviders>
      {element}
    </AppProviders>
  );
}

export default App;
