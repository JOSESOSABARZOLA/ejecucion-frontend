/**
 * Microservicio: resolucion
 * M�dulo: N/A
 * Feature: Servicio de usuario
 * Archivo: UserService.ts
 * Responsabilidad: Manejo de informaci�n de usuario al iniciar la aplicaci�n
 * Desarrollador: Johan Freire
 * Fecha: 2026-03-23
 */

import httpClient from "../api/httpClient";

type UserLogin = {
  email: string;
  password: string;
};

export const UserService = {
  async login(userLogin: UserLogin) {
    const { data } = await httpClient.post(`/auth/login`, userLogin);
    return data;
  },

  //   async getUsers() {
  //     const { data } = await axios.get(`${API_URL}/users`);
  //     return data;
  //   },

  //   async getUserById(id: string) {
  //     const { data } = await axios.get(`${API_URL}/users/${id}`);
  //     return data;
  //   },

  //   async createUser(userData: any) {
  //     const { data } = await axios.post(`${API_URL}/users`, userData);
  //     return data;
  //   },

  //   async updateUser(id: string, userData: any) {
  //     const { data } = await axios.put(`${API_URL}/users/${id}`, userData);
  //     return data;
  //   },

  //   async deleteUser(id: string) {
  //     const { data } = await axios.delete(`${API_URL}/users/${id}`);
  //     return data;
  //   },
};
