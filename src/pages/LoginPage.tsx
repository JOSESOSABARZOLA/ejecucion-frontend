/**
 * Microservicio: resolucion
 * Módulo: N/A
 * Feature: Página del modulo de recepción
 * Archivo: ReceptionPage.tsx
 * Responsabilidad: Presentar la interfaz del modulo de Recepcion
 * Desarrollador: Johan Freire
 * Fecha: 2026-03-19
 */

import { useNavigate } from "react-router-dom";
// import { UserService } from "../services/UserService";
import { useState } from "react";
import { useUser } from "../context/UserContext";
import type { UserFromLogin } from "../interfaces/IUser";

//TODO: Manejar la autenticación con el token recibido

const LoginPage = () => {
  const navigate = useNavigate();
  const { loginUser } = useUser();

  // const [email, setEmail] = useState("");
  // const [password, setPassword] = useState("");

  const [loginData, setLoginData] = useState<UserFromLogin>({
    // nombre: "",
    // apellido: "",
    email: "",
    password: "",
  });
  // const [error, setError] = useState("");

  const handleSesion = async () => {
    // const userData = {
    //   email,
    //   password,
    // };

    try {
      await loginUser(loginData);
      navigate("/home/dashboard");
    } catch (error) {
      // Error ya está en el estado
      console.error("Error al iniciar sesión", error);
    }

    // UserService.login(userData)
    //   .then((data) =>
    //     data?.usu_id === "1" ? navigate("/home") : console.log(data),
    //   )
    //   .catch((err) => {
    //     console.log(err);

    //     setError(err.message);
    //   });
    //   .finally(() => setLoading(false));
  };

  return (
    <div>
      <div className="hero">
        <div className="hero-content flex-row">
          <div className="text-left">
            <h1 className="text-5xl font-bold text-white">
              Sistema de Gestión Orden y Control
            </h1>
            <p className="py-6"></p>
          </div>
          <div className="card bg-base-100 w-full max-w-sm shrink-0 shadow-2xl">
            <div className="card-body">
              <fieldset className="fieldset">
                <label className="label">Correo</label>
                <input
                  type="email"
                  className="input"
                  placeholder="Correo electrónico"
                  value={loginData.email}
                  onChange={(e) =>
                    setLoginData({ ...loginData, email: e.target.value })
                  }
                />
                <label className="label">Contraseña</label>
                <input
                  type="password"
                  className="input"
                  placeholder="Contraseña"
                  value={loginData.password}
                  onChange={(e) =>
                    setLoginData({ ...loginData, password: e.target.value })
                  }
                />
                <div>
                  <a className="link link-hover">¿Olvidaste tu contraseña?</a>
                </div>
                <button
                  className="btn btn-primary mt-4"
                  onClick={handleSesion}
                >
                  Ingresar
                </button>
              </fieldset>
              {/* {error !== "" && (
                <div
                  role="alert"
                  className="alert alert-error"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 shrink-0 stroke-current"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>Error! {error}</span>
                </div>
              )} */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
