import { NgFor, NgIf } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService, MovimentacaoItem } from '../../services/auth.service';

type TipoMovimentacao = 'saida' | 'entrada';

interface CategoriaOpcao {
  nome: string;
  icone: string;
  acao?: 'expandir' | 'recolher';
}

interface RegistroRecente {
  icone: string;
  titulo: string;
  categoria: string;
  valor: string;
  data: string;
  tipo: TipoMovimentacao;
  tipoLabel: string;
}

interface GastoCategoria {
  nome: string;
  percentual: number;
  valor: string;
}

interface GrupoTransacoesMes {
  chave: string;
  mes: string;
  totalEntradas: string;
  totalSaidas: string;
  saldo: string;
  saldoNegativo: boolean;
  transacoes: RegistroRecente[];
}

@Component({
  selector: 'app-home',
  imports: [NgFor, NgIf, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  hoje = this.formatarData(new Date());
  dataRegistro = this.hoje;
  valorRegistro = '';
  descricaoRegistro = '';
  mensagemRegistro = '';
  mensagemTransacoes = '';
  registroComErro = false;
  carregandoRegistro = false;
  carregandoTransacoes = false;
  resumoCarregado = false;
  mostrandoTransacoes = false;
  mesAberto: string | null = null;
  nomeUsuario = this.obterNomeUsuario();
  tipoMovimentacao: TipoMovimentacao = 'entrada';
  categoriaSelecionada = 'Salario';
  mostrarCategoriasExtrasSaida = false;
  saldoTotal = 'R$ 0,00';
  totalEntradas = 'R$ 0,00';
  totalSaidas = 'R$ 0,00';
  saldoNegativo = false;

  registrosRecentes: RegistroRecente[] = [];
  gastosPorCategoria: GastoCategoria[] = [];
  transacoesPorMes: GrupoTransacoesMes[] = [];

  categoriasSaida: CategoriaOpcao[] = [
    { nome: 'Mercado', icone: '&#128722;' },
    { nome: 'Alimentacao', icone: '&#127860;' },
    { nome: 'Transporte', icone: '&#128652;' },
    { nome: 'Aluguel', icone: '&#127968;' },
    { nome: 'Contas', icone: '&#128161;' },
    { nome: 'Saude', icone: '&#128138;' },
    { nome: 'Lazer', icone: '&#127918;' },
    { nome: 'Mais', icone: '+', acao: 'expandir' },
  ];

  categoriasExtrasSaida: CategoriaOpcao[] = [
    { nome: 'Educacao', icone: '&#127891;' },
    { nome: 'Assinaturas', icone: '&#128240;' },
    { nome: 'Investimentos', icone: '&#128201;' },
    { nome: 'Economia', icone: '&#128176;' },
    { nome: 'Imprevistos', icone: '&#9888;' },
    { nome: 'Outro', icone: '...' },
    { nome: 'Menos', icone: '-', acao: 'recolher' },
  ];

  categoriasEntrada: CategoriaOpcao[] = [
    { nome: 'Salario', icone: '&#128188;' },
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
    this.carregarResumo();
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

    return this.tipoMovimentacao === 'saida' ? 'Salvar saida' : 'Salvar entrada';
  }

  get dicaRegistro(): string {
    return this.tipoMovimentacao === 'saida'
      ? 'Anote este gasto para acompanhar melhor seu saldo.'
      : 'Anote o dinheiro recebido para atualizar suas entradas.';
  }

  selecionarTipo(tipo: TipoMovimentacao): void {
    this.tipoMovimentacao = tipo;
    this.mostrarCategoriasExtrasSaida = false;
    this.categoriaSelecionada = this.categoriasAtuais[0].nome;
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
    this.descricaoRegistro = (event.target as HTMLTextAreaElement).value;
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

    this.authService
      .salvarMovimentacao({
        tipo: this.tipoMovimentacao,
        valor: this.valorRegistro,
        data_movimentacao: this.dataRegistro,
        categoria: this.categoriaSelecionada,
        descricao: this.descricaoRegistro.trim(),
      })
      .subscribe({
        next: (resposta) => {
          this.carregandoRegistro = false;
          this.exibirMensagemRegistro(resposta.message || 'Registro salvo com sucesso.', false);
          this.valorRegistro = '';
          this.descricaoRegistro = '';
          this.dataRegistro = this.hoje;
          this.atualizarTela();
          this.carregarResumo();
          if (this.mostrandoTransacoes) {
            this.carregarTransacoes();
          }
        },
        error: (erro) => {
          this.carregandoRegistro = false;
          this.exibirMensagemRegistro(erro.error?.message ?? 'Nao foi possivel salvar o registro.', true);
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
        this.saldoTotal = this.formatarReal(dashboard.saldo);
        this.totalEntradas = this.formatarReal(dashboard.total_entradas);
        this.totalSaidas = this.formatarReal(dashboard.total_saidas);
        this.saldoNegativo = dashboard.saldo < 0;
        this.registrosRecentes = dashboard.registros_recentes.slice(0, 4).map((registro) => this.formatarRegistroTela(registro));
        this.gastosPorCategoria = dashboard.gastos_por_categoria.map((gasto) => ({
          nome: gasto.nome,
          percentual: gasto.percentual,
          valor: this.formatarReal(gasto.total),
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

  private carregarTransacoes(): void {
    this.carregandoTransacoes = true;
    this.mensagemTransacoes = '';

    this.authService.listarMovimentacoes().subscribe({
      next: (resposta) => {
        this.transacoesPorMes = this.agruparTransacoesPorMes(resposta.movimentacoes);
        this.mesAberto = null;
        this.carregandoTransacoes = false;
        this.atualizarTela();
      },
      error: () => {
        this.carregandoTransacoes = false;
        this.mensagemTransacoes = 'Nao foi possivel carregar todas as transacoes.';
        this.atualizarTela();
      },
    });
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

  private formatarRegistroTela(registro: MovimentacaoItem): RegistroRecente {
    const entrada = registro.tipo === 'entrada';

    return {
      icone: this.obterIconeCategoria(registro.tipo, registro.categoria, registro.icone),
      titulo: registro.titulo,
      categoria: registro.categoria,
      valor: `${entrada ? '+' : '-'} ${this.formatarReal(registro.valor)}`,
      data: this.formatarDataCurta(registro.data_movimentacao),
      tipo: registro.tipo,
      tipoLabel: entrada ? 'Entrada' : 'Saida',
    };
  }

  private agruparTransacoesPorMes(movimentacoes: MovimentacaoItem[]): GrupoTransacoesMes[] {
    const grupos = new Map<string, { chave: string; mes: string; entradas: number; saidas: number; transacoes: RegistroRecente[] }>();

    movimentacoes.forEach((movimentacao) => {
      const chave = movimentacao.data_movimentacao.slice(0, 7);
      const grupoExistente =
        grupos.get(chave) ??
        {
          chave,
          mes: this.formatarMesAno(movimentacao.data_movimentacao),
          entradas: 0,
          saidas: 0,
          transacoes: [],
        };

      if (movimentacao.tipo === 'entrada') {
        grupoExistente.entradas += movimentacao.valor;
      } else {
        grupoExistente.saidas += movimentacao.valor;
      }

      grupoExistente.transacoes.push(this.formatarRegistroTela(movimentacao));
      grupos.set(chave, grupoExistente);
    });

    return Array.from(grupos.values()).map((grupo) => ({
      chave: grupo.chave,
      mes: grupo.mes,
      totalEntradas: this.formatarReal(grupo.entradas),
      totalSaidas: this.formatarReal(grupo.saidas),
      saldo: this.formatarReal(grupo.entradas - grupo.saidas),
      saldoNegativo: grupo.entradas - grupo.saidas < 0,
      transacoes: grupo.transacoes,
    }));
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
