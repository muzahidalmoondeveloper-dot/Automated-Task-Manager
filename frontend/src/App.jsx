import { AuthProvider } from "./context/AuthContext";
import { ConfirmDialogProvider } from "./context/ConfirmContext";
import {Toaster} from "react-hot-toast"
import AppRouter from "./routes/AppRouter";

export default function App() {
  return (
    <AuthProvider>
      <ConfirmDialogProvider>
        <AppRouter />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: "12px",
              background: "#0f172a",
              color: "#fff",
              fontSize: "14px",
            },
            success: {
              duration: 3000,
            },
            error: {
              duration: 5000,
            },
          }}
        />
      </ConfirmDialogProvider>
    </AuthProvider>
  );
}