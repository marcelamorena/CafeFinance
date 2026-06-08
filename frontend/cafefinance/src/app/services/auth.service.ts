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

export type TipoMovimentacao = 'entrada' | 'saida';

export interface MovimentacaoRequest {
  tipo: TipoMovimentacao;
  valor: string;
  data_movimentacao: string;
  categoria: string;
  descricao?: string;
}

export interface MovimentacaoResponse {
  success: boolean;
  message: string;
  movimentacao?: {
    id: number;
    tipo: TipoMovimentacao;
    valor: number;
    data_movimentacao: string;
    descricao?: string;
  };
}

export interface MovimentacaoItem {
  id: number;
  tipo: TipoMovimentacao;
  valor: number;
  data_movimentacao: string;
  descricao?: string | null;
  titulo: string;
  categoria: string;
  icone: string;
  created_at?: string | null;
}

export interface MovimentacoesResponse {
  success: boolean;
  message: string;
  movimentacoes: MovimentacaoItem[];
}

export interface DashboardResumoResponse {
  success: boolean;
  message: string;
  dashboard: {
    saldo: number;
    total_entradas: number;
    total_saidas: number;
    registros_recentes: Array<{
      id: number;
      tipo: TipoMovimentacao;
      valor: number;
      data_movimentacao: string;
      descricao?: string | null;
      titulo: string;
      categoria: string;
      icone: string;
      created_at?: string | null;
    }>;
    gastos_por_categoria: Array<{
      nome: string;
      total: number;
      percentual: number;
    }>;
  };
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/php';

  registrar(dados: CadastroRequest) {
    return this.http.post<CadastroResponse>(`${this.apiUrl}/cadastro`, dados, { withCredentials: true });
  }

  login(dados: LoginRequest) {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, dados, { withCredentials: true });
  }

  perfil() {
    return this.http.get<PerfilResponse>(`${this.apiUrl}/perfil`, { withCredentials: true });
  }

  logout() {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/logout`, {}, { withCredentials: true });
  }

  salvarMovimentacao(dados: MovimentacaoRequest) {
    return this.http.post<MovimentacaoResponse>(`${this.apiUrl}/movimentacoes`, dados, { withCredentials: true });
  }

  listarMovimentacoes() {
    return this.http.get<MovimentacoesResponse>(`${this.apiUrl}/movimentacoes`, { withCredentials: true });
  }

  resumoMovimentacoes() {
    return this.http.get<DashboardResumoResponse>(`${this.apiUrl}/movimentacoes/resumo`, { withCredentials: true });
  }
}
