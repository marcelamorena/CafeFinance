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
  parcelado?: boolean;
  quantidade_parcelas?: number;
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
  parcelamento?: {
    id: number;
    valor_total: number;
    valor_parcela: number;
    quantidade_parcelas: number;
    data_primeira_parcela: string;
  };
  movimentacoes?: MovimentacaoItem[];
}

export interface MovimentacaoItem {
  id: number;
  tipo: TipoMovimentacao;
  valor: number;
  data_movimentacao: string;
  descricao?: string | null;
  parcelamento_id?: number | null;
  parcela_numero?: number | null;
  total_parcelas?: number | null;
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

export interface ExcluirMovimentacaoResponse {
  success: boolean;
  message: string;
  removidos: number;
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
      parcelamento_id?: number | null;
      parcela_numero?: number | null;
      total_parcelas?: number | null;
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

export interface MetaEconomia {
  id: number;
  nome: string;
  valor_meta: number;
  valor_atual: number;
  percentual: number;
  data_limite?: string | null;
  status: string;
  created_at?: string | null;
}

export interface EconomiaItem {
  id: number;
  meta_id: number;
  meta_nome: string;
  valor: number;
  data_economia: string;
  descricao?: string | null;
  created_at?: string | null;
}

export interface CriarMetaEconomiaRequest {
  nome: string;
  valor_meta: string;
  data_limite?: string;
}

export interface GuardarEconomiaRequest {
  meta_id: number;
  valor: string;
  data_economia: string;
  descricao?: string;
}

export interface MetaEconomiaResponse {
  success: boolean;
  message: string;
  meta: MetaEconomia;
}

export interface GuardarEconomiaResponse {
  success: boolean;
  message: string;
  economia: EconomiaItem;
}

export interface EconomiaResumoResponse {
  success: boolean;
  message: string;
  dashboard: {
    total_economizado: number;
    meta_principal?: MetaEconomia | null;
    metas: MetaEconomia[];
    historico_recente: EconomiaItem[];
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

  atualizarMovimentacao(id: number, dados: MovimentacaoRequest) {
    return this.http.put<MovimentacaoResponse>(`${this.apiUrl}/movimentacoes/${id}`, dados, { withCredentials: true });
  }

  excluirMovimentacao(id: number) {
    return this.http.delete<ExcluirMovimentacaoResponse>(`${this.apiUrl}/movimentacoes/${id}`, { withCredentials: true });
  }

  listarMovimentacoes() {
    return this.http.get<MovimentacoesResponse>(`${this.apiUrl}/movimentacoes`, { withCredentials: true });
  }

  resumoMovimentacoes() {
    return this.http.get<DashboardResumoResponse>(`${this.apiUrl}/movimentacoes/resumo`, { withCredentials: true });
  }

  criarMetaEconomia(dados: CriarMetaEconomiaRequest) {
    return this.http.post<MetaEconomiaResponse>(`${this.apiUrl}/metas-economia`, dados, { withCredentials: true });
  }

  guardarEconomia(dados: GuardarEconomiaRequest) {
    return this.http.post<GuardarEconomiaResponse>(`${this.apiUrl}/economias`, dados, { withCredentials: true });
  }

  resumoEconomias() {
    return this.http.get<EconomiaResumoResponse>(`${this.apiUrl}/economias/resumo`, { withCredentials: true });
  }
}
