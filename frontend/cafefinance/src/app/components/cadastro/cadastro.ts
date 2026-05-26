import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { AuthService, CadastroRequest } from '../../services/auth.service';

@Component({
  selector: 'app-cadastro',
  imports: [ReactiveFormsModule],
  templateUrl: './cadastro.html',
  styleUrl: './cadastro.css',
})
export class Cadastro {
  mensagem = '';
  carregando = false;

  cadastroForm = new FormGroup({
    name: new FormControl(''),
    email: new FormControl(''),
    password: new FormControl(''),
    confirmarSenha: new FormControl(''),
  });

  cadastro() {
    this.mensagem = '';

    const dados = this.cadastroForm.getRawValue() as CadastroRequest;

    if (!dados.name || !dados.email || !dados.password || !dados.confirmarSenha) {
      this.mensagem = 'Preencha todos os campos.';
      return;
    }

    if (dados.password !== dados.confirmarSenha) {
      this.mensagem = 'As senhas precisam ser iguais.';
      return;
    }

    this.carregando = true;

    this.authService.registrar(dados).subscribe({
      next: (resposta) => {
        this.carregando = false;
        this.mensagem = resposta.message;

        if (resposta.success) {
          this.cadastroForm.reset();
        }
      },
      error: (erro) => {
        this.carregando = false;
        this.mensagem = erro.error?.message ?? 'Nao foi possivel cadastrar.';
      },
    });
  }

  private readonly authService = inject(AuthService);
}
