import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface CadastroRequest {
  name: string;
  email: string;
  password: string;
  confirmarSenha: string;
}

export interface CadastroResponse {
  success: boolean;
  message: string;
  user?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  user?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface PerfilResponse {
  success: boolean;
  message: string;
  user?: {
    id: number;
    name: string;
    email: string;
  };
  session?: {
    id: string;
    user_id: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/php';

  registrar(dados: CadastroRequest) {
    return this.http.post<CadastroResponse>(`${this.apiUrl}/cadastro`, dados);
  }

  login(dados: LoginRequest) {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, dados);
  }

  perfil() {
    return this.http.get<PerfilResponse>(`${this.apiUrl}/perfil`);
  }

  logout() {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/logout`, {});
  }
}
