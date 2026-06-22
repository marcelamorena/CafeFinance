import { NgFor, NgIf } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import Chart from 'chart.js/auto';
import type { ChartConfiguration } from 'chart.js';
import { Subscription } from 'rxjs';

import { AuthService, MetaEconomia, MovimentacaoItem } from '../../services/auth.service';

type TipoMovimentacao = 'saida' | 'entrada';

interface CategoriaOpcao {
  nome: string;
  icone: string;
  label?: string;
  acao?: 'expandir' | 'recolher';
}

interface RegistroRecente {
  id: number;
  icone: string;
  titulo: string;
  categoria: string;
  categoriaLabel: string;
  valor: string;
  valorNumero: number;
  data: string;
  dataMovimentacao: string;
  descricao?: string | null;
  tipo: TipoMovimentacao;
  tipoLabel: string;
  parcela?: string;
  parcelamentoId?: number | null;
  parcelaNumero?: number | null;
  totalParcelas?: number | null;
}

interface GastoCategoria {
  nome: string;
  percentual: number;
  valor: string;
  valorNumero: number;
}

interface DiaDashboard {
  dia: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

interface GrupoTransacoesMes {
  chave: string;
  mes: string;
  totalEntradas: string;
  totalSaidas: string;
  saldo: string;
  faturaParcelada: string;
  totalEntradasNumero: number;
  totalSaidasNumero: number;
  saldoNumero: number;
  faturaParceladaNumero: number;
  saldoNegativo: boolean;
  gastosPorCategoria: GastoCategoria[];
  dias: DiaDashboard[];
  transacoes: RegistroRecente[];
}

@Component({
  selector: 'app-home',
  imports: [NgFor, NgIf, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit, AfterViewInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private graficoFluxoMensal?: Chart<'bar'>;
  private graficoCategoriaMensal?: Chart<'doughnut'>;
  private graficoEvolucaoMensal?: Chart<'line'>;
  private graficoFaturaParcelada?: Chart<'bar'>;
  private navegacaoSubscription?: Subscription;
  private viewCarregada = false;

  @ViewChild('fluxoMensalCanvas') private fluxoMensalCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoriaMensalCanvas') private categoriaMensalCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('evolucaoMensalCanvas') private evolucaoMensalCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('faturaParceladaCanvas') private faturaParceladaCanvas?: ElementRef<HTMLCanvasElement>;

  hoje = this.formatarData(new Date());
  readonly limitePalavrasDescricao = 12;
  dataRegistro = this.hoje;
  valorRegistro = '';
  descricaoRegistro = '';
  descricaoPalavras = 0;
  compraParcelada = false;
  quantidadeParcelas = 2;
  registroEditandoId: number | null = null;
  registroEditandoParcela = '';
  registroEditandoParcelamento = false;
  deletandoRegistroId: number | null = null;
  registroParaExcluir: RegistroRecente | null = null;
  mensagemRegistro = '';
  mensagemTransacoes = '';
  registroComErro = false;
  carregandoRegistro = false;
  carregandoTransacoes = false;
  resumoCarregado = false;
  mostrandoTransacoes = false;
  mesAberto: string | null = null;
  mesDashboardSelecionado: string | null = null;
  nomeUsuario = this.obterNomeUsuario();
  tipoMovimentacao: TipoMovimentacao = 'entrada';
  categoriaSelecionada = 'Salario';
  mostrarCategoriasExtrasSaida = false;
  saldoTotal = 'R$ 0,00';
  totalEntradas = 'R$ 0,00';
  totalSaidas = 'R$ 0,00';
  saldoTotalNumero = 0;
  totalEntradasNumero = 0;
  totalSaidasNumero = 0;
  saldoNegativo = false;
  progressoEconomia = 0;
  textoMetaXicara = 'Sem meta';
  textoResumoEconomia = 'Crie uma meta de economia para acompanhar seu progresso na xicara.';

  registrosRecentes: RegistroRecente[] = [];
  gastosPorCategoria: GastoCategoria[] = [];
  transacoesPorMes: GrupoTransacoesMes[] = [];

  categoriasSaida: CategoriaOpcao[] = [
    { nome: 'Mercado', icone: '&#128722;' },
    { nome: 'Alimentacao', label: 'Alimentação', icone: '&#127860;' },
    { nome: 'Transporte', icone: '&#128652;' },
    { nome: 'Aluguel', icone: '&#127968;' },
    { nome: 'Contas', icone: '&#128161;' },
    { nome: 'Saude', label: 'Saúde', icone: '&#128138;' },
    { nome: 'Lazer', icone: '&#127918;' },
    { nome: 'Mais', icone: '+', acao: 'expandir' },
  ];

  categoriasExtrasSaida: CategoriaOpcao[] = [
    { nome: 'Educacao', label: 'Educação', icone: '&#127891;' },
    { nome: 'Assinaturas', icone: '&#128240;' },
    { nome: 'Investimentos', icone: '&#128201;' },
    { nome: 'Economia', icone: '&#128176;' },
    { nome: 'Imprevistos', icone: '&#9888;' },
    { nome: 'Outro', icone: '...' },
    { nome: 'Menos', icone: '-', acao: 'recolher' },
  ];

  categoriasEntrada: CategoriaOpcao[] = [
    { nome: 'Salario', label: 'Salário', icone: '&#128188;' },
    { nome: 'Freelance', icone: '&#128187;' },
    { nome: 'Pix', icone: '&#128179;' },
    { nome: 'Reembolso', icone: '&#128260;' },
    { nome: 'Rendimento', icone: '&#128200;' },
    { nome: 'Presente', icone: '&#127873;' },
    { nome: 'Venda', icone: '&#128176;' },
    { nome: 'Outro', icone: '...' },
  ];

  ngOnInit(): void {
    this.carregarPerfil();
    this.carregarEconomias();
    this.carregarDadosDaRota();

    this.navegacaoSubscription = this.router.events.subscribe((evento) => {
      if (evento instanceof NavigationEnd) {
        this.carregarDadosDaRota();
      }
    });
  }

  ngAfterViewInit(): void {
    this.viewCarregada = true;
    this.agendarRenderizacaoGraficos();
  }

  ngOnDestroy(): void {
    this.navegacaoSubscription?.unsubscribe();
    this.destruirGraficosDashboard();
  }

  get paginaMovimentacoes(): boolean {
    return this.router.url.includes('/movimentacoes');
  }

  get paginaPerfil(): boolean {
    return this.router.url.includes('/perfil');
  }

  get paginaDashboard(): boolean {
    return !this.paginaMovimentacoes && !this.paginaPerfil;
  }

  get mesDashboardAtual(): GrupoTransacoesMes | null {
    const meses = this.mesesDashboard;

    return meses.find((grupo) => grupo.chave === this.mesDashboardSelecionado) ?? meses[0] ?? null;
  }

  get mesesDashboard(): GrupoTransacoesMes[] {
    const chaveAtual = this.chaveMesAtual();
    const meses = this.transacoesPorMes.slice();

    if (!meses.some((grupo) => grupo.chave === chaveAtual)) {
      meses.push(this.criarGrupoMesVazio(chaveAtual));
    }

    return meses.sort((grupoA, grupoB) => grupoB.chave.localeCompare(grupoA.chave));
  }

  get mesesComFaturaParcelada(): GrupoTransacoesMes[] {
    return this.transacoesPorMes
      .filter((grupo) => grupo.faturaParceladaNumero > 0)
      .slice()
      .sort((grupoA, grupoB) => grupoA.chave.localeCompare(grupoB.chave));
  }

  get percentualEntradas(): number {
    return this.calcularPercentualComparativo(this.totalEntradasNumero);
  }

  get percentualSaidas(): number {
    return this.calcularPercentualComparativo(this.totalSaidasNumero);
  }

  get maiorFluxoFinanceiro(): number {
    return Math.max(this.totalEntradasNumero, this.totalSaidasNumero, 1);
  }

  get categoriasAtuais(): CategoriaOpcao[] {
    if (this.tipoMovimentacao === 'entrada') {
      return this.categoriasEntrada;
    }

    return this.categoriasSaidaVisiveis;
  }

  get categoriasSaidaVisiveis(): CategoriaOpcao[] {
    return this.mostrarCategoriasExtrasSaida
      ? [...this.categoriasSaida.filter((categoria) => categoria.acao !== 'expandir'), ...this.categoriasExtrasSaida]
      : this.categoriasSaida;
  }

  get textoBotaoSalvar(): string {
    if (this.carregandoRegistro) {
      return 'Salvando...';
    }

    if (this.registroEditandoId) {
      return 'Salvar edição';
    }

    return this.tipoMovimentacao === 'saida' ? 'Salvar saída' : 'Salvar entrada';
  }

  get dicaRegistro(): string {
    if (this.registroEditandoParcelamento) {
      return 'Edite o valor total e a quantidade; as parcelas serão recalculadas automaticamente.';
    }

    if (this.tipoMovimentacao === 'saida' && this.compraParcelada) {
      return 'A compra será dividida automaticamente nos próximos meses.';
    }

    return this.tipoMovimentacao === 'saida'
      ? 'Anote este gasto para acompanhar melhor seu saldo.'
      : 'Anote o dinheiro recebido para atualizar suas entradas.';
  }

  get valorParcelaEstimado(): string {
    if ((!this.compraParcelada && !this.registroEditandoParcelamento) || !this.valorRegistro) {
      return '';
    }

    const valorTotal = this.valorRegistroParaNumero(this.valorRegistro);

    if (valorTotal <= 0) {
      return '';
    }

    return this.formatarReal(valorTotal / this.quantidadeParcelas);
  }

  selecionarTipo(tipo: TipoMovimentacao): void {
    if (this.registroEditandoParcelamento && tipo === 'entrada') {
      this.exibirMensagemRegistro('Parcelas continuam como saída. Edite valor, data, categoria ou descrição.', true);
      return;
    }

    this.tipoMovimentacao = tipo;
    this.mostrarCategoriasExtrasSaida = false;
    this.categoriaSelecionada = this.categoriasAtuais[0].nome;

    if (tipo === 'entrada') {
      this.compraParcelada = false;
      this.quantidadeParcelas = 2;
    }

    this.limparMensagemRegistro();
  }

  selecionarCategoria(categoria: CategoriaOpcao): void {
    if (categoria.acao === 'expandir') {
      this.mostrarCategoriasExtrasSaida = true;
      this.limparMensagemRegistro();
      return;
    }

    if (categoria.acao === 'recolher') {
      this.mostrarCategoriasExtrasSaida = false;

      if (!this.categoriasSaida.some((item) => item.nome === this.categoriaSelecionada)) {
        this.categoriaSelecionada = this.categoriasSaida[0].nome;
      }

      this.limparMensagemRegistro();
      return;
    }

    this.categoriaSelecionada = categoria.nome;
    this.limparMensagemRegistro();
  }

  formatarValor(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digitos = input.value.replace(/\D/g, '');

    if (!digitos) {
      this.valorRegistro = '';
      input.value = '';
      return;
    }

    this.valorRegistro = this.formatarMoeda(digitos);
    input.value = this.valorRegistro;
    this.limparMensagemRegistro();
  }

  atualizarDataRegistro(event: Event): void {
    this.dataRegistro = (event.target as HTMLInputElement).value;
    this.limparMensagemRegistro();
  }

  atualizarDescricaoRegistro(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    const descricaoLimitada = this.limitarPalavras(textarea.value, this.limitePalavrasDescricao);

    this.descricaoRegistro = descricaoLimitada;
    this.descricaoPalavras = this.contarPalavras(descricaoLimitada);
    textarea.value = descricaoLimitada;
  }

  atualizarCompraParcelada(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.compraParcelada = this.tipoMovimentacao === 'saida' && input.checked;
    this.limparMensagemRegistro();
  }

  atualizarQuantidadeParcelas(event: Event): void {
    const input = event.target as HTMLInputElement;
    const quantidade = Math.min(60, Math.max(2, Number(input.value) || 2));

    this.quantidadeParcelas = quantidade;
    input.value = String(quantidade);
    this.limparMensagemRegistro();
  }

  editarRegistro(registro: RegistroRecente): void {
    this.registroEditandoId = registro.id;
    this.registroEditandoParcela = registro.parcela ?? '';
    this.registroEditandoParcelamento = Boolean(registro.parcelamentoId);
    this.tipoMovimentacao = registro.tipo;
    this.mostrarCategoriasExtrasSaida = false;
    this.categoriaSelecionada = registro.categoria;
    this.quantidadeParcelas = registro.totalParcelas ?? 2;
    this.valorRegistro = this.formatarMoeda(
      String(Math.round(registro.valorNumero * (this.registroEditandoParcelamento ? this.quantidadeParcelas : 1) * 100)),
    );
    this.dataRegistro = this.registroEditandoParcelamento
      ? this.calcularDataPrimeiraParcela(registro.dataMovimentacao, registro.parcelaNumero ?? 1)
      : registro.dataMovimentacao;
    this.descricaoRegistro = registro.descricao ?? '';
    this.descricaoPalavras = this.contarPalavras(this.descricaoRegistro);
    this.compraParcelada = this.registroEditandoParcelamento;
    this.limparMensagemRegistro();
    document.getElementById('novo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  cancelarEdicao(limparMensagem = true): void {
    this.registroEditandoId = null;
    this.registroEditandoParcela = '';
    this.registroEditandoParcelamento = false;
    this.valorRegistro = '';
    this.descricaoRegistro = '';
    this.descricaoPalavras = 0;
    this.dataRegistro = this.hoje;
    this.compraParcelada = false;
    this.quantidadeParcelas = 2;
    this.tipoMovimentacao = 'entrada';
    this.categoriaSelecionada = this.categoriasEntrada[0].nome;
    if (limparMensagem) {
      this.limparMensagemRegistro();
    }
  }

  alternarTransacoes(): void {
    this.mostrandoTransacoes = !this.mostrandoTransacoes;

    if (!this.mostrandoTransacoes) {
      this.mesAberto = null;
    }

    if (this.mostrandoTransacoes && this.transacoesPorMes.length === 0) {
      this.carregarTransacoes();
    }
  }

  alternarMesTransacoes(chave: string): void {
    this.mesAberto = this.mesAberto === chave ? null : chave;
  }

  selecionarMesDashboard(chave: string): void {
    this.mesDashboardSelecionado = chave;
    this.atualizarTela();
    this.agendarRenderizacaoGraficos();
  }

  salvarRegistro(): void {
    if (!this.valorRegistro) {
      this.exibirMensagemRegistro('Informe um valor maior que zero.', true);
      return;
    }

    if (!this.dataRegistro) {
      this.exibirMensagemRegistro('Informe a data do registro.', true);
      return;
    }

    this.carregandoRegistro = true;
    this.limparMensagemRegistro();

    if (this.registroEditandoId) {
      this.authService
        .atualizarMovimentacao(this.registroEditandoId, {
          tipo: this.tipoMovimentacao,
          valor: this.valorRegistro,
          data_movimentacao: this.dataRegistro,
          categoria: this.categoriaSelecionada,
          descricao: this.descricaoRegistro.trim(),
          parcelado: this.registroEditandoParcelamento,
          quantidade_parcelas: this.registroEditandoParcelamento ? this.quantidadeParcelas : undefined,
        })
        .subscribe({
          next: (resposta) => {
            this.carregandoRegistro = false;
            this.exibirMensagemRegistro(resposta.message || 'Registro atualizado com sucesso.', false);
            this.cancelarEdicao(false);
            this.carregarResumo();
            if (this.mostrandoTransacoes || this.paginaDashboard) {
              this.carregarTransacoes();
            }
            this.atualizarTela();
          },
          error: (erro) => {
            this.carregandoRegistro = false;
            this.exibirMensagemRegistro(erro.error?.message ?? 'Não foi possível atualizar o registro.', true);
            this.atualizarTela();
          },
        });
      return;
    }

    this.authService
      .salvarMovimentacao({
        tipo: this.tipoMovimentacao,
        valor: this.valorRegistro,
        data_movimentacao: this.dataRegistro,
        categoria: this.categoriaSelecionada,
        descricao: this.descricaoRegistro.trim(),
        parcelado: this.tipoMovimentacao === 'saida' && this.compraParcelada,
        quantidade_parcelas: this.compraParcelada ? this.quantidadeParcelas : undefined,
      })
      .subscribe({
        next: (resposta) => {
          this.carregandoRegistro = false;
          this.exibirMensagemRegistro(resposta.message || 'Registro salvo com sucesso.', false);
          this.valorRegistro = '';
          this.descricaoRegistro = '';
          this.descricaoPalavras = 0;
          this.compraParcelada = false;
          this.quantidadeParcelas = 2;
          this.dataRegistro = this.hoje;
          this.atualizarTela();
          this.carregarResumo();
          if (this.mostrandoTransacoes || this.paginaDashboard) {
            this.carregarTransacoes();
          }
        },
        error: (erro) => {
          this.carregandoRegistro = false;
          this.exibirMensagemRegistro(erro.error?.message ?? 'Não foi possível salvar o registro.', true);
          this.atualizarTela();
        },
      });
  }

  solicitarExclusao(registro: RegistroRecente): void {
    this.registroParaExcluir = registro;
    this.limparMensagemRegistro();
  }

  cancelarExclusao(): void {
    if (this.deletandoRegistroId) {
      return;
    }

    this.registroParaExcluir = null;
  }

  confirmarExclusao(): void {
    const registro = this.registroParaExcluir;

    if (!registro) {
      return;
    }

    this.deletandoRegistroId = registro.id;
    this.limparMensagemRegistro();

    this.authService.excluirMovimentacao(registro.id).subscribe({
      next: (resposta) => {
        this.deletandoRegistroId = null;
        this.registroParaExcluir = null;

        if (this.registroEditandoId === registro.id || registro.parcelamentoId) {
          this.cancelarEdicao(false);
        }

        this.exibirMensagemRegistro(resposta.message || 'Registro excluído com sucesso.', false);
        this.carregarResumo();

        if (this.mostrandoTransacoes || this.paginaDashboard) {
          this.carregarTransacoes();
        }

        this.atualizarTela();
      },
      error: (erro) => {
        this.deletandoRegistroId = null;
        this.exibirMensagemRegistro(erro.error?.message ?? 'Não foi possível excluir o registro.', true);
        this.atualizarTela();
      },
    });
  }

  sair(): void {
    this.authService.logout().subscribe({
      next: () => this.finalizarSessao(),
      error: () => this.finalizarSessao(),
    });
  }

  private carregarDadosDaRota(): void {
    this.carregarResumo();

    if (this.paginaMovimentacoes || this.paginaDashboard) {
      this.mostrandoTransacoes = true;

      if (this.paginaDashboard) {
        this.mesDashboardSelecionado = this.chaveMesAtual();
      }

      this.carregarTransacoes();
      return;
    }

    this.mostrandoTransacoes = false;
    this.destruirGraficosDashboard();
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

  private carregarResumo(): void {
    this.authService.resumoMovimentacoes().subscribe({
      next: (resposta) => {
        const dashboard = resposta.dashboard;
        this.saldoTotalNumero = dashboard.saldo;
        this.totalEntradasNumero = dashboard.total_entradas;
        this.totalSaidasNumero = dashboard.total_saidas;
        this.saldoTotal = this.formatarReal(dashboard.saldo);
        this.totalEntradas = this.formatarReal(dashboard.total_entradas);
        this.totalSaidas = this.formatarReal(dashboard.total_saidas);
        this.saldoNegativo = dashboard.saldo < 0;
        this.registrosRecentes = dashboard.registros_recentes.slice(0, 4).map((registro) => this.formatarRegistroTela(registro));
        this.gastosPorCategoria = dashboard.gastos_por_categoria.map((gasto) => ({
          nome: gasto.nome,
          percentual: gasto.percentual,
          valor: this.formatarReal(gasto.total),
          valorNumero: gasto.total,
        }));
        this.resumoCarregado = true;
        this.atualizarTela();
      },
      error: () => {
        this.resumoCarregado = true;
        this.atualizarTela();
      },
    });
  }

  private carregarEconomias(): void {
    this.authService.resumoEconomias().subscribe({
      next: (resposta) => {
        this.aplicarMetaPrincipal(resposta.dashboard.meta_principal ?? null);
        this.atualizarTela();
      },
      error: () => {
        this.aplicarMetaPrincipal(null);
        this.atualizarTela();
      },
    });
  }

  private carregarTransacoes(): void {
    this.carregandoTransacoes = true;
    this.mensagemTransacoes = '';

    this.authService.listarMovimentacoes().subscribe({
      next: (resposta) => {
        this.transacoesPorMes = this.agruparTransacoesPorMes(resposta.movimentacoes);
        this.ajustarMesDashboardSelecionado();
        this.mesAberto = null;
        this.carregandoTransacoes = false;
        this.atualizarTela();
        this.agendarRenderizacaoGraficos();
      },
      error: () => {
        this.carregandoTransacoes = false;
        this.mensagemTransacoes = 'Não foi possível carregar todas as transações.';
        this.atualizarTela();
        this.destruirGraficosDashboard();
      },
    });
  }

  private ajustarMesDashboardSelecionado(): void {
    if (this.paginaDashboard) {
      const mesExisteNoDashboard = this.mesesDashboard.some((grupo) => grupo.chave === this.mesDashboardSelecionado);

      if (!this.mesDashboardSelecionado || !mesExisteNoDashboard) {
        this.mesDashboardSelecionado = this.chaveMesAtual();
      }

      return;
    }

    if (!this.transacoesPorMes.length) {
      this.mesDashboardSelecionado = null;
      return;
    }

    const mesAindaExiste = this.transacoesPorMes.some((grupo) => grupo.chave === this.mesDashboardSelecionado);
    if (!mesAindaExiste) {
      this.mesDashboardSelecionado = this.transacoesPorMes[0].chave;
    }
  }

  private agendarRenderizacaoGraficos(): void {
    if (!this.paginaDashboard) {
      this.destruirGraficosDashboard();
      return;
    }

    window.setTimeout(() => this.renderizarGraficosDashboard(), 0);
  }

  private renderizarGraficosDashboard(): void {
    if (!this.viewCarregada || !this.paginaDashboard) {
      return;
    }

    const grupo = this.mesDashboardAtual;
    if (!grupo) {
      this.destruirGraficosDashboard();
      return;
    }

    this.renderizarGraficoFluxoMensal(grupo);
    this.renderizarGraficoCategoriaMensal(grupo);
    this.renderizarGraficoEvolucaoMensal(grupo);
    this.renderizarGraficoFaturaParcelada();
  }

  private renderizarGraficoFluxoMensal(grupo: GrupoTransacoesMes): void {
    const canvas = this.fluxoMensalCanvas?.nativeElement;
    if (!canvas) {
      return;
    }

    this.graficoFluxoMensal?.destroy();
    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: ['Entradas', 'Saídas'],
        datasets: [
          {
            label: grupo.mes,
            data: [grupo.totalEntradasNumero, grupo.totalSaidasNumero],
            backgroundColor: ['#6e3517', '#a13d2b'],
            borderColor: ['#3a190a', '#7e3418'],
            borderRadius: 12,
            borderWidth: 1,
          },
        ],
      },
      options: this.opcoesGraficoMonetario<'bar'>(false),
    };

    this.graficoFluxoMensal = new Chart(canvas, config);
  }

  private renderizarGraficoCategoriaMensal(grupo: GrupoTransacoesMes): void {
    const canvas = this.categoriaMensalCanvas?.nativeElement;
    if (!canvas || !grupo.gastosPorCategoria.length) {
      this.graficoCategoriaMensal?.destroy();
      this.graficoCategoriaMensal = undefined;
      return;
    }

    this.graficoCategoriaMensal?.destroy();
    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: grupo.gastosPorCategoria.map((categoria) => categoria.nome),
        datasets: [
          {
            data: grupo.gastosPorCategoria.map((categoria) => categoria.valorNumero),
            backgroundColor: ['#6e3517', '#a96c3f', '#d5b98c', '#a13d2b', '#3a190a', '#c97b52', '#ead4b2'],
            borderColor: '#fff8ea',
            borderWidth: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#2a1208',
              font: { weight: 'bold' },
            },
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.label}: ${this.formatarReal(Number(context.raw ?? 0))}`,
            },
          },
        },
      },
    };

    this.graficoCategoriaMensal = new Chart(canvas, config);
  }

  private renderizarGraficoEvolucaoMensal(grupo: GrupoTransacoesMes): void {
    const canvas = this.evolucaoMensalCanvas?.nativeElement;
    if (!canvas) {
      return;
    }

    this.graficoEvolucaoMensal?.destroy();
    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: grupo.dias.map((dia) => dia.dia),
        datasets: [
          {
            label: 'Entradas',
            data: grupo.dias.map((dia) => dia.entradas),
            borderColor: '#6e3517',
            backgroundColor: '#6e351733',
            tension: 0.35,
          },
          {
            label: 'Saídas',
            data: grupo.dias.map((dia) => dia.saidas),
            borderColor: '#a13d2b',
            backgroundColor: '#a13d2b33',
            tension: 0.35,
          },
          {
            label: 'Saldo acumulado',
            data: grupo.dias.map((dia) => dia.saldo),
            borderColor: '#2a1208',
            backgroundColor: '#2a120833',
            tension: 0.35,
          },
        ],
      },
      options: this.opcoesGraficoMonetario<'line'>(true),
    };

    this.graficoEvolucaoMensal = new Chart(canvas, config);
  }

  private renderizarGraficoFaturaParcelada(): void {
    const canvas = this.faturaParceladaCanvas?.nativeElement;
    const meses = this.mesesComFaturaParcelada;

    if (!canvas || !meses.length) {
      this.graficoFaturaParcelada?.destroy();
      this.graficoFaturaParcelada = undefined;
      return;
    }

    this.graficoFaturaParcelada?.destroy();
    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: meses.map((grupo) => grupo.mes),
        datasets: [
          {
            label: 'Fatura parcelada',
            data: meses.map((grupo) => grupo.faturaParceladaNumero),
            backgroundColor: '#7c3717',
            borderColor: '#3a190a',
            borderRadius: 12,
            borderWidth: 1,
          },
        ],
      },
      options: this.opcoesGraficoMonetario<'bar'>(false),
    };

    this.graficoFaturaParcelada = new Chart(canvas, config);
  }

  private opcoesGraficoMonetario<T extends 'bar' | 'line'>(mostrarLegenda: boolean): ChartConfiguration<T>['options'] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: mostrarLegenda,
          position: 'bottom',
          labels: {
            color: '#2a1208',
            font: { weight: 'bold' },
          },
        },
        tooltip: {
          callbacks: {
            label: (context: { dataset: { label?: string }; raw: unknown }) => {
              const label = 'label' in context.dataset ? String(context.dataset.label ?? '') : '';
              return `${label}: ${this.formatarReal(Number(context.raw ?? 0))}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#ead4b280' },
          ticks: { color: '#2a1208', font: { weight: 'bold' } },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#ead4b280' },
          ticks: {
            color: '#2a1208',
            callback: (valor: string | number) => this.formatarReal(Number(valor)),
          },
        },
      },
    } as unknown as ChartConfiguration<T>['options'];
  }

