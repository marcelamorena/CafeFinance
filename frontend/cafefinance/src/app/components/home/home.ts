import { Component, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

type TipoMovimentacao = 'saida' | 'entrada';

interface CategoriaOpcao {
  nome: string;
  icone: string;
  acao?: 'expandir' | 'recolher';
}

@Component({
  selector: 'app-home',
  imports: [NgFor, NgIf, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private router = inject(Router);

  hoje = this.formatarData(new Date());
  valorRegistro = '';
  nomeUsuario = this.obterNomeUsuario();
  tipoMovimentacao: TipoMovimentacao = 'saida';
  categoriaSelecionada = 'Mercado';
  mostrarCategoriasExtrasSaida = false;
  saldoTotal = 'R$ 1.720,00';
  totalEntradas = 'R$ 3.200,00';
  totalSaidas = 'R$ 1.480,00';

  registrosRecentes = [
    { icone: '&#128722;', titulo: 'Mercado', categoria: 'Alimentação', valor: '- R$ 186,40' },
    { icone: '&#128188;', titulo: 'Salário', categoria: 'Entrada', valor: '+ R$ 3.200,00' },
    { icone: '&#128652;', titulo: 'Combustível', categoria: 'Transporte', valor: '- R$ 120,00' },
  ];

  gastosPorCategoria = [
    { nome: 'Alimentação', percentual: 68, valor: 'R$ 520,00' },
    { nome: 'Transporte', percentual: 44, valor: 'R$ 310,00' },
    { nome: 'Lazer', percentual: 30, valor: 'R$ 180,00' },
  ];

  categoriasSaida: CategoriaOpcao[] = [
    { nome: 'Mercado', icone: '&#128722;' },
    { nome: 'Alimenta\u00e7\u00e3o', icone: '&#127860;' },
    { nome: 'Transporte', icone: '&#128652;' },
    { nome: 'Aluguel', icone: '&#127968;' },
    { nome: 'Contas', icone: '&#128161;' },
    { nome: 'Sa\u00fade', icone: '&#128138;' },
    { nome: 'Lazer', icone: '&#127918;' },
    { nome: 'Mais', icone: '+', acao: 'expandir' },
  ];

  categoriasExtrasSaida: CategoriaOpcao[] = [
    { nome: 'Educa\u00e7\u00e3o', icone: '&#127891;' },
    { nome: 'Assinaturas', icone: '&#128240;' },
    { nome: 'Investimentos', icone: '&#128201;' },
    { nome: 'Economia', icone: '&#128176;' },
    { nome: 'Imprevistos', icone: '&#9888;' },
    { nome: 'Outro', icone: '...' },
    { nome: 'Menos', icone: '-', acao: 'recolher' },
  ];

  categoriasEntrada: CategoriaOpcao[] = [
    { nome: 'Sal\u00e1rio', icone: '&#128188;' },
    { nome: 'Freelance', icone: '&#128187;' },
    { nome: 'Pix', icone: '&#128179;' },
    { nome: 'Reembolso', icone: '&#128260;' },
    { nome: 'Rendimento', icone: '&#128200;' },
    { nome: 'Presente', icone: '&#127873;' },
    { nome: 'Venda', icone: '&#128176;' },
    { nome: 'Outro', icone: '...' },
  ];

  get categoriasAtuais(): CategoriaOpcao[] {
    if (this.tipoMovimentacao === 'entrada') {
      return this.categoriasEntrada;
    }

    return this.mostrarCategoriasExtrasSaida
      ? [...this.categoriasSaida.filter((categoria) => categoria.acao !== 'expandir'), ...this.categoriasExtrasSaida]
      : this.categoriasSaida;
  }

  get textoBotaoSalvar(): string {
    return this.tipoMovimentacao === 'saida' ? 'Salvar sa\u00edda' : 'Salvar entrada';
  }

  get dicaRegistro(): string {
    return this.tipoMovimentacao === 'saida'
      ? 'Registre suas sa\u00eddas para entender onde seu caf\u00e9 financeiro est\u00e1 esfriando.'
      : 'Registre suas entradas para acompanhar tudo que mant\u00e9m seu caf\u00e9 rendendo.';
  }

  selecionarTipo(tipo: TipoMovimentacao): void {
    this.tipoMovimentacao = tipo;
    this.mostrarCategoriasExtrasSaida = false;
    this.categoriaSelecionada = this.categoriasAtuais[0].nome;
  }

  selecionarCategoria(categoria: CategoriaOpcao): void {
    if (categoria.acao === 'expandir') {
      this.mostrarCategoriasExtrasSaida = true;
      return;
    }

    if (categoria.acao === 'recolher') {
      this.mostrarCategoriasExtrasSaida = false;

      if (!this.categoriasSaida.some((item) => item.nome === this.categoriaSelecionada)) {
        this.categoriaSelecionada = this.categoriasSaida[0].nome;
      }

      return;
    }

    this.categoriaSelecionada = categoria.nome;
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
  }

  sair(): void {
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
