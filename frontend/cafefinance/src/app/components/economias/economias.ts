import { NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService, EconomiaItem, MetaEconomia } from '../../services/auth.service';

interface MetaEconomiaTela {
  id: number;
  nome: string;
  valorMeta: string;
  valorAtual: string;
  percentual: number;
  dataLimite?: string | null;
  status: string;
}

interface EconomiaTela {
  id: number;
  metaNome: string;
  valor: string;
  data: string;
  descricao?: string | null;
}

@Component({
  selector: 'app-economias',
  imports: [NgFor, NgIf, RouterLink],
  templateUrl: './economias.html',
  styleUrl: './economias.css',
})
export class Economias implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  hoje = this.formatarData(new Date());
  readonly limitePalavrasDescricao = 12;

  nomeUsuario = this.obterNomeUsuario();
  nomeMetaEconomia = '';
  valorMetaEconomia = '';
  dataLimiteEconomia = '';
  valorEconomia = '';
  dataEconomia = this.hoje;
  descricaoEconomia = '';
  economiaPalavras = 0;
  metaEconomiaSelecionadaId: number | null = null;
  mensagemEconomia = '';
  economiaComErro = false;
  carregandoEconomia = false;
  criandoMetaEconomia = false;

  totalEconomizado = 'R$ 0,00';
  progressoEconomia = 0;
  textoMetaXicara = 'Sem meta';
  textoResumoEconomia = 'Crie uma meta para acompanhar o progresso das suas economias.';
  metasEconomia: MetaEconomiaTela[] = [];
  historicoEconomias: EconomiaTela[] = [];

  ngOnInit(): void {
    this.carregarPerfil();
    this.carregarEconomias();
  }

  get textoBotaoMetaEconomia(): string {
    return this.criandoMetaEconomia ? 'Criando...' : 'Criar meta';
  }

  get textoBotaoGuardarEconomia(): string {
    return this.carregandoEconomia ? 'Guardando...' : 'Guardar economia';
  }

  atualizarNomeMetaEconomia(event: Event): void {
    this.nomeMetaEconomia = (event.target as HTMLInputElement).value;
    this.limparMensagemEconomia();
  }

  formatarValorMetaEconomia(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.valorMetaEconomia = this.formatarValorDigitado(input);
    this.limparMensagemEconomia();
  }

  atualizarDataLimiteEconomia(event: Event): void {
    this.dataLimiteEconomia = (event.target as HTMLInputElement).value;
    this.limparMensagemEconomia();
  }

  selecionarMetaEconomia(event: Event): void {
    this.metaEconomiaSelecionadaId = Number((event.target as HTMLSelectElement).value) || null;
    this.limparMensagemEconomia();
  }

  formatarValorEconomia(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.valorEconomia = this.formatarValorDigitado(input);
    this.limparMensagemEconomia();
  }

  atualizarDataEconomia(event: Event): void {
    this.dataEconomia = (event.target as HTMLInputElement).value;
    this.limparMensagemEconomia();
  }

  atualizarDescricaoEconomia(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    const descricaoLimitada = this.limitarPalavras(textarea.value, this.limitePalavrasDescricao);

    this.descricaoEconomia = descricaoLimitada;
    this.economiaPalavras = this.contarPalavras(descricaoLimitada);
    textarea.value = descricaoLimitada;
  }

  criarMetaEconomia(): void {
    if (!this.nomeMetaEconomia.trim()) {
      this.exibirMensagemEconomia('Informe o nome da meta.', true);
      return;
    }

    if (!this.valorMetaEconomia) {
      this.exibirMensagemEconomia('Informe o valor da meta.', true);
      return;
    }

    this.criandoMetaEconomia = true;
    this.limparMensagemEconomia();

    this.authService
      .criarMetaEconomia({
        nome: this.nomeMetaEconomia.trim(),
        valor_meta: this.valorMetaEconomia,
        data_limite: this.dataLimiteEconomia,
      })
      .subscribe({
        next: (resposta) => {
          this.criandoMetaEconomia = false;
          this.nomeMetaEconomia = '';
          this.valorMetaEconomia = '';
          this.dataLimiteEconomia = '';
          this.exibirMensagemEconomia(resposta.message || 'Meta criada com sucesso.', false);
          this.carregarEconomias();
        },
        error: (erro) => {
          this.criandoMetaEconomia = false;
          this.exibirMensagemEconomia(erro.error?.message ?? 'Nao foi possivel criar a meta.', true);
        },
      });
  }

  guardarEconomia(): void {
    if (!this.metaEconomiaSelecionadaId) {
      this.exibirMensagemEconomia('Escolha uma meta.', true);
      return;
    }

    if (!this.valorEconomia) {
      this.exibirMensagemEconomia('Informe o valor guardado.', true);
      return;
    }

    if (!this.dataEconomia) {
      this.exibirMensagemEconomia('Informe a data da economia.', true);
      return;
    }

    this.carregandoEconomia = true;
    this.limparMensagemEconomia();

    this.authService
      .guardarEconomia({
        meta_id: this.metaEconomiaSelecionadaId,
        valor: this.valorEconomia,
        data_economia: this.dataEconomia,
        descricao: this.descricaoEconomia.trim(),
      })
      .subscribe({
        next: (resposta) => {
          this.carregandoEconomia = false;
          this.valorEconomia = '';
          this.dataEconomia = this.hoje;
          this.descricaoEconomia = '';
          this.economiaPalavras = 0;
          this.exibirMensagemEconomia(resposta.message || 'Economia guardada com sucesso.', false);
          this.carregarEconomias();
        },
        error: (erro) => {
          this.carregandoEconomia = false;
          this.exibirMensagemEconomia(erro.error?.message ?? 'Nao foi possivel guardar a economia.', true);
        },
      });
  }

  sair(): void {
    this.authService.logout().subscribe({
      next: () => this.finalizarSessao(),
      error: () => this.finalizarSessao(),
    });
  }

  private carregarPerfil(): void {
    this.authService.perfil().subscribe({
      next: (resposta) => {
        const usuario = resposta.user;
        this.nomeUsuario = usuario?.name ?? this.obterNomeUsuario();

        if (usuario) {
          localStorage.setItem('cafefinance_usuario', JSON.stringify(usuario));
        }
      },
      error: () => {
        this.nomeUsuario = this.obterNomeUsuario();
      },
    });
  }

  private carregarEconomias(): void {
    this.authService.resumoEconomias().subscribe({
      next: (resposta) => {
        const dashboard = resposta.dashboard;
        this.totalEconomizado = this.formatarReal(dashboard.total_economizado);
        this.metasEconomia = dashboard.metas.map((meta) => this.formatarMetaEconomiaTela(meta));
        this.historicoEconomias = dashboard.historico_recente.map((economia) => this.formatarEconomiaTela(economia));

        if (!this.metaEconomiaSelecionadaId && this.metasEconomia.length) {
          this.metaEconomiaSelecionadaId = this.metasEconomia[0].id;
        }

        this.aplicarMetaPrincipal(dashboard.meta_principal ?? null);
      },
      error: () => {
        this.aplicarMetaPrincipal(null);
      },
    });
  }

  private aplicarMetaPrincipal(meta: MetaEconomia | null): void {
    if (!meta) {
      this.progressoEconomia = 0;
      this.textoMetaXicara = 'Sem meta';
      this.textoResumoEconomia = 'Crie uma meta para acompanhar o progresso das suas economias.';
      return;
    }

    this.progressoEconomia = Math.max(0, Math.min(100, Math.round(meta.percentual)));
    this.textoMetaXicara = meta.nome;
    this.textoResumoEconomia = `${this.formatarReal(meta.valor_atual)} guardados de ${this.formatarReal(meta.valor_meta)}.`;
  }

  private exibirMensagemEconomia(mensagem: string, erro: boolean): void {
    this.mensagemEconomia = mensagem;
    this.economiaComErro = erro;
  }

  private limparMensagemEconomia(): void {
    this.mensagemEconomia = '';
    this.economiaComErro = false;
  }

  private finalizarSessao(): void {
    localStorage.removeItem('cafefinance_usuario');
    this.router.navigate(['/']);
  }

  private formatarValorDigitado(input: HTMLInputElement): string {
    const digitos = input.value.replace(/\D/g, '');

    if (!digitos) {
      input.value = '';
      return '';
    }

    const valor = this.formatarMoeda(digitos);
    input.value = valor;
    return valor;
  }

  private formatarMoeda(digitos: string): string {
    const centavos = Number(digitos || '0');

    return (centavos / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private formatarReal(valor: number): string {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  private formatarData(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');

    return `${ano}-${mes}-${dia}`;
  }

  private formatarDataCurta(data: string): string {
    return new Date(`${data}T00:00:00`)
      .toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
      })
      .replace('.', '');
  }

  private limitarPalavras(texto: string, limite: number): string {
    const palavras = texto.trim().split(/\s+/).filter(Boolean);

    if (palavras.length <= limite) {
      return texto;
    }

    return palavras.slice(0, limite).join(' ');
  }

  private contarPalavras(texto: string): number {
    return texto.trim().split(/\s+/).filter(Boolean).length;
  }

  private formatarMetaEconomiaTela(meta: MetaEconomia): MetaEconomiaTela {
    return {
      id: meta.id,
      nome: meta.nome,
      valorMeta: this.formatarReal(meta.valor_meta),
      valorAtual: this.formatarReal(meta.valor_atual),
      percentual: Math.max(0, Math.min(100, Math.round(meta.percentual))),
      dataLimite: meta.data_limite,
      status: meta.status,
    };
  }

  private formatarEconomiaTela(economia: EconomiaItem): EconomiaTela {
    return {
      id: economia.id,
      metaNome: economia.meta_nome,
      valor: this.formatarReal(economia.valor),
      data: this.formatarDataCurta(economia.data_economia),
      descricao: economia.descricao,
    };
  }

  private obterNomeUsuario(): string {
    const usuarioSalvo = localStorage.getItem('cafefinance_usuario');

    if (!usuarioSalvo) {
      return '';
    }

    try {
      return JSON.parse(usuarioSalvo)?.name ?? '';
    } catch {
      return '';
    }
  }
}