  private destruirGraficosDashboard(): void {
    this.graficoFluxoMensal?.destroy();
    this.graficoCategoriaMensal?.destroy();
    this.graficoEvolucaoMensal?.destroy();
    this.graficoFaturaParcelada?.destroy();
    this.graficoFluxoMensal = undefined;
    this.graficoCategoriaMensal = undefined;
    this.graficoEvolucaoMensal = undefined;
    this.graficoFaturaParcelada = undefined;
  }

  private atualizarTela(): void {
    this.changeDetectorRef.detectChanges();
  }

  private exibirMensagemRegistro(mensagem: string, erro: boolean): void {
    this.mensagemRegistro = mensagem;
    this.registroComErro = erro;
  }

  private limparMensagemRegistro(): void {
    this.mensagemRegistro = '';
    this.registroComErro = false;
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

  private finalizarSessao(): void {
    localStorage.removeItem('cafefinance_usuario');
    this.router.navigate(['/']);
  }

  private formatarData(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');

    return `${ano}-${mes}-${dia}`;
  }

  private calcularDataPrimeiraParcela(dataParcela: string, parcelaNumero: number): string {
    const [ano, mes, dia] = dataParcela.split('-').map(Number);
    const data = new Date(ano, mes - parcelaNumero, dia);

    if (data.getDate() !== dia) {
      data.setDate(0);
    }

    return this.formatarData(data);
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

  private calcularPercentualComparativo(valor: number): number {
    return Math.max(0, Math.min(100, Math.round((valor / this.maiorFluxoFinanceiro) * 100)));
  }

  private valorRegistroParaNumero(valor: string): number {
    const normalizado = valor.replace(/\./g, '').replace(',', '.');

    return Number(normalizado) || 0;
  }

  private formatarRegistroTela(registro: MovimentacaoItem): RegistroRecente {
    const entrada = registro.tipo === 'entrada';

    return {
      id: registro.id,
      icone: this.obterIconeCategoria(registro.tipo, registro.categoria, registro.icone),
      titulo: registro.titulo,
      categoria: registro.categoria,
      categoriaLabel: this.formatarNomeCategoria(registro.categoria),
      valor: `${entrada ? '+' : '-'} ${this.formatarReal(registro.valor)}`,
      valorNumero: registro.valor,
      data: this.formatarDataCurta(registro.data_movimentacao),
      dataMovimentacao: registro.data_movimentacao,
      descricao: registro.descricao ?? '',
      tipo: registro.tipo,
      tipoLabel: entrada ? 'Entrada' : 'Saída',
      parcela:
        registro.parcela_numero && registro.total_parcelas
          ? `Parcela ${registro.parcela_numero}/${registro.total_parcelas}`
          : undefined,
      parcelamentoId: registro.parcelamento_id,
      parcelaNumero: registro.parcela_numero,
      totalParcelas: registro.total_parcelas,
    };
  }

  private aplicarMetaPrincipal(meta: MetaEconomia | null): void {
    if (!meta) {
      this.progressoEconomia = 0;
      this.textoMetaXicara = 'Sem meta';
      this.textoResumoEconomia = 'Crie uma meta de economia para acompanhar seu progresso na xicara.';
      return;
    }

    this.progressoEconomia = Math.max(0, Math.min(100, Math.round(meta.percentual)));
    this.textoMetaXicara = meta.nome;
    this.textoResumoEconomia = `${this.formatarReal(meta.valor_atual)} guardados de ${this.formatarReal(meta.valor_meta)} em ${meta.nome}.`;
  }

  private agruparTransacoesPorMes(movimentacoes: MovimentacaoItem[]): GrupoTransacoesMes[] {
    const grupos = new Map<
      string,
      {
        chave: string;
        mes: string;
        entradas: number;
        saidas: number;
        faturaParcelada: number;
        categorias: Map<string, number>;
        dias: Map<string, { dia: string; entradas: number; saidas: number }>;
        transacoes: RegistroRecente[];
      }
    >();

    movimentacoes.forEach((movimentacao) => {
      const chave = movimentacao.data_movimentacao.slice(0, 7);
      const grupoExistente =
        grupos.get(chave) ??
        {
          chave,
          mes: this.formatarMesAno(movimentacao.data_movimentacao),
          entradas: 0,
          saidas: 0,
          faturaParcelada: 0,
          categorias: new Map<string, number>(),
          dias: new Map<string, { dia: string; entradas: number; saidas: number }>(),
          transacoes: [],
        };
      const diaChave = movimentacao.data_movimentacao;
      const diaExistente =
        grupoExistente.dias.get(diaChave) ??
        {
          dia: this.formatarDataCurta(movimentacao.data_movimentacao),
          entradas: 0,
          saidas: 0,
        };

      if (movimentacao.tipo === 'entrada') {
        grupoExistente.entradas += movimentacao.valor;
        diaExistente.entradas += movimentacao.valor;
      } else {
        grupoExistente.saidas += movimentacao.valor;
        diaExistente.saidas += movimentacao.valor;
        if (movimentacao.parcelamento_id) {
          grupoExistente.faturaParcelada += movimentacao.valor;
        }
        const categoria = this.formatarNomeCategoria(movimentacao.categoria);
        grupoExistente.categorias.set(categoria, (grupoExistente.categorias.get(categoria) ?? 0) + movimentacao.valor);
      }

      grupoExistente.dias.set(diaChave, diaExistente);
      grupoExistente.transacoes.push(this.formatarRegistroTela(movimentacao));
      grupos.set(chave, grupoExistente);
    });

    return Array.from(grupos.values()).sort((grupoA, grupoB) => grupoB.chave.localeCompare(grupoA.chave)).map((grupo) => {
      let saldoAcumulado = 0;
      const dias = Array.from(grupo.dias.entries())
        .sort(([dataA], [dataB]) => dataA.localeCompare(dataB))
        .map(([, dia]) => {
          saldoAcumulado += dia.entradas - dia.saidas;

          return {
            dia: dia.dia,
            entradas: dia.entradas,
            saidas: dia.saidas,
            saldo: saldoAcumulado,
          };
        });
      const gastosPorCategoria = Array.from(grupo.categorias.entries())
        .sort(([, valorA], [, valorB]) => valorB - valorA)
        .map(([nome, valor]) => ({
          nome,
          percentual: grupo.saidas > 0 ? Math.round((valor / grupo.saidas) * 100) : 0,
          valor: this.formatarReal(valor),
          valorNumero: valor,
        }));
      const saldo = grupo.entradas - grupo.saidas;

      return {
        chave: grupo.chave,
        mes: grupo.mes,
        totalEntradas: this.formatarReal(grupo.entradas),
        totalSaidas: this.formatarReal(grupo.saidas),
        saldo: this.formatarReal(saldo),
        faturaParcelada: this.formatarReal(grupo.faturaParcelada),
        totalEntradasNumero: grupo.entradas,
        totalSaidasNumero: grupo.saidas,
        saldoNumero: saldo,
        faturaParceladaNumero: grupo.faturaParcelada,
        saldoNegativo: saldo < 0,
        gastosPorCategoria,
        dias,
        transacoes: grupo.transacoes,
      };
    });
  }

  private criarGrupoMesVazio(chave: string): GrupoTransacoesMes {
    const dataBase = `${chave}-01`;

    return {
      chave,
      mes: this.formatarMesAno(dataBase),
      totalEntradas: this.formatarReal(0),
      totalSaidas: this.formatarReal(0),
      saldo: this.formatarReal(0),
      faturaParcelada: this.formatarReal(0),
      totalEntradasNumero: 0,
      totalSaidasNumero: 0,
      saldoNumero: 0,
      faturaParceladaNumero: 0,
      saldoNegativo: false,
      gastosPorCategoria: [],
      dias: [],
      transacoes: [],
    };
  }

  private chaveMesAtual(): string {
    return this.hoje.slice(0, 7);
  }

  private obterIconeCategoria(tipo: TipoMovimentacao, categoria: string, iconeRecebido?: string): string {
    const categorias =
      tipo === 'entrada'
        ? this.categoriasEntrada
        : [...this.categoriasSaida.filter((item) => !item.acao), ...this.categoriasExtrasSaida.filter((item) => !item.acao)];

    const categoriaEncontrada = categorias.find((item) => this.normalizarTexto(item.nome) === this.normalizarTexto(categoria));

    if (categoriaEncontrada?.nome === 'Outro') {
      return '&#10067;';
    }

    if (categoriaEncontrada?.icone) {
      return categoriaEncontrada.icone;
    }

    const iconeDoBanco = (iconeRecebido ?? '').trim();

    if (this.iconeValido(iconeDoBanco)) {
      return iconeDoBanco;
    }

    return tipo === 'entrada' ? '&#128176;' : '&#128179;';
  }

  private iconeValido(icone: string): boolean {
    return Boolean(icone && icone !== '...' && icone !== '+' && icone !== '-' && icone !== '?' && icone !== '??');
  }

  private normalizarTexto(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private formatarNomeCategoria(categoria: string): string {
    const nomes: Record<string, string> = {
      Alimentacao: 'Alimentação',
      Educacao: 'Educação',
      Salario: 'Salário',
      Saude: 'Saúde',
    };

    return nomes[categoria] ?? categoria;
  }

  private formatarDataCurta(data: string): string {
    return this.criarDataLocal(data)
      .toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
      })
      .replace('.', '');
  }

  private formatarMesAno(data: string): string {
    const dataLocal = this.criarDataLocal(data);
    const mes = dataLocal.toLocaleDateString('pt-BR', {
      month: 'long',
    });
    const mesFormatado = mes.charAt(0).toUpperCase() + mes.slice(1);

    return `${mesFormatado}/${dataLocal.getFullYear()}`;
  }

  private criarDataLocal(data: string): Date {
    return new Date(`${data}T00:00:00`);
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
