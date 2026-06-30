import { NgFor, NgIf } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import Chart from 'chart.js/auto';
import type { ChartConfiguration } from 'chart.js';
import { Subscription } from 'rxjs';

import { AuthService, EconomiaDashboard, EconomiaItem, MetaEconomia } from '../../services/auth.service';

interface MetaEconomiaTela {
  id: number;
  nome: string;
  valorMetaNumero: number;
  valorAtualNumero: number;
  valorMeta: string;
  valorAtual: string;
  percentual: number;
  percentualTexto: string;
  dataLimite?: string | null;
  status: string;
}

interface EconomiaTela {
  id: number;
  metaId: number;
  metaNome: string;
  valorNumero: number;
  valor: string;
  dataValor: string;
  data: string;
  descricao?: string | null;
}

@Component({
  selector: 'app-economias',
  imports: [NgFor, NgIf, RouterLink],
  templateUrl: './economias.html',
  styleUrl: './economias.css',
})
export class Economias implements OnInit, AfterViewInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  @ViewChildren('goalCupCanvas') private goalCupCanvases?: QueryList<ElementRef<HTMLCanvasElement>>;
  private graficosXicarasMetas = new Map<number, Chart<'bar'>>();
  private canvasMetasSubscription?: Subscription;
  private viewPronta = false;
  private renderizacaoGraficosAgendada = false;

  hoje = this.formatarData(new Date());
  readonly limitePalavrasDescricao = 12;

  nomeUsuario = this.obterNomeUsuario();
  nomeMetaEconomia = '';
  valorMetaEconomia = '';
  valorAtualMetaEconomia = '';
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
  metaEditandoId: number | null = null;
  metaExcluindoId: number | null = null;
  metaParaExcluir: MetaEconomiaTela | null = null;
  economiaEditandoId: number | null = null;
  economiaExcluindoId: number | null = null;
  economiaParaExcluir: EconomiaTela | null = null;
  metaConcluidaNome = '';
  mostrarCafesConcluidos = false;
  carregandoResumoEconomias = true;

  totalEconomizado = 'R$ 0,00';
  textoResumoEconomia = 'Crie uma meta para acompanhar o progresso das suas economias.';
  metasEconomia: MetaEconomiaTela[] = [];
  historicoEconomias: EconomiaTela[] = [];

  ngOnInit(): void {
    this.carregarPerfil();
    this.carregarEconomias();
  }

  ngAfterViewInit(): void {
    this.viewPronta = true;
    this.canvasMetasSubscription = this.goalCupCanvases?.changes.subscribe(() => this.agendarRenderizacaoGraficosXicaras());
    this.agendarRenderizacaoGraficosXicaras();
  }

  ngOnDestroy(): void {
    this.canvasMetasSubscription?.unsubscribe();
    this.graficosXicarasMetas.forEach((grafico) => grafico.destroy());
  }

  get textoBotaoMetaEconomia(): string {
    if (this.criandoMetaEconomia) {
      return this.metaEditandoId ? 'Salvando...' : 'Criando...';
    }

    return this.metaEditandoId ? 'Salvar meta' : 'Criar meta';
  }

  get textoBotaoGuardarEconomia(): string {
    if (this.carregandoEconomia) {
      return this.economiaEditandoId ? 'Salvando...' : 'Guardando...';
    }

    return this.economiaEditandoId ? 'Salvar economia' : 'Guardar economia';
  }

  get tituloFormularioMeta(): string {
    return this.metaEditandoId ? 'Editar meta' : 'Criar meta';
  }

  get rotuloValorMeta(): string {
    return this.metaEditandoId ? 'Valor total da meta' : 'Valor da meta';
  }

  get rotuloValorEconomia(): string {
    return this.economiaEditandoId ? 'Novo valor guardado' : 'Valor guardado';
  }

  get metasAtivas(): MetaEconomiaTela[] {
    return this.metasEconomia.filter((meta) => !this.metaEstaConcluida(meta));
  }

  get metasConcluidas(): MetaEconomiaTela[] {
    return this.metasEconomia.filter((meta) => this.metaEstaConcluida(meta));
  }

  get metasParaFormularioEconomia(): MetaEconomiaTela[] {
    const metas = [...this.metasAtivas];
    const metaSelecionada = this.metasEconomia.find((meta) => meta.id === this.metaEconomiaSelecionadaId);

    if (this.economiaEditandoId && metaSelecionada && !metas.some((meta) => meta.id === metaSelecionada.id)) {
      metas.push(metaSelecionada);
    }

    return metas;
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

  formatarValorAtualMetaEconomia(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.valorAtualMetaEconomia = this.formatarValorDigitado(input);
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
    const nome = this.nomeMetaEconomia.trim();

    if (!nome) {
      this.exibirMensagemEconomia('Informe o nome da meta.', true);
      return;
    }

    if (!this.valorMetaEconomia) {
      this.exibirMensagemEconomia('Informe o valor da meta.', true);
      return;
    }

    if (this.nomeMetaDuplicado(nome)) {
      this.exibirMensagemEconomia('Ja existe uma meta com esse nome.', true);
      return;
    }

    const valorMetaNumero = this.converterValorCampoParaNumero(this.valorMetaEconomia);
    const valorAtualNumero = this.converterValorCampoParaNumero(this.valorAtualMetaEconomia || '0,00');

    if (this.metaEditandoId && valorAtualNumero > valorMetaNumero) {
      this.exibirMensagemEconomia('O valor guardado não pode passar do valor delimitado na meta.', true);
      return;
    }

    this.criandoMetaEconomia = true;
    this.limparMensagemEconomia();
    const metasAntes = this.mapearPercentualDasMetas();

    const dados = {
      nome,
      valor_meta: this.valorMetaEconomia,
      ...(this.metaEditandoId ? { valor_atual: this.valorAtualMetaEconomia || '0,00' } : {}),
      data_limite: this.dataLimiteEconomia,
    };

    const requisicao = this.metaEditandoId
      ? this.authService.atualizarMetaEconomia(this.metaEditandoId, dados)
      : this.authService.criarMetaEconomia(dados);

    requisicao.subscribe({
      next: (resposta) => {
        this.criandoMetaEconomia = false;
        this.limparFormularioMeta();
        this.exibirMensagemEconomia(resposta.message || 'Meta salva com sucesso.', false);

        if (resposta.dashboard) {
          this.aplicarDashboardEconomias(resposta.dashboard);
          this.verificarMetasConcluidas(resposta.dashboard.metas ?? [], metasAntes);
          this.atualizarTela();
          return;
        }

        this.adicionarOuAtualizarMetaLocal(resposta.meta);
        this.metaEconomiaSelecionadaId = resposta.meta.id;
        this.atualizarResumoEconomiaLocal();
        this.verificarMetasConcluidas([resposta.meta], metasAntes);
        this.atualizarTela();
      },
      error: (erro) => {
        this.criandoMetaEconomia = false;
        this.exibirMensagemEconomia(erro.error?.message ?? 'Não foi possível salvar a meta.', true);
        this.atualizarTela();
      },
    });
  }

  editarMetaEconomia(meta: MetaEconomiaTela): void {
    this.metaEditandoId = meta.id;
    this.nomeMetaEconomia = meta.nome;
    this.valorMetaEconomia = this.formatarNumeroParaCampo(meta.valorMetaNumero);
    this.valorAtualMetaEconomia = this.formatarNumeroParaCampo(meta.valorAtualNumero);
    this.dataLimiteEconomia = meta.dataLimite ?? '';
    this.limparMensagemEconomia();
    this.metaParaExcluir = null;
    this.economiaParaExcluir = null;
    this.atualizarTela();
  }

  cancelarEdicaoMeta(): void {
    this.limparFormularioMeta();
    this.limparMensagemEconomia();
  }

  excluirMetaEconomia(meta: MetaEconomiaTela): void {
    this.metaParaExcluir = meta;
    this.limparMensagemEconomia();
    this.atualizarTela();
  }

  cancelarExclusaoMeta(): void {
    this.metaParaExcluir = null;
    this.atualizarTela();
  }

  confirmarExclusaoMeta(): void {
    const meta = this.metaParaExcluir;

    if (!meta) {
      return;
    }

    this.metaExcluindoId = meta.id;
    this.limparMensagemEconomia();

    this.authService.excluirMetaEconomia(meta.id).subscribe({
      next: (resposta) => {
        this.metaExcluindoId = null;
        this.metaParaExcluir = null;

        if (this.metaEditandoId === meta.id) {
          this.limparFormularioMeta();
        }

        if (this.metaEconomiaSelecionadaId === meta.id) {
          this.metaEconomiaSelecionadaId = null;
        }

        this.exibirMensagemEconomia(resposta.message || 'Meta excluída com sucesso.', false);

        if (resposta.dashboard) {
          this.aplicarDashboardEconomias(resposta.dashboard);
          this.atualizarTela();
          return;
        }

        this.removerMetaLocal(resposta.id ?? meta.id);
        this.atualizarTela();
      },
      error: (erro) => {
        this.metaExcluindoId = null;
        this.metaParaExcluir = null;
        this.exibirMensagemEconomia(erro.error?.message ?? 'Não foi possível excluir a meta.', true);
        this.atualizarTela();
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
    const metasAntes = this.mapearPercentualDasMetas();
    const valorEconomiaNumero = this.converterValorCampoParaNumero(this.valorEconomia);
    const metaDestino = this.metasEconomia.find((meta) => meta.id === this.metaEconomiaSelecionadaId);
    const economiaAtual = this.economiaEditandoId
      ? this.historicoEconomias.find((economia) => economia.id === this.economiaEditandoId) ?? null
      : null;
    const totalSemEconomiaAtual = metaDestino
      ? metaDestino.valorAtualNumero - (economiaAtual?.metaId === metaDestino.id ? economiaAtual.valorNumero : 0)
      : 0;

    if (metaDestino && totalSemEconomiaAtual + valorEconomiaNumero > metaDestino.valorMetaNumero) {
      this.carregandoEconomia = false;
      this.exibirMensagemEconomia('Não dá para guardar mais do que o valor delimitado na meta.', true);
      return;
    }

    const dados = {
      meta_id: this.metaEconomiaSelecionadaId,
      valor: this.valorEconomia,
      data_economia: this.dataEconomia,
      descricao: this.descricaoEconomia.trim(),
    };
    const economiaEditandoId = this.economiaEditandoId;
    const requisicao = economiaEditandoId
      ? this.authService.atualizarEconomia(economiaEditandoId, dados)
      : this.authService.guardarEconomia(dados);

    requisicao.subscribe({
        next: (resposta) => {
          this.carregandoEconomia = false;
          this.limparFormularioEconomia();
          this.exibirMensagemEconomia(resposta.message || 'Economia guardada com sucesso.', false);

          if (resposta.dashboard) {
            this.aplicarDashboardEconomias(resposta.dashboard);
            this.atualizarTela();
            return;
          }

          if (resposta.metas?.length) {
            resposta.metas.forEach((meta) => this.adicionarOuAtualizarMetaLocal(meta));
          }

          if (resposta.meta) {
            this.adicionarOuAtualizarMetaLocal(resposta.meta);
          }

          if (typeof resposta.total_economizado === 'number') {
            this.totalEconomizado = this.formatarReal(resposta.total_economizado);
          }

          this.atualizarResumoEconomiaLocal(resposta.economia.meta_id);
          this.atualizarMetaSelecionadaParaAtiva();
          this.atualizarHistoricoEconomiaLocal(this.formatarEconomiaTela(resposta.economia), Boolean(economiaEditandoId));
          this.verificarMetasConcluidas([...(resposta.metas ?? []), ...(resposta.meta ? [resposta.meta] : [])], metasAntes);
          this.atualizarTela();
        },
        error: (erro) => {
          this.carregandoEconomia = false;
          this.exibirMensagemEconomia(erro.error?.message ?? 'Não foi possível guardar a economia.', true);
          this.atualizarTela();
        },
      });
  }

  editarEconomia(economia: EconomiaTela): void {
    this.economiaEditandoId = economia.id;
    this.metaEconomiaSelecionadaId = economia.metaId;
    this.valorEconomia = this.formatarNumeroParaCampo(economia.valorNumero);
    this.dataEconomia = economia.dataValor;
    this.descricaoEconomia = economia.descricao ?? '';
    this.economiaPalavras = this.contarPalavras(this.descricaoEconomia);
    this.limparMensagemEconomia();
    this.atualizarTela();
    this.rolarParaFormularioEconomia();
  }

  excluirEconomia(economia: EconomiaTela): void {
    this.economiaParaExcluir = economia;
    this.limparMensagemEconomia();
    this.atualizarTela();
  }

  cancelarExclusaoEconomia(): void {
    this.economiaParaExcluir = null;
    this.atualizarTela();
  }

  alternarCafesConcluidos(): void {
    if (!this.metasConcluidas.length) {
      return;
    }

    this.mostrarCafesConcluidos = !this.mostrarCafesConcluidos;
    this.atualizarTela();
  }

  confirmarExclusaoEconomia(): void {
    const economia = this.economiaParaExcluir;

    if (!economia) {
      return;
    }

    this.economiaExcluindoId = economia.id;
    this.limparMensagemEconomia();

    this.authService.excluirEconomia(economia.id).subscribe({
      next: (resposta) => {
        this.economiaExcluindoId = null;
        this.economiaParaExcluir = null;

        if (this.economiaEditandoId === economia.id) {
          this.limparFormularioEconomia();
        }

        this.exibirMensagemEconomia(resposta.message || 'Registro excluído com sucesso.', false);

        if (resposta.dashboard) {
          this.aplicarDashboardEconomias(resposta.dashboard);
          this.atualizarTela();
          return;
        }

        this.historicoEconomias = this.historicoEconomias.filter((item) => item.id !== economia.id);
        this.atualizarResumoEconomiaLocal(economia.metaId);
        this.atualizarTela();
      },
      error: (erro) => {
        this.economiaExcluindoId = null;
        this.economiaParaExcluir = null;
        this.exibirMensagemEconomia(erro.error?.message ?? 'Não foi possível excluir o registro.', true);
        this.atualizarTela();
      },
    });
  }

  cancelarEdicaoEconomia(): void {
    this.limparFormularioEconomia();
    this.limparMensagemEconomia();
    this.atualizarTela();
  }

  fecharMensagemMetaConcluida(): void {
    this.metaConcluidaNome = '';
    this.atualizarTela();
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

        this.atualizarTela();
      },
      error: () => {
        this.nomeUsuario = this.obterNomeUsuario();
        this.atualizarTela();
      },
    });
  }

  private carregarEconomias(): void {
    this.carregandoResumoEconomias = true;

    this.authService.resumoEconomias().subscribe({
      next: (resposta) => {
        this.aplicarDashboardEconomias(resposta.dashboard);
        this.carregandoResumoEconomias = false;
        this.atualizarTela();
      },
      error: () => {
        this.aplicarMetaPrincipal(null);
        this.carregandoResumoEconomias = false;
        this.atualizarTela();
      },
    });
  }

  private atualizarTela(): void {
    this.cdr.detectChanges();
    this.agendarRenderizacaoGraficosXicaras();
  }

  private rolarParaFormularioEconomia(): void {
    setTimeout(() => {
      document.querySelector('.economy-form-panel')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  private aplicarDashboardEconomias(dashboard: EconomiaDashboard): void {
    this.totalEconomizado = this.formatarReal(dashboard.total_economizado);
    this.metasEconomia = (dashboard.metas ?? []).map((meta) => this.formatarMetaEconomiaTela(meta));
    this.historicoEconomias = (dashboard.historico_recente ?? []).map((economia) => this.formatarEconomiaTela(economia));

    if (!this.metasConcluidas.length) {
      this.mostrarCafesConcluidos = false;
    }

    const metasAtivas = this.metasEconomia.filter((meta) => !this.metaEstaConcluida(meta));
    const metaSelecionadaExiste = metasAtivas.some((meta) => meta.id === this.metaEconomiaSelecionadaId);

    if (!this.economiaEditandoId && !metaSelecionadaExiste) {
      this.metaEconomiaSelecionadaId = metasAtivas[0]?.id ?? null;
    }

    this.aplicarMetaPrincipal(dashboard.meta_principal ?? null);
  }

  private aplicarMetaPrincipal(meta: MetaEconomia | null): void {
    if (!meta) {
      this.textoResumoEconomia = 'Crie uma meta para acompanhar o progresso das suas economias.';
      this.agendarRenderizacaoGraficosXicaras();
      return;
    }

    this.textoResumoEconomia = `${this.formatarReal(meta.valor_atual)} guardados de ${this.formatarReal(meta.valor_meta)}.`;
    this.agendarRenderizacaoGraficosXicaras();
  }

  private exibirMensagemEconomia(mensagem: string, erro: boolean): void {
    this.mensagemEconomia = mensagem;
    this.economiaComErro = erro;
  }

  private limparMensagemEconomia(): void {
    this.mensagemEconomia = '';
    this.economiaComErro = false;
  }

  private limparFormularioMeta(): void {
    this.metaEditandoId = null;
    this.nomeMetaEconomia = '';
    this.valorMetaEconomia = '';
    this.valorAtualMetaEconomia = '';
    this.dataLimiteEconomia = '';
  }

  private limparFormularioEconomia(): void {
    this.economiaEditandoId = null;
    this.valorEconomia = '';
    this.dataEconomia = this.hoje;
    this.descricaoEconomia = '';
    this.economiaPalavras = 0;
  }

  private adicionarOuAtualizarMetaLocal(meta: MetaEconomia): void {
    const metaFormatada = this.formatarMetaEconomiaTela(meta);
    const indice = this.metasEconomia.findIndex((item) => item.id === meta.id);

    if (indice >= 0) {
      this.metasEconomia = this.metasEconomia.map((item) => (item.id === meta.id ? metaFormatada : item));
      return;
    }

    this.metasEconomia = [metaFormatada, ...this.metasEconomia];
  }

  private removerMetaLocal(metaId: number): void {
    this.metasEconomia = this.metasEconomia.filter((meta) => meta.id !== metaId);
    this.historicoEconomias = this.historicoEconomias.filter((economia) => economia.metaId !== metaId);

    if (this.metaEditandoId === metaId) {
      this.limparFormularioMeta();
    }

    if (this.metaEconomiaSelecionadaId === metaId) {
      this.metaEconomiaSelecionadaId = this.metasAtivas[0]?.id ?? null;
    }

    this.atualizarResumoEconomiaLocal();
  }

  private atualizarResumoEconomiaLocal(metaPrincipalId?: number | null): void {
    const total = this.metasEconomia.reduce((soma, meta) => soma + meta.valorAtualNumero, 0);
    this.totalEconomizado = this.formatarReal(total);

    const metaPrincipal = this.metasEconomia.find((meta) => meta.id === metaPrincipalId) ?? this.metasEconomia[0] ?? null;
    this.aplicarMetaPrincipalTela(metaPrincipal);
  }

  private atualizarMetaSelecionadaParaAtiva(): void {
    if (this.economiaEditandoId) {
      return;
    }

    const metaSelecionadaAtiva = this.metasAtivas.some((meta) => meta.id === this.metaEconomiaSelecionadaId);

    if (!metaSelecionadaAtiva) {
      this.metaEconomiaSelecionadaId = this.metasAtivas[0]?.id ?? null;
    }
  }

  private atualizarHistoricoEconomiaLocal(economia: EconomiaTela, editando: boolean): void {
    const historicoSemAtual = this.historicoEconomias.filter((item) => item.id !== economia.id);
    const historicoAtualizado = editando ? [economia, ...historicoSemAtual] : [economia, ...historicoSemAtual];

    this.historicoEconomias = historicoAtualizado
      .sort((a, b) => b.dataValor.localeCompare(a.dataValor) || b.id - a.id)
      .slice(0, 5);
  }

  private aplicarMetaPrincipalTela(meta: MetaEconomiaTela | null): void {
    if (!meta) {
      this.aplicarMetaPrincipal(null);
      return;
    }

    this.textoResumoEconomia = `${meta.valorAtual} guardados de ${meta.valorMeta}.`;
    this.agendarRenderizacaoGraficosXicaras();
  }

  private agendarRenderizacaoGraficosXicaras(): void {
    if (!this.viewPronta || this.renderizacaoGraficosAgendada) {
      return;
    }

    this.renderizacaoGraficosAgendada = true;
    const agendar = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (callback: FrameRequestCallback) => window.setTimeout(callback, 0);

    agendar(() => {
      this.renderizacaoGraficosAgendada = false;
      this.renderizarGraficosXicaras();
    });
  }

  private renderizarGraficosXicaras(): void {
    const metasRenderizadas = new Set<number>();

    this.goalCupCanvases?.forEach((canvasRef) => {
      const canvas = canvasRef.nativeElement;
      const metaId = Number(canvas.dataset['metaId']);
      const percentual = Number(canvas.dataset['progress'] ?? 0);

      if (!metaId) {
        return;
      }

      metasRenderizadas.add(metaId);
      const graficoAtual = this.graficosXicarasMetas.get(metaId);
      const graficoAtualizado = this.criarOuAtualizarGraficoXicara(canvas, percentual, graficoAtual);
      this.graficosXicarasMetas.set(metaId, graficoAtualizado);
    });

    this.graficosXicarasMetas.forEach((grafico, metaId) => {
      if (!metasRenderizadas.has(metaId)) {
        grafico.destroy();
        this.graficosXicarasMetas.delete(metaId);
      }
    });
  }

  private criarOuAtualizarGraficoXicara(canvas: HTMLCanvasElement, percentual: number, grafico?: Chart<'bar'>): Chart<'bar'> {
    const progresso = Math.max(0, Math.min(100, percentual));
    const preenchimento = this.criarGradienteCafe(canvas, progresso);

    if (grafico) {
      grafico.data.datasets[0].data = [progresso];
      grafico.data.datasets[0].backgroundColor = preenchimento;
      grafico.update();
      return grafico;
    }

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: [''],
        datasets: [
          {
            data: [progresso],
            backgroundColor: preenchimento,
            borderWidth: 0,
            borderSkipped: false,
            borderRadius: {
              topLeft: 12,
              topRight: 12,
              bottomLeft: 0,
              bottomRight: 0,
            },
            barPercentage: 1,
            categoryPercentage: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 450,
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            enabled: false,
          },
        },
        scales: {
          x: {
            display: false,
            grid: {
              display: false,
            },
          },
          y: {
            display: false,
            min: 0,
            max: 100,
            grid: {
              display: false,
            },
          },
        },
      },
    };

    return new Chart(canvas, config);
  }

  private criarGradienteCafe(canvas: HTMLCanvasElement, percentual: number): CanvasGradient | string {
    const contexto = canvas.getContext('2d');

    if (!contexto) {
      return '#8c4c22';
    }

    const altura = canvas.height || canvas.clientHeight || 80;
    const gradiente = contexto.createLinearGradient(0, altura, 0, 0);
    gradiente.addColorStop(0, '#5b260f');
    gradiente.addColorStop(0.55, percentual >= 75 ? '#9d5422' : '#7b3a18');
    gradiente.addColorStop(1, percentual >= 75 ? '#d18a36' : '#b46425');

    return gradiente;
  }

  private mapearPercentualDasMetas(): Map<number, number> {
    return new Map(this.metasEconomia.map((meta) => [meta.id, meta.percentual]));
  }

  private verificarMetasConcluidas(metas: MetaEconomia[], metasAntes: Map<number, number>): void {
    const metaConcluida = metas.find((meta) => {
      const percentualAnterior = metasAntes.get(meta.id) ?? 0;

      return percentualAnterior < 100 && meta.percentual >= 100;
    });

    if (metaConcluida) {
      this.metaConcluidaNome = metaConcluida.nome;
    }
  }

  private nomeMetaDuplicado(nome: string): boolean {
    const nomeNormalizado = this.normalizarNomeMeta(nome);

    return this.metasEconomia.some((meta) => {
      return meta.id !== this.metaEditandoId && this.normalizarNomeMeta(meta.nome) === nomeNormalizado;
    });
  }

  private normalizarNomeMeta(nome: string): string {
    return nome.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
  }

  private metaEstaConcluida(meta: MetaEconomiaTela): boolean {
    return meta.status === 'concluida' || meta.percentual >= 100;
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

  private converterValorCampoParaNumero(valor: string): number {
    const normalizado = valor.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');

    return Number(normalizado || '0');
  }

  private formatarNumeroParaCampo(valor: number): string {
    return valor.toLocaleString('pt-BR', {
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
    const percentual = this.normalizarPercentual(meta.percentual);

    return {
      id: meta.id,
      nome: meta.nome,
      valorMetaNumero: meta.valor_meta,
      valorAtualNumero: meta.valor_atual,
      valorMeta: this.formatarReal(meta.valor_meta),
      valorAtual: this.formatarReal(meta.valor_atual),
      percentual,
      percentualTexto: this.formatarPercentual(percentual),
      dataLimite: meta.data_limite,
      status: meta.status,
    };
  }

  private normalizarPercentual(percentual: number): number {
    return Math.max(0, Math.min(100, Number(percentual.toFixed(1))));
  }

  private formatarPercentual(percentual: number): string {
    return percentual.toLocaleString('pt-BR', {
      minimumFractionDigits: Number.isInteger(percentual) ? 0 : 1,
      maximumFractionDigits: 1,
    });
  }

  private formatarEconomiaTela(economia: EconomiaItem): EconomiaTela {
    return {
      id: economia.id,
      metaId: economia.meta_id,
      metaNome: economia.meta_nome,
      valorNumero: economia.valor,
      valor: this.formatarReal(economia.valor),
      dataValor: economia.data_economia,
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
